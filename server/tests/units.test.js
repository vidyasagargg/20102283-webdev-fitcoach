import { describe, it, expect } from 'vitest';
import { parseWorkout, canonicalExercise, parseDate } from '../src/services/workoutParser.js';
import { sessionFor, describeDay } from '../src/services/schedule.service.js';
import { createNutritionService } from '../src/services/nutrition/index.js';
import { parseItem } from '../src/services/nutrition/mealText.js';
import { mapFood } from '../src/services/nutrition/usdaClient.js';
import { createUsdaClient } from '../src/services/nutrition/usdaClient.js';
import { suggestLoads } from '../src/services/progression.service.js';
import { ruleWeeklyReview, ruleDailyReview } from '../src/services/coach/ruleCoach.js';
import { buildReminderCalendar } from '../src/services/ics.service.js';
import { withDefaults } from '../src/services/profileDefaults.js';

const NOTES = `Day 59 - Pull Day 2 - 05-Oct
Supported pull ups
Warm up 50kgs 30 reps
1. 40kg assist 12 reps
Reverse pec fly
1. 26kgs ~ 10 reps + 19kgs ~ 5 reps
Machine pechure curls
1) 20kgs ~ 15 reps
Hammer curls 10kg x 12
Smith squat 3x12 @ 15kg
Hanging knee raise
Body weight 15 reps 3 sets
Treadmill 30 min speed 4.5 incline 5`;

describe('workout parser', () => {
  const r = parseWorkout(NOTES, { date: '2026-10-05' });

  it('reads the session and date header', () => {
    expect(r.session).toBe('Pull 2');
    expect(r.date).toBe('2026-10-05');
  });

  it('maps misspelt names to the catalogue', () => {
    expect(r.exercises.map((e) => e.name)).toEqual([
      'Assisted pull-up',
      'Reverse pec fly',
      'Preacher curl',
      'Hammer curl',
      'Smith machine squat',
      'Hanging knee raise',
    ]);
    expect(canonicalExercise('RDLs').name).toBe('Romanian deadlift');
  });

  it('reads warm-ups, assisted sets and drop sets', () => {
    const [pullup, fly] = r.exercises;
    expect(pullup.sets[0]).toMatchObject({ type: 'warmup', weightKg: 50, reps: 30 });
    expect(pullup.sets[1]).toMatchObject({ type: 'working', weightKg: 40, reps: 12, assisted: true });
    expect(fly.sets.map((s) => s.type)).toEqual(['working', 'drop']);
    expect(fly.sets[1]).toMatchObject({ weightKg: 19, reps: 5 });
  });

  it('expands "3x12 @ 15kg" and "3 sets" and marks per-side lifts', () => {
    const squat = r.exercises.find((e) => e.name === 'Smith machine squat');
    expect(squat.sets).toHaveLength(3);
    expect(squat.sets[0]).toMatchObject({ weightKg: 15, reps: 12 });
    expect(squat.perSide).toBe(true);
    expect(r.exercises.at(-1).sets).toHaveLength(3);
  });

  it('reads cardio lines', () => {
    expect(r.cardio).toEqual([{ type: 'Treadmill', minutes: 30, speed: 4.5, incline: 5 }]);
  });

  it('keeps the selected date and warns when the notes date looks like a typo', () => {
    const t = parseWorkout('Legs 1 04-Sep\nLeg press\n50kg x 12', { date: '2026-10-04' });
    expect(t.date).toBe('2026-10-04');
    expect(t.warnings.join(' ')).toMatch(/Check the date/);
  });

  it('parses several date styles', () => {
    expect(parseDate('Oct 5', 2026)).toBe('2026-10-05');
    expect(parseDate('5th October', 2026)).toBe('2026-10-05');
    expect(parseDate('05/10/2026', 2026)).toBe('2026-10-05');
    expect(parseDate('2026-10-05', 2026)).toBe('2026-10-05');
  });

  it('converts pounds to kilograms', () => {
    const t = parseWorkout('Bench press\n45 lbs x 10', { date: '2026-10-05' });
    expect(t.exercises[0].sets[0].weightKg).toBeCloseTo(20.4, 1);
  });
});

