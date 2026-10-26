/**
 * Progress analytics over any date range. Nothing is tied to a fixed end
 * date: charts, averages and projections are computed from whatever range the
 * user picks, so the app keeps working indefinitely.
 */
import { addDays, diffDays } from '../utils/dates.js';
import { withDefaults } from './profileDefaults.js';

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

/** Epley estimated one-rep max. */
export const e1rm = (w, r) => (w && r ? w * (1 + r / 30) : 0);

/** For each exercise, the heaviest working set per session date. */
export function topSetsByExercise(workouts) {
  const out = {};
  for (const w of workouts) {
    for (const ex of w.exercises ?? []) {
      const working = (ex.sets ?? []).filter((s) => s.type !== 'warmup' && s.weightKg != null);
      if (!working.length) continue;
      // Assisted machines (e.g. assisted pull-up): the best set is the one with the LEAST assistance
      const assisted = working.some((s) => s.assisted) || /assisted/i.test(ex.name);
      const better = (a, b) => (assisted ? b.weightKg < a.weightKg : b.weightKg > a.weightKg) || (b.weightKg === a.weightKg && b.reps > a.reps);
      const top = working.reduce((a, b) => (better(a, b) ? b : a));
      (out[ex.name] ??= []).push({
        date: w.date,
        weightKg: top.weightKg,
        reps: top.reps,
        perSide: Boolean(ex.perSide),
        assisted,
        e1rm: round(e1rm(top.weightKg, top.reps)),
        volume: Math.round(working.reduce((a, s) => a + (s.weightKg || 0) * (s.reps || 0), 0)),
      });
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

/** Least-squares slope (kg/day) of the weight points. */
function slope(points) {
  if (points.length < 5) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const mx = avg(xs);
  const my = avg(ys);
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? num / den : null;
}

export function createProgressService({ repos, dayData }) {
  async function summary(user, from, to) {
    const profile = withDefaults(user.profile);
    // Look back 6 extra days so the 7-day average is correct from the first day shown
    const { days } = await dayData.range(user.id, addDays(from, -6), to);
    const [allMeasurements, workouts, firstWeight] = await Promise.all([
      repos.measurements.find({ userId: user.id }, { sort: { date: 1 } }),
      repos.workouts.find({ userId: user.id, date: { $gte: from, $lte: to } }, { sort: { date: 1 } }),
      repos.daily.find({ userId: user.id, weightKg: { $gte: 0 } }, { sort: { date: 1 }, limit: 1 }),
    ]);

    const weight = [];
    days.forEach((d, i) => {
      if (d.date < from) return;
      const window = days.slice(Math.max(0, i - 6), i + 1).map((x) => x.daily?.weightKg).filter((v) => v != null);
      weight.push({ date: d.date, weightKg: d.daily?.weightKg ?? null, avg7: window.length ? round(avg(window), 2) : null });
    });

    const shown = days.filter((d) => d.date >= from);
    const nutrition = shown.map((d) => ({
      date: d.date,
      kcal: d.nutrition ? Math.round(d.nutrition.kcal) : null,
      protein: d.nutrition ? Math.round(d.nutrition.protein) : null,
      carbs: d.nutrition ? Math.round(d.nutrition.carbs) : null,
      fat: d.nutrition ? Math.round(d.nutrition.fat) : null,
      fibre: d.nutrition ? Math.round(d.nutrition.fibre) : null,
      sugar: d.nutrition ? Math.round(d.nutrition.sugar) : null,
      waterMl: d.waterMl || null,
      steps: d.daily?.steps ?? null,
      sleep: d.daily?.sleepHours ?? null,
    }));
    const logged = (key) => nutrition.map((n) => n[key]).filter((v) => v != null);

    // Projection: when will the 7-day average reach the goal at the current rate?
    const recent = weight.filter((w) => w.weightKg != null).slice(-28);
    const kgPerDay = slope(recent.map((w) => ({ x: diffDays(from, w.date), y: w.weightKg })));
    const latestAvg = [...weight].reverse().find((w) => w.avg7 != null)?.avg7 ?? null;
    const goal = profile.goals.targetWeightMaxKg ?? profile.goals.longTermWeightKg ?? null;
    let projection = null;
    if (kgPerDay != null && latestAvg != null) {
      projection = { kgPerWeek: round(kgPerDay * 7, 2) };
      // Only project when the trend is a real loss (at least 0.1 kg a week) and the date is within a year
      const daysToGoal = kgPerDay < 0 ? Math.ceil((latestAvg - goal) / -kgPerDay) : Infinity;
      if (goal && kgPerDay * 7 <= -0.1 && latestAvg > goal && daysToGoal <= 365) {
        projection.goalKg = goal;
        projection.goalDate = addDays(to, daysToGoal);
      }
    }

    // Streak: consecutive days up to `to` with any activity logged
    let streak = 0;
    for (let i = shown.length - 1; i >= 0; i--) {
      const d = shown[i];
      const active = d.workouts.length || d.meals.length || d.waterEntries || d.daily;
      if (active) streak += 1;
      else if (i !== shown.length - 1) break;
    }

    const baseline = allMeasurements[0] ?? null;
    return {
      range: { from, to },
      targets: profile.targets,
      goals: profile.goals,
      baseline: { ...profile.baseline, firstWeighIn: firstWeight[0] ?? null },
      weight,
      latestAvgWeight: latestAvg,
      projection,
      nutrition,
      averages: {
        kcal: round(avg(logged('kcal')), 0),
        protein: round(avg(logged('protein')), 0),
        fibre: round(avg(logged('fibre')), 0),
        sugar: round(avg(logged('sugar')), 0),
        waterMl: round(avg(logged('waterMl')), 0),
        steps: round(avg(logged('steps')), 0),
        sleep: round(avg(logged('sleep')), 1),
      },
      counts: {
        workouts: workouts.filter((w) => w.exercises.length).length,
        cardioSessions: workouts.filter((w) => w.cardio?.length).length,
        daysLogged: shown.filter((d) => d.meals.length || d.daily || d.waterEntries || d.workouts.length).length,
        days: shown.length,
      },
      streak,
      lifts: topSetsByExercise(workouts),
      workouts: workouts
        .map((w) => ({
          id: w.id,
          date: w.date,
          session: w.session,
          exercises: w.exercises.length,
          sets: w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup').length, 0),
          cardioMin: (w.cardio ?? []).reduce((a, c) => a + (c.minutes || 0), 0),
        }))
        .reverse(),
      measurements: { baseline, entries: allMeasurements },
    };
  }

  return { summary };
}
