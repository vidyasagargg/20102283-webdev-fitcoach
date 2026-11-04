/**
 * Demo and test accounts with realistic history, for the presentation and for
 * trying the app without typing weeks of data. Each persona is built to show
 * different features. All passwords: DemoPass123
 *
 *   demo@fitcoach.app   Charan: steady progress, good adherence (the main demo)
 *   priya@fitcoach.app  Priya: losing weight too fast on too little food,
 *                       so the safety rules raise calories and flag protein
 *   arjun@fitcoach.app  Arjun: inconsistent: skipped days shift his plan,
 *                       complete-rest days, a pain report, weight flat
 *   admin@fitcoach.app  Admin: role-based access (aggregate stats only)
 */
import bcrypt from 'bcryptjs';
import { addDays, todayIso, weekday } from '../utils/dates.js';
import { sessionFor } from '../services/schedule.service.js';
import { PLAN, DEFAULT_CYCLE, PER_SIDE_EXERCISES, isRestSession } from '../services/plan.js';
import { createNutritionService } from '../services/nutrition/index.js';
import { createDayDataService } from '../services/dayData.service.js';
import { createCoachService } from '../services/coach/index.js';

export const DEMO_EMAIL = 'demo@fitcoach.app';
export const DEMO_PASSWORD = 'DemoPass123';

// Deterministic pseudo-random numbers so the demo data is the same every time
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const PERSONAS = [
  {
    name: 'Charan',
    email: DEMO_EMAIL,
    days: 42,
    seed: 42,
    profile: {
      age: 27,
      heightCm: 160,
      dietNotes: 'Vegetarian. No bread, no brinjal.',
      baseline: { weightKg: 72.35, bodyFatPct: 28.2, waistCm: 85.1, bellyCm: 88.9 },
      goals: { targetWeightMinKg: 69.5, targetWeightMaxKg: 70.5, targetWaistMinCm: 82, targetWaistMaxCm: 83, longTermBodyFatPct: 17, longTermWeightKg: 65.5 },
    },
    goalWeeks: 8,
    weight: (i, r) => 72.35 - i * 0.075 + (r() - 0.5) * 0.6,
    loads: { perSide: 10, other: 15 },
    workoutChance: 0.9,
    cardioChance: 0.65,
    meals: [
      ['pre-workout', '06:30', '1 banana and 5 almonds'],
      ['breakfast', '09:00', '1 scoop whey, oats 40g and milk 200ml'],
      ['lunch', '13:15', '3 rotis, 1 bowl dal, 100 g paneer bhurji and salad'],
      ['snack', '17:00', 'roasted chana 30g and buttermilk'],
      ['dinner', '20:30', '1 bowl rice, 1 bowl rajma, 150 g curd'],
    ],
    treat: [0.3, ['other', '18:30', '1 samosa and chai']],
    glasses: [9, 13],
    steps: [6500, 12500],
    sleep: [6, 7.5],
    measure: { waistCm: [85.1, -0.55], bellyCm: [88.9, -0.6], hipsCm: [96, -0.3], chestCm: [94, 0.1], bicepsCm: [30, 0.08], thighsCm: [55, -0.1] },
  },
  {
    name: 'Priya',
    email: 'priya@fitcoach.app',
    days: 28,
    seed: 7,
    profile: {
      age: 24,
      heightCm: 165,
      dietNotes: 'Vegetarian. Wants fast results before a wedding.',
      baseline: { weightKg: 66, bodyFatPct: 31, waistCm: 80, bellyCm: 84 },
      goals: { targetWeightMinKg: 61, targetWeightMaxKg: 62, targetWaistMinCm: 74, targetWaistMaxCm: 76, longTermBodyFatPct: 24, longTermWeightKg: 60 },
      targets: { kcal: 1700, proteinG: 100, carbsG: 190, fatG: 55, waterMl: 2500, stepsMin: 8000, stepsGoal: 10000 },
      safety: { minKcal: 1400, maxWeeklyLossKg: 0.8 },
    },
    goalWeeks: 6,
    // Slow start, then a crash: about 1.3 kg a week in the last fortnight
    weight: (i, r) => 66 - Math.min(i, 14) * 0.06 - Math.max(0, i - 14) * 0.19 + (r() - 0.5) * 0.3,
    loads: { perSide: 5, other: 8 },
    workoutChance: 0.95,
    cardioChance: 0.95,
    meals: [
      ['breakfast', '09:00', '1 bowl poha and 1 glass milk'],
      ['lunch', '13:30', '2 idli and sambar'],
      ['snack', '17:00', '1 apple'],
      ['dinner', '20:00', '1 bowl veg pulao and 1 bowl dal'],
    ],
    treat: [0, null],
    glasses: [5, 7],
    steps: [11000, 15000],
    sleep: [6.5, 8],
    measure: { waistCm: [80, -0.9], bellyCm: [84, -1], hipsCm: [98, -0.6], chestCm: [88, -0.3], bicepsCm: [27, -0.1], thighsCm: [56, -0.4] },
  },
  {
    name: 'Arjun',
    email: 'arjun@fitcoach.app',
    days: 28,
    seed: 99,
    profile: {
      age: 31,
      heightCm: 175,
      dietNotes: 'Vegetarian. Eats out often near the office.',
      baseline: { weightKg: 82, bodyFatPct: 27, waistCm: 94, bellyCm: 97 },
      goals: { targetWeightMinKg: 78, targetWeightMaxKg: 79, targetWaistMinCm: 88, targetWaistMaxCm: 90, longTermBodyFatPct: 18, longTermWeightKg: 76 },
      targets: { kcal: 1750, proteinG: 140, waterMl: 3500, stepsMin: 8000, stepsGoal: 10000 },
      safety: { minKcal: 1700, maxWeeklyLossKg: 1 },
    },
    goalWeeks: 8,
    weight: (i, r) => 82 - i * 0.01 + (r() - 0.5) * 0.8, // flat
    loads: { perSide: 15, other: 25 },
    workoutChance: 1,
    cardioChance: 0.25,
    skipChance: 0.3, // about one lifting day in three is skipped
    completeRestChance: 0.6,
    painDaysAgo: 1,
    meals: [
      ['breakfast', '09:30', '2 aloo paratha and 1 glass lassi'],
      ['lunch', '13:30', '1 bowl veg biryani and raita'],
      ['snack', '17:30', '1 samosa and chai'],
      ['dinner', '21:30', '3 rotis, 1 bowl paneer butter masala, 1 bowl dal'],
    ],
    treat: [0.25, ['other', '23:00', '2 gulab jamun']],
    glasses: [6, 9],
    steps: [3500, 8000],
    sleep: [5, 6.5],
    measure: { waistCm: [94, 0], bellyCm: [97, 0.05], hipsCm: [102, 0], chestCm: [100, 0], bicepsCm: [33, 0.05], thighsCm: [60, 0] },
  },
];

