/**
 * Converts free-form gym notes (as typed into a phone during a session) into
 * structured workout data. It is designed around real note styles, e.g.
 *
 *   Pull Day 2 - 05-Oct
 *   Machine pechure curls
 *   1. 26kgs ~ 10 reps + 19kgs ~ 5 reps      -> working set + drop set
 *   Warm up 10kg 30 reps                     -> warm-up set
 *   Pull ups 40 kg assist 10 reps            -> assisted set on the same line
 *   Body weight 15 reps 3 sets               -> three body-weight sets
 *   Smith squat 3x12 @ 15kg                  -> sets x reps @ weight
 *   Treadmill 30 min speed 4.5 incline 5     -> cardio entry
 *
 * The parser never throws: anything it cannot read is returned in `unparsed`
 * so the user can fix it in the editable preview before saving.
 */
import { EXERCISE_ALIASES, PER_SIDE_EXERCISES } from './plan.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const CARDIO_RE = /\b(treadmill|cardio|walk(ing)?|cycl(e|ing)|bike|elliptical|cross ?trainer|stair ?master|stairs|run(ning)?|jog(ging)?|rowing machine|skipping)\b/i;
const SESSION_RE = /\b(legs?|push|pull)\s*(?:day)?\s*-?\s*([12])\b|\bactive\s*rest\b/i;
const WEIGHT_RE = /(\d+(?:\.\d+)?)\s*(kgs?|kilos?|lbs?|pounds?)\b/i;

// ---------- name normalisation ----------
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

const similarity = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

const ALIAS_INDEX = Object.entries(EXERCISE_ALIASES).flatMap(([canonical, aliases]) =>
  [canonical, ...aliases].map((alias) => ({ canonical, alias: norm(alias) })),
);

/** Map a typed exercise name to the catalogue name (exact alias, then fuzzy). */
export function canonicalExercise(raw) {
  const n = norm(raw);
  if (!n) return { name: raw.trim(), matched: false };
  const exact = ALIAS_INDEX.find((a) => a.alias === n);
  if (exact) return { name: exact.canonical, matched: true };

  let best = { score: 0, canonical: null };
  for (const { canonical, alias } of ALIAS_INDEX) {
    // whole-string similarity, plus a bonus when one contains the other
    let score = similarity(n, alias);
    if (n.includes(alias) || alias.includes(n)) score = Math.max(score, 0.85);
    if (score > best.score) best = { score, canonical };
  }
  if (best.score >= 0.72) return { name: best.canonical, matched: true };
  // Unknown exercise: keep the user's wording, tidied to Title case
  const titled = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { name: titled, matched: false };
}

