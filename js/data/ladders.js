/* Bodyweight progression ladders, after the r/bodyweightfitness Recommended Routine.
   Each ladder is an ordered list of rungs. A rung is an exercise id plus how it is dosed:
     reps rungs: 3 sets of 5-8; add a rep per set each session; at 3x8 with good form move up and restart at 3x5.
     hold rungs (seconds): 3 sets of 10-30 s; move up when all three sets hit 30 s.
     weighted rungs: the top of a ladder; add load with a belt, vest or dumbbell and keep 3x5-8.
   The user's current rung per ladder lives in plan.ladders[ladderId] = { rung, reps } and is advanced by
   Engine.progressLadder after each logged session. */
window.DATA = window.DATA || {};

DATA.LADDERS = {
  pullup: { id: 'pullup', name: 'Pull-up ladder', pairWith: 'squat', rungs: [
    { ex: 'scapular-pull-up' }, { ex: 'dead-hang', seconds: true }, { ex: 'negative-pull-up' }, { ex: 'assisted-pull-up' }, { ex: 'pull-up' }, { ex: 'weighted-pull-up', weighted: true }] },
  squat: { id: 'squat', name: 'Squat ladder', pairWith: 'pullup', rungs: [
    { ex: 'wall-sit', seconds: true }, { ex: 'bodyweight-squat' }, { ex: 'split-squat' }, { ex: 'bulgarian-split-squat' }, { ex: 'assisted-pistol-squat' }, { ex: 'shrimp-squat' }, { ex: 'pistol-squat', weighted: true }] },
  dip: { id: 'dip', name: 'Dip ladder', pairWith: 'hinge', rungs: [
    { ex: 'bench-dip' }, { ex: 'assisted-dip' }, { ex: 'dip' }, { ex: 'weighted-dip', weighted: true }] },
  hinge: { id: 'hinge', name: 'Hinge ladder', pairWith: 'dip', rungs: [
    { ex: 'glute-bridge' }, { ex: 'single-leg-glute-bridge' }, { ex: 'dumbbell-romanian-deadlift' }, { ex: 'single-leg-romanian-deadlift' }, { ex: 'nordic-hamstring-curl', weighted: true }] },
  row: { id: 'row', name: 'Row ladder', pairWith: 'pushup', rungs: [
    { ex: 'towel-row' }, { ex: 'banded-row' }, { ex: 'inverted-row' }, { ex: 'inverted-row', weighted: true, label: 'Weighted or feet-elevated inverted row' }] },
  pushup: { id: 'pushup', name: 'Push-up ladder', pairWith: 'row', rungs: [
    { ex: 'wall-push-up' }, { ex: 'incline-push-up' }, { ex: 'knee-push-up' }, { ex: 'push-up' }, { ex: 'diamond-push-up' }, { ex: 'archer-push-up' }, { ex: 'pseudo-planche-push-up', weighted: true }] },
  antiext: { id: 'antiext', name: 'Anti-extension core', rungs: [
    { ex: 'dead-bug' }, { ex: 'plank', seconds: true }, { ex: 'hollow-body-hold', seconds: true }, { ex: 'ab-wheel-rollout', weighted: true }] },
  antirot: { id: 'antirot', name: 'Anti-rotation core', rungs: [
    { ex: 'bird-dog' }, { ex: 'side-plank', seconds: true }, { ex: 'pallof-press' }, { ex: 'copenhagen-plank', seconds: true, weighted: true }] },
  ext: { id: 'ext', name: 'Extension core', rungs: [
    { ex: 'superman' }, { ex: 'reverse-hyperextension' }, { ex: 'back-extension', weighted: true }] }
};

/* Dosing constants used by the engine for every ladder. */
DATA.LADDER_RULES = { sets: 3, repsLow: 5, repsHigh: 8, holdLow: 10, holdHigh: 30 };
