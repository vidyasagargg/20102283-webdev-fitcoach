/**
 * Mongoose schemas. They are the database-level safety net (types, required
 * fields, enums, indexes); request validation happens earlier with Zod.
 * Every user-owned collection is indexed on { userId, date } because almost
 * every query is "this user's records for a day or a date range".
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true, versionKey: false };
const isoDate = { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ };
const owner = { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true };

const ProfileSchema = new Schema(
  {
    age: Number,
    heightCm: Number,
    dietNotes: String,
    startDate: String,
    baseline: {
      weightKg: Number,
      bodyFatPct: Number,
      waistCm: Number,
      bellyCm: Number,
    },
    goals: {
      targetDate: String,
      targetWeightMinKg: Number,
      targetWeightMaxKg: Number,
      targetWaistMinCm: Number,
      targetWaistMaxCm: Number,
      longTermBodyFatPct: Number,
      longTermWeightKg: Number,
    },
    targets: {
      kcal: Number,
      proteinG: Number,
      carbsG: Number,
      fatG: Number,
      fibreG: Number,
      sugarMaxG: Number,
      waterMl: Number,
      stepsMin: Number,
      stepsGoal: Number,
      sleepHours: Number,
    },
    safety: {
      minKcal: Number,
      maxWeeklyLossKg: Number,
    },
    schedule: {
      cycleStart: String,
      cycle: [String],
    },
    reminders: [{ label: String, time: String, _id: false }],
    onboarded: Boolean,
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    tokenVersion: { type: Number, default: 0 },
    profile: ProfileSchema,
  },
  opts,
);

const SetSchema = new Schema(
  {
    type: { type: String, enum: ['warmup', 'working', 'drop'], default: 'working' },
    weightKg: { type: Number, min: 0, max: 1000 },
    reps: { type: Number, min: 0, max: 1000 },
    assisted: Boolean,
    done: Boolean,
  },
  { _id: false },
);

const WorkoutSchema = new Schema(
  {
    userId: owner,
    date: isoDate,
    session: String,
    durationMin: Number,
    feeling: { type: Number, min: 1, max: 5 },
    notes: String,
    rawText: String,
    exercises: [
      {
        _id: false,
        name: { type: String, required: true },
        originalName: String,
        perSide: Boolean,
        sets: [SetSchema],
      },
    ],
    cardio: [
      {
        _id: false,
        type: { type: String }, // a field named "type" must be wrapped, or Mongoose treats it as the type itself
        minutes: Number,
        speed: Number,
        incline: Number,
        note: String,
      },
    ],
  },
  opts,
);
WorkoutSchema.index({ userId: 1, date: -1 });

const NutrientFields = {
  kcal: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
  fibre: Number,
  sugar: Number,
};

const MealSchema = new Schema(
  {
    userId: owner,
    date: isoDate,
    time: String,
    slot: {
      type: String,
      enum: ['pre-workout', 'breakfast', 'lunch', 'snack', 'dinner', 'bedtime', 'other'],
      default: 'other',
    },
    description: String,
    items: [
      {
        _id: false,
        name: String,
        qty: Number,
        unit: String,
        grams: Number,
        source: String,
        ...NutrientFields,
      },
    ],
    totals: NutrientFields,
  },
  opts,
);
MealSchema.index({ userId: 1, date: -1 });

const WaterSchema = new Schema(
  { userId: owner, date: isoDate, time: String, ml: { type: Number, min: 1, max: 5000 } },
  opts,
);
WaterSchema.index({ userId: 1, date: -1 });

const DailyLogSchema = new Schema(
  {
    userId: owner,
    date: isoDate,
    weightKg: Number,
    sleepHours: Number,
    steps: Number,
    energy: { type: Number, min: 1, max: 5 },
    painFlag: Boolean,
    painNote: String,
    dayStatus: { type: String, enum: ['normal', 'skipped', 'complete_rest'], default: 'normal' },
    notes: String,
  },
  opts,
);
DailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });

const MeasurementSchema = new Schema(
  {
    userId: owner,
    date: isoDate,
    waistCm: Number,
    bellyCm: Number,
    hipsCm: Number,
    chestCm: Number,
    bicepsCm: Number,
    thighsCm: Number,
    bodyFatPct: Number,
  },
  opts,
);
MeasurementSchema.index({ userId: 1, date: 1 }, { unique: true });

const ReviewSchema = new Schema(
  {
    userId: owner,
    date: isoDate,
    kind: { type: String, enum: ['daily', 'weekly'], required: true },
    source: { type: String, enum: ['rules', 'ai'], default: 'rules' },
    content: { type: Schema.Types.Mixed, required: true },
  },
  opts,
);
ReviewSchema.index({ userId: 1, kind: 1, date: -1 });

export const models = {
  users: mongoose.models.User || mongoose.model('User', UserSchema),
  workouts: mongoose.models.Workout || mongoose.model('Workout', WorkoutSchema),
  meals: mongoose.models.Meal || mongoose.model('Meal', MealSchema),
  water: mongoose.models.Water || mongoose.model('Water', WaterSchema),
  daily: mongoose.models.DailyLog || mongoose.model('DailyLog', DailyLogSchema),
  measurements: mongoose.models.Measurement || mongoose.model('Measurement', MeasurementSchema),
  reviews: mongoose.models.Review || mongoose.model('Review', ReviewSchema),
};
