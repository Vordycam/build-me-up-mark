/* Engine: every rule in the app, as pure functions with no DOM.
   Sections:
     1. Units and maths            kg <-> lb, plate rounding, estimated 1RM (Epley), calories from METs
     2. Profile and equipment      what the user can do, slot resolution, alternatives
     3. Programs and plans         recommendation, starting a plan, the current day, deload weeks
     4. Building a workout         day template -> concrete blocks with targets
     5. Progression rules          linear, double, pyramid, GZCLP tiers, 5/3/1 waves, bodyweight ladders
     6. Finishing a workout        apply progression, detect PRs, advance the plan, estimate calories
     7. Analysis                   weekly sets per muscle vs target, strength trends, week summary and streak
     8. WOD scoring                scores, comparisons, Rx loads in the user's units
     9. Timers                     pure clock views for countdown, stopwatch, EMOM, Tabata, segments, death-by
   All loads are stored in kg; `units` only affects increments, rounding and display. Dates are ms timestamps.
   Date.now() and Math.random() are only used through the two hooks at the top so tests can control them. */
(function () {
  'use strict';

  var now = function () { return Date.now(); };
  var DAY = 86400000, WEEK = 7 * DAY;

  /* ---------------------------------------------------------------- 1. units and maths */
  var KG_PER_LB = 0.45359237;
  function kgToLb(kg) { return kg / KG_PER_LB; }
  function lbToKg(lb) { return lb * KG_PER_LB; }
  /* round a kg load to the nearest plate step in the display unit; returns the display number */
  function roundLoad(kg, units) {
    if (kg == null || isNaN(kg)) return null;
    if (units === 'lb') return Math.round(kgToLb(kg) / 2.5) * 2.5;
    return Math.round(kg / 1.25) * 1.25;
  }
  function fmtLoad(kg, units, withUnit) {
    var v = roundLoad(kg, units);
    if (v == null) return '';
    var s = (Math.round(v * 100) / 100).toString();
    return withUnit === false ? s : s + ' ' + units;
  }
  /* parse a number typed in the display unit into kg */
  function toKg(value, units) {
    var n = parseFloat(value);
    if (isNaN(n)) return null;
    return units === 'lb' ? lbToKg(n) : n;
  }
  /* the increment for a lift class in kg: lower-body lifts move in bigger jumps */
  function incKg(kind, units) {
    if (units === 'lb') return lbToKg(kind === 'lower' ? 10 : 5);
    return kind === 'lower' ? 5 : 2.5;
  }
  function liftClass(ex) {
    if (!ex) return 'upper';
    if (ex.part === 'legs' || (ex.primary || []).some(function (m) { return m === 'quads' || m === 'glutes' || m === 'hamstrings'; })) return 'lower';
    return 'upper';
  }
  /* Epley estimated one-rep max; reps capped at 12 because the formula drifts above that */
  function e1rm(kg, reps) {
    if (!kg || !reps || reps < 1) return 0;
    if (reps === 1) return kg;
    return kg * (1 + Math.min(reps, 12) / 30);
  }
  /* the weight you could lift for `reps`, from an estimated 1RM */
  function loadForReps(oneRm, reps) { return oneRm / (1 + Math.min(reps, 12) / 30); }
  /* calories: MET x 3.5 x kg / 200 per minute */
  function kcal(met, minutes, bodyKg) { return Math.round((met || 5) * 3.5 * (bodyKg || 75) / 200 * minutes); }
  function age(profile, t) { if (!profile || !profile.birthYear) return 35; return new Date(t || now()).getFullYear() - profile.birthYear; }
  function hrMax(profile, t) { return 220 - age(profile, t); }

  /* ---------------------------------------------------------------- 2. profile and equipment */
  var ALWAYS = { bodyweight: true, mat: true, wall: true, chair: true, towel: true };
  function hasEquipment(profile, ex) {
    if (!ex) return false;
    if (!profile || profile.location !== 'home') return true;
    var have = profile.equipment || [];
    return (ex.equip || []).every(function (q) { return ALWAYS[q] || have.indexOf(q) >= 0; });
  }
  function avoids(profile, ex) {
    if (!profile || !profile.joints || !profile.joints.length || !ex) return false;
    return (ex.stress || []).some(function (j) { return profile.joints.indexOf(j) >= 0; });
  }
  function usable(profile, ex) { return hasEquipment(profile, ex) && !avoids(profile, ex); }

  /* pick the first slot candidate the user can do; fall back through equipment-only, then the first candidate */
  function resolveSlot(slotId, profile, exById) {
    var cands = (DATA.SLOTS[slotId] || []).map(function (id) { return exById[id]; }).filter(Boolean);
    var ok = cands.filter(function (ex) { return usable(profile, ex); });
    if (ok.length) return ok[0].id;
    ok = cands.filter(function (ex) { return hasEquipment(profile, ex); });
    if (ok.length) return ok[0].id;
    return cands.length ? cands[0].id : null;
  }

  /* resolve a block's exercise: a fixed id if the user can do it, otherwise the best stand-in */
  function resolveExercise(block, profile, exById) {
    if (block.slot) return { id: resolveSlot(block.slot, profile, exById), substituted: false };
    var ex = exById[block.ex];
    if (!ex) return { id: block.ex, substituted: false };
    if (usable(profile, ex)) return { id: ex.id, substituted: false };
    /* try the easier chain first (same movement), then the slot */
    var seen = {}, cur = ex;
    while (cur && cur.easier && !seen[cur.easier]) {
      seen[cur.easier] = true; cur = exById[cur.easier];
      if (cur && usable(profile, cur)) return { id: cur.id, substituted: true, reason: 'easier' };
    }
    if (ex.slot) {
      var s = resolveSlot(ex.slot, profile, exById);
      if (s && s !== ex.id) return { id: s, substituted: true, reason: 'slot' };
    }
    return { id: ex.id, substituted: false };
  }

  /* alternatives for the swap button: same slot, then easier / harder, filtered by equipment, deduplicated */
  function alternativesFor(exId, profile, exById) {
    var ex = exById[exId];
    if (!ex) return [];
    var ids = [];
    function add(id) { if (id && id !== exId && ids.indexOf(id) < 0 && exById[id] && hasEquipment(profile, exById[id])) ids.push(id); }
    if (ex.slot) (DATA.SLOTS[ex.slot] || []).forEach(add);
    add(ex.easier); add(ex.harder);
    Object.keys(DATA.SLOTS).forEach(function (s) { if (DATA.SLOTS[s].indexOf(exId) >= 0) DATA.SLOTS[s].forEach(add); });
    /* same primary muscle, same part, as a last resort */
    Object.keys(exById).forEach(function (id) {
      var o = exById[id];
      if (o.part === ex.part && o.cat === ex.cat && o.primary[0] === ex.primary[0]) add(id);
    });
    return ids.slice(0, 10);
  }

  /* ---------------------------------------------------------------- 3. programs and plans */
  var LEVEL_ORDER = ['beginner', 'intermediate', 'advanced'];
  function recommendPrograms(profile, programs) {
    var out = programs.map(function (p) {
      var score = 0, reasons = [];
      if (p.goal === profile.goal) { score += 100; reasons.push('Built for ' + DATA.GOALS[p.goal].label.toLowerCase()); }
      if (p.level.indexOf(profile.level) >= 0) { score += 30; reasons.push('Matches your level'); }
      else {
        var d = Math.min.apply(null, p.level.map(function (l) { return Math.abs(LEVEL_ORDER.indexOf(l) - LEVEL_ORDER.indexOf(profile.level)); }));
        if (d === 1) { score += 10; reasons.push('One level off, workable'); } else score -= 20;
      }
      if (p.location.indexOf(profile.location) >= 0) {
        score += 20; reasons.push(profile.location === 'home' ? 'Works at home' : 'Gym program');
        if (p.location.length === 1) score += 5; /* built only for this setting beats a program that merely allows it */
      } else score -= 40;
      var dd = Math.abs(p.perWeek - (profile.daysPerWeek || 4));
      score -= dd * 6;
      if (dd === 0) reasons.push(p.perWeek + ' sessions a week, as you asked');
      else reasons.push(p.perWeek + ' sessions a week');
      return { program: p, score: score, reasons: reasons };
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  /* collect every exercise a program will load, with the scheme that governs it */
  function programExercises(program, profile, exById) {
    var map = {};
    program.days.forEach(function (day) {
      day.blocks.forEach(function (b) {
        if (b.kind !== 'strength') return;
        var r = resolveExercise(b, profile, exById);
        if (!map[r.id]) map[r.id] = b.scheme;
      });
    });
    return map;
  }

  /* the user's best estimate for the main lifts, from the onboarding strength step */
  function knownE1rm(profile, exId) {
    var s = profile && profile.strength && profile.strength[exId];
    if (!s || !s.kg || !s.reps) return 0;
    return e1rm(s.kg, s.reps);
  }

  /* a sensible first load when the user has not told us anything: empty bar, light dumbbells, or bodyweight */
  function defaultStartKg(ex) {
    if (!ex) return null;
    if (ex.bw) return 0;
    var q = ex.equip || [];
    if (q.indexOf('barbell') >= 0 || q.indexOf('smith') >= 0 || q.indexOf('ez_bar') >= 0 || q.indexOf('trap_bar') >= 0) return 20;
    if (q.indexOf('dumbbells') >= 0) return 8;
    if (q.indexOf('kettlebell') >= 0) return 12;
    return null; /* machines and cables: ask on the first set */
  }

  function startState(scheme, ex, profile, units) {
    var one = knownE1rm(profile, ex.id);
    var st = { kg: null, stage: 0, reps: null, fails: 0, stage0Kg: null };
    var targetReps = scheme.type === 'sets' ? scheme.reps : scheme.type === 'pyramid' ? scheme.reps[scheme.reps.length - 1] : 10;
    if (scheme.type === 'gzclp') targetReps = scheme.tier === 'T1' ? 3 : scheme.tier === 'T2' ? 10 : 15;
    if (one) {
      /* start 10-15% under what the estimate says you could do for the target reps, so the first weeks are wins */
      var factor = scheme.type === 'gzclp' ? 0.85 : 0.9;
      st.kg = loadForReps(one, targetReps) * factor;
    } else {
      st.kg = defaultStartKg(ex);
    }
    if (scheme.type === 'sets') st.reps = scheme.range ? scheme.range[0] : scheme.reps;
    if (st.kg != null && st.kg > 0) st.kg = lbToKgRound(st.kg, units);
    st.stage0Kg = st.kg;
    return st;
  }
  /* snap a kg value to the display unit's plate step and back to kg */
  function lbToKgRound(kg, units) {
    var v = roundLoad(kg, units);
    return units === 'lb' ? lbToKg(v) : v;
  }

  function startPlan(program, profile, exById, units, t) {
    t = t || now();
    var plan = { programId: program.id, startedAt: t, dayIndex: 0, round: 0, sessions: 0, state: {}, tm: {}, ladders: {}, c25kWeek: 1, wodChoice: {} };
    var map = programExercises(program, profile, exById);
    Object.keys(map).forEach(function (id) {
      var ex = exById[id], scheme = map[id];
      if (scheme.type === '531') {
        var one = knownE1rm(profile, id);
        plan.tm[id] = one ? lbToKgRound(one * 0.9, units) : null;
      } else if (scheme.type !== 'amrap') {
        plan.state[id] = startState(scheme, ex, profile, units);
      }
    });
    Object.keys(DATA.LADDERS).forEach(function (l) {
      var start = ladderStartRung(l, profile);
      plan.ladders[l] = { rung: start, reps: DATA.LADDER_RULES.repsLow, seconds: DATA.LADDER_RULES.holdLow, kg: 0, fails: 0 };
    });
    return plan;
  }

  /* where a ladder starts: beginners at the bottom, intermediates a couple of rungs up, advanced near the top */
  function ladderStartRung(ladderId, profile) {
    var L = DATA.LADDERS[ladderId];
    if (!L) return 0;
    var n = L.rungs.length;
    var lvl = profile ? profile.level : 'beginner';
    var r = lvl === 'advanced' ? Math.max(0, n - 3) : lvl === 'intermediate' ? Math.min(2, n - 2) : 0;
    /* never start on a weighted rung */
    while (r > 0 && L.rungs[r].weighted) r--;
    return Math.max(0, r);
  }

  function currentDay(plan, program) {
    var i = plan.dayIndex % program.days.length;
    return { index: i, day: program.days[i] };
  }
  function calendarWeek(plan, t) { return Math.floor(((t || now()) - plan.startedAt) / WEEK) + 1; }
  function isDeloadWeek(plan, program, t) {
    var every = program.deload && program.deload.everyWeeks;
    if (!every) return false;
    return calendarWeek(plan, t) % every === 0;
  }
  /* the 5/3/1 wave for this pass through the program: 1, 2, 3, then the optional deload 4 */
  function cycleWeek(plan) { return (plan.round % 4) + 1; }

  /* ---------------------------------------------------------------- 4. building a workout */
  var GZCLP = {
    T1: [{ sets: 5, reps: 3 }, { sets: 6, reps: 2 }, { sets: 10, reps: 1 }],
    T2: [{ sets: 3, reps: 10 }, { sets: 3, reps: 8 }, { sets: 3, reps: 6 }],
    T3: [{ sets: 3, reps: 15 }]
  };
  var WAVE_531 = [
    { pct: [0.65, 0.75, 0.85], reps: [5, 5, 5], amrap: true },
    { pct: [0.70, 0.80, 0.90], reps: [3, 3, 3], amrap: true },
    { pct: [0.75, 0.85, 0.95], reps: [5, 3, 1], amrap: true },
    { pct: [0.40, 0.50, 0.60], reps: [5, 5, 5], amrap: false }
  ];

  function mkSet(n, reps, kg, amrap) {
    return { n: n, targetReps: reps, targetKg: kg == null ? null : kg, amrap: !!amrap, done: false, reps: null, kg: null };
  }

  /* the sets a scheme asks for today, given the exercise's progression state */
  function targetSets(scheme, st, plan, exId, units, deload) {
    var sets = [], i, n, reps, kg = st ? st.kg : null;
    if (scheme.type === 'sets') {
      n = scheme.sets; reps = (st && st.reps) || scheme.reps;
      if (deload) n = Math.max(1, Math.ceil(n / 2));
      for (i = 1; i <= n; i++) sets.push(mkSet(i, reps, kg, scheme.amrapLast && i === n));
    } else if (scheme.type === 'pyramid') {
      var top = kg, last = scheme.reps[scheme.reps.length - 1];
      scheme.reps.forEach(function (r, k) {
        var w = top == null ? null : lbToKgRound(top * (1 + last / 30) / (1 + r / 30), units);
        if (deload && k < scheme.reps.length - 2) return;
        sets.push(mkSet(k + 1, r, w, false));
      });
    } else if (scheme.type === 'gzclp') {
      var stage = GZCLP[scheme.tier][Math.min(st ? st.stage : 0, GZCLP[scheme.tier].length - 1)];
      n = deload ? Math.ceil(stage.sets / 2) : stage.sets;
      for (i = 1; i <= n; i++) sets.push(mkSet(i, stage.reps, kg, scheme.tier !== 'T2' && i === n));
    } else if (scheme.type === '531') {
      var wave = WAVE_531[cycleWeek(plan) - 1], tm = plan.tm[exId];
      wave.pct.forEach(function (p, k) {
        sets.push(mkSet(k + 1, wave.reps[k], tm == null ? null : lbToKgRound(tm * p, units), wave.amrap && k === 2));
      });
      if (scheme.bbb && cycleWeek(plan) !== 4) {
        var bn = deload ? 3 : 5;
        for (i = 1; i <= bn; i++) sets.push(mkSet(sets.length + 1, 10, tm == null ? null : lbToKgRound(tm * 0.5, units), false));
        sets.bbbFrom = 3;
      }
    } else if (scheme.type === 'amrap') {
      n = deload ? Math.ceil(scheme.sets / 2) : scheme.sets;
      for (i = 1; i <= n; i++) sets.push(mkSet(i, null, 0, true));
    }
    return sets;
  }

  function buildWorkout(plan, program, profile, exById, units, t) {
    t = t || now();
    var cd = currentDay(plan, program), day = cd.day;
    var deload = isDeloadWeek(plan, program, t);
    var w = { id: Storage_.newId(), programId: program.id, dayId: day.id, dayName: day.name, dayKind: day.kind, dayIndex: cd.index,
      week: calendarWeek(plan, t), deload: deload, startedAt: t, endedAt: null, status: 'active', blocks: [], notes: '', rpe: null, kcal: 0 };
    day.blocks.forEach(function (b, bi) {
      var block = { id: 'b' + bi, kind: b.kind, note: b.note || null };
      if (b.kind === 'warmup' || b.kind === 'cooldown') {
        block.items = b.items.map(function (it) { var r = resolveExercise(it, profile, exById); return { exerciseId: r.id, reps: it.reps || null, seconds: it.seconds || null, done: false }; });
      } else if (b.kind === 'strength') {
        var r = resolveExercise(b, profile, exById);
        block.exerciseId = r.id; block.substituted = r.substituted; block.scheme = b.scheme; block.rest = b.rest || 90; block.tier = b.scheme.tier || null;
        if (b.scheme.note) block.note = b.scheme.note;
        var st = plan.state[r.id];
        if (!st && b.scheme.type !== '531' && b.scheme.type !== 'amrap') { st = startState(b.scheme, exById[r.id], profile, units); plan.state[r.id] = st; }
        if (b.scheme.type === '531' && plan.tm[r.id] === undefined) plan.tm[r.id] = null;
        block.sets = targetSets(b.scheme, st, plan, r.id, units, deload);
        if (b.scheme.type === '531') { block.wave = cycleWeek(plan); block.tm = plan.tm[r.id]; block.bbbFrom = block.sets.bbbFrom || null; }
        if (b.scheme.type === 'gzclp') block.stage = st.stage;
      } else if (b.kind === 'hold') {
        var rh = resolveExercise(b, profile, exById);
        block.exerciseId = rh.id; block.rest = b.rest || 45;
        block.sets = []; for (var i = 1; i <= (deload ? Math.ceil(b.sets / 2) : b.sets); i++) block.sets.push({ n: i, targetSeconds: b.seconds, done: false, seconds: null });
      } else if (b.kind === 'ladder') {
        var L = DATA.LADDERS[b.ladder], ls = plan.ladders[b.ladder];
        if (!ls) { ls = { rung: ladderStartRung(b.ladder, profile), reps: 5, seconds: 10, kg: 0, fails: 0 }; plan.ladders[b.ladder] = ls; }
        var rung = L.rungs[Math.min(ls.rung, L.rungs.length - 1)];
        block.ladderId = b.ladder; block.rung = ls.rung; block.rungCount = L.rungs.length; block.exerciseId = rung.ex; block.rest = b.rest || 90;
        block.hold = !!rung.seconds; block.weighted = !!rung.weighted; block.label = rung.label || null;
        block.sets = [];
        var ns = deload ? 2 : DATA.LADDER_RULES.sets;
        for (var k = 1; k <= ns; k++) {
          if (rung.seconds) block.sets.push({ n: k, targetSeconds: ls.seconds || 10, done: false, seconds: null });
          else block.sets.push(mkSet(k, ls.reps || 5, rung.weighted ? (ls.kg || 0) : 0, false));
        }
      } else if (b.kind === 'circuit') {
        block.format = b.format; block.minutes = b.minutes || null; block.rounds = b.rounds || null;
        block.items = b.items.map(function (it) { var r = resolveExercise(it, profile, exById); return { exerciseId: r.id, reps: it.reps || null, seconds: it.seconds || null, meters: it.meters || null, cal: it.cal || null }; });
        block.result = null;
      } else if (b.kind === 'wod') {
        if (b.wod.indexOf('pick:') === 0) { block.pick = b.wod.slice(5); block.wodId = plan.wodChoice[day.id] || null; }
        else block.wodId = b.wod;
        block.result = null;
      } else if (b.kind === 'cardio') {
        var proto = DATA.CARDIO[b.protocol];
        block.protocol = b.protocol; block.minutes = b.minutes || (proto && proto.defaultMinutes) || 30;
        block.c25kWeek = b.protocol === 'c25k' ? plan.c25kWeek : null;
        block.exerciseId = (proto && proto.ex) || null;
        block.result = null;
      }
      w.blocks.push(block);
    });
    return w;
  }

  /* ---------------------------------------------------------------- 5. progression rules */
  function allSetsHit(sets, target) {
    return sets.length > 0 && sets.every(function (s) { return s.done && s.reps != null && s.reps >= (target != null ? target : (s.targetReps || 0)); });
  }
  function anyDone(sets) { return sets.some(function (s) { return s.done; }); }
  function doneSets(sets) { return sets.filter(function (s) { return s.done; }); }
  function actualKg(sets, fallback) { var d = doneSets(sets); if (!d.length) return fallback; var k = d[d.length - 1].kg; return k == null ? fallback : k; }

  function progressLinear(st, sets, scheme, ex, units, notes) {
    var cls = scheme.inc || liftClass(ex), inc = incKg(cls, units);
    var used = actualKg(sets, st.kg);
    if (allSetsHit(sets)) { st.kg = used + inc; st.fails = 0; notes.push({ ex: ex.id, text: 'Next time: ' + fmtLoad(st.kg, units) + ' (+' + fmtLoad(inc, units) + ')' }); }
    else { st.kg = used; st.fails = (st.fails || 0) + 1; if (st.fails >= 3) { st.kg = lbToKgRound(used * 0.9, units); st.fails = 0; notes.push({ ex: ex.id, text: 'Three misses: dropping to ' + fmtLoad(st.kg, units) + ' and climbing again.' }); } else notes.push({ ex: ex.id, text: 'Same weight next time (' + st.fails + ' of 3 misses).' }); }
  }
  function progressDouble(st, sets, scheme, ex, units, notes) {
    var lo = scheme.range ? scheme.range[0] : scheme.reps, hi = scheme.range ? scheme.range[1] : scheme.reps;
    var cls = scheme.inc || liftClass(ex), inc = incKg(cls, units);
    var used = actualKg(sets, st.kg);
    if (used === 0 || used == null) { /* bodyweight: progress reps only */
      if (allSetsHit(sets, hi)) notes.push({ ex: ex.id, text: 'All sets at ' + hi + '. Time for a harder variation or added weight.' });
      else if (allSetsHit(sets)) { st.reps = Math.min(hi, (st.reps || lo) + 1); notes.push({ ex: ex.id, text: 'Next time aim for ' + st.reps + ' reps.' }); }
      return;
    }
    if (allSetsHit(sets, hi)) { st.kg = used + inc; st.reps = lo; st.fails = 0; notes.push({ ex: ex.id, text: 'Top of the range on every set. Next time ' + fmtLoad(st.kg, units) + ' for ' + lo + '.' }); }
    else if (allSetsHit(sets)) { st.kg = used; st.reps = Math.min(hi, (st.reps || lo) + 1); st.fails = 0; notes.push({ ex: ex.id, text: 'Next time ' + fmtLoad(used, units) + ' for ' + st.reps + ' reps.' }); }
    else { st.kg = used; st.fails = (st.fails || 0) + 1; if (st.fails >= 3) { st.kg = lbToKgRound(used * 0.95, units); st.reps = lo; st.fails = 0; notes.push({ ex: ex.id, text: 'Stalled three times: 5% off, back to ' + lo + ' reps.' }); } }
  }
  function progressPyramid(st, sets, scheme, ex, units, notes) {
    var top = sets[sets.length - 1], inc = incKg(liftClass(ex), units);
    var used = top && top.done && top.kg != null ? top.kg : st.kg;
    if (top && top.done && top.reps != null && top.reps >= top.targetReps) { st.kg = used + inc; notes.push({ ex: ex.id, text: 'Top set made. Pyramid climbs to ' + fmtLoad(st.kg, units) + '.' }); }
    else st.kg = used;
  }
  function progressGzclp(st, sets, scheme, ex, units, notes) {
    var tier = scheme.tier, stages = GZCLP[tier], inc = incKg(liftClass(ex), units);
    var used = actualKg(sets, st.kg);
    if (st.stage0Kg == null) st.stage0Kg = used;
    if (tier === 'T3') {
      var last = sets[sets.length - 1];
      if (last && last.done && last.reps >= 25) { st.kg = used + inc; notes.push({ ex: ex.id, text: 'T3: 25+ on the last set, up to ' + fmtLoad(st.kg, units) + '.' }); }
      else st.kg = used;
      return;
    }
    if (allSetsHit(sets)) { st.kg = used + inc; notes.push({ ex: ex.id, text: tier + ' made: ' + fmtLoad(st.kg, units) + ' next time.' }); return; }
    st.kg = used;
    st.stage = (st.stage || 0) + 1;
    if (st.stage < stages.length) { notes.push({ ex: ex.id, text: tier + ' missed: same weight, now ' + stages[st.stage].sets + 'x' + stages[st.stage].reps + '.' }); return; }
    /* all stages exhausted */
    st.stage = 0;
    if (tier === 'T1') {
      var best = 0; sets.forEach(function (s) { if (s.done && s.reps) best = Math.max(best, e1rm(s.kg != null ? s.kg : used, s.reps)); });
      st.kg = lbToKgRound(loadForReps(best || used, 5) * 0.85, units);
      notes.push({ ex: ex.id, text: 'T1 reset: restarting 5x3 at ' + fmtLoad(st.kg, units) + ' (85% of your estimated 5RM).' });
    } else {
      st.kg = lbToKgRound((st.stage0Kg || used) + inc * 2, units);
      notes.push({ ex: ex.id, text: 'T2 reset: back to 3x10 at ' + fmtLoad(st.kg, units) + '.' });
    }
    st.stage0Kg = st.kg;
  }
  /* 5/3/1: the training max only moves at the end of a cycle (see finishWorkout) */
  function progress531(plan, block, ex, units, notes) {
    var top = block.sets[2];
    if (plan.tm[ex.id] == null && top && top.done && top.kg) { plan.tm[ex.id] = lbToKgRound(e1rm(top.kg, top.reps || 1) * 0.9, units); notes.push({ ex: ex.id, text: 'Training max set to ' + fmtLoad(plan.tm[ex.id], units) + ' from today.' }); return; }
    if (block.wave === 3 && top && top.done && top.reps != null) {
      if (top.reps < 1) { plan.tm[ex.id] = lbToKgRound(plan.tm[ex.id] * 0.9, units); notes.push({ ex: ex.id, text: 'Missed the 95% single: training max drops 10%.' }); }
      else notes.push({ ex: ex.id, text: top.reps + ' reps at 95%. Training max goes up after this cycle.' });
    }
  }
  function progressLadder(ls, block, units, notes) {
    var L = DATA.LADDERS[block.ladderId], rung = L.rungs[Math.min(ls.rung, L.rungs.length - 1)], R = DATA.LADDER_RULES;
    var top = ls.rung >= L.rungs.length - 1;
    if (block.hold) {
      var d = block.sets.filter(function (s) { return s.done && s.seconds != null; });
      if (!d.length) return;
      var min = Math.min.apply(null, d.map(function (s) { return s.seconds; }));
      if (min >= R.holdHigh) {
        if (top) notes.push({ ladder: block.ladderId, text: L.name + ': 30 s on every set at the top rung. Add load or slow the tempo.' });
        else { ls.rung++; ls.seconds = R.holdLow; ls.reps = R.repsLow; notes.push({ ladder: block.ladderId, text: L.name + ': moving up to ' + L.rungs[ls.rung].ex + '.' }); }
      } else { ls.seconds = Math.min(R.holdHigh, min + 5); notes.push({ ladder: block.ladderId, text: L.name + ': aim for ' + ls.seconds + ' s next time.' }); }
      return;
    }
    if (allSetsHit(block.sets, R.repsHigh)) {
      if (rung.weighted) { ls.kg = (ls.kg || 0) + incKg('upper', units); ls.reps = R.repsLow; notes.push({ ladder: block.ladderId, text: L.name + ': 3x8 made, add ' + fmtLoad(ls.kg, units) + ' next time.' }); }
      else if (top) notes.push({ ladder: block.ladderId, text: L.name + ': top rung complete. Keep adding reps or load.' });
      else { ls.rung++; ls.reps = R.repsLow; ls.seconds = R.holdLow; notes.push({ ladder: block.ladderId, text: L.name + ': moving up to ' + L.rungs[ls.rung].ex + ', back to 3x5.' }); }
      ls.fails = 0;
    } else if (allSetsHit(block.sets)) { ls.reps = Math.min(R.repsHigh, (ls.reps || R.repsLow) + 1); ls.fails = 0; notes.push({ ladder: block.ladderId, text: L.name + ': next time 3x' + ls.reps + '.' }); }
    else { ls.fails = (ls.fails || 0) + 1; if (ls.fails >= 3 && ls.rung > 0 && !rung.weighted) { ls.rung--; ls.reps = R.repsHigh - 1; ls.fails = 0; notes.push({ ladder: block.ladderId, text: L.name + ': three misses, one rung down to rebuild.' }); } }
  }

  /* ---------------------------------------------------------------- 6. finishing a workout */
  function detectPrs(prs, workout, exById) {
    var found = [];
    workout.blocks.forEach(function (b) {
      if ((b.kind === 'strength' || b.kind === 'ladder') && b.sets) {
        b.sets.forEach(function (s) {
          if (!s.done || !s.reps) return;
          var k = s.kg == null ? (s.targetKg || 0) : s.kg;
          var rec = prs[b.exerciseId] = prs[b.exerciseId] || {};
          if (k > 0) {
            var v = e1rm(k, s.reps);
            if (!rec.e1rm || v > rec.e1rm.value + 0.01) { rec.e1rm = { kg: k, reps: s.reps, value: v, at: workout.startedAt, workoutId: workout.id }; found.push({ exerciseId: b.exerciseId, kind: 'e1rm', value: v, kg: k, reps: s.reps }); }
          } else if (!rec.reps || s.reps > rec.reps.reps) { rec.reps = { reps: s.reps, at: workout.startedAt, workoutId: workout.id }; found.push({ exerciseId: b.exerciseId, kind: 'reps', reps: s.reps }); }
        });
      }
      if (b.kind === 'wod' && b.wodId && b.result) {
        var wod = DATA.wodById[b.wodId], rec2 = prs['wod:' + b.wodId] = prs['wod:' + b.wodId] || {};
        if (wod && (!rec2.score || betterWod(wod, b.result, rec2.score))) { rec2.score = Object.assign({ at: workout.startedAt, workoutId: workout.id }, b.result); found.push({ wodId: b.wodId, kind: 'wod', result: b.result }); }
      }
    });
    /* the first time an exercise is logged counts as a record but is not worth a celebration */
    return found;
  }

  function workoutKcal(workout, exById, bodyKg) {
    var total = 0;
    workout.blocks.forEach(function (b) {
      var ex = exById[b.exerciseId];
      if ((b.kind === 'strength' || b.kind === 'ladder' || b.kind === 'hold') && b.sets) {
        var n = doneSets(b.sets).length;
        total += kcal(ex ? ex.met : 5, n * 0.75 + n * ((b.rest || 60) / 60) * 0.5, bodyKg);
      } else if ((b.kind === 'circuit' || b.kind === 'wod') && b.result && b.result.seconds) {
        total += kcal(8, b.result.seconds / 60, bodyKg);
      } else if (b.kind === 'cardio' && b.result && b.result.minutes) {
        var proto = DATA.CARDIO[b.protocol];
        var met = ex ? ex.met : (proto && proto.kind === 'intervals' ? 9 : 6);
        total += kcal(met, b.result.minutes, bodyKg);
      } else if ((b.kind === 'warmup' || b.kind === 'cooldown') && b.items) {
        total += kcal(3, b.items.length * 0.75, bodyKg);
      }
    });
    return Math.round(total);
  }

  /* apply every rule, bump the plan pointer, return the notes for the summary screen. Mutates plan, prs and workout.
     opts.advance === false keeps the day pointer where it is (free sessions outside the program). */
  function finishWorkout(plan, program, workout, prs, profile, exById, units, t, opts) {
    t = t || now();
    var advance = !(opts && opts.advance === false);
    var notes = [];
    workout.endedAt = t; workout.status = 'done';
    workout.blocks.forEach(function (b) {
      var ex = exById[b.exerciseId];
      if (b.kind === 'strength' && anyDone(b.sets)) {
        var sch = b.scheme, st = plan.state[b.exerciseId];
        if (sch.type === '531') progress531(plan, b, ex, units, notes);
        else if (sch.type === 'amrap') { /* reps only */ }
        else {
          if (!st) st = plan.state[b.exerciseId] = { kg: actualKg(b.sets, 0), stage: 0, reps: null, fails: 0, stage0Kg: null };
          if (sch.type === 'gzclp') progressGzclp(st, b.sets, sch, ex, units, notes);
          else if (sch.type === 'pyramid') progressPyramid(st, b.sets, sch, ex, units, notes);
          else if (sch.rule === 'linear') progressLinear(st, b.sets, sch, ex, units, notes);
          else progressDouble(st, b.sets, sch, ex, units, notes);
        }
      } else if (b.kind === 'ladder' && anyDone(b.sets)) {
        var ls = plan.ladders[b.ladderId];
        if (ls) progressLadder(ls, b, units, notes);
      } else if (b.kind === 'cardio' && b.protocol === 'c25k' && b.result && b.result.done) {
        plan.c25kRuns = (plan.c25kRuns || 0) + 1;
        if (plan.c25kRuns % 3 === 0 && plan.c25kWeek < 9) { plan.c25kWeek++; notes.push({ text: 'Couch to 5K: week ' + plan.c25kWeek + ' unlocked.' }); }
      }
    });
    var found = detectPrs(prs, workout, exById);
    workout.kcal = workoutKcal(workout, exById, profile && profile.bodyKg);
    workout.prs = found.map(function (p) { return p.exerciseId || p.wodId; });
    /* advance the plan */
    plan.sessions = (plan.sessions || 0) + 1;
    if (!advance) return { notes: notes, prs: found };
    plan.dayIndex = (plan.dayIndex + 1) % program.days.length;
    if (plan.dayIndex === 0) {
      plan.round = (plan.round || 0) + 1;
      /* 5/3/1: after the third wave the training maxes go up */
      if (program.progression === '531' && plan.round % 4 === 3) {
        Object.keys(plan.tm).forEach(function (id) {
          if (plan.tm[id] == null) return;
          var ex2 = exById[id];
          plan.tm[id] = lbToKgRound(plan.tm[id] + incKg(liftClass(ex2), units), units);
          notes.push({ ex: id, text: 'Cycle done. Training max up to ' + fmtLoad(plan.tm[id], units) + '.' });
        });
      }
    }
    return { notes: notes, prs: found };
  }

  /* ---------------------------------------------------------------- 7. analysis */
  function startOfWeek(t, weekStartsOn) {
    var d = new Date(t); d.setHours(0, 0, 0, 0);
    var diff = (d.getDay() - (weekStartsOn == null ? 1 : weekStartsOn) + 7) % 7;
    return d.getTime() - diff * DAY;
  }
  var VOLUME_TARGET = { lean: [10, 14], cut: [10, 14], buffed: [12, 20] };
  var SMALL_GROUPS = { calves: [6, 12], core: [6, 12], biceps: [6, 14], triceps: [6, 14] };
  function weeklySets(workouts, exById, from, to) {
    var per = {};
    Object.keys(DATA.MUSCLES).forEach(function (m) { per[m] = 0; });
    workouts.forEach(function (w) {
      if (w.status !== 'done' || w.startedAt < from || w.startedAt >= to) return;
      w.blocks.forEach(function (b) {
        if (!(b.kind === 'strength' || b.kind === 'ladder' || b.kind === 'hold') || !b.sets) return;
        var ex = exById[b.exerciseId]; if (!ex) return;
        var n = doneSets(b.sets).length; if (!n) return;
        ex.primary.forEach(function (m) { per[m] += n; });
        ex.secondary.forEach(function (m) { per[m] += n * 0.5; });
      });
    });
    return per;
  }
  function volumeReport(workouts, exById, goal, from, to) {
    var per = weeklySets(workouts, exById, from, to);
    var target = VOLUME_TARGET[goal] || VOLUME_TARGET.lean;
    return DATA.VOLUME_GROUPS.map(function (g) {
      var sets = 0; g.muscles.forEach(function (m) { sets += per[m] || 0; });
      sets = Math.round(sets * 10) / 10;
      var tgt = SMALL_GROUPS[g.id] || target;
      return { id: g.id, label: g.label, sets: sets, target: tgt, status: sets < tgt[0] ? 'low' : sets > tgt[1] ? 'high' : 'ok' };
    });
  }
  function strengthTrend(workouts, exId) {
    var pts = [];
    workouts.forEach(function (w) {
      if (w.status !== 'done') return;
      var best = 0;
      w.blocks.forEach(function (b) { if (b.exerciseId !== exId || !b.sets) return; b.sets.forEach(function (s) { if (s.done && s.reps && (s.kg || s.targetKg)) best = Math.max(best, e1rm(s.kg != null ? s.kg : s.targetKg, s.reps)); }); });
      if (best) pts.push({ t: w.startedAt, e1rm: best });
    });
    pts.sort(function (a, b) { return a.t - b.t; });
    return pts;
  }
  function exerciseHistory(workouts, exId) {
    var out = [];
    workouts.forEach(function (w) {
      if (w.status !== 'done') return;
      w.blocks.forEach(function (b) { if (b.exerciseId === exId && b.sets && anyDone(b.sets)) out.push({ t: w.startedAt, workoutId: w.id, sets: doneSets(b.sets) }); });
    });
    out.sort(function (a, b) { return b.t - a.t; });
    return out;
  }
  /* sessions this week vs planned, and how many consecutive weeks met the bar (at least min(planned, 3) sessions) */
  function weekSummary(workouts, program, t, weekStartsOn) {
    t = t || now();
    var ws = startOfWeek(t, weekStartsOn), planned = program ? (program.perWeek || program.days.length) : 3;
    var bar = Math.min(planned, 3);
    function count(from) { return workouts.filter(function (w) { return w.status === 'done' && w.startedAt >= from && w.startedAt < from + WEEK; }).length; }
    var thisWeek = count(ws), streak = 0, cursor = ws;
    if (thisWeek >= bar) { streak = 1; }
    cursor -= WEEK;
    while (count(cursor) >= bar) { streak++; cursor -= WEEK; if (streak > 520) break; }
    if (thisWeek < bar && streak > 0) { /* current week not yet met: streak counts past weeks only */ }
    return { thisWeek: thisWeek, planned: planned, streakWeeks: streak, weekStart: ws };
  }
  function cardioMinutes(workouts, from, to) {
    var easy = 0, hard = 0;
    workouts.forEach(function (w) {
      if (w.status !== 'done' || w.startedAt < from || w.startedAt >= to) return;
      w.blocks.forEach(function (b) {
        if (b.kind === 'cardio' && b.result && b.result.minutes) { var p = DATA.CARDIO[b.protocol]; if (p && p.kind === 'intervals') hard += b.result.minutes; else easy += b.result.minutes; }
        if ((b.kind === 'wod' || b.kind === 'circuit') && b.result && b.result.seconds) hard += b.result.seconds / 60;
      });
    });
    return { easy: Math.round(easy), hard: Math.round(hard) };
  }

  /* ---------------------------------------------------------------- 8. WOD scoring */
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function wodScore(wod, r) {
    if (!r) return '';
    var f = wod.format;
    if (f === 'fortime' || f === 'rounds' || f === 'chipper') return r.finished === false ? (r.reps || 0) + ' reps at the cap' : fmtTime(r.seconds);
    if (f === 'amrap' || f === 'emom') return (r.rounds || 0) + ' rounds' + (r.reps ? ' + ' + r.reps : '');
    if (f === 'maxreps' || f === 'tabata') return (r.reps || 0) + ' reps';
    if (f === 'deathby') return 'Minute ' + (r.rounds || 0);
    return '';
  }
  function betterWod(wod, a, b) {
    var f = wod.format;
    if (f === 'fortime' || f === 'rounds' || f === 'chipper') {
      if (a.finished === false && b.finished === false) return (a.reps || 0) > (b.reps || 0);
      if (a.finished === false) return false;
      if (b.finished === false) return true;
      return a.seconds < b.seconds;
    }
    if (f === 'amrap' || f === 'emom') return (a.rounds || 0) * 1000 + (a.reps || 0) > (b.rounds || 0) * 1000 + (b.reps || 0);
    return (a.reps || a.rounds || 0) > (b.reps || b.rounds || 0);
  }
  function rxLoad(load, sex, units) {
    if (!load) return '';
    var lb = sex === 'f' ? load.f : load.m;
    return units === 'lb' ? lb + ' lb' : (Math.round(lbToKg(lb) / 0.5) * 0.5) + ' kg';
  }

  /* ---------------------------------------------------------------- 9. timers */
  /* A timer is plain state: { spec, running, startedAt, elapsedBefore }. view() derives everything from elapsed ms,
     so the UI can tick with setInterval and nothing drifts if a tick is late. */
  var Timer = {
    create: function (spec) { return { spec: spec, running: false, startedAt: null, elapsedBefore: 0 }; },
    start: function (t, at) { if (!t.running) { t.running = true; t.startedAt = at; } return t; },
    pause: function (t, at) { if (t.running) { t.elapsedBefore += at - t.startedAt; t.running = false; t.startedAt = null; } return t; },
    reset: function (t) { t.running = false; t.startedAt = null; t.elapsedBefore = 0; return t; },
    elapsed: function (t, at) { return t.elapsedBefore + (t.running ? at - t.startedAt : 0); },
    view: function (t, at) {
      var e = Timer.elapsed(t, at), s = t.spec, v = { elapsedMs: e, running: t.running, done: false, phase: null, label: '', remainingMs: null, round: null, zone: null, segIndex: null };
      if (s.kind === 'countdown') { v.remainingMs = Math.max(0, s.totalMs - e); v.done = e >= s.totalMs; v.label = s.label || ''; }
      else if (s.kind === 'stopwatch') { v.remainingMs = s.capMs ? Math.max(0, s.capMs - e) : null; v.done = !!s.capMs && e >= s.capMs; }
      else if (s.kind === 'emom' || s.kind === 'deathby') {
        var minute = Math.floor(e / 60000) + 1, total = s.minutes || 0;
        v.round = minute; v.remainingMs = 60000 - (e % 60000); v.label = s.kind === 'deathby' ? minute + ' rep' + (minute > 1 ? 's' : '') : 'Minute ' + minute + (total ? ' of ' + total : '');
        v.done = !!total && e >= total * 60000;
        if (v.done) { v.round = total; v.remainingMs = 0; }
      } else if (s.kind === 'tabata') {
        var work = (s.workSec || 20) * 1000, rest = (s.restSec || 10) * 1000, rounds = s.rounds || 8, cycle = work + rest;
        var idx = Math.floor(e / cycle), inCycle = e % cycle;
        if (idx >= rounds) { v.done = true; v.round = rounds; v.remainingMs = 0; v.phase = 'done'; }
        else { v.round = idx + 1; v.phase = inCycle < work ? 'work' : 'rest'; v.remainingMs = v.phase === 'work' ? work - inCycle : cycle - inCycle; v.label = (v.phase === 'work' ? 'Work' : 'Rest') + ' ' + v.round + ' of ' + rounds; }
      } else if (s.kind === 'segments') {
        var acc = 0, segs = s.segments || [];
        for (var i = 0; i < segs.length; i++) {
          var ms = segs[i].seconds * 1000;
          if (e < acc + ms) { v.segIndex = i; v.label = segs[i].label; v.zone = segs[i].zone; v.remainingMs = acc + ms - e; v.phase = segs[i].zone; break; }
          acc += ms;
        }
        if (v.segIndex == null) { v.done = true; v.remainingMs = 0; v.phase = 'done'; v.label = 'Done'; }
        v.totalMs = segs.reduce(function (a, g) { return a + g.seconds * 1000; }, 0);
      }
      return v;
    }
  };

  window.Engine = {
    _setNow: function (fn) { now = fn; },
    kgToLb: kgToLb, lbToKg: lbToKg, roundLoad: roundLoad, fmtLoad: fmtLoad, toKg: toKg, incKg: incKg, liftClass: liftClass,
    e1rm: e1rm, loadForReps: loadForReps, kcal: kcal, hrMax: hrMax, age: age,
    hasEquipment: hasEquipment, avoids: avoids, usable: usable, resolveSlot: resolveSlot, resolveExercise: resolveExercise, alternativesFor: alternativesFor,
    recommendPrograms: recommendPrograms, startPlan: startPlan, startState: startState, ladderStartRung: ladderStartRung,
    currentDay: currentDay, calendarWeek: calendarWeek, isDeloadWeek: isDeloadWeek, cycleWeek: cycleWeek,
    buildWorkout: buildWorkout, targetSets: targetSets, finishWorkout: finishWorkout, detectPrs: detectPrs, workoutKcal: workoutKcal,
    weeklySets: weeklySets, volumeReport: volumeReport, strengthTrend: strengthTrend, exerciseHistory: exerciseHistory, weekSummary: weekSummary, cardioMinutes: cardioMinutes, startOfWeek: startOfWeek,
    fmtTime: fmtTime, wodScore: wodScore, betterWod: betterWod, rxLoad: rxLoad,
    Timer: Timer, GZCLP: GZCLP, WAVE_531: WAVE_531
  };
})();
