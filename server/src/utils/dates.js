/**
 * Date helpers. All "days" are ISO calendar strings (YYYY-MM-DD) so the
 * user's local day is stored as-is and never shifted by server time zones.
 */
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (s) => typeof s === 'string' && ISO_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export function toDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** Whole days from a to b (b - a). */
export function diffDays(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday */
export const weekday = (iso) => toDate(iso).getUTCDay();

export const todayIso = () => toIso(new Date());
