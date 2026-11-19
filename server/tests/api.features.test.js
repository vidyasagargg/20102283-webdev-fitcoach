import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, signedInAgent, api, closeDb } from './helpers.js';

let app;
let a; // api helper for a signed-in user (cycle starts 2026-10-11 via X-Client-Date)
beforeAll(async () => {
  ({ app } = await buildTestApp());
  a = api((await signedInAgent(app)).agent);
});
afterAll(closeDb);

describe('profile', () => {
  it('returns defaults and merges partial updates', async () => {
    const before = await a.get('/api/profile');
    expect(before.body.profile.targets.kcal).toBe(1900);
    expect(before.body.profile.schedule.cycleStart).toBe('2026-10-11');
    const res = await a.put('/api/profile', { profile: { targets: { proteinG: 140 }, goals: { targetWeightMaxKg: 70.5 } } });
    expect(res.status).toBe(200);
    expect(res.body.profile.targets.proteinG).toBe(140);
    expect(res.body.profile.targets.kcal).toBe(1900);
  });

  it('enforces the 1,200 kcal minimum and rejects unknown fields', async () => {
    expect((await a.put('/api/profile', { profile: { targets: { kcal: 800 } } })).status).toBe(400);
    expect((await a.put('/api/profile', { profile: { hacked: true } })).status).toBe(400);
  });
});

describe('schedule, skip and complete rest', () => {
  it('shows the planned session with exercises', async () => {
    const res = await a.get('/api/schedule/2026-10-19');
    expect(res.body.session).toBe('Legs 1');
    expect(res.body.exercises.length).toBeGreaterThan(3);
    expect(res.body.upcoming).toHaveLength(10);
  });

  it('skipping shifts the plan by one day and can be undone', async () => {
    expect((await a.put('/api/daily/2026-10-19/status', { status: 'skipped' })).status).toBe(200);
    expect((await a.get('/api/schedule/2026-10-20')).body.session).toBe('Legs 1');
    expect((await a.get('/api/schedule/2026-10-21')).body.session).toBe('Push 1');
    await a.put('/api/daily/2026-10-19/status', { status: 'normal' });
    expect((await a.get('/api/schedule/2026-10-20')).body.session).toBe('Push 1');
  });

  it('refuses invalid status changes', async () => {
    expect((await a.put('/api/daily/2026-10-18/status', { status: 'skipped' })).status).toBe(400); // rest day
    expect((await a.put('/api/daily/2026-10-19/status', { status: 'complete_rest' })).status).toBe(400); // lifting day
    expect((await a.put('/api/daily/2026-10-18/status', { status: 'complete_rest' })).status).toBe(200);
  });
});

describe('workouts', () => {
  let id;
  it('parses pasted notes without saving', async () => {
    const res = await a.post('/api/workouts/parse', { text: 'Legs 1\nSmith squat\n1. 15kg ~ 12 reps\n2. 17.5kg ~ 10 reps', date: '2026-10-19' });
    expect(res.status).toBe(200);
    expect(res.body.exercises[0]).toMatchObject({ name: 'Smith machine squat', perSide: true });
    expect((await a.get('/api/workouts?date=2026-10-19')).body).toHaveLength(0);
  });

  it('creates, edits and deletes a workout', async () => {
    const body = {
      date: '2026-10-19',
      session: 'Legs 1',
      exercises: [{ name: 'Smith machine squat', sets: [{ weightKg: 17.5, reps: 10 }, { weightKg: 17.5, reps: 10 }, { weightKg: 17.5, reps: 10 }] }],
      cardio: [{ type: 'Treadmill', minutes: 20 }],
    };
    const created = await a.post('/api/workouts', body);
    expect(created.status).toBe(201);
    expect(created.body.exercises[0].perSide).toBe(true);
    id = created.body.id;
    body.exercises[0].sets[0].reps = 12;
    const updated = await a.put(`/api/workouts/${id}`, body);
    expect(updated.body.exercises[0].sets[0].reps).toBe(12);
  });

  it('suggests a heavier load next time (double progression)', async () => {
    const res = await a.get('/api/schedule/2026-10-27'); // next Legs 1
    const squat = res.body.exercises.find((e) => e.name === 'Smith machine squat');
    expect(squat.last.date).toBe('2026-10-19');
    expect(squat.suggestion).toMatchObject({ weightKg: 20, increase: true });
  });

  it('validates workout input', async () => {
    const res = await a.post('/api/workouts', { date: 'yesterday', exercises: [] });
    expect(res.status).toBe(400);
    expect(res.body.fields.date).toBeDefined();
    expect((await a.del('/api/workouts/not-an-id')).status).toBe(400);
  });
});

