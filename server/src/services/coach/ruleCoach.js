/**
 * Rule-based coach (default strategy). Deterministic, explainable and free.
 * Produces the same review shape as the AI coach:
 *   { headline, feedback[], fixes[], tomorrow: {session, focus}, motivation, alerts[], scores }
 */
import { isRestSession } from '../plan.js';

const MOTIVATION = [
  'Every rep you add load to is muscle you are building while the belly shrinks.',
  'Consistency beats intensity. Show up tomorrow and the scale follows.',
  'You do not need a perfect day, just a better week than last week.',
  'Strong legs, steady protein, early sleep. That is the whole secret.',
  'The waistband will notice before the mirror does. Keep going.',
  'Small wins logged daily become big changes by the end of the month.',
  'Discipline is choosing what you want most over what you want now.',
];

const pick = (list, seed) => list[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length];
const pct = (v, t) => (t ? Math.round((v / t) * 100) : 0);

export function painAlert(daily) {
  if (!daily?.painFlag) return null;
  return `You reported pain or dizziness${daily.painNote ? ` ("${daily.painNote}")` : ''}. Rest today, skip training, and see a doctor before your next session.`;
}

/** Shared numbers both coaches use, so the AI coach is grounded in the same facts. */
export function summariseDay({ day, profile, tomorrow }) {
  const t = profile.targets;
  const n = day.nutrition ?? { kcal: 0, protein: 0, fibre: 0, sugar: 0 };
  const workout = day.workouts[0];
  const workingSets = day.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets.filter((s) => s.type !== 'warmup')));
  const cardioMin = day.workouts.flatMap((w) => w.cardio ?? []).reduce((a, c) => a + (c.minutes || 0), 0);
  return {
    date: day.date,
    session: day.schedule.session,
    dayStatus: day.schedule.dayStatus,
    isRest: day.schedule.isRest,
    trained: day.workouts.length > 0,
    workoutSession: workout?.session ?? null,
    exercises: day.workouts.flatMap((w) => w.exercises.map((e) => e.name)),
    workingSets: workingSets.length,
    cardioMin,
    mealsLogged: day.meals.length,
    dayEatingDone: day.meals.some((m) => ['dinner', 'bedtime'].includes(m.slot)),
    kcal: Math.round(n.kcal),
    protein: Math.round(n.protein),
    fibre: Math.round(n.fibre),
    sugar: Math.round(n.sugar),
    waterMl: day.waterMl,
    steps: day.daily?.steps ?? null,
    sleep: day.daily?.sleepHours ?? null,
    energy: day.daily?.energy ?? null,
    weightKg: day.daily?.weightKg ?? null,
    pain: Boolean(day.daily?.painFlag),
    targets: t,
    minKcal: profile.safety.minKcal,
    tomorrow: { session: tomorrow.session, label: tomorrow.label, focus: tomorrow.focus },
  };
}

