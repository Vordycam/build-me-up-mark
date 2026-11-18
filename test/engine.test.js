/* Engine and data tests. No dependencies: Node's built-in runner.
 *
 *   node --test test/
 *
 * The data files and engine.js are browser scripts that hang themselves on `window`, so `window` is
 * aliased to the test realm's global before they are loaded (into THIS realm, not a separate vm context,
 * so arrays keep the realm's Array.prototype and deepStrictEqual behaves). Storage_.newId and Date.now
 * are replaced so every run is identical. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let clock = 1_700_000_000_000;
const DAY = 86_400_000, WEEK = 7 * DAY;

globalThis.window = globalThis;
let n = 0;
globalThis.Storage_ = { newId: () => 'w' + (++n) };
const ROOT = path.join(__dirname, '..');
['data/taxonomy', 'data/media', 'data/exercises-1', 'data/exercises-2', 'data/exercises-3', 'data/exercises-4', 'data/exercises',
  'data/programs', 'data/wods', 'data/ladders', 'data/cardio', 'data/champions', 'engine'].forEach((f) => {
  const file = path.join(ROOT, 'js', f + '.js');
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
});
const D = globalThis.DATA, E = globalThis.Engine, X = D.exerciseById;
E._setNow(() => clock);

const gym = { goal: 'buffed', level: 'intermediate', daysPerWeek: 4, location: 'gym', equipment: [], joints: [], sex: 'm', bodyKg: 85, birthYear: 1985,
  strength: { squat: { kg: 100, reps: 5 }, 'bench-press': { kg: 80, reps: 5 }, deadlift: { kg: 140, reps: 3 }, 'overhead-press': { kg: 50, reps: 5 } } };
const home = { goal: 'lean', level: 'beginner', daysPerWeek: 5, location: 'home', equipment: ['pullup_bar', 'dumbbells'], joints: [], sex: 'f', bodyKg: 62, birthYear: 1990, strength: {} };

function completeAll(w, repsOverride) {
  w.blocks.forEach((b) => { if (b.sets) b.sets.forEach((s) => { s.done = true; s.reps = repsOverride != null ? repsOverride : (s.targetReps || 10); s.kg = s.targetKg; if (s.targetSeconds) s.seconds = s.targetSeconds; }); });
}

/* ── data integrity ─────────────────────────────────────────────────── */

test('every exercise has media, valid muscles, equipment, slot and swap references', () => {
  assert.ok(D.exercises.length >= 200);
  const ids = new Set(D.exercises.map((e) => e.id));
  assert.equal(ids.size, D.exercises.length, 'ids unique');
  D.exercises.forEach((e) => {
    assert.ok(e.anim || e.repdb, e.id + ' has no media');
    e.primary.concat(e.secondary).forEach((m) => assert.ok(D.MUSCLES[m], e.id + ' muscle ' + m));
    e.equip.forEach((q) => assert.ok(D.EQUIPMENT[q], e.id + ' equipment ' + q));
    if (e.slot && e.slot !== 'mobility') assert.ok(D.SLOTS[e.slot], e.id + ' slot ' + e.slot);
    if (e.easier) assert.ok(ids.has(e.easier), e.id + ' easier ' + e.easier);
    if (e.harder) assert.ok(ids.has(e.harder), e.id + ' harder ' + e.harder);
    assert.ok(e.steps.length >= 1 && e.cues.length >= 1, e.id + ' coaching text');
    if (e.anim) assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'anim', e.anim, 'frame-3.svg')), e.id + ' frames');
  });
  Object.keys(D.SLOTS).forEach((s) => D.SLOTS[s].forEach((id) => assert.ok(ids.has(id), 'slot ' + s + ' -> ' + id)));
});

