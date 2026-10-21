/**
 * Gathers everything known about a user's day (or range of days) from the
 * repositories. Shared by the coach, the progress report and the schedule
 * endpoints, so each one reads data the same way.
 */
import { sumTotals } from './nutrition/index.js';
import { describeDay } from './schedule.service.js';
import { dateRange } from '../utils/dates.js';
import { withDefaults } from './profileDefaults.js';

export function createDayDataService(repos) {
  async function skippedDates(userId) {
    const skipped = await repos.daily.find({ userId, dayStatus: 'skipped' });
    return skipped.map((d) => d.date);
  }

  async function scheduleFor(user, date, dayStatus) {
    const profile = withDefaults(user.profile);
    return describeDay(date, {
      schedule: profile.schedule,
      dayStatus: dayStatus ?? (await repos.daily.findOne({ userId: user.id, date }))?.dayStatus ?? 'normal',
      skippedDates: await skippedDates(user.id),
    });
  }

  async function range(userId, from, to) {
    const f = { userId, date: { $gte: from, $lte: to } };
    const [daily, meals, water, workouts, measurements] = await Promise.all([
      repos.daily.find(f),
      repos.meals.find(f, { sort: { date: 1 } }),
      repos.water.find(f, { sort: { date: 1 } }),
      repos.workouts.find(f, { sort: { date: 1 } }),
      repos.measurements.find(f, { sort: { date: 1 } }),
    ]);
    const byDate = Object.fromEntries(
      dateRange(from, to).map((date) => [
        date,
        { date, daily: null, meals: [], waterMl: 0, waterEntries: 0, workouts: [], nutrition: null },
      ]),
    );
    daily.forEach((d) => byDate[d.date] && (byDate[d.date].daily = d));
    meals.forEach((m) => byDate[m.date]?.meals.push(m));
    water.forEach((w) => {
      if (!byDate[w.date]) return;
      byDate[w.date].waterMl += w.ml;
      byDate[w.date].waterEntries += 1;
    });
    workouts.forEach((w) => byDate[w.date]?.workouts.push(w));
    for (const day of Object.values(byDate)) {
      day.nutrition = day.meals.length ? sumTotals(day.meals.map((m) => m.totals ?? sumTotals(m.items))) : null;
    }
    return { days: Object.values(byDate), measurements };
  }

  async function day(user, date) {
    const { days } = await range(user.id, date, date);
    const d = days[0];
    return { ...d, schedule: await scheduleFor(user, date, d.daily?.dayStatus) };
  }

  return { range, day, scheduleFor, skippedDates };
}
