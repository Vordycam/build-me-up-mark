/* Taxonomy: the fixed vocabularies every other data file and the engine rely on.
   - MUSCLES: the groups we count weekly sets against (keys used in exercises' primary / secondary).
   - EQUIPMENT: what a user can tick in their profile; 'bodyweight' is always available.
   - SLOTS: movement-pattern slots a program day can ask for instead of a fixed exercise;
     the engine resolves a slot to the first candidate the user's equipment allows.
   - GOALS and LEVELS: the three physique goals and the three experience levels.
   Change a label here and it changes everywhere; never rename a key without a data migration. */
window.DATA = window.DATA || {};

DATA.MUSCLES = {
  chest: 'Chest', lats: 'Lats', upper_back: 'Upper back', traps: 'Traps', lower_back: 'Lower back',
  front_delts: 'Front delts', side_delts: 'Side delts', rear_delts: 'Rear delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  adductors: 'Adductors', abductors: 'Abductors', hip_flexors: 'Hip flexors',
  abs: 'Abs', obliques: 'Obliques', full_body: 'Full body', cardio: 'Heart and lungs'
};

/* Groups shown on the weekly volume audit, with the muscles that roll up into each. */
DATA.VOLUME_GROUPS = [
  { id: 'chest', label: 'Chest', muscles: ['chest'] },
  { id: 'back', label: 'Back', muscles: ['lats', 'upper_back', 'traps'] },
  { id: 'shoulders', label: 'Shoulders', muscles: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'biceps', label: 'Biceps', muscles: ['biceps'] },
  { id: 'triceps', label: 'Triceps', muscles: ['triceps'] },
  { id: 'quads', label: 'Quads', muscles: ['quads'] },
  { id: 'hamstrings', label: 'Hamstrings', muscles: ['hamstrings'] },
  { id: 'glutes', label: 'Glutes', muscles: ['glutes'] },
  { id: 'calves', label: 'Calves', muscles: ['calves'] },
  { id: 'core', label: 'Core', muscles: ['abs', 'obliques', 'lower_back'] }
];

DATA.EQUIPMENT = {
  bodyweight: 'Just me', mat: 'Mat or floor space', wall: 'A wall', chair: 'Sturdy chair or step', towel: 'Towel',
  pullup_bar: 'Pull-up bar', rings: 'Gymnastic rings', bands: 'Resistance bands', dip_station: 'Dip bars or parallel bars',
  dumbbells: 'Dumbbells', kettlebell: 'Kettlebell', jump_rope: 'Jump rope', bench: 'Bench', box: 'Plyo box or step',
  barbell: 'Barbell and plates', rack: 'Squat rack', ez_bar: 'EZ bar', trap_bar: 'Trap bar', landmine: 'Landmine',
  cables: 'Cable station', machines: 'Gym machines', smith: 'Smith machine', wall_ball: 'Medicine or wall ball',
  ab_wheel: 'Ab wheel', stability_ball: 'Stability ball', sled: 'Sled', battle_rope: 'Battle ropes',
  rower: 'Rowing machine', bike: 'Stationary or air bike', treadmill: 'Treadmill', elliptical: 'Elliptical',
  stairs: 'Stair climber', pool: 'Pool'
};

/* Equipment offered on the home-gym picker, in the order shown. A gym profile has everything. */
DATA.HOME_EQUIPMENT = ['mat', 'wall', 'chair', 'towel', 'pullup_bar', 'rings', 'bands', 'dip_station', 'dumbbells',
  'kettlebell', 'jump_rope', 'bench', 'box', 'barbell', 'rack', 'ez_bar', 'cables', 'ab_wheel', 'stability_ball',
  'wall_ball', 'rower', 'bike', 'treadmill'];

/* Slot candidates are listed from the most to the least preferred. The engine picks the first one
   whose equipment the user has and that does not clash with a flagged joint. */
