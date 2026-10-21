/**
 * Nutrition estimation service. It combines three sources:
 *   1. local Indian-food table (fast, best for home-style dishes)
 *   2. USDA FoodData Central API (broad coverage for everything else)
 *   3. "unknown" placeholder the user can correct by hand
 * Totals are always recomputed on the server from the item list, so the
 * client can never submit totals that do not match the items.
 */
import { findLocalFood } from './localFoods.js';
import { splitMealText, toGrams } from './mealText.js';

const FIELDS = ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar'];
const round1 = (n) => Math.round(n * 10) / 10;

const scale = (per100, grams) => Object.fromEntries(FIELDS.map((f) => [f, round1(((per100[f] ?? 0) * grams) / 100)]));

export function sumTotals(items = []) {
  const totals = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  for (const it of items) for (const f of FIELDS) totals[f] += Number(it[f]) || 0;
  return Object.fromEntries(FIELDS.map((f) => [f, round1(totals[f])]));
}

export function createNutritionService({ usda }) {
  async function estimateItem(parsed) {
    const local = findLocalFood(parsed.name);
    if (local) {
      const [kcal, protein, carbs, fat, fibre, sugar] = local.per100;
      const usePortion = !parsed.qtyGiven && !parsed.unit && local.portion;
      const grams = Math.round(usePortion ? local.portion : toGrams(parsed, { serving: local.serving, bowl: local.bowl ?? 150 }));
      return {
        name: parsed.name,
        qty: parsed.qty,
        unit: parsed.unit ?? undefined,
        grams,
        source: 'local',
        ...scale({ kcal, protein, carbs, fat, fibre, sugar }, grams),
      };
    }
    const remote = usda ? await usda.searchPer100g(parsed.name) : null;
    const grams = Math.round(toGrams(parsed, { serving: 100, bowl: 150 }));
    if (remote) {
      return {
        name: parsed.name,
        qty: parsed.qty,
        unit: parsed.unit ?? undefined,
        grams,
        source: 'usda',
        ...scale(remote.per100, grams),
      };
    }
    return {
      name: parsed.name,
      qty: parsed.qty,
      unit: parsed.unit ?? undefined,
      grams,
      source: 'unknown',
      ...Object.fromEntries(FIELDS.map((f) => [f, 0])),
    };
  }

  /** Estimate every item in a free-text description (items looked up in parallel). */
  async function estimate(text) {
    const parsed = splitMealText(text).slice(0, 40);
    const items = await Promise.all(parsed.map(estimateItem));
    return { items, totals: sumTotals(items), unknown: items.filter((i) => i.source === 'unknown').map((i) => i.name) };
  }

  return { estimate, sumTotals };
}
