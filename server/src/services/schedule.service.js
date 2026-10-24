/**
 * Training-cycle scheduling.
 *
 * The plan is a repeating cycle (default 8 days: Legs 1 … Pull 2, Active rest).
 * Skipping a lifting day pushes that session, and every later one, back by
 * one day. That way the plan is never silently lost:
 *
 *   index(date) = (daysSince(cycleStart) - skippedDaysBefore(date)) mod cycleLength
 *
 * A "complete rest" swaps an Active-rest day for full rest and does not
 * shift anything. There is no end date: the cycle repeats indefinitely.
 */
import { diffDays, addDays } from '../utils/dates.js';
import { DEFAULT_CYCLE, isRestSession, sessionPlan } from './plan.js';

export function sessionFor(date, { cycleStart, cycle = DEFAULT_CYCLE, skippedDates = [] }) {
  if (!cycleStart || date < cycleStart) return { session: null, beforePlan: true };
  const skipsBefore = skippedDates.filter((d) => d >= cycleStart && d < date).length;
  const offset = diffDays(cycleStart, date) - skipsBefore;
  const index = ((offset % cycle.length) + cycle.length) % cycle.length;
  const cycleNumber = Math.floor(offset / cycle.length) + 1;
  return { session: cycle[index], index, cycleNumber, beforePlan: false };
}

/** Build a day card: planned session plus the effect of the day's status. */
export function describeDay(date, { schedule, dayStatus = 'normal', skippedDates = [] }) {
  const base = sessionFor(date, { ...schedule, skippedDates });
  const isRest = isRestSession(base.session);
  const plan = sessionPlan(base.session);
  let label = base.session ?? 'No plan yet';
  let next = null;

  if (dayStatus === 'skipped') {
    label = `${base.session} skipped`;
    next = sessionFor(addDays(date, 1), { ...schedule, skippedDates }).session;
  } else if (dayStatus === 'complete_rest') {
    label = 'Complete rest';
  }

  return {
    date,
    session: base.session,
    label,
    cycleNumber: base.cycleNumber ?? null,
    dayStatus,
    isRest,
    canSkip: !base.beforePlan && !isRest,
    canCompleteRest: !base.beforePlan && isRest,
    nextSession: next,
    focus: dayStatus === 'complete_rest' ? 'Full recovery: eat on plan, hydrate, sleep' : plan.focus,
    cardio: dayStatus === 'complete_rest' ? null : plan.cardio,
    exercises: dayStatus === 'normal' ? plan.exercises : [],
  };
}

/** Upcoming sessions for a calendar strip. */
export function upcoming(from, days, { schedule, skippedDates = [] }) {
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return { date: d, session: sessionFor(d, { ...schedule, skippedDates }).session };
  });
}
