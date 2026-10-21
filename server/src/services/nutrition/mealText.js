/**
 * Splits a free-text meal description into items with quantity and unit, e.g.
 * "2 rotis, 100 g paneer bhurji and 1 bowl dal" ->
 *   [{qty:2, unit:null, name:'rotis'}, {qty:100, unit:'g', name:'paneer bhurji'}, {qty:1, unit:'bowl', name:'dal'}]
 */
const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, quarter: 0.25 };

const UNIT_ALIASES = {
  g: ['g', 'gm', 'gms', 'gram', 'grams', 'gr'],
  kg: ['kg', 'kgs'],
  ml: ['ml', 'mls'],
  l: ['l', 'litre', 'liter', 'litres', 'liters'],
  cup: ['cup', 'cups'],
  bowl: ['bowl', 'bowls', 'katori', 'katoris'],
  plate: ['plate', 'plates'],
  glass: ['glass', 'glasses'],
  tbsp: ['tbsp', 'tablespoon', 'tablespoons'],
  tsp: ['tsp', 'teaspoon', 'teaspoons'],
  scoop: ['scoop', 'scoops'],
  slice: ['slice', 'slices'],
  piece: ['piece', 'pieces', 'pc', 'pcs', 'no', 'nos'],
  handful: ['handful', 'handfuls'],
};
const UNIT_LOOKUP = Object.fromEntries(Object.entries(UNIT_ALIASES).flatMap(([u, list]) => list.map((a) => [a, u])));

function parseQty(token) {
  if (!token) return null;
  if (/^\d+\/\d+$/.test(token)) {
    const [a, b] = token.split('/').map(Number);
    return b ? a / b : null;
  }
  if (/^\d+(\.\d+)?$/.test(token)) return parseFloat(token);
  return WORD_NUMBERS[token] ?? null;
}

export function splitMealText(text) {
  return text
    .split(/,|;|\n|\+|\band\b|\bwith\b|&/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseItem)
    .filter((i) => i.name);
}

export function parseItem(raw) {
  let s = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  // "100g paneer" -> "100 g paneer"
  s = s.replace(/^(\d+(?:\.\d+)?)([a-z]+)\b/, '$1 $2');
  const tokens = s.split(' ');
  let qty = parseQty(tokens[0]);
  let i = qty != null ? 1 : 0;
  // "1 and a half" is rare; "1.5" is the norm.
  let unit = null;
  if (tokens[i] && UNIT_LOOKUP[tokens[i]]) {
    unit = UNIT_LOOKUP[tokens[i]];
    i += 1;
    if (tokens[i] === 'of') i += 1;
  }
  // trailing quantity: "paneer 100g", "dal - 1 bowl"
  let name = tokens.slice(i).join(' ').replace(/^of /, '');
  const trailing = name.match(/\s*[-x]?\s*(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (qty == null && trailing && (!trailing[2] || UNIT_LOOKUP[trailing[2]])) {
    qty = parseFloat(trailing[1]);
    unit = trailing[2] ? UNIT_LOOKUP[trailing[2]] : null;
    name = name.slice(0, trailing.index);
  }
  name = name.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { raw: raw.trim(), qty: qty ?? 1, qtyGiven: qty != null, unit, name };
}

/** Grams for a parsed item, given food defaults (serving size and bowl size). */
export function toGrams({ qty, unit }, { serving = 100, bowl = 150 } = {}) {
  switch (unit) {
    case 'g':
    case 'ml':
      return qty;
    case 'kg':
    case 'l':
      return qty * 1000;
    case 'cup':
      return qty * 240;
    case 'glass':
      return qty * 250;
    case 'bowl':
      return qty * bowl;
    case 'plate':
      return qty * Math.max(bowl * 2, 250);
    case 'tbsp':
      return qty * 15;
    case 'tsp':
      return qty * 5;
    case 'scoop':
      return qty * 30;
    case 'handful':
      return qty * 30;
    default: // piece, slice or no unit: one serving each
      return qty * serving;
  }
}
