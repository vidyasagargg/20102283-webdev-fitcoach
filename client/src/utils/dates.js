/** Local-calendar date helpers. Dates travel as 'YYYY-MM-DD' strings. */
const pad = (n) => String(n).padStart(2, '0');

export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => toIso(new Date());
export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const parseIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (iso, n) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};
export const isIso = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const fmtDay = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  parseIso(iso).toLocaleDateString('en-GB', opts);
export const fmtShort = (iso) => parseIso(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function relativeLabel(iso) {
  const today = todayIso();
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  return fmtDay(iso);
}

/** Saturday on or before the date: the weekly review day. */
export function weekEndingSaturday(iso) {
  const d = parseIso(iso);
  const back = (d.getDay() + 1) % 7; // Sat=0 back, Sun=1, … Fri=6
  d.setDate(d.getDate() - back);
  return toIso(d);
}