describe('meals and water', () => {
  it('estimates nutrition, using the USDA API for foods missing from the local table', async () => {
    const res = await a.post('/api/meals/estimate', { text: '2 rotis, quinoa 100g, unicorn dust' });
    expect(res.body.items.map((i) => i.source)).toEqual(['local', 'usda', 'unknown']);
  });

  it('recomputes totals on the server and supports editing', async () => {
    const created = await a.post('/api/meals', { date: '2026-10-19', slot: 'lunch', time: '13:15', description: '3 rotis, 1 bowl dal' });
    expect(created.status).toBe(201);
    expect(created.body.totals.kcal).toBeGreaterThan(300);
    const items = [...created.body.items, { name: 'paneer', grams: 100, kcal: 265, protein: 18.3, source: 'manual' }];
    const updated = await a.put(`/api/meals/${created.body.id}`, { date: '2026-10-19', slot: 'lunch', description: '3 rotis, 1 bowl dal, paneer', items });
    expect(updated.body.totals.kcal).toBeCloseTo(created.body.totals.kcal + 265, 0);
  });

  it('logs and deletes water', async () => {
    const w = await a.post('/api/water', { date: '2026-10-19', time: '09:00', ml: 500 });
    await a.post('/api/water', { date: '2026-10-19', time: '11:00', ml: 750 });
    expect((await a.get('/api/water?date=2026-10-19')).body).toHaveLength(2);
    expect((await a.del(`/api/water/${w.body.id}`)).status).toBe(204);
    expect((await a.get('/api/daily/2026-10-19')).body.waterMl).toBe(750);
  });
});

describe('daily log, measurements, coach and progress', () => {
  it('upserts the body check for a date', async () => {
    await a.put('/api/daily/2026-10-19', { weightKg: 72.1, sleepHours: 6.5, steps: 9000, energy: 4 });
    const res = await a.put('/api/daily/2026-10-19', { steps: 11000 });
    expect(res.body).toMatchObject({ weightKg: 72.1, steps: 11000 });
  });

  it('keeps one measurement per date', async () => {
    await a.post('/api/measurements', { date: '2026-10-10', waistCm: 85.1, bellyCm: 88.9 });
    await a.post('/api/measurements', { date: '2026-10-17', waistCm: 84.5 });
    await a.post('/api/measurements', { date: '2026-10-17', waistCm: 84.3, bellyCm: 88 });
    const list = (await a.get('/api/measurements')).body;
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ waistCm: 84.3, bellyCm: 88 });
  });

  it('generates and stores a daily coach review', async () => {
    const res = await a.post('/api/coach/daily/2026-10-19');
    expect(res.status).toBe(200);
    expect(res.body.content.feedback.length).toBeGreaterThan(0);
    expect(res.body.content.tomorrow.session).toBe('Push 1');
    expect((await a.get('/api/daily/2026-10-19')).body.review.id).toBe(res.body.id);
  });

  it('adds a doctor alert when pain is flagged', async () => {
    await a.put('/api/daily/2026-10-20', { painFlag: true, painNote: 'knee' });
    const res = await a.post('/api/coach/daily/2026-10-20');
    expect(res.body.content.alerts[0]).toMatch(/see a doctor/);
    expect(res.body.content.alerts[0]).toMatch(/knee/);
    expect(res.body.content.alerts.filter((a) => /see a doctor/.test(a))).toHaveLength(1);
  });

  it('generates a weekly review', async () => {
    const res = await a.post('/api/coach/weekly/2026-10-24');
    expect(res.body.kind).toBe('weekly');
    expect(res.body.content.stats.plannedSessions).toBeGreaterThan(0);
  });

  it('reports progress for any range, including months after the first target date', async () => {
    for (const [date, kg] of [['2026-12-01', 71], ['2026-12-05', 70.6], ['2027-01-10', 69.8]]) {
      await a.put(`/api/daily/${date}`, { weightKg: kg });
    }
    const res = await a.get('/api/progress?from=2026-10-11&to=2027-01-15');
    expect(res.status).toBe(200);
    expect(res.body.weight.at(-1).date).toBe('2027-01-15');
    expect(res.body.weight.find((w) => w.date === '2027-01-10').weightKg).toBe(69.8);
    expect(res.body.lifts['Smith machine squat'][0].weightKg).toBe(17.5);
    expect(res.body.measurements.entries).toHaveLength(2);
  });

  it('rejects oversized progress ranges', async () => {
    expect((await a.get('/api/progress?from=2020-01-01&to=2026-01-01')).status).toBe(400);
  });
});

describe('export and account deletion', () => {
  it('exports reminders as iCalendar and data as JSON', async () => {
    const ics = await a.get('/api/export/reminders.ics?tz=Asia/Kolkata&start=2026-10-19');
    expect(ics.headers['content-type']).toMatch(/text\/calendar/);
    expect(ics.text).toContain('BEGIN:VEVENT');
    expect((await a.get('/api/export/reminders.ics?tz=Mars/Olympus')).status).toBe(400);
    const json = await a.get('/api/export/data.json');
    expect(json.body.workouts.length).toBe(1);
    expect(json.body.user.passwordHash).toBeUndefined();
  });

  it('deletes the account and all its data', async () => {
    const { agent } = await signedInAgent(app);
    const b = api(agent);
    await b.post('/api/water', { date: '2026-10-19', ml: 250 });
    expect((await b.del('/api/profile')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});
