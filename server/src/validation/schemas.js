/**
 * Zod schemas: the single source of truth for what the API accepts.
 * `.strict()` rejects unknown keys, which blocks mass-assignment (e.g. a
 * client trying to set `role` or `userId`) and operator injection such as
 * `{ "$gt": "" }`, because every field must be a plain string or number.
 */
import { z } from 'zod';
import { isIsoDate } from '../utils/dates.js';

const text = (max) => z.string().trim().max(max);
export const isoDate = z.string().refine(isIsoDate, 'Must be a date in YYYY-MM-DD format');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be a time in HH:MM format');
const num = (min, max) => z.coerce.number().min(min).max(max);
const optNum = (min, max) => num(min, max).nullable().optional();

export const objectIdLike = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

// ---------- Auth ----------
export const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/\d/, 'Password needs a number');

export const registerSchema = z
  .object({
    name: text(80).min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
    password,
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();

// ---------- Profile ----------
export const profileSchema = z
  .object({
    name: text(80).min(1).optional(),
    profile: z
      .object({
        age: optNum(13, 100),
        heightCm: optNum(100, 250),
        dietNotes: text(300).optional(),
        startDate: isoDate.optional(),
        baseline: z
          .object({
            weightKg: optNum(30, 300),
            bodyFatPct: optNum(3, 70),
            waistCm: optNum(40, 200),
            bellyCm: optNum(40, 200),
          })
          .strict()
          .optional(),
        goals: z
          .object({
            targetDate: isoDate.nullable().optional(),
            targetWeightMinKg: optNum(30, 300),
            targetWeightMaxKg: optNum(30, 300),
            targetWaistMinCm: optNum(40, 200),
            targetWaistMaxCm: optNum(40, 200),
            longTermBodyFatPct: optNum(3, 70),
            longTermWeightKg: optNum(30, 300),
          })
          .strict()
          .optional(),
        targets: z
          .object({
            kcal: optNum(1000, 6000),
            proteinG: optNum(20, 400),
            carbsG: optNum(0, 800),
            fatG: optNum(0, 300),
            fibreG: optNum(0, 100),
            sugarMaxG: optNum(0, 300),
            waterMl: optNum(500, 8000),
            stepsMin: optNum(0, 50000),
            stepsGoal: optNum(0, 50000),
            sleepHours: optNum(3, 12),
          })
          .strict()
          .optional(),
        safety: z
          .object({ minKcal: optNum(1200, 4000), maxWeeklyLossKg: optNum(0.1, 1.5) })
          .strict()
          .optional(),
        schedule: z
          .object({
            cycleStart: isoDate.optional(),
            cycle: z.array(text(40).min(1)).min(1).max(14).optional(),
          })
          .strict()
          .optional(),
        reminders: z
          .array(z.object({ label: text(60).min(1), time }).strict())
          .max(20)
          .optional(),
        onboarded: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// ---------- Daily log ----------
export const dailySchema = z
  .object({
    weightKg: optNum(30, 300),
    sleepHours: optNum(0, 24),
    steps: optNum(0, 100000),
    energy: optNum(1, 5),
    painFlag: z.boolean().optional(),
    painNote: text(300).optional(),
    notes: text(1000).optional(),
  })
  .strict();

export const dayStatusSchema = z
  .object({ status: z.enum(['normal', 'skipped', 'complete_rest']) })
  .strict();

// ---------- Workouts ----------
const setSchema = z
  .object({
    type: z.enum(['warmup', 'working', 'drop']).default('working'),
    weightKg: num(0, 1000).nullable().optional(),
    reps: num(0, 1000).nullable().optional(),
    assisted: z.boolean().optional(),
    done: z.boolean().optional(),
  })
  .strict();

export const workoutSchema = z
  .object({
    date: isoDate,
    session: text(40).optional(),
    durationMin: optNum(0, 600),
    feeling: optNum(1, 5),
    notes: text(2000).optional(),
    rawText: text(20000).optional(),
    exercises: z
      .array(
        z
          .object({
            name: text(80).min(1, 'Exercise name is required'),
            originalName: text(120).optional(),
            perSide: z.boolean().optional(),
            sets: z.array(setSchema).max(30).default([]),
          })
          .strict(),
      )
      .max(40)
      .default([]),
    cardio: z
      .array(
        z
          .object({
            type: text(40).default('Cardio'),
            minutes: num(0, 600),
            speed: optNum(0, 30),
            incline: optNum(0, 30),
            note: text(200).optional(),
          })
          .strict(),
      )
      .max(10)
      .default([]),
  })
  .strict();

export const workoutParseSchema = z
  .object({ text: z.string().min(1, 'Paste your workout notes').max(20000), date: isoDate.optional() })
  .strict();

// ---------- Meals ----------
const nutrientNum = num(0, 10000).default(0);
export const mealItemSchema = z
  .object({
    name: text(120).min(1),
    qty: optNum(0, 10000),
    unit: text(20).optional(),
    grams: optNum(0, 10000),
    source: z.enum(['local', 'usda', 'manual', 'unknown']).default('manual'),
    kcal: nutrientNum,
    protein: nutrientNum,
    carbs: nutrientNum,
    fat: nutrientNum,
    fibre: nutrientNum,
    sugar: nutrientNum,
  })
  .strict();

export const mealSchema = z
  .object({
    date: isoDate,
    time: time.optional(),
    slot: z.enum(['pre-workout', 'breakfast', 'lunch', 'snack', 'dinner', 'bedtime', 'other']).default('other'),
    description: text(1000).default(''),
    // If items are omitted the server estimates them from `description`.
    items: z.array(mealItemSchema).max(40).optional(),
  })
  .strict();

export const estimateSchema = z.object({ text: z.string().trim().min(1, 'Describe what you ate').max(1000) }).strict();

// ---------- Water ----------
export const waterSchema = z
  .object({ date: isoDate, time: time.optional(), ml: num(1, 5000) })
  .strict();

// ---------- Measurements ----------
export const measurementSchema = z
  .object({
    date: isoDate,
    waistCm: optNum(30, 250),
    bellyCm: optNum(30, 250),
    hipsCm: optNum(30, 250),
    chestCm: optNum(30, 250),
    bicepsCm: optNum(10, 80),
    thighsCm: optNum(20, 120),
    bodyFatPct: optNum(3, 70),
  })
  .strict();

// ---------- Query strings ----------
export const rangeQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional(), date: isoDate.optional() })
  .strict();