export function ruleDailyReview(s) {
  const t = s.targets;
  const feedback = [];
  const fixes = [];
  const alerts = [];

  const pain = s.pain ? painAlert({ painFlag: true }) : null;
  if (pain) alerts.push(pain);

  // Training
  if (s.dayStatus === 'skipped') {
    feedback.push(`${s.session} was skipped, so it moves to tomorrow and the rest of the plan shifts by a day.`);
  } else if (s.dayStatus === 'complete_rest') {
    feedback.push('Complete rest day: recovery is part of the plan, so judge today on food, water and sleep.');
  } else if (s.trained) {
    feedback.push(
      `${s.workoutSession ?? s.session} done: ${s.workingSets} working sets${s.cardioMin ? ` plus ${s.cardioMin} min cardio` : ''}.`,
    );
    if (!s.isRest && s.cardioMin === 0) fixes.push('No cardio logged. Add 15 to 20 minutes of incline walking after lifting; it is your biggest lever for belly fat.');
  } else if (s.isRest) {
    if (s.steps != null && s.steps < t.stepsMin) fixes.push(`Active rest means moving: get a 30-minute walk in (steps were ${s.steps.toLocaleString('en')}).`);
    else feedback.push('Active rest day. A brisk walk and some mobility work keep recovery moving.');
  } else if (s.pain) {
    feedback.push('No training today because of the pain you reported. That is the right call.');
  } else {
    fixes.push(`No ${s.session} workout logged. If you trained, paste your notes in the Gym tab; if not, tap Skip so the plan shifts.`);
  }

  // Nutrition
  if (s.mealsLogged === 0) {
    fixes.push('No meals logged yet. Log each meal as you eat it, because the coach cannot judge what it cannot see.');
  } else {
    feedback.push(`Food: ${s.kcal} kcal (${pct(s.kcal, t.kcal)}% of ${t.kcal}) and ${s.protein} g protein (${pct(s.protein, t.proteinG)}%).`);
    if (s.protein < t.proteinG * 0.85) {
      fixes.push(`Protein is ${t.proteinG - s.protein} g short. Add paneer, tofu, soya chunks, Greek yogurt or a whey scoop to the next meal.`);
    }
    if (s.kcal > t.kcal * 1.1) fixes.push(`Calories ran ${s.kcal - t.kcal} kcal over. Trim oil, sweets or extra rice tomorrow, not protein.`);
    if (s.dayEatingDone && s.kcal < s.minKcal) {
      // only judged once dinner is in, so a half-logged day is not flagged
      alerts.push(`Intake of ${s.kcal} kcal is below your ${s.minKcal} kcal safety floor. Eat a proper meal; under-eating costs muscle.`);
    }
    if (t.fibreG && s.fibre < t.fibreG * 0.6) fixes.push('Fibre is low. Add a salad, sprouts or fruit to keep you full.');
    if (t.sugarMaxG && s.sugar > t.sugarMaxG) fixes.push(`Sugar is ${s.sugar} g, above your ${t.sugarMaxG} g limit. Swap the sweet for fruit or nuts.`);
  }

  // Water, steps, sleep
  if (s.waterMl < t.waterMl * 0.75) fixes.push(`Water is ${(s.waterMl / 1000).toFixed(1)} L of ${(t.waterMl / 1000).toFixed(1)} L. Keep a bottle at your desk during the shift.`);
  else feedback.push(`Hydration on track at ${(s.waterMl / 1000).toFixed(1)} L.`);
  if (s.dayStatus !== 'complete_rest' && s.steps != null && s.steps < t.stepsMin && !s.isRest) {
    fixes.push(`Steps at ${s.steps.toLocaleString('en')}, under ${t.stepsMin.toLocaleString('en')}. A 15-minute walk on your break closes the gap.`);
  }
  if (s.sleep != null && s.sleep < 6.5) fixes.push(`Only ${s.sleep} h sleep. Aim for 7 h: lights out by midnight after your shift.`);
  if (s.energy != null && s.energy <= 2) feedback.push('Energy is low today, so keep tomorrow’s weights the same and focus on clean reps.');

  const tomorrowFocus = pain
    ? 'Rest and get checked by a doctor before training again.'
    : isRestSession(s.tomorrow.session)
      ? 'Walk 30 to 40 minutes, stretch, and hit protein and water targets.'
      : `${s.tomorrow.focus ? `${s.tomorrow.focus} day. ` : ''}Add 2.5 kg wherever you hit the top of the rep range last time.`;

  return {
    headline: pain ? 'Rest first' : fixes.length === 0 ? 'Strong day' : fixes.length <= 2 ? 'Good day, small fixes' : 'Room to tighten up',
    feedback: feedback.slice(0, 4),
    fixes: fixes.slice(0, 4),
    tomorrow: { session: s.tomorrow.label ?? s.tomorrow.session, focus: tomorrowFocus },
    motivation: pick(MOTIVATION, s.date),
    alerts,
    scores: {
      protein: pct(s.protein, t.proteinG),
      calories: pct(s.kcal, t.kcal),
      water: pct(s.waterMl, t.waterMl),
      steps: s.steps != null ? pct(s.steps, t.stepsGoal) : null,
    },
  };
}