describe('schedule cycle', () => {
  const schedule = { cycleStart: '2026-10-11' };

  it('runs the 8-day cycle with Active rest after Pull 2 and keeps repeating', () => {
    expect(sessionFor('2026-10-11', schedule).session).toBe('Legs 1');
    expect(sessionFor('2026-10-17', schedule).session).toBe('Pull 2');
    expect(sessionFor('2026-10-18', schedule).session).toBe('Active rest');
    expect(sessionFor('2026-10-19', schedule).session).toBe('Legs 1');
    expect(sessionFor('2027-06-01', schedule).session).toBeTruthy(); // no end date
  });

  it('shifts every later day when a session is skipped', () => {
    const skippedDates = ['2026-10-19'];
    expect(sessionFor('2026-10-19', { ...schedule, skippedDates }).session).toBe('Legs 1');
    expect(sessionFor('2026-10-20', { ...schedule, skippedDates }).session).toBe('Legs 1');
    expect(sessionFor('2026-10-21', { ...schedule, skippedDates }).session).toBe('Push 1');
  });

  it('allows complete rest only on active rest days and skip only on lifting days', () => {
    const rest = describeDay('2026-10-18', { schedule });
    const lift = describeDay('2026-10-19', { schedule });
    expect(rest.canCompleteRest && !rest.canSkip).toBe(true);
    expect(lift.canSkip && !lift.canCompleteRest).toBe(true);
    const cr = describeDay('2026-10-18', { schedule, dayStatus: 'complete_rest' });
    expect(cr.label).toBe('Complete rest');
    expect(describeDay('2026-10-19', { schedule }).session).toBe('Legs 1'); // no shift
  });
});

describe('nutrition', () => {
  const svc = createNutritionService({ usda: { searchPer100g: async () => null } });

  it('parses quantities and units', () => {
    expect(parseItem('100g paneer bhurji')).toMatchObject({ qty: 100, unit: 'g', name: 'paneer bhurji' });
    expect(parseItem('half bowl dal')).toMatchObject({ qty: 0.5, unit: 'bowl', name: 'dal' });
    expect(parseItem('paneer 150 g')).toMatchObject({ qty: 150, unit: 'g', name: 'paneer' });
  });

  it('estimates an Indian meal from the local table', async () => {
    const r = await svc.estimate('2 rotis, 100 g paneer bhurji, 1 bowl dal');
    expect(r.items.map((i) => i.source)).toEqual(['local', 'local', 'local']);
    expect(r.totals.kcal).toBeGreaterThan(550);
    expect(r.totals.protein).toBeGreaterThan(25);
  });

  it('flags foods it cannot find', async () => {
    const r = await svc.estimate('dragonfruit smoothie bowl');
    expect(r.unknown).toEqual(['dragonfruit smoothie bowl']);
  });

  it('maps a USDA FoodData Central response to per-100 g nutrients', () => {
    const food = {
      description: 'Quinoa, cooked',
      fdcId: 1,
      foodNutrients: [
        { nutrientNumber: '208', value: 120 },
        { nutrientNumber: '203', value: 4.4 },
        { nutrientNumber: '205', value: 21.3 },
        { nutrientNumber: '204', value: 1.9 },
        { nutrientNumber: '291', value: 2.8 },
      ],
    };
    expect(mapFood(food).per100).toEqual({ kcal: 120, protein: 4.4, carbs: 21.3, fat: 1.9, fibre: 2.8, sugar: 0 });
  });

  it('USDA client caches results and survives network failures', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return { ok: true, json: async () => ({ foods: [{ description: 'X', fdcId: 2, foodNutrients: [{ nutrientNumber: '208', value: 50 }] }] }) };
    };
    const client = createUsdaClient({ apiKey: 'k', baseUrl: 'https://example.test', fetchImpl });
    await client.searchPer100g('kale');
    await client.searchPer100g('Kale ');
    expect(calls).toBe(1);
    const broken = createUsdaClient({ apiKey: 'k', baseUrl: 'https://example.test', fetchImpl: async () => { throw new Error('offline'); } });
    expect(await broken.searchPer100g('kale')).toBeNull();
  });
});

