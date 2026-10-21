/**
 * Sensible defaults so a brand-new account works immediately. They are
 * merged under whatever the user has saved, so saved values always win.
 */
import { DEFAULT_CYCLE } from './plan.js';

export const DEFAULT_PROFILE = {
  dietNotes: '',
  baseline: {},
  goals: {},
  targets: {
    kcal: 1900,
    proteinG: 130,
    carbsG: 200,
    fatG: 60,
    fibreG: 30,
    sugarMaxG: 40,
    waterMl: 3000,
    stepsMin: 8000,
    stepsGoal: 10000,
    sleepHours: 7,
  },
  safety: { minKcal: 1700, maxWeeklyLossKg: 1 },
  schedule: { cycleStart: null, cycle: DEFAULT_CYCLE },
  reminders: [
    { label: 'Pre-workout snack', time: '06:30' },
    { label: 'Time to train', time: '07:00' },
    { label: 'Post-workout breakfast', time: '09:00' },
    { label: 'Water check', time: '11:00' },
    { label: 'Lunch before shift', time: '13:15' },
    { label: 'Shift snack and water', time: '17:00' },
    { label: 'Dinner', time: '19:30' },
    { label: 'Log your day', time: '22:15' },
  ],
  onboarded: false,
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function merge(base, over) {
  if (!isObj(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    if (v === null) {
      delete out[k]; // explicit null clears a saved value
      continue;
    }
    out[k] = isObj(v) && isObj(base?.[k]) ? merge(base[k], v) : v;
  }
  return out;
}

export const withDefaults = (profile = {}) => merge(DEFAULT_PROFILE, profile ?? {});
export const mergeProfile = merge;