/**
 * Weekly review. It adjusts the plan within the user's safety limits:
 * calories never go below safety.minKcal, and weekly loss is kept at or
 * under safety.maxWeeklyLossKg.
 */
export function ruleWeeklyReview(w, profile) {
  const { targets: t, safety } = profile;
  const feedback = [];
  const fixes = [];
  const adjustments = [];
  const alerts = [];
  let newKcal = t.kcal;

  if (w.avgWeight != null && w.prevAvgWeight != null) {
    const change = +(w.avgWeight - w.prevAvgWeight).toFixed(2);
    feedback.push(`Average weight ${w.avgWeight.toFixed(1)} kg, ${change <= 0 ? 'down' : 'up'} ${Math.abs(change).toFixed(2)} kg on last week.`);
    if (-change > safety.maxWeeklyLossKg) {
      newKcal = t.kcal + 150;
      alerts.push(`You lost ${(-change).toFixed(2)} kg, faster than your ${safety.maxWeeklyLossKg} kg/week limit. Calories go up 150 to protect muscle.`);
    } else if (change > -0.2 && w.avgKcal != null && w.avgKcal > t.kcal * 1.1) {
      // Flat weight while eating well above target: the plan is fine, the intake is not
      adjustments.push(
        `Weight is flat because intake averaged ${Math.round(w.avgKcal)} kcal against your ${t.kcal} kcal target. No change to the plan: hit the target first.`,
      );
    } else if (change > -0.2 && w.adherence.mealsDays >= 5) {
      const proposed = t.kcal - 100;
      if (proposed >= safety.minKcal) {
        newKcal = proposed;
        adjustments.push(`Weight is flat. Calories drop 100 to ${proposed} kcal, still above your ${safety.minKcal} kcal floor.`);
      } else {
        adjustments.push(`Weight is flat, but calories are already near your ${safety.minKcal} kcal floor. Add 2,000 daily steps instead of eating less.`);
      }
    } else if (change <= -0.2) {
      feedback.push('That is a healthy rate of loss. Keep the plan exactly as it is.');
    }
  } else {
    feedback.push('Log your weight at least 3 mornings a week so I can compare weekly averages.');
  }

  if (w.waistChangeCm != null) {
    feedback.push(`Waist ${w.waistChangeCm <= 0 ? 'down' : 'up'} ${Math.abs(w.waistChangeCm).toFixed(1)} cm (${(Math.abs(w.waistChangeCm) / 2.54).toFixed(1)} in) since the previous measurement.`);
  } else fixes.push('Take tape measurements this Saturday (waist and belly) so we can track fat loss beyond the scale.');

  feedback.push(`${w.workouts} of ${w.plannedSessions} planned lifting sessions done; cardio on ${w.cardioSessions} days.`);
  if (w.workouts < w.plannedSessions) fixes.push(`${w.plannedSessions - w.workouts} session(s) missed. Lock in your gym time before your 2 PM shift.`);
  if (w.cardioSessions < Math.min(4, w.workouts)) fixes.push('Add cardio after at least 4 sessions next week.');
  if (w.avgProtein != null && w.avgProtein < t.proteinG * 0.9) fixes.push(`Protein averaged ${Math.round(w.avgProtein)} g against ${t.proteinG} g. Plan a protein source for every meal.`);
  if (w.liftsImproved.length) feedback.push(`Load went up on: ${w.liftsImproved.slice(0, 4).join(', ')}.`);
  else if (w.workouts) fixes.push('No lift went up in weight this week. When you hit the top of the rep range on every set, add 2.5 kg.');

  return {
    headline: alerts.length ? 'Adjusting for safety' : fixes.length <= 1 ? 'Great week' : 'Solid base, tighten up',
    feedback: feedback.slice(0, 5),
    fixes: fixes.slice(0, 4),
    adjustments,
    newTargets: newKcal !== t.kcal ? { kcal: newKcal } : null,
    motivation: pick(MOTIVATION, w.weekEnding),
    alerts,
  };
}