describe('double progression', () => {
  it('adds 2.5 kg only after every working set reaches the top of the range', () => {
    const plan = [{ name: 'Smith machine squat', reps: '8-10', perSide: true }];
    const done = [{ date: '2026-10-11', exercises: [{ name: 'Smith machine squat', sets: [{ type: 'working', weightKg: 15, reps: 10 }, { type: 'working', weightKg: 15, reps: 10 }] }] }];
    const notYet = [{ date: '2026-10-11', exercises: [{ name: 'Smith machine squat', sets: [{ type: 'working', weightKg: 15, reps: 10 }, { type: 'working', weightKg: 15, reps: 8 }] }] }];
    expect(suggestLoads(plan, done)[0].suggestion).toMatchObject({ weightKg: 17.5, increase: true });
    expect(suggestLoads(plan, notYet)[0].suggestion).toMatchObject({ weightKg: 15, increase: false });
  });
});

describe('assisted lifts', () => {
  it('treats less assistance as the better set', async () => {
    const { topSetsByExercise } = await import('../src/services/progress.service.js');
    const w = [{ date: '2026-10-19', exercises: [{ name: 'Assisted pull-up', sets: [{ type: 'working', weightKg: 40, reps: 10, assisted: true }, { type: 'working', weightKg: 35, reps: 8, assisted: true }] }] }];
    expect(topSetsByExercise(w)['Assisted pull-up'][0]).toMatchObject({ weightKg: 35, assisted: true });
  });
});

describe('coach safety rules', () => {
  const profile = withDefaults({});

  it('never drops calories below the safety floor', () => {
    const atFloor = withDefaults({ targets: { kcal: 1750 } });
    const w = { weekEnding: '2026-10-17', avgWeight: 72, prevAvgWeight: 72, waistChangeCm: null, workouts: 6, plannedSessions: 6, cardioSessions: 6, avgProtein: 130, adherence: { mealsDays: 7 }, liftsImproved: ['Leg press'] };
    const r = ruleWeeklyReview(w, atFloor);
    expect(r.newTargets).toBeNull();
    expect(r.adjustments.join(' ')).toMatch(/steps/);
  });

  it('blames intake, not the plan, when weight is flat while eating over target', () => {
    const w = { weekEnding: '2026-10-17', avgWeight: 82, prevAvgWeight: 82, avgKcal: 2500, waistChangeCm: null, workouts: 4, plannedSessions: 4, cardioSessions: 4, avgProtein: 140, adherence: { mealsDays: 7 }, liftsImproved: [] };
    const r = ruleWeeklyReview(w, withDefaults({ targets: { kcal: 1750 } }));
    expect(r.newTargets).toBeNull();
    expect(r.adjustments[0]).toMatch(/intake averaged 2500 kcal/);
  });

  it('raises calories when loss is faster than the weekly limit', () => {
    const w = { weekEnding: '2026-10-17', avgWeight: 70.5, prevAvgWeight: 72, waistChangeCm: -1, workouts: 6, plannedSessions: 6, cardioSessions: 5, avgProtein: 130, adherence: { mealsDays: 7 }, liftsImproved: [] };
    const r = ruleWeeklyReview(w, profile);
    expect(r.newTargets.kcal).toBe(profile.targets.kcal + 150);
    expect(r.alerts[0]).toMatch(/faster than/);
  });

  it('tells the user to rest and see a doctor when pain is reported', () => {
    const r = ruleDailyReview({
      date: '2026-10-19', session: 'Legs 1', dayStatus: 'normal', isRest: false, trained: false, workingSets: 0, cardioMin: 0,
      mealsLogged: 0, kcal: 0, protein: 0, fibre: 0, sugar: 0, waterMl: 0, steps: null, sleep: null, energy: null,
      pain: true, targets: profile.targets, minKcal: 1700, tomorrow: { session: 'Push 1', label: 'Push 1', focus: 'Chest' },
    });
    expect(r.alerts[0]).toMatch(/see a doctor/);
    expect(r.tomorrow.focus).toMatch(/doctor/);
  });
});

describe('iCalendar export', () => {
  it('produces valid VEVENTs with daily recurrence and alarms', () => {
    const ics = buildReminderCalendar({ reminders: [{ label: 'Gym, now', time: '07:00' }], startDate: '2026-10-19', days: 28, timezone: 'Asia/Kolkata' });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20261019T070000');
    expect(ics).toContain('RRULE:FREQ=DAILY;COUNT=28');
    expect(ics).toContain('SUMMARY:FitCoach: Gym\\, now');
    expect(ics).toContain('BEGIN:VALARM');
  });
});
