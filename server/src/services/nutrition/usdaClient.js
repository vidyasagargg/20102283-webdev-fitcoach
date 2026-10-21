/**
 * Client for the USDA FoodData Central REST API (JSON).
 * https://fdc.nal.usda.gov/api-guide
 *
 * - Runs on the server, so the API key is never exposed to the browser.
 * - Uses a time-out (AbortController) so a slow upstream cannot hang requests.
 * - Caches results for 24 h to respect the API's rate limits.
 * - Returns per-100 g nutrients or null; callers degrade gracefully.
 */
import { TtlCache } from '../../utils/ttlCache.js';

// FoodData Central nutrient numbers
const NUTRIENT_NUMBERS = { kcal: '208', protein: '203', carbs: '205', fat: '204', fibre: '291', sugar: '269' };

export function createUsdaClient({ apiKey, baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 4000 }) {
  const cache = new TtlCache({ max: 1000 });

  async function searchPer100g(query) {
    const key = query.toLowerCase().trim();
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const url = new URL(`${baseUrl}/foods/search`);
    url.searchParams.set('query', key);
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('dataType', 'Foundation,SR Legacy,Survey (FNDDS)');
    url.searchParams.set('api_key', apiKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`USDA responded ${res.status}`);
      const data = await res.json();
      const food = (data.foods ?? []).find((f) => Array.isArray(f.foodNutrients) && f.foodNutrients.length);
      const value = food ? mapFood(food) : null;
      cache.set(key, value);
      return value;
    } catch (err) {
      // Network/timeout/quota failure: do not cache, so the next call can retry
      if (process.env.NODE_ENV !== 'test') console.warn(`USDA lookup failed for "${key}": ${err.message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return { searchPer100g };
}

export function mapFood(food) {
  const per100 = {};
  for (const [field, number] of Object.entries(NUTRIENT_NUMBERS)) {
    const n = food.foodNutrients.find((x) => String(x.nutrientNumber) === number);
    per100[field] = n ? Number(n.value) || 0 : 0;
  }
  // Some entries report energy only in kJ (nutrient 268)
  if (!per100.kcal) {
    const kj = food.foodNutrients.find((x) => String(x.nutrientNumber) === '268');
    if (kj) per100.kcal = Math.round(Number(kj.value) / 4.184);
  }
  return { description: food.description, fdcId: food.fdcId, per100 };
}
