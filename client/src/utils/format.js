export const CM_PER_IN = 2.54;
export const cmToIn = (cm) => (cm == null ? null : Math.round((cm / CM_PER_IN) * 10) / 10);
export const inToCm = (inch) => (inch == null || inch === '' ? null : Math.round(Number(inch) * CM_PER_IN * 10) / 10);
export const both = (cm) => (cm == null ? '–' : `${cmToIn(cm)} in (${cm} cm)`);

export const num = (v, digits = 0) =>
  v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
export const kg = (v) => (v == null ? '–' : `${num(v, 2)} kg`);
export const litres = (ml = 0) => `${Number((ml / 1000).toFixed(2))} L`;
export const pct = (v, t) => (t ? Math.min(100, Math.round((v / t) * 100)) : 0);

/** Parse an <input> value into a number or null. */
export const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
