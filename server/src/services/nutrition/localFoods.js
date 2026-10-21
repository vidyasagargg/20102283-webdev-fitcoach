/**
 * Local nutrition table for common Indian vegetarian foods that generic
 * databases (USDA) cover poorly. Values are per 100 g of the food as eaten,
 * from Indian Food Composition Tables (Longvah et al., 2017) and typical
 * home recipes, so treat them as estimates. `serving` is the default
 * grams for one piece or one serving; `bowl` is grams in one katori or bowl.
 */
// portion: default grams when no quantity is typed (e.g. 'almonds' = a 15 g handful, while '10 almonds' uses serving = one nut)
const f = (names, per100, serving, bowl, portion) => ({ names, per100, serving, bowl, portion });
// per100: [kcal, protein, carbs, fat, fibre, sugar]

export const LOCAL_FOODS = [
  f(['roti', 'chapati', 'chapathi', 'phulka', 'rotis', 'chapatis'], [297, 9.8, 54, 4.4, 9.7, 1.5], 40),
  f(['paratha', 'plain paratha'], [326, 7.5, 46, 12.5, 6.2, 1.8], 80),
  f(['aloo paratha'], [260, 5.6, 38, 9.5, 4.2, 2], 120),
  f(['rice', 'white rice', 'steamed rice', 'cooked rice'], [130, 2.7, 28, 0.3, 0.4, 0.1], 150, 150),
  f(['brown rice'], [123, 2.7, 25.6, 1, 1.6, 0.2], 150, 150),
  f(['jeera rice'], [160, 3, 29, 3.5, 0.8, 0.2], 150, 150),
  f(['veg pulao', 'pulao', 'vegetable pulao'], [150, 3.2, 26, 3.8, 1.5, 1.2], 200, 200),
  f(['veg biryani', 'vegetable biryani', 'biryani'], [170, 3.8, 27, 5.5, 2, 1.5], 250, 250),
  f(['curd rice'], [125, 3.5, 21, 3, 0.6, 2.5], 200, 200),
  f(['lemon rice'], [165, 3, 28, 4.6, 1, 0.5], 200, 200),
  f(['dal', 'daal', 'dal tadka', 'toor dal', 'yellow dal', 'dal fry', 'moong dal'], [116, 6.8, 16, 3, 3.5, 1], 150, 150),
  f(['dal makhani'], [150, 6.5, 15, 7.5, 4.5, 1.5], 150, 150),
  f(['rajma', 'rajma curry', 'kidney beans curry'], [140, 7.4, 18, 4.5, 5.5, 1.5], 150, 150),
  f(['chole', 'chana masala', 'chickpea curry', 'chana'], [164, 7.5, 21, 5.5, 6.5, 2.5], 150, 150),
  f(['sambar', 'sambhar'], [70, 3.2, 10, 2, 2.8, 2], 150, 150),
  f(['rasam'], [35, 1.2, 5.5, 1, 0.8, 1.2], 150, 150),
  f(['paneer', 'raw paneer', 'cottage cheese'], [265, 18.3, 3.6, 20.8, 0, 2.6], 100),
  f(['paneer bhurji'], [230, 14, 6, 17, 1.2, 2.8], 150, 150),
  f(['paneer butter masala', 'butter paneer', 'paneer makhani'], [220, 9, 9, 17, 1.5, 4.5], 150, 150),
  f(['palak paneer'], [170, 8.5, 6.5, 12.5, 2.5, 2], 150, 150),
  f(['paneer tikka'], [240, 16, 6, 17, 1, 2.5], 150),
  f(['tofu'], [144, 15.8, 3.5, 8.7, 2.3, 0.6], 100),
  f(['soya chunks', 'soya chunk', 'soy chunks', 'meal maker', 'nutrela'], [345, 52, 33, 0.5, 13, 4], 30),
  f(['soya chunks curry', 'soya curry'], [120, 11, 8, 5, 3, 2], 150, 150),
  f(['egg', 'eggs', 'boiled egg'], [155, 12.6, 1.1, 10.6, 0, 1.1], 50),
  f(['sprouts', 'moong sprouts', 'sprout salad'], [30, 3, 5.9, 0.2, 1.8, 4.1], 100, 100),
  f(['mixed veg', 'mix veg', 'sabzi', 'sabji', 'vegetable curry', 'veg curry'], [95, 2.5, 9, 5.5, 3, 3], 150, 150),
  f(['aloo sabzi', 'aloo curry', 'potato curry', 'aloo gobi'], [110, 2.2, 14, 5, 2.5, 2], 150, 150),
  f(['bhindi', 'bhindi fry', 'okra'], [105, 2.2, 9, 7, 3.5, 2], 150, 150),
  f(['poha'], [130, 2.6, 23, 3, 1.2, 1], 200, 200),
  f(['upma'], [140, 3.5, 21, 4.5, 1.6, 1], 200, 200),
  f(['idli', 'idly'], [146, 4.5, 29, 0.6, 1.5, 0.3], 40),
  f(['dosa', 'plain dosa'], [168, 3.9, 29, 3.7, 1, 0.5], 80),
  f(['masala dosa'], [190, 4, 28, 7, 2, 1.5], 180),
  f(['uttapam'], [150, 4.2, 25, 3.5, 1.8, 1.2], 120),
  f(['pesarattu'], [140, 7.5, 20, 3.5, 4, 1], 100),
  f(['oats', 'rolled oats'], [389, 16.9, 66, 6.9, 10.6, 1], 40),
  f(['oats porridge', 'oatmeal'], [90, 3.5, 13, 2.5, 1.8, 4], 250, 250),
  f(['muesli'], [370, 9.5, 66, 6, 7.5, 18], 45),
  f(['milk', 'toned milk', 'cow milk'], [58, 3.1, 4.8, 3, 0, 4.8], 250),
  f(['skimmed milk', 'skim milk'], [35, 3.4, 5, 0.2, 0, 5], 250),
  f(['curd', 'dahi', 'yogurt', 'yoghurt'], [60, 3.1, 4.7, 3.3, 0, 4.7], 150, 150),
  f(['greek yogurt', 'greek yoghurt', 'hung curd'], [97, 9, 3.9, 5, 0, 3.6], 150, 150),
  f(['buttermilk', 'chaas', 'majjiga'], [25, 1.3, 2.5, 1, 0, 2.5], 250),
  f(['lassi', 'sweet lassi'], [95, 3, 14, 3, 0, 13], 250),
  f(['whey', 'whey protein', 'protein shake', 'scoop whey'], [400, 78, 8, 6, 0, 4], 30),
  f(['peanut butter'], [588, 25, 20, 50, 6, 9], 16),
  f(['peanuts', 'groundnuts', 'roasted peanuts'], [567, 25.8, 16, 49, 8.5, 4], 0.6, undefined, 30),
  f(['almonds', 'badam'], [579, 21, 22, 50, 12.5, 4.4], 1.2, undefined, 15),
  f(['walnuts'], [654, 15, 14, 65, 6.7, 2.6], 5, undefined, 15),
  f(['cashews', 'kaju'], [553, 18, 30, 44, 3.3, 5.9], 1.5, undefined, 15),
  f(['chana roasted', 'roasted chana', 'bhuna chana'], [369, 22.5, 58, 5.2, 17, 10], 30),
  f(['makhana', 'fox nuts', 'lotus seeds'], [347, 9.7, 77, 0.1, 14.5, 0], 0.4, undefined, 25),
  f(['banana'], [89, 1.1, 23, 0.3, 2.6, 12], 120),
  f(['apple'], [52, 0.3, 14, 0.2, 2.4, 10], 180),
  f(['orange'], [47, 0.9, 12, 0.1, 2.4, 9], 150),
  f(['papaya'], [43, 0.5, 11, 0.3, 1.7, 7.8], 150),
  f(['guava'], [68, 2.6, 14, 1, 5.4, 9], 100),
  f(['dates', 'khajur'], [282, 2.5, 75, 0.4, 8, 63], 8, undefined, 16),
  f(['salad', 'green salad', 'cucumber salad', 'kachumber'], [20, 1, 4, 0.2, 1.5, 2], 100, 100),
  f(['raita'], [70, 3, 5, 4, 0.5, 4], 100, 100),
  f(['tea', 'chai', 'milk tea'], [45, 1.5, 6.5, 1.5, 0, 6], 150),
  f(['coffee', 'milk coffee', 'filter coffee'], [50, 1.7, 6.5, 1.8, 0, 6.2], 150),
  f(['black coffee'], [2, 0.3, 0, 0, 0, 0], 200),
  f(['green tea', 'black tea', 'herbal tea', 'lemon tea'], [1, 0, 0.2, 0, 0, 0], 200),
  f(['samosa'], [262, 4.7, 30, 14, 2.5, 2], 70),
  f(['pakora', 'pakoda', 'bhaji'], [280, 7, 25, 17, 3.5, 2], 60),
  f(['vada', 'medu vada'], [290, 9, 30, 15, 3, 1], 50),
  f(['pav bhaji'], [180, 4.5, 24, 7.5, 3, 4], 300),
  f(['maggi', 'instant noodles', 'noodles'], [137, 3.3, 19.7, 5.2, 1, 0.7], 280),
  f(['sandwich', 'veg sandwich'], [220, 7, 30, 8, 3, 4], 150),
  f(['pizza', 'veg pizza'], [260, 10, 32, 10, 2.2, 3.5], 110),
  f(['gulab jamun'], [320, 4.5, 50, 12, 0.5, 38], 40),
  f(['ghee'], [900, 0, 0, 100, 0, 0], 5),
  f(['oil', 'cooking oil'], [884, 0, 0, 100, 0, 0], 5),
  f(['honey'], [304, 0.3, 82, 0, 0.2, 82], 7),
  f(['sugar'], [387, 0, 100, 0, 0, 100], 5),
  f(['bread', 'brown bread', 'white bread'], [265, 9, 49, 3.2, 2.7, 5], 25),
];

const normalise = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const INDEX = LOCAL_FOODS.flatMap((food) => food.names.map((n) => ({ key: normalise(n), food })));

/** Best local match for a food name, or null. Prefers the longest matching alias. */
export function findLocalFood(name) {
  const n = normalise(name);
  if (!n) return null;
  const exact = INDEX.find((e) => e.key === n);
  if (exact) return exact.food;
  // whole-word containment, longest alias wins ("paneer bhurji" beats "paneer")
  const candidates = INDEX.filter((e) => new RegExp(`\\b${e.key}s?\\b`).test(n)).sort((a, b) => b.key.length - a.key.length);
  return candidates[0]?.food ?? null;
}