test('programs, WODs, ladders, cardio and playbooks only reference things that exist', () => {
  D.PROGRAMS.forEach((p) => {
    assert.ok(D.PLAYBOOKS[p.goal], p.id);
    assert.ok(D.championById[p.champion], p.id + ' champion');
    assert.ok(typeof p.perWeek === 'number' && Array.isArray(p.days), p.id + ' perWeek/days');
    p.days.forEach((d) => d.blocks.forEach((b) => {
      if (b.kind === 'strength' || b.kind === 'hold') { if (b.ex) assert.ok(X[b.ex], p.id + ' ' + b.ex); if (b.slot) assert.ok(D.SLOTS[b.slot], p.id + ' ' + b.slot); }
      if (b.items) b.items.forEach((it) => assert.ok(X[it.ex], p.id + ' item ' + it.ex));
      if (b.kind === 'ladder') assert.ok(D.LADDERS[b.ladder], p.id + ' ladder ' + b.ladder);
      if (b.kind === 'wod' && b.wod.indexOf('pick:') !== 0) assert.ok(D.wodById[b.wod], p.id + ' wod ' + b.wod);
      if (b.kind === 'cardio') assert.ok(D.CARDIO[b.protocol], p.id + ' cardio ' + b.protocol);
    }));
  });
  D.WODS.forEach((w) => { assert.ok(D.WOD_FORMATS[w.format], w.id + ' format'); w.movements.forEach((m) => assert.ok(X[m.ex], w.id + ' ' + m.ex)); });
  Object.values(D.LADDERS).forEach((L) => L.rungs.forEach((r) => assert.ok(X[r.ex], L.id + ' ' + r.ex)));
  Object.values(D.CARDIO).forEach((c) => { assert.ok(c.build(30, 2).length > 0, c.id); if (c.ex) assert.ok(X[c.ex]); });
  Object.values(D.PLAYBOOKS).forEach((pb) => pb.champions.forEach((c) => assert.ok(D.championById[c], c)));
});

/* ── units and maths ────────────────────────────────────────────────── */

test('unit conversion and plate rounding', () => {
  assert.equal(E.roundLoad(E.lbToKg(137), 'lb'), 137.5);
  assert.equal(E.roundLoad(61.3, 'kg'), 61.25);
  assert.equal(E.fmtLoad(E.lbToKg(135), 'lb'), '135 lb');
  assert.equal(E.fmtLoad(60, 'kg'), '60 kg');
  assert.ok(Math.abs(E.toKg('100', 'lb') - 45.36) < 0.01);
  assert.equal(E.toKg('abc', 'kg'), null);
  assert.ok(Math.abs(E.incKg('lower', 'lb') - E.lbToKg(10)) < 1e-9);
  assert.equal(E.incKg('upper', 'kg'), 2.5);
});

test('Epley e1rm and its inverse agree, and reps are capped at 12', () => {
  assert.equal(E.e1rm(100, 1), 100);
  assert.ok(Math.abs(E.e1rm(100, 5) - 116.67) < 0.01);
  assert.ok(Math.abs(E.loadForReps(E.e1rm(100, 5), 5) - 100) < 1e-9);
  assert.equal(E.e1rm(100, 20), E.e1rm(100, 12));
  assert.equal(E.e1rm(0, 5), 0);
});

test('calories from METs', () => {
  assert.equal(E.kcal(8, 30, 80), Math.round(8 * 3.5 * 80 / 200 * 30));
});

/* ── equipment and slots ────────────────────────────────────────────── */

test('gym users can do everything; home users only what they own, plus the always-available items', () => {
  assert.equal(E.hasEquipment(gym, X['leg-press']), true);
  assert.equal(E.hasEquipment(home, X['leg-press']), false);
  assert.equal(E.hasEquipment(home, X['pull-up']), true);
  assert.equal(E.hasEquipment(home, X['bulgarian-split-squat']), true, 'a chair is always available');
  assert.equal(E.hasEquipment(home, X['squat']), false);
});

test('slot resolution prefers the first candidate the user can do and respects joint flags', () => {
  assert.equal(E.resolveSlot('squat', gym, X), 'squat');
  assert.equal(E.resolveSlot('squat', home, X), 'goblet-squat');
  assert.equal(E.resolveSlot('horizontal_pull', home, X), 'dumbbell-bent-over-row');
  const sore = Object.assign({}, gym, { joints: ['lower_back'] });
  assert.equal(E.resolveSlot('hinge', sore, X), 'trap-bar-deadlift', 'deadlift and RDL stress the lower back; trap bar does not');
  const r = E.resolveExercise({ ex: 'squat' }, home, X);
  assert.equal(r.substituted, true);
  assert.equal(r.id, 'goblet-squat');
});

