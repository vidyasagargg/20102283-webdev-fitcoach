/**
 * Training plan templates (push/pull/legs, two variations each) and the
 * canonical exercise catalogue used to normalise names from pasted notes.
 * `perSide: true` marks barbell/Smith lifts where the user logs plates per side.
 */
export const DEFAULT_CYCLE = ['Legs 1', 'Push 1', 'Pull 1', 'Active rest', 'Legs 2', 'Push 2', 'Pull 2', 'Active rest'];

const ex = (name, sets, reps, extra = {}) => ({ name, sets, reps, ...extra });

export const PLAN = {
  'Legs 1': {
    focus: 'Quads',
    exercises: [
      ex('Smith machine squat', 4, '8-10', { perSide: true, main: true }),
      ex('Leg press', 4, '10-12', { main: true }),
      ex('Walking lunges', 3, '12-15'),
      ex('Romanian deadlift', 3, '10-12', { perSide: true }),
      ex('Leg extension', 3, '12-15'),
      ex('Standing calf raise', 4, '15-20'),
    ],
    cardio: '15 min easy walk or bike, plus machine crunch and plank finisher',
  },
  'Push 1': {
    focus: 'Chest',
    exercises: [
      ex('Barbell bench press', 4, '8-10', { perSide: true, main: true }),
      ex('Incline dumbbell press', 3, '10-12', { main: true }),
      ex('Seated shoulder press', 3, '10-12'),
      ex('Cable fly', 3, '12-15'),
      ex('Lateral raise', 3, '12-15'),
      ex('Triceps pushdown', 3, '12-15'),
    ],
    cardio: '20 min incline walk (speed 4.5, incline 5)',
  },
  'Pull 1': {
    focus: 'Back width',
    exercises: [
      ex('Lat pulldown', 4, '8-10', { main: true }),
      ex('Seated cable row', 3, '10-12', { main: true }),
      ex('Assisted pull-up', 3, '8-12'),
      ex('Reverse pec fly', 3, '12-15'),
      ex('Dumbbell curl', 3, '10-12'),
      ex('Hammer curl', 3, '10-12'),
    ],
    cardio: '20 min incline walk (speed 4.5, incline 5)',
  },
  'Legs 2': {
    focus: 'Hamstrings and glutes',
    exercises: [
      ex('Romanian deadlift', 4, '8-10', { perSide: true, main: true }),
      ex('Hip thrust', 4, '10-12', { perSide: true, main: true }),
      ex('Bulgarian split squat', 3, '10-12'),
      ex('Lying leg curl', 3, '12-15'),
      ex('Hip abduction', 3, '15-20'),
      ex('Seated calf raise', 4, '15-20'),
    ],
    cardio: '15 min bike, plus hanging knee raise finisher',
  },
  'Push 2': {
    focus: 'Shoulders',
    exercises: [
      ex('Seated dumbbell shoulder press', 4, '8-10', { main: true }),
      ex('Incline barbell press', 3, '8-10', { perSide: true, main: true }),
      ex('Machine chest press', 3, '10-12'),
      ex('Lateral raise', 4, '12-15'),
      ex('Overhead triceps extension', 3, '12-15'),
      ex('Dips', 3, '8-12'),
    ],
    cardio: '20 min incline walk (speed 4.5, incline 5)',
  },
  'Pull 2': {
    focus: 'Back thickness and arms',
    exercises: [
      ex('Assisted pull-up', 4, '8-12', { main: true }),
      ex('One-arm dumbbell row', 3, '10-12', { main: true }),
      ex('T-bar row', 3, '8-10', { perSide: true }),
      ex('Reverse pec fly', 3, '12-15'),
      ex('Preacher curl', 3, '10-12'),
      ex('Face pull', 3, '12-15'),
    ],
    cardio: '20 min incline walk (speed 4.5, incline 5)',
  },
  'Active rest': {
    focus: 'Recovery',
    exercises: [],
    cardio: '30-40 min brisk walk plus 10 min mobility',
  },
};

