import { describe, it, expect } from 'vitest';
import { addDays, weekEndingSaturday, isIso } from './dates.js';
import { cmToIn, inToCm, litres, both } from './format.js';

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('finds the Saturday that ends the week', () => {
    expect(weekEndingSaturday('2026-11-21')).toBe('2026-11-21'); // Saturday
    expect(weekEndingSaturday('2026-11-24')).toBe('2026-11-21'); // Tuesday
  });
  it('validates ISO dates', () => {
    expect(isIso('2026-11-24')).toBe(true);
    expect(isIso('24/11/2026')).toBe(false);
  });
});

describe('unit formatting', () => {
  it('converts between inches and centimetres', () => {
    expect(cmToIn(85.1)).toBe(33.5);
    expect(inToCm(35)).toBe(88.9);
    expect(both(85.1)).toBe('33.5 in (85.1 cm)');
  });
  it('formats litres', () => {
    expect(litres(0)).toBe('0 L');
    expect(litres(2750)).toBe('2.75 L');
    expect(litres(3000)).toBe('3 L');
  });
});
