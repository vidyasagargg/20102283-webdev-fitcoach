/**
 * Coach service. Strategy pattern: the AI coach is tried first when
 * configured, and the rule coach is the fallback. Either way, the safety rules
 * (pain alert, calorie floor) are applied in code after generation, so they
 * cannot be dropped by a model.
 */
import { addDays, diffDays } from '../../utils/dates.js';
import { withDefaults } from '../profileDefaults.js';
import { isRestSession } from '../plan.js';
import { ruleDailyReview, ruleWeeklyReview, summariseDay, painAlert } from './ruleCoach.js';
import { topSetsByExercise } from '../progress.service.js';

export function createCoachService({ repos, dayData, aiCoach = null }) {
  async function saveReview(userId, date, kind, content, source) {
    return repos.reviews.upsert({ userId, date, kind }, { content, source });
  }

  async function daily(user, date) {
    const profile = withDefaults(user.profile);
    const day = await dayData.day(user, date);
    const tomorrow = await dayData.scheduleFor(user, addDays(date, 1));
    const summary = summariseDay({ day, profile, tomorrow });

    let content = ruleDailyReview(summary);
    let source = 'rules';
    if (aiCoach) {
      try {
        const ai = await aiCoach.dailyReview({ ...summary, targets: profile.targets });
        content = { ...content, ...ai };
        source = 'ai';
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') console.warn(`AI coach unavailable, using rules: ${err.message}`);
      }
    }
    // Safety rules always run last
    const alert = painAlert(day.daily);
    if (alert) content.alerts = [alert, ...content.alerts.filter((a) => !a.startsWith('You reported pain'))];
    return saveReview(user.id, date, 'daily', content, source);
  }

  async function weekly(user, weekEnding) {
    const profile = withDefaults(user.profile);
    const from = addDays(weekEnding, -6);
    const prevFrom = addDays(weekEnding, -13);
    const [{ days, measurements }, prev, history] = await Promise.all([
      dayData.range(user.id, from, weekEnding),
      dayData.range(user.id, prevFrom, addDays(from, -1)),
      repos.measurements.find({ userId: user.id, date: { $lte: weekEnding } }, { sort: { date: -1 }, limit: 2 }),
    ]);

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const weights = (ds) => ds.map((d) => d.daily?.weightKg).filter((v) => v != null);
    const skipped = await dayData.skippedDates(user.id);
    const plannedSessions = (
      await Promise.all(days.map((d) => dayData.scheduleFor(user, d.date, d.daily?.dayStatus)))
    ).filter((s) => s.session && !isRestSession(s.session) && s.dayStatus !== 'skipped').length;

    const workouts = days.flatMap((d) => d.workouts);
    const liftNow = topSetsByExercise(workouts);
    const liftBefore = topSetsByExercise(prev.days.flatMap((d) => d.workouts));
    const liftsImproved = Object.keys(liftNow).filter(
      (name) => {
        if (!liftBefore[name]) return false;
        const now = liftNow[name].at(-1);
        const before = liftBefore[name].at(-1);
        return now.assisted ? now.weightKg < before.weightKg : now.weightKg > before.weightKg;
      },
    );
    const proteinDays = days.filter((d) => d.nutrition);

    const stats = {
      weekEnding,
      avgWeight: avg(weights(days)),
      prevAvgWeight: avg(weights(prev.days)),
      waistChangeCm:
        history.length === 2 && history[0].waistCm && history[1].waistCm ? history[0].waistCm - history[1].waistCm : null,
      workouts: workouts.filter((w) => w.exercises.length).length,
      plannedSessions,
      cardioSessions: workouts.filter((w) => (w.cardio ?? []).length).length,
      avgProtein: avg(proteinDays.map((d) => d.nutrition.protein)),
      avgKcal: avg(proteinDays.map((d) => d.nutrition.kcal)),
      avgSteps: avg(days.map((d) => d.daily?.steps).filter((v) => v != null)),
      adherence: { mealsDays: proteinDays.length },
      liftsImproved,
      measurementsThisWeek: measurements.length,
      skippedThisWeek: skipped.filter((d) => diffDays(from, d) >= 0 && diffDays(d, weekEnding) >= 0).length,
    };
    const content = { ...ruleWeeklyReview(stats, profile), stats };
    return saveReview(user.id, weekEnding, 'weekly', content, 'rules');
  }

  return { daily, weekly };
}