/** Canonical names and common aliases / misspellings seen in gym notes. */
export const EXERCISE_ALIASES = {
  'Smith machine squat': ['smith squat', 'smith squats', 'smith machine squats', 'squat smith'],
  'Barbell back squat': ['squat', 'squats', 'back squat', 'barbell squat'],
  'Leg press': ['leg press', 'legpress', 'leg press machine'],
  'Walking lunges': ['lunges', 'walking lunge', 'db lunges', 'dumbbell lunges'],
  'Romanian deadlift': ['rdl', 'rdls', 'romanian deadlifts', 'romanian dead lift'],
  Deadlift: ['deadlift', 'deadlifts', 'conventional deadlift'],
  'Leg extension': ['leg extensions', 'leg ext', 'quad extension'],
  'Lying leg curl': ['leg curl', 'leg curls', 'hamstring curl', 'lying leg curls'],
  'Seated leg curl': ['seated leg curls'],
  'Standing calf raise': ['calf raise', 'calf raises', 'calves', 'standing calf raises'],
  'Seated calf raise': ['seated calf raises'],
  'Hip thrust': ['hip thrusts', 'barbell hip thrust', 'glute bridge'],
  'Bulgarian split squat': ['bulgarian split squats', 'split squat', 'bss'],
  'Hip abduction': ['abduction', 'hip abductor', 'abductor machine'],
  'Barbell bench press': ['bench press', 'bench', 'flat bench', 'flat bench press', 'barbell bench'],
  'Incline dumbbell press': ['incline db press', 'incline dumbbell bench', 'incline press dumbbell'],
  'Incline barbell press': ['incline bench press', 'incline barbell bench', 'incline bench'],
  'Machine chest press': ['chest press', 'chest press machine'],
  'Seated shoulder press': ['shoulder press', 'shoulder press machine', 'machine shoulder press'],
  'Seated dumbbell shoulder press': ['db shoulder press', 'dumbbell shoulder press', 'seated db press'],
  'Cable fly': ['cable flys', 'cable flies', 'cable crossover', 'pec fly', 'pec deck', 'chest fly'],
  'Lateral raise': ['lateral raises', 'side raise', 'side raises', 'lat raise', 'lateral raises dumbbell'],
  'Triceps pushdown': ['tricep pushdown', 'triceps push down', 'rope pushdown', 'pushdown', 'tricep pushdowns'],
  'Overhead triceps extension': ['overhead extension', 'tricep overhead extension', 'overhead tricep extension'],
  Dips: ['dip', 'tricep dips', 'assisted dips'],
  'Lat pulldown': ['lat pull down', 'lat pulldowns', 'pulldown', 'pull down', 'wide grip pulldown'],
  'Seated cable row': ['cable row', 'seated row', 'low row', 'cable rows'],
  'Assisted pull-up': ['pull ups', 'pull up', 'pullups', 'assisted pull ups', 'supported pull ups', 'pull-ups'],
  'Reverse pec fly': ['reverse fly', 'rear delt fly', 'reverse pec deck', 'reverse pec flys', 'rear delt'],
  'Dumbbell curl': ['bicep curl', 'biceps curl', 'db curl', 'curls', 'dumbbell curls'],
  'Hammer curl': ['hammer curls'],
  'Preacher curl': ['preacher curls', 'machine preacher curl', 'machine pechure curls', 'pechure curls'],
  'One-arm dumbbell row': ['db row', 'dumbbell row', 'one arm row', 'single arm row'],
  'T-bar row': ['t bar row', 'tbar row', 't-bar rows'],
  'Face pull': ['face pulls'],
  'Machine crunch': ['crunch machine', 'crunches', 'ab crunch'],
  Plank: ['planks'],
  'Hanging knee raise': ['knee raises', 'hanging leg raise', 'leg raises'],
};

export const PER_SIDE_EXERCISES = new Set([
  'Smith machine squat',
  'Barbell back squat',
  'Romanian deadlift',
  'Deadlift',
  'Hip thrust',
  'Barbell bench press',
  'Incline barbell press',
  'T-bar row',
]);

export const sessionPlan = (session) => PLAN[session] ?? { focus: '', exercises: [], cardio: '' };
export const isRestSession = (session) => /rest/i.test(session ?? '');