test('alternatives come from the same slot first and never include the exercise itself', () => {
  const alts = E.alternativesFor('bench-press', gym, X);
  assert.ok(alts.length > 3);
  assert.ok(alts.indexOf('bench-press') < 0);
  assert.ok(alts.indexOf('dumbbell-bench-press') >= 0);
});

/* ── recommendations and plans ──────────────────────────────────────── */

test('recommendations put the matching goal, level and location first with finite scores', () => {
  const rec = E.recommendPrograms(gym, D.PROGRAMS);
  assert.ok(Number.isFinite(rec[0].score));
  assert.equal(rec[0].program.goal, 'buffed');
  assert.ok(rec[0].program.level.indexOf('intermediate') >= 0);
  const recHome = E.recommendPrograms(home, D.PROGRAMS);
  assert.equal(recHome[0].program.id, 'lean-at-home');
});

test('startPlan seeds loads from known strength and leaves machines to be asked', () => {
  const p = D.programById['gzclp'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  assert.ok(plan.state['squat'].kg > 80 && plan.state['squat'].kg < 100, 'T1 squat starts about 85% of the 5RM');
  assert.equal(plan.state['lat-pulldown'].kg, null);
  const p531 = D.programById['five-three-one'];
  const plan5 = E.startPlan(p531, gym, X, 'lb', clock);
  assert.ok(Math.abs(plan5.tm['squat'] - E.lbToKg(E.roundLoad(E.e1rm(100, 5) * 0.9, 'lb'))) < 1e-6, 'training max is 90% of e1rm, plate-rounded');
  Object.keys(D.LADDERS).forEach((l) => assert.ok(plan5.ladders[l]));
});

test('ladder start rung depends on level and never starts weighted', () => {
  assert.equal(E.ladderStartRung('pushup', { level: 'beginner' }), 0);
  assert.equal(E.ladderStartRung('pushup', { level: 'intermediate' }), 2);
  const adv = E.ladderStartRung('dip', { level: 'advanced' });
  assert.equal(D.LADDERS.dip.rungs[adv].weighted, undefined);
});

/* ── building workouts ──────────────────────────────────────────────── */

test('buildWorkout resolves every block kind and keeps the day pointer', () => {
  const p = D.programById['lean-foundations'];
  const plan = E.startPlan(p, home, X, 'kg', clock);
  const w = E.buildWorkout(plan, p, home, X, 'kg', clock);
  assert.equal(w.dayName, 'Full Body A');
  const kinds = w.blocks.map((b) => b.kind);
  assert.deepEqual(kinds, ['warmup', 'strength', 'strength', 'strength', 'strength', 'hold', 'circuit', 'cooldown']);
  assert.equal(w.blocks[1].exerciseId, 'goblet-squat');
  assert.equal(w.blocks[1].sets.length, 3);
  assert.equal(w.blocks[1].sets[0].targetReps, 8, 'double progression starts at the bottom of the range');
  assert.equal(w.blocks[5].sets[0].targetSeconds, 30);
  assert.equal(w.blocks[6].format, 'emom');
});

test('GZCLP tiers produce 5x3+, 3x10 and 3x15+ and advance stages on failure', () => {
  const p = D.programById['gzclp'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  let w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const t1 = w.blocks.find((b) => b.tier === 'T1'), t2 = w.blocks.find((b) => b.tier === 'T2'), t3 = w.blocks.find((b) => b.tier === 'T3');
  assert.equal(t1.sets.length, 5); assert.equal(t1.sets[0].targetReps, 3); assert.equal(t1.sets[4].amrap, true);
  assert.equal(t2.sets.length, 3); assert.equal(t2.sets[0].targetReps, 10); assert.equal(t2.sets[2].amrap, false);
  assert.equal(t3.sets.length, 3); assert.equal(t3.sets[0].targetReps, 15); assert.equal(t3.sets[2].amrap, true);
  const kg0 = plan.state.squat.kg;
  /* succeed: weight goes up by 10 lb for a lower-body lift */
  completeAll(w);
  E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
  assert.ok(Math.abs(plan.state.squat.kg - (kg0 + E.lbToKg(10))) < 1e-6);
  assert.equal(plan.state.squat.stage, 0);
  /* fail on day 3 (squat is T2 there): stage moves to 3x8 */
  plan.dayIndex = 2;
  w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const sq = w.blocks.find((b) => b.exerciseId === 'squat');
  assert.equal(sq.tier, 'T2');
  sq.sets.forEach((s, i) => { s.done = true; s.kg = s.targetKg; s.reps = i === 2 ? 6 : 10; });
  E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
  assert.equal(plan.state.squat.stage, 1);
  plan.dayIndex = 2;
  w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  assert.equal(w.blocks.find((b) => b.exerciseId === 'squat').sets[0].targetReps, 8);
});

test('GZCLP T1 reset after the third stage fails restarts at 85% of the estimated 5RM', () => {
  const p = D.programById['gzclp'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  plan.state.squat.stage = 2;
  const w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const sq = w.blocks.find((b) => b.exerciseId === 'squat');
  assert.equal(sq.sets.length, 10);
  sq.sets.forEach((s, i) => { s.done = true; s.kg = s.targetKg; s.reps = i < 8 ? 1 : 0; });
  const kg = sq.sets[0].kg;
  E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
  assert.equal(plan.state.squat.stage, 0);
  const expect = E.lbToKg(E.roundLoad(E.loadForReps(E.e1rm(kg, 1), 5) * 0.85, 'lb'));
  assert.ok(Math.abs(plan.state.squat.kg - expect) < 1e-6);
});

test('5/3/1 waves use 65/75/85, 70/80/90, 75/85/95 of the training max and the TM rises after a cycle', () => {
  const p = D.programById['five-three-one'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  const tm = plan.tm['overhead-press'];
  let w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const main = w.blocks[1];
  assert.equal(main.wave, 1);
  assert.ok(Math.abs(main.sets[0].targetKg - E.lbToKg(E.roundLoad(tm * 0.65, 'lb'))) < 1e-6);
  assert.equal(main.sets[2].amrap, true);
  assert.equal(main.sets.length, 8, 'three wave sets plus five BBB sets');
  assert.ok(Math.abs(main.sets[3].targetKg - E.lbToKg(E.roundLoad(tm * 0.5, 'lb'))) < 1e-6);
  /* run three full rounds (12 sessions): training maxes bump once at the end of wave 3 */
  for (let i = 0; i < 12; i++) { w = E.buildWorkout(plan, p, gym, X, 'lb', clock); completeAll(w, 5); E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock); }
  assert.equal(plan.round, 3);
  assert.ok(Math.abs(plan.tm['overhead-press'] - (tm + E.lbToKg(5))) < 1e-6);
  assert.ok(Math.abs(plan.tm['squat'] - (E.startPlan(p, gym, X, 'lb', clock).tm['squat'] + E.lbToKg(10))) < 1e-6);
  /* the fourth pass is the deload wave */
  w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  assert.equal(w.blocks[1].wave, 4);
  assert.equal(w.blocks[1].sets.length, 3, 'no BBB on the deload wave');
});

test('linear progression adds weight on success, holds on a miss and drops 10% after three misses', () => {
  const p = D.programById['five-by-five'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  const kg0 = plan.state['bench-press'].kg;
  let w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  completeAll(w);
  E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
  assert.ok(Math.abs(plan.state['bench-press'].kg - (kg0 + E.lbToKg(5))) < 1e-6);
  const kg1 = plan.state['bench-press'].kg;
  for (let i = 0; i < 3; i++) {
    plan.dayIndex = 0;
    w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
    const b = w.blocks.find((x) => x.exerciseId === 'bench-press');
    b.sets.forEach((s) => { s.done = true; s.kg = s.targetKg; s.reps = 4; });
    E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
    if (i < 2) assert.ok(Math.abs(plan.state['bench-press'].kg - kg1) < 1e-6, 'held after miss ' + (i + 1));
  }
  assert.ok(Math.abs(plan.state['bench-press'].kg - E.lbToKg(E.roundLoad(kg1 * 0.9, 'lb'))) < 1e-6);
  assert.equal(plan.state['bench-press'].fails, 0);
});

test('double progression climbs reps to the top of the range, then adds weight and resets reps', () => {
  const p = D.programById['phul'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  plan.dayIndex = 2; /* upper hypertrophy: incline bench 3x8-12 */
  let w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const b = w.blocks.find((x) => x.exerciseId === 'incline-bench-press');
  assert.equal(b.sets[0].targetReps, 8);
  const st = plan.state['incline-bench-press'];
  st.kg = 60;
  b.sets.forEach((s) => { s.done = true; s.kg = 60; s.reps = 8; });
  E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
  assert.equal(st.reps, 9); assert.equal(st.kg, 60);
  plan.dayIndex = 2;
  w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const b2 = w.blocks.find((x) => x.exerciseId === 'incline-bench-press');
  assert.equal(b2.sets[0].targetReps, 9);
  b2.sets.forEach((s) => { s.done = true; s.kg = 60; s.reps = 12; });
  E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock);
  assert.equal(st.reps, 8);
  assert.ok(Math.abs(st.kg - (60 + E.lbToKg(5))) < 1e-6);
});

test('pyramid sets get lighter loads for higher reps and the top set drives progression', () => {
  const p = D.programById['zane-pyramid'];
  const plan = E.startPlan(p, gym, X, 'kg', clock);
  plan.dayIndex = 4; /* chest day: bench 12/10/8/6 */
  const w = E.buildWorkout(plan, p, gym, X, 'kg', clock);
  const b = w.blocks.find((x) => x.exerciseId === 'bench-press');
  assert.deepEqual(b.sets.map((s) => s.targetReps), [12, 10, 8, 6]);
  assert.ok(b.sets[0].targetKg < b.sets[3].targetKg);
  const top = b.sets[3].targetKg;
  b.sets.forEach((s) => { s.done = true; s.kg = s.targetKg; s.reps = s.targetReps; });
  E.finishWorkout(plan, p, w, {}, gym, X, 'kg', clock);
  assert.equal(plan.state['bench-press'].kg, top + 2.5);
});

test('ladders add a rep per session, move up a rung at 3x8, and holds move up at 30 s', () => {
  const p = D.programById['lean-at-home'];
  const plan = E.startPlan(p, home, X, 'kg', clock);
  let w = E.buildWorkout(plan, p, home, X, 'kg', clock);
  const push = w.blocks.find((b) => b.ladderId === 'pushup');
  assert.equal(push.exerciseId, 'wall-push-up');
  assert.equal(push.sets[0].targetReps, 5);
  push.sets.forEach((s) => { s.done = true; s.reps = 5; s.kg = 0; });
  const sq = w.blocks.find((b) => b.ladderId === 'squat');
  assert.equal(sq.hold, true);
  sq.sets.forEach((s) => { s.done = true; s.seconds = 30; });
  E.finishWorkout(plan, p, w, {}, home, X, 'kg', clock);
  assert.equal(plan.ladders.pushup.reps, 6);
  assert.equal(plan.ladders.pushup.rung, 0);
  assert.equal(plan.ladders.squat.rung, 1, 'wall sit at 30 s on every set moves to the next rung');
  /* 3x8 on the push-up rung moves up */
  plan.ladders.pushup.reps = 8;
  plan.dayIndex = 0;
  w = E.buildWorkout(plan, p, home, X, 'kg', clock);
  w.blocks.find((b) => b.ladderId === 'pushup').sets.forEach((s) => { s.done = true; s.reps = 8; s.kg = 0; });
  E.finishWorkout(plan, p, w, {}, home, X, 'kg', clock);
  assert.equal(plan.ladders.pushup.rung, 1);
  assert.equal(plan.ladders.pushup.reps, 5);
});

test('finishWorkout advances the day, wraps into a new round, records PRs and estimates calories', () => {
  const p = D.programById['five-by-five'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  const prs = {};
  const w = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  completeAll(w);
  const res = E.finishWorkout(plan, p, w, prs, gym, X, 'lb', clock + 3_600_000);
  assert.equal(w.status, 'done');
  assert.equal(plan.dayIndex, 1);
  assert.ok(prs['squat'].e1rm.value > 0);
  assert.ok(res.prs.length >= 3);
  assert.ok(w.kcal > 100 && w.kcal < 1000, 'kcal ' + w.kcal);
  const w2 = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  completeAll(w2);
  E.finishWorkout(plan, p, w2, prs, gym, X, 'lb', clock);
  assert.equal(plan.dayIndex, 0);
  assert.equal(plan.round, 1);
  /* a heavier set later is a new PR; a lighter one is not */
  const before = prs['squat'].e1rm.value;
  const w3 = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  w3.blocks.find((b) => b.exerciseId === 'squat').sets.forEach((s) => { s.done = true; s.kg = 200; s.reps = 5; });
  const r3 = E.finishWorkout(plan, p, w3, prs, gym, X, 'lb', clock);
  assert.ok(prs['squat'].e1rm.value > before);
  assert.ok(r3.prs.some((x) => x.exerciseId === 'squat'));
});

test('deload weeks halve the sets', () => {
  const p = D.programById['phul'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  const normal = E.buildWorkout(plan, p, gym, X, 'lb', clock);
  const deload = E.buildWorkout(plan, p, gym, X, 'lb', clock + 4 * WEEK + DAY);
  assert.equal(normal.deload, false);
  assert.equal(deload.deload, true);
  assert.ok(deload.blocks[1].sets.length < normal.blocks[1].sets.length);
});

test('Couch to 5K moves to the next week after every three completed runs', () => {
  const p = D.programById['lean-at-home'];
  const plan = E.startPlan(p, home, X, 'kg', clock);
  for (let i = 0; i < 3; i++) {
    plan.dayIndex = 1;
    const w = E.buildWorkout(plan, p, home, X, 'kg', clock);
    assert.equal(w.blocks[0].protocol, 'c25k');
    assert.equal(w.blocks[0].c25kWeek, 1);
    w.blocks[0].result = { done: true, minutes: 30 };
    E.finishWorkout(plan, p, w, {}, home, X, 'kg', clock);
  }
  assert.equal(plan.c25kWeek, 2);
  assert.equal(D.CARDIO.c25k.build(30, 9).filter((s) => s.zone === 'hard')[0].seconds, 1800);
});

/* ── analysis ───────────────────────────────────────────────────────── */

test('weekly volume counts primary sets fully and secondary sets half, against the goal band', () => {
  const p = D.programById['ppl-6'];
  const plan = E.startPlan(p, gym, X, 'lb', clock);
  const ws = [];
  for (let i = 0; i < 6; i++) { const w = E.buildWorkout(plan, p, gym, X, 'lb', clock + i * DAY); completeAll(w); E.finishWorkout(plan, p, w, {}, gym, X, 'lb', clock + i * DAY); ws.push(w); }
  const rep = E.volumeReport(ws, X, 'buffed', clock - 1, clock + WEEK);
  const chest = rep.find((g) => g.id === 'chest');
  assert.ok(chest.sets >= 12, 'chest ' + chest.sets);
  assert.ok(['ok', 'high'].indexOf(chest.status) >= 0);
  const calves = rep.find((g) => g.id === 'calves');
  assert.equal(calves.target[0], 6);
});

test('week summary counts sessions and streaks of weeks that met the bar', () => {
  const p = D.programById['five-by-five'];
  const ws = [];
  const monday = E.startOfWeek(clock, 1);
  for (let k = 3; k >= 1; k--) for (let i = 0; i < 3; i++) ws.push({ status: 'done', startedAt: monday - k * WEEK + i * DAY, blocks: [] });
  ws.push({ status: 'done', startedAt: monday + DAY, blocks: [] });
  const s = E.weekSummary(ws, p, monday + 2 * DAY, 1);
  assert.equal(s.thisWeek, 1);
  assert.equal(s.planned, 3);
  assert.equal(s.streakWeeks, 3);
  ws.push({ status: 'done', startedAt: monday + DAY, blocks: [] }, { status: 'done', startedAt: monday + 2 * DAY, blocks: [] });
  assert.equal(E.weekSummary(ws, p, monday + 2 * DAY + 1, 1).streakWeeks, 4);
});

test('strength trend and exercise history are ordered and filtered to finished workouts', () => {
  const ws = [
    { id: 'a', status: 'done', startedAt: 2, blocks: [{ kind: 'strength', exerciseId: 'squat', sets: [{ done: true, kg: 100, reps: 5 }] }] },
    { id: 'b', status: 'done', startedAt: 1, blocks: [{ kind: 'strength', exerciseId: 'squat', sets: [{ done: true, kg: 90, reps: 5 }] }] },
    { id: 'c', status: 'abandoned', startedAt: 3, blocks: [{ kind: 'strength', exerciseId: 'squat', sets: [{ done: true, kg: 200, reps: 5 }] }] }
  ];
  const tr = E.strengthTrend(ws, 'squat');
  assert.deepEqual(tr.map((x) => x.t), [1, 2]);
  assert.equal(E.exerciseHistory(ws, 'squat')[0].workoutId, 'a');
});

/* ── WODs ───────────────────────────────────────────────────────────── */

test('WOD scores format by type and compare correctly', () => {
  const fran = D.wodById.fran, cindy = D.wodById.cindy;
  assert.equal(E.wodScore(fran, { seconds: 312 }), '5:12');
  assert.equal(E.wodScore(fran, { finished: false, reps: 40 }), '40 reps at the cap');
  assert.equal(E.wodScore(cindy, { rounds: 18, reps: 7 }), '18 rounds + 7');
  assert.equal(E.betterWod(fran, { seconds: 300 }, { seconds: 312 }), true);
  assert.equal(E.betterWod(fran, { finished: false, reps: 40 }, { seconds: 900 }), false);
  assert.equal(E.betterWod(cindy, { rounds: 19, reps: 0 }, { rounds: 18, reps: 14 }), true);
  assert.equal(E.rxLoad(fran.movements[0].load, 'f', 'lb'), '65 lb');
  assert.equal(E.rxLoad(fran.movements[0].load, 'm', 'kg'), '43 kg');
});

/* ── timers ─────────────────────────────────────────────────────────── */

test('timers derive everything from elapsed time and survive pauses', () => {
  const T = E.Timer;
  let t = T.create({ kind: 'countdown', totalMs: 60_000 });
  T.start(t, 0); T.pause(t, 10_000); T.start(t, 50_000);
  assert.equal(T.view(t, 60_000).remainingMs, 40_000);
  assert.equal(T.view(t, 110_000).done, true);
  t = T.create({ kind: 'emom', minutes: 10 }); T.start(t, 0);
  assert.equal(T.view(t, 125_000).round, 3);
  assert.equal(T.view(t, 125_000).remainingMs, 55_000);
  assert.equal(T.view(t, 600_000).done, true);
  t = T.create({ kind: 'tabata', rounds: 8 }); T.start(t, 0);
  assert.equal(T.view(t, 19_000).phase, 'work');
  assert.equal(T.view(t, 25_000).phase, 'rest');
  assert.equal(T.view(t, 240_000).done, true);
  t = T.create({ kind: 'segments', segments: D.CARDIO['norwegian-4x4'].build() }); T.start(t, 0);
  const v = T.view(t, 11 * 60_000);
  assert.equal(v.segIndex, 1);
  assert.equal(v.zone, 'hard');
  assert.equal(T.view(t, 2 * 3600_000).done, true);
  t = T.create({ kind: 'deathby' }); T.start(t, 0);
  assert.equal(T.view(t, 61_000).label, '2 reps');
  t = T.create({ kind: 'stopwatch', capMs: 420_000 }); T.start(t, 0);
  assert.equal(T.view(t, 421_000).done, true);
});