// ---------- dates and sessions ----------
export function parseDate(line, fallbackYear) {
  const l = line.toLowerCase();
  let m = l.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = l.match(/\b(\d{1,2})[-/ .](\d{1,2})[-/ .](\d{2,4})\b/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = l.match(/\b(\d{1,2})(?:st|nd|rd|th)?[-/ ]?([a-z]{3,9})\b/);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return iso(fallbackYear, MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]);
  m = l.match(/\b([a-z]{3,9})[-/ ]?(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (m && MONTHS.includes(m[1].slice(0, 3))) return iso(fallbackYear, MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]);
  return null;
}

function iso(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseSession(line) {
  const m = line.match(SESSION_RE);
  if (!m) return null;
  if (/active\s*rest/i.test(m[0])) return 'Active rest';
  const kind = m[1].toLowerCase().startsWith('leg') ? 'Legs' : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return `${kind} ${m[2]}`;
}

// ---------- sets ----------
const toKg = (value, unit) => (/lb|pound/i.test(unit) ? Math.round(value * 0.4536 * 10) / 10 : value);

/** Parse one "weight ~ reps" style segment. */
function parseSegment(seg) {
  const s = seg.toLowerCase();
  const out = { weightKg: null, reps: null, multiplier: 1, bodyweight: /\b(body ?weight|bw)\b/.test(s), assisted: /assist/.test(s) };

  // "3x12 @ 20kg", "3 x 12", "20kg x 12", "20 x 12"
  const sxr = s.match(/\b(\d+)\s*[x×*]\s*(\d+)\b(?!\s*(kg|lb))/);
  const w = s.match(WEIGHT_RE);
  if (w) out.weightKg = toKg(parseFloat(w[1]), w[2]);

  const repsM = s.match(/(\d+)\s*(reps?|r)\b/);
  const setsM = s.match(/(\d+)\s*sets?\b/);
  if (repsM) out.reps = parseInt(repsM[1], 10);
  if (setsM) out.multiplier = Math.min(parseInt(setsM[1], 10), 10);

  if (sxr && out.reps == null) {
    const [a, b] = [parseInt(sxr[1], 10), parseInt(sxr[2], 10)];
    const atWeight = /@/.test(s) || (w && s.indexOf(sxr[0]) < s.indexOf(w[0]));
    if (atWeight || !w) {
      // "3x12 @ 20kg": sets x reps. If no weight anywhere, the first number is the sets.
      out.multiplier = Math.min(a, 10);
      out.reps = b;
    } else {
      // "20kg x 12": weight was given first, so b is reps
      out.reps = b;
    }
  }
  // "20kg x 12" where the x follows the unit
  if (out.reps == null) {
    const afterUnit = s.match(/(kgs?|lbs?)\s*[x×*~-]\s*(\d+)/);
    if (afterUnit) out.reps = parseInt(afterUnit[2], 10);
  }
  // A bare "~ 10" or trailing number after the weight
  if (out.reps == null && w) {
    const rest = s.slice(s.indexOf(w[0]) + w[0].length);
    const n = rest.match(/(\d+)/);
    if (n) out.reps = parseInt(n[1], 10);
  }
  if (out.bodyweight && out.weightKg == null) out.weightKg = 0;
  const ok = out.reps != null || out.weightKg != null;
  return ok ? out : null;
}

/** A line that looks like it contains set data (numbers with units or reps). */
const looksLikeSet = (l) =>
  WEIGHT_RE.test(l) || /\d+\s*(reps?|sets?)\b/i.test(l) || /\b\d+\s*[x×*]\s*\d+\b/.test(l) || /\b(body ?weight|bw)\b/i.test(l);

function parseSetLine(line) {
  const isWarm = /warm\s*-?\s*up|\bwu\b/i.test(line);
  const body = line
    .replace(/^\s*(set\s*)?\d+\s*[.)\]:-]\s+/i, '') // "1. ", "2) ", "Set 3: "
    .replace(/warm\s*-?\s*up:?/i, '');
  const segments = body.split(/\s\+\s|\s*\+\s*(?=\d)/); // "26kg ~ 10 + 19kg ~ 5"
  const sets = [];
  segments.forEach((seg, i) => {
    const p = parseSegment(seg);
    if (!p) return;
    let type = i > 0 ? 'drop' : 'working';
    if (isWarm || (i === 0 && p.reps >= 25)) type = 'warmup';
    for (let k = 0; k < p.multiplier; k++) {
      sets.push({ type, weightKg: p.weightKg, reps: p.reps, ...(p.assisted ? { assisted: true } : {}), done: true });
    }
  });
  return sets;
}

/** Split "Calf raises 7.5kg x 20" into a name part and a set part. */
function splitInline(line) {
  const m = line.match(/^(.*?[a-z]{3,}.*?)\s+(?=(\d+(?:\.\d+)?\s*(kgs?|lbs?)|\d+\s*[x×*]\s*\d+|\d+\s*reps?|body ?weight|bw\b))/i);
  if (!m) return null;
  const name = m[1].replace(/[:\-–~]+$/, '').trim();
  if (!/[a-z]{3,}/i.test(name) || /^(warm|set\b|body ?weight)/i.test(name)) return null;
  return { name, rest: line.slice(m[0].length) };
}