DATA.SLOTS = {
  horizontal_push: ['bench-press', 'dumbbell-bench-press', 'machine-chest-press', 'push-up', 'incline-push-up', 'knee-push-up'],
  incline_push: ['incline-bench-press', 'incline-dumbbell-press', 'decline-push-up', 'push-up'],
  vertical_push: ['overhead-press', 'standing-dumbbell-press', 'seated-dumbbell-press', 'machine-shoulder-press', 'pike-push-up'],
  horizontal_pull: ['barbell-row', 'dumbbell-bent-over-row', 'one-arm-dumbbell-row', 'seated-cable-row', 'machine-row', 'inverted-row', 'banded-row', 'towel-row'],
  vertical_pull: ['pull-up', 'lat-pulldown', 'chin-up', 'assisted-pull-up', 'negative-pull-up', 'banded-row'],
  squat: ['squat', 'front-squat', 'goblet-squat', 'leg-press', 'hack-squat', 'bulgarian-split-squat', 'bodyweight-squat'],
  hinge: ['deadlift', 'trap-bar-deadlift', 'romanian-deadlift', 'dumbbell-romanian-deadlift', 'kettlebell-swing', 'single-leg-romanian-deadlift', 'glute-bridge'],
  rdl: ['romanian-deadlift', 'dumbbell-romanian-deadlift', 'single-leg-romanian-deadlift', 'good-morning', 'single-leg-glute-bridge'],
  lunge: ['bulgarian-split-squat', 'walking-lunge', 'reverse-lunge', 'split-squat', 'step-up', 'forward-lunge'],
  hip_thrust: ['hip-thrust', 'barbell-glute-bridge', 'dumbbell-hip-thrust', 'single-leg-glute-bridge', 'glute-bridge'],
  chest_iso: ['cable-fly', 'pec-deck', 'dumbbell-fly', 'push-up'],
  side_delt: ['lateral-raise', 'cable-lateral-raise', 'upright-row', 'band-pull-apart'],
  rear_delt: ['face-pull', 'rear-delt-fly', 'band-pull-apart'],
  biceps: ['barbell-curl', 'dumbbell-curl', 'ez-bar-curl', 'hammer-curl', 'cable-curl', 'chin-up'],
  triceps: ['tricep-pushdown', 'skull-crusher', 'overhead-tricep-extension', 'dumbbell-skull-crusher', 'bench-dip', 'diamond-push-up'],
  calves: ['standing-calf-raise', 'seated-calf-raise', 'single-leg-calf-raise', 'calf-raise'],
  quad_iso: ['leg-extension', 'wall-sit', 'sumo-squat'],
  ham_iso: ['lying-leg-curl', 'seated-leg-curl', 'nordic-hamstring-curl', 'stability-ball-hamstring-curl', 'single-leg-romanian-deadlift'],
  core_anti_ext: ['ab-wheel-rollout', 'dead-bug', 'plank', 'hollow-body-hold'],
  core_anti_rot: ['pallof-press', 'side-plank', 'copenhagen-plank', 'bird-dog'],
  core_flex: ['hanging-leg-raise', 'hanging-knee-raise', 'cable-crunch', 'lying-leg-raise', 'crunch'],
  core_ext: ['back-extension', 'reverse-hyperextension', 'superman'],
  carry: ['farmer-carry'],
  conditioning: ['burpee', 'kettlebell-swing', 'jump-rope', 'mountain-climber', 'jumping-jack'],
  cardio_machine: ['rowing', 'assault-bike', 'cycling', 'running', 'elliptical', 'stair-climber', 'treadmill-incline-walk', 'walking']
};

DATA.GOALS = {
  lean: { id: 'lean', label: 'Lean', tagline: 'Lower body fat, athletic, conditioned.', color: 'teal' },
  cut: { id: 'cut', label: 'Cut', tagline: 'Keep the muscle, strip the fat, show the definition.', color: 'amber' },
  buffed: { id: 'buffed', label: 'Buffed', tagline: 'Add muscle and strength, build the frame.', color: 'violet' }
};

DATA.LEVELS = {
  beginner: { id: 'beginner', label: 'Beginner', hint: 'Under a year of consistent lifting, or coming back after a long break.' },
  intermediate: { id: 'intermediate', label: 'Intermediate', hint: 'One to three years. You know the big lifts and progress is slower.' },
  advanced: { id: 'advanced', label: 'Advanced', hint: 'Three years or more of structured training.' }
};

/* Joint flags a user can set; exercises carrying a matching 'stress' tag are skipped at slot resolution
   and marked in the library. */
DATA.JOINTS = { knee: 'Knees', shoulder: 'Shoulders', lower_back: 'Lower back', wrist: 'Wrists', elbow: 'Elbows' };