const ADMIN = { name: 'Admin', email: 'admin@fitcoach.app' };

export const DEMO_ACCOUNTS = [...PERSONAS.map((p) => p.email), ADMIN.email];

async function removeAccount(repos, email) {
  const existing = await repos.users.findOne({ email });
  if (!existing) return;
  for (const c of ['workouts', 'meals', 'water', 'daily', 'measurements', 'reviews']) {
    await repos[c].deleteMany({ userId: existing.id });
  }
  await repos.users.deleteOne({ id: existing.id });
}

async function seedPersona(repos, p, { passwordHash, nutrition, coach }) {
  await removeAccount(repos, p.email);
  const today = todayIso();
  const start = addDays(today, -p.days);
  const r = rng(p.seed);
  const pick = ([lo, hi]) => lo + r() * (hi - lo);

  const user = await repos.users.create({
    name: p.name,
    email: p.email,
    passwordHash,
    role: 'user',
    tokenVersion: 0,
    profile: {
      ...p.profile,
      startDate: start,
      goals: { ...p.profile.goals, targetDate: addDays(start, p.goalWeeks * 7) },
      schedule: { cycleStart: start, cycle: DEFAULT_CYCLE },
      onboarded: true,
    },
  });

  const loads = {};
  const skipped = [];
  for (let i = 0; i <= p.days; i++) {
    const date = addDays(start, i);
    const isToday = date === today;
    const session = sessionFor(date, { cycleStart: start, cycle: DEFAULT_CYCLE, skippedDates: skipped }).session;
    const painToday = p.painDaysAgo != null && date === addDays(today, -p.painDaysAgo);

    // Day status: skip a lifting day (shifts the plan) or take complete rest on an active-rest day
    let dayStatus = 'normal';
    if (!isToday && !painToday && !isRestSession(session) && r() < (p.skipChance ?? 0)) {
      dayStatus = 'skipped';
      skipped.push(date);
    } else if (!isToday && isRestSession(session) && r() < (p.completeRestChance ?? 0)) {
      dayStatus = 'complete_rest';
    }

    await repos.daily.create({
      userId: user.id,
      date,
      weightKg: round(p.weight(i, r), 2),
      sleepHours: round(pick(p.sleep) * 2, 0) / 2,
      steps: Math.round(pick(p.steps)),
      energy: Math.min(5, Math.max(1, Math.round(pick([2.5, 5])))),
      dayStatus,
      ...(painToday ? { painFlag: true, painNote: 'Lower back twinge during deadlifts' } : {}),
    });

    // Workouts with double progression on every exercise
    const plan = PLAN[session];
    const trains = plan?.exercises.length && dayStatus === 'normal' && !painToday && !isToday && r() < p.workoutChance;
    if (trains) {
      const exercises = plan.exercises.map((ex) => {
        const assisted = /assisted/i.test(ex.name);
        loads[ex.name] ??= { weight: assisted ? 40 : ex.perSide ? p.loads.perSide : p.loads.other, reps: 10 };
        const l = loads[ex.name];
        const sets = Array.from({ length: ex.sets }, () => ({ type: 'working', weightKg: l.weight, reps: l.reps, done: true, ...(assisted ? { assisted: true } : {}) }));
        l.reps += 1;
        if (l.reps > 12) {
          l.weight += assisted ? -5 : 2.5; // less assistance = progress on assisted machines
          l.reps = 8;
        }
        return { name: ex.name, perSide: PER_SIDE_EXERCISES.has(ex.name), sets };
      });
      await repos.workouts.create({
        userId: user.id,
        date,
        session,
        durationMin: 55 + Math.round(r() * 25),
        feeling: 3 + Math.round(r() * 2),
        exercises,
        cardio: r() < p.cardioChance ? [{ type: 'Treadmill', minutes: 20, speed: 4.5, incline: 5 }] : [],
      });
    } else if (isRestSession(session) && dayStatus === 'normal' && !isToday && !painToday) {
      await repos.workouts.create({ userId: user.id, date, session: 'Active rest', exercises: [], cardio: [{ type: 'Walk', minutes: 35 }] });
    }

    // Meals (today: only the first two so far) and water
    let meals = isToday ? p.meals.slice(0, 2) : [...p.meals];
    if (!isToday && r() < p.treat[0]) meals.push(p.treat[1]);
    for (const [slot, time, description] of meals) {
      const est = await nutrition.estimate(description);
      await repos.meals.create({ userId: user.id, date, time, slot, description, items: est.items, totals: est.totals });
    }
    const glasses = isToday ? 4 : Math.round(pick(p.glasses));
    for (let g = 0; g < glasses; g++) {
      await repos.water.create({ userId: user.id, date, time: `${String(7 + g).padStart(2, '0')}:30`, ml: 250 });
    }

    // Tape measurements on day 1 and every Saturday
    if (i === 0 || weekday(date) === 6) {
      const weeks = i / 7;
      const m = Object.fromEntries(Object.entries(p.measure).map(([k, [base, perWeek]]) => [k, round(base + perWeek * weeks + (r() - 0.5) * 0.2)]));
      await repos.measurements.create({ userId: user.id, date, ...m });
    }
  }

  // Coach reviews: the last three days and the last two Saturdays
  for (let d = 3; d >= 1; d--) await coach.daily(user, addDays(today, -d));
  const lastSat = addDays(today, -((weekday(today) + 1) % 7));
  await coach.weekly(user, addDays(lastSat, -7));
  await coach.weekly(user, lastSat);
  return user;
}

export async function seedDemo(repos, { rounds = 10 } = {}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, rounds);
  const nutrition = createNutritionService({ usda: null });
  const coach = createCoachService({ repos, dayData: createDayDataService(repos), aiCoach: null });

  const users = [];
  for (const p of PERSONAS) users.push(await seedPersona(repos, p, { passwordHash, nutrition, coach }));

  await removeAccount(repos, ADMIN.email);
  users.push(
    await repos.users.create({
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash,
      role: 'admin',
      tokenVersion: 0,
      profile: { startDate: todayIso(), schedule: { cycleStart: todayIso() }, onboarded: true },
    }),
  );
  return users;
}