function parseCardio(line) {
  const l = line.toLowerCase();
  const minutes = l.match(/(\d+(?:\.\d+)?)\s*(min|mins|minutes|m)\b/);
  const hours = l.match(/(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours)\b/);
  const speed = l.match(/speed\s*:?\s*(\d+(?:\.\d+)?)/);
  const incline = l.match(/incline\s*:?\s*(\d+(?:\.\d+)?)/);
  const type = (l.match(CARDIO_RE)?.[0] ?? 'cardio').replace(/^\w/, (c) => c.toUpperCase());
  const mins = minutes ? parseFloat(minutes[1]) : hours ? parseFloat(hours[1]) * 60 : null;
  if (mins == null) return null;
  return {
    type: type === 'Cardio' && /treadmill/.test(l) ? 'Treadmill' : type,
    minutes: mins,
    ...(speed ? { speed: parseFloat(speed[1]) } : {}),
    ...(incline ? { incline: parseFloat(incline[1]) } : {}),
  };
}

/**
 * @param {string} text   pasted notes
 * @param {object} opts   { date: 'YYYY-MM-DD' selected in the app }
 */
export function parseWorkout(text, { date } = {}) {
  const year = date ? parseInt(date.slice(0, 4), 10) : new Date().getUTCFullYear();
  const result = { date: date ?? null, session: null, exercises: [], cardio: [], unparsed: [], warnings: [] };
  let current = null;
  let parsedDate = null;

  const pushExercise = (rawName) => {
    const { name, matched } = canonicalExercise(rawName);
    current = { name, originalName: rawName.trim(), perSide: PER_SIDE_EXERCISES.has(name), sets: [] };
    if (/per side|each side/i.test(rawName)) current.perSide = true;
    result.exercises.push(current);
    if (!matched) result.warnings.push(`"${rawName.trim()}" is not in the exercise list; kept as typed.`);
  };

  const lines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, ' ').trim());
  for (const line of lines) {
    if (!line || /^[-=_*#•]+$/.test(line)) continue;
    const clean = line.replace(/^[-•*#]\s*/, '');

    // Header lines: date and/or session
    const session = parseSession(clean);
    const d = parseDate(clean, year);
    const isHeader = (session || d || /^day\s*\d+/i.test(clean)) && !looksLikeSet(clean) && !CARDIO_RE.test(clean);
    if (isHeader) {
      if (session && !result.session) result.session = session;
      if (d && !parsedDate) parsedDate = d;
      continue;
    }

    if (CARDIO_RE.test(clean) && /\d/.test(clean) && !WEIGHT_RE.test(clean)) {
      const c = parseCardio(clean);
      if (c) {
        result.cardio.push(c);
        current = null;
        continue;
      }
    }

    if (looksLikeSet(clean)) {
      const inline = splitInline(clean);
      if (inline && !/^\d/.test(clean)) {
        pushExercise(inline.name);
        const sets = parseSetLine(inline.rest);
        if (sets.length) current.sets.push(...sets);
        else result.unparsed.push(line);
        continue;
      }
      const sets = parseSetLine(clean);
      if (sets.length && current) {
        current.sets.push(...sets);
        continue;
      }
      if (sets.length && !current) {
        pushExercise('Unnamed exercise');
        current.sets.push(...sets);
        result.warnings.push(`Sets found before any exercise name: "${line}"`);
        continue;
      }
      result.unparsed.push(line);
      continue;
    }

    // Anything else with letters is treated as a new exercise name
    if (/[a-z]{3,}/i.test(clean)) {
      pushExercise(clean.replace(/^\d+\s*[.)]\s*/, '').replace(/[:\-–]+$/, ''));
      continue;
    }
    result.unparsed.push(line);
  }

  // Drop exercises that ended up with no sets but keep a warning
  result.exercises = result.exercises.filter((e) => {
    if (e.sets.length) return true;
    result.warnings.push(`No sets found for "${e.originalName}".`);
    return false;
  });

  if (parsedDate) {
    result.notesDate = parsedDate;
    const days = date ? Math.abs((Date.parse(parsedDate) - Date.parse(date)) / 86400000) : 0;
    if (days > 3) {
      // Likely a typo in the notes (e.g. "04-Sep" in October): keep the selected day, ask the user.
      result.warnings.push(`The notes say ${parsedDate}, but you are logging for ${date}. Check the date before saving.`);
    } else {
      result.date = parsedDate;
    }
  }
  return result;
}
