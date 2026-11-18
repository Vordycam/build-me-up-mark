/* Workout tab: the guided session.
   Features:
     - next-session card when nothing is active (start it, or a free WOD / cardio session)
     - one card per block: warm-up and cool-down checklists; strength and ladder blocks with the faceless
       animation, steps and cues, a sets table with prefilled targets, a done button per set and a swap button;
       holds with a countdown; circuits, WODs and cardio protocols with their own full-screen clock and score entry
     - rest timer bar after each logged set (+30 s, skip), with a beep when it ends
     - WOD picker for "pick:" days, Rx loads in the user's units and sex, scaling text, personal best
     - finish: summary modal with the progression notes, PRs, estimated calories, RPE and notes; abandon
     - the Timer overlay (App.timer) used by every clocked block */
(function () {
  'use strict';
  var A = window.App;

  /* ---------------------------------------------------------------- render */
  A.register('workout', function (el) {
    var w = A.activeWorkout();
    if (!w) { renderIdle(el); return; }
    renderActive(el, w);
  });

  function renderIdle(el) {
    var p = A.profile(), plan = A.plan(), program = A.program();
    if (plan && program && p) {
      var cd = Engine.currentDay(plan, program);
      el.appendChild(A.h('<div class="card"><span class="badge">' + A.esc(program.name) + '</span><h2 class="mt">' + A.esc(cd.day.name) + '</h2><p class="muted">' + cd.day.blocks.length + ' blocks, about ' + (cd.day.est || 45) + ' minutes.</p><button class="btn primary lg block" data-action="start-next">Start this session</button></div>'));
    } else {
      el.appendChild(A.h('<div class="card"><h2>No program yet</h2><p class="muted">Set up a plan for guided sessions, or run a free session below.</p><button class="btn primary" data-action="' + (p ? 'open-program-picker' : 'open-onboarding') + '">' + (p ? 'Choose a program' : 'Set up my plan') + '</button></div>'));
    }
    el.appendChild(A.h('<div class="card"><h3>Free session</h3><p class="muted small">Not on the plan, still logged.</p><div class="row"><button class="btn sm" data-action="pick-wod" data-pick="all">Benchmark WOD</button><button class="btn sm" data-action="pick-cardio">Cardio protocol</button><button class="btn sm" data-action="free-ladders">Bodyweight ladders</button></div></div>'));
  }

  function elapsedLabel(w) { return Engine.fmtTime((Date.now() - w.startedAt) / 1000); }

  function renderActive(el, w) {
    A.wake.on();
    var head = A.h('<div class="wk-head"><div class="row between"><div><span class="badge accent">' + (w.free ? 'Free session' : 'Week ' + w.week + (w.deload ? ' · deload' : '')) + '</span><h2>' + A.esc(w.dayName) + '</h2></div><div class="stat"><span class="v" id="wk-clock">' + elapsedLabel(w) + '</span><span class="l">elapsed</span></div></div></div>');
    el.appendChild(head);
    if (w.deload) el.appendChild(A.h('<div class="card flat small muted">Deload week: sets are halved. Move well, leave the gym fresh.</div>'));
    var firstOpen = -1;
    w.blocks.forEach(function (b, i) {
      var done = blockDone(b);
      if (!done && firstOpen < 0) firstOpen = i;
      el.appendChild(renderBlock(w, b, i, !done && firstOpen === i));
    });
    el.appendChild(A.h('<div class="sticky-actions"><div class="finish-bar"><button class="btn primary lg" data-action="finish-workout">Finish workout</button><button class="btn danger" data-action="abandon-workout">Abandon</button></div></div>'));
    clearInterval(A._wkClock);
    A._wkClock = setInterval(function () { var c = document.getElementById('wk-clock'); if (c) c.textContent = elapsedLabel(w); else clearInterval(A._wkClock); }, 1000);
  }

  function blockDone(b) {
    if (b.kind === 'warmup' || b.kind === 'cooldown') return b.items.every(function (it) { return it.done; });
    if (b.sets) return b.sets.every(function (s) { return s.done; });
    return !!b.result;
  }

  /* the coaching panel shown under every exercise */
  function coachBox(ex, open) {
    if (!ex) return '';
    return '<details class="coach-box"' + (open ? ' open' : '') + '><summary>How to do it</summary><ol class="steps">' + ex.steps.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ol>' +
      (ex.cues.length ? '<strong>Cues</strong><ul>' + ex.cues.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ul>' : '') +
      (ex.mistakes.length ? '<strong>Watch for</strong><ul>' + ex.mistakes.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</details>';
  }

  function schemeLabel(b) {
    var s = b.scheme;
    if (!s) return '';
    if (s.type === 'sets') return s.sets + ' x ' + (s.range ? s.range[0] + '-' + s.range[1] : s.reps) + (s.amrapLast ? ' (last set max)' : '') + (s.rule === 'linear' ? ' · add weight when every set hits target' : ' · double progression');
    if (s.type === 'pyramid') return 'Pyramid ' + s.reps.join(' / ') + ' · weight climbs each set';
    if (s.type === 'gzclp') { var st = Engine.GZCLP[s.tier][Math.min(b.stage || 0, Engine.GZCLP[s.tier].length - 1)]; return s.tier + ' · ' + st.sets + 'x' + st.reps + (s.tier !== 'T2' ? '+' : '') + (b.stage ? ' (stage ' + (b.stage + 1) + ')' : ''); }
    if (s.type === '531') return '5/3/1 wave ' + b.wave + (b.wave === 4 ? ' (deload)' : '') + (b.tm ? ' · training max ' + A.fmtKg(b.tm) : ' · set your training max on the top set') + (s.bbb && b.wave !== 4 ? ' · then 5x10 Boring But Big' : '');
    if (s.type === 'amrap') return s.sets + ' sets, as many reps as you can';
    return '';
  }

  function renderBlock(w, b, i, current) {
    var card = A.h('<div class="card block' + (blockDone(b) ? ' done' : current ? ' current' : '') + '" data-block="' + i + '"></div>');
    var ex = A.ex(b.exerciseId);
    if (b.kind === 'warmup' || b.kind === 'cooldown') {
      card.innerHTML = '<div class="block-title"><h3>' + (b.kind === 'warmup' ? 'Warm-up' : 'Cool-down') + '</h3><button class="btn sm ghost" data-action="check-all" data-i="' + i + '">All done</button></div><div class="check-list mt">' +
        b.items.map(function (it, k) { return '<div class="check-item' + (it.done ? ' on' : '') + '" data-action="check-item" data-i="' + i + '" data-k="' + k + '">' + A.thumb(it.exerciseId) + '<span class="name">' + A.esc(A.exName(it.exerciseId)) + '</span><span class="muted small">' + (it.reps ? it.reps + ' reps' : it.seconds + ' s') + '</span><button class="btn sm ghost" data-action="open-exercise" data-id="' + it.exerciseId + '">?</button></div>'; }).join('') + '</div>';
      return card;
    }
    if (b.kind === 'strength' || b.kind === 'ladder' || b.kind === 'hold') {
      var title = ex ? ex.name : b.exerciseId;
      var meta = b.kind === 'ladder' ? DATA.LADDERS[b.ladderId].name + ' · rung ' + (b.rung + 1) + ' of ' + b.rungCount + (b.label ? ' · ' + b.label : '') : b.kind === 'hold' ? b.sets.length + ' holds of ' + b.sets[0].targetSeconds + ' s' : schemeLabel(b);
      card.innerHTML = '<div class="block-title"><div><h3>' + A.esc(title) + (b.substituted ? ' <span class="badge warn">swapped in</span>' : '') + '</h3><div class="block-meta">' + A.esc(meta) + (b.rest ? ' · rest ' + b.rest + ' s' : '') + '</div></div><div class="row"><button class="btn sm ghost" data-action="swap-exercise" data-i="' + i + '">Swap</button><button class="btn sm ghost" data-action="open-exercise" data-id="' + b.exerciseId + '">Info</button></div></div>' +
        (b.note ? '<p class="small muted">' + A.esc(b.note) + '</p>' : '') +
        '<div class="block-body"><div class="media-wrap"><div class="media" data-media="' + i + '"></div><div class="media-controls"><button class="btn sm ghost" data-action="media-toggle" data-i="' + i + '">Pause</button><button class="btn sm ghost" data-action="media-step" data-i="' + i + '">Step</button>' + (ex && ex.anim && ex.repdb ? '<button class="btn sm ghost" data-action="media-mode" data-i="' + i + '">Illustration</button>' : '') + '</div></div><div>' + setsTable(b, i) + coachBox(ex, false) + '</div></div>';
      var mediaEl = card.querySelector('[data-media]');
      var player = A.mountMedia(mediaEl, ex, { autoplay: current });
      card._player = player;
      if (!current) { var tb = card.querySelector('[data-action="media-toggle"]'); if (tb) tb.textContent = 'Play'; }
      return card;
    }
    if (b.kind === 'circuit') {
      var fmt = DATA.WOD_FORMATS[b.format] || { label: b.format };
      card.innerHTML = '<div class="block-title"><div><h3>' + fmt.label + (b.minutes ? ' ' + b.minutes + ' min' : '') + (b.rounds ? ' · ' + b.rounds + ' rounds' : '') + '</h3><div class="block-meta">' + A.esc(fmt.help || '') + '</div></div></div>' + (b.note ? '<p class="small muted">' + A.esc(b.note) + '</p>' : '') +
        '<div class="wod-card mt">' + b.items.map(function (it) { return '<div class="mv">' + A.thumb(it.exerciseId) + '<span class="name">' + A.esc(A.exName(it.exerciseId)) + '</span><span class="muted small">' + itemDose(it) + '</span><button class="btn sm ghost" data-action="open-exercise" data-id="' + it.exerciseId + '">?</button></div>'; }).join('') + '</div>' +
        resultRow(b, i);
      return card;
    }
    if (b.kind === 'wod') {
      if (!b.wodId) {
        card.innerHTML = '<div class="block-title"><h3>Benchmark WOD</h3></div><p class="muted small">Pick today\'s benchmark from the ' + (b.pick === 'bodyweight' ? 'bodyweight' : 'Girls') + ' list. Your best score on each is shown.</p><button class="btn primary" data-action="pick-wod" data-pick="' + (b.pick || 'all') + '" data-i="' + i + '">Choose a WOD</button>';
        return card;
      }
      var wod = DATA.wodById[b.wodId], best = A.data.prs['wod:' + wod.id];
      card.innerHTML = '<div class="block-title"><div><h3>' + A.esc(wod.name) + ' <span class="badge">' + wod.kind + '</span></h3><div class="block-meta">' + wodHeadline(wod) + '</div></div><button class="btn sm ghost" data-action="open-wod" data-id="' + wod.id + '">Info</button></div>' +
        '<div class="wod-card mt">' + wod.movements.map(function (m) { return '<div class="mv">' + A.thumb(m.ex) + '<span class="name">' + A.esc(A.exName(m.ex)) + (m.note ? ' <span class="muted small">' + A.esc(m.note) + '</span>' : '') + '</span><span class="muted small">' + movementDose(wod, m) + '</span><button class="btn sm ghost" data-action="open-exercise" data-id="' + m.ex + '">?</button></div>'; }).join('') + '</div>' +
        '<p class="small muted mt"><strong>Scale:</strong> ' + A.esc(wod.scaling.intermediate) + ' <strong>Beginner:</strong> ' + A.esc(wod.scaling.beginner) + '</p>' +
        (best && best.score ? '<p class="small"><strong>Your best:</strong> ' + Engine.wodScore(wod, best.score) + ' <span class="muted">(' + A.fmtDate(best.score.at) + ')</span></p>' : '') +
        resultRow(b, i, wod);
      return card;
    }
    if (b.kind === 'cardio') {
      var proto = DATA.CARDIO[b.protocol];
      var segs = proto.build(b.minutes, b.c25kWeek), total = segs.reduce(function (a, s) { return a + s.seconds; }, 0);
      card.innerHTML = '<div class="block-title"><div><h3>' + A.esc(proto.name) + (b.c25kWeek ? ' · week ' + b.c25kWeek : '') + '</h3><div class="block-meta">' + A.esc(proto.zone) + ' · ' + Math.round(total / 60) + ' min</div></div></div>' +
        (b.note ? '<p class="small muted">' + A.esc(b.note) + '</p>' : '') + '<p class="small muted">' + A.esc(proto.help) + '</p>' +
        '<div class="pill-row">' + segs.slice(0, 14).map(function (s) { return '<span class="chip" style="border-color:var(--zone-' + zoneVar(s.zone) + ');color:var(--zone-' + zoneVar(s.zone) + ')">' + A.esc(s.label) + ' ' + Engine.fmtTime(s.seconds) + '</span>'; }).join('') + (segs.length > 14 ? '<span class="chip">+' + (segs.length - 14) + ' more</span>' : '') + '</div>' +
        resultRow(b, i);
      return card;
    }
    card.innerHTML = '<p class="muted">Unknown block</p>';
    return card;
  }
  function zoneVar(z) { return z === 'hard' ? 'hard' : z === 'rest' ? 'rest' : z === 'easy' ? 'easy' : 'warm'; }
  function itemDose(it) { return it.reps ? it.reps + ' reps' : it.seconds ? it.seconds + ' s' : it.meters ? it.meters + ' m' : it.cal ? it.cal + ' cal' : ''; }
  function movementDose(wod, m) {
    var p = A.profile(), parts = [];
    if (m.reps) parts.push(m.reps + ' reps'); else if (m.meters) parts.push(m.meters + ' m'); else if (m.seconds) parts.push(m.seconds + ' s'); else if (wod.scheme) parts.push(wod.scheme.join('-'));
    if (m.load) parts.push(Engine.rxLoad(m.load, p ? p.sex : 'm', A.units()));
    return parts.join(' · ');
  }
  function wodHeadline(wod) {
    var f = DATA.WOD_FORMATS[wod.format].label;
    if (wod.scheme) f += ' ' + wod.scheme.join('-');
    if (wod.rounds) f += ' · ' + wod.rounds + ' rounds';
    if (wod.minutes) f += ' · ' + wod.minutes + ' min';
    if (wod.cap) f += ' · cap ' + wod.cap + ' min';
    return f;
  }
  A.wodHeadline = wodHeadline; A.movementDose = movementDose;

  /* the sets table for strength, ladder and hold blocks */
  function setsTable(b, i) {
    var hold = b.kind === 'hold' || (b.kind === 'ladder' && b.hold);
    var ex = A.ex(b.exerciseId);
    /* the load column shows for loaded lifts, weighted ladder rungs, and bodyweight moves that already carry a load */
    var showLoad = !hold && (b.kind === 'ladder' ? !!b.weighted : (!(ex && ex.bw) || (b.sets[0] && b.sets[0].targetKg > 0)));
    var html = '<table class="sets"><thead><tr><th>Set</th><th>Target</th>' + (showLoad ? '<th>' + A.units() + '</th>' : '') + '<th>' + (hold ? 'sec' : 'reps') + '</th><th></th></tr></thead><tbody>';
    b.sets.forEach(function (s, k) {
      var isBbb = b.bbbFrom != null && k >= b.bbbFrom;
      var target = hold ? s.targetSeconds + ' s' : ((s.targetReps == null ? 'max' : s.targetReps + (s.amrap ? '+' : '')) + (showLoad && s.targetKg != null && s.targetKg > 0 ? ' @ ' + A.fmtKg(s.targetKg, false) : showLoad && s.targetKg == null ? ' @ ?' : ''));
      html += '<tr class="' + (s.done ? 'done' : '') + (isBbb ? ' bbb' : '') + '" data-set="' + k + '"><td>' + (isBbb && k === b.bbbFrom ? 'BBB ' : '') + s.n + '</td><td class="target">' + target + '</td>' +
        (showLoad ? '<td><input type="number" inputmode="decimal" step="any" data-f="kg" value="' + (s.done && s.kg != null ? A.loadVal(s.kg) : (s.targetKg != null ? A.loadVal(s.targetKg) : '')) + '" placeholder="' + A.units() + '"' + (s.done ? ' readonly' : '') + '></td>' : '') +
        '<td><input type="number" inputmode="numeric" data-f="' + (hold ? 'seconds' : 'reps') + '" value="' + (s.done ? (hold ? s.seconds : s.reps) : (hold ? s.targetSeconds : (s.targetReps == null ? '' : s.targetReps))) + '" placeholder="' + (hold ? 's' : s.amrap ? 'max' : 'reps') + '"' + (s.done ? ' readonly' : '') + '></td>' +
        '<td><button class="set-btn' + (s.done ? ' on' : '') + '" data-action="log-set" data-i="' + i + '" data-k="' + k + '" aria-label="' + (s.done ? 'Undo set' : 'Set done') + '">' + (s.done ? '&#10003;' : hold ? '&#9654;' : '&#10003;') + '</button></td></tr>';
    });
    html += '</tbody></table>';
    if (b.kind === 'strength' && b.sets[0] && b.sets[0].targetKg == null && b.scheme && b.scheme.type !== 'amrap') html += '<p class="small muted">No starting weight yet: pick one you can do for the target reps with two in reserve. The plan remembers it.</p>';
    return html;
  }

  /* score entry for circuits, WODs and cardio */
  function resultRow(b, i, wod) {
    if (b.result) {
      var txt = b.kind === 'cardio' ? b.result.minutes + ' min' + (b.result.distance ? ' · ' + b.result.distance : '') + (b.result.avgHr ? ' · ' + b.result.avgHr + ' bpm' : '') : (wod ? Engine.wodScore(wod, b.result) : circuitScore(b));
      return '<div class="row between mt"><span class="badge ok">Done</span><span>' + A.esc(txt) + '</span><button class="btn sm ghost" data-action="clear-result" data-i="' + i + '">Edit</button></div>';
    }
    return '<div class="row mt"><button class="btn primary" data-action="start-clock" data-i="' + i + '">Start clock</button><button class="btn" data-action="enter-result" data-i="' + i + '">Enter result</button></div>';
  }
  function circuitScore(b) {
    var r = b.result;
    if (b.format === 'amrap' || b.format === 'emom') return (r.rounds || 0) + ' rounds' + (r.reps ? ' + ' + r.reps : '');
    return Engine.fmtTime(r.seconds || 0);
  }

  /* ---------------------------------------------------------------- set logging */
  function block(i) { var w = A.activeWorkout(); return w ? { w: w, b: w.blocks[i] } : null; }
  function rerenderBlock(i) {
    var w = A.activeWorkout(); if (!w) return;
    var old = document.querySelector('[data-block="' + i + '"]'); if (!old) return A.render('workout');
    if (old._player) { old._player.destroy(); A.players = A.players.filter(function (p) { return p !== old._player; }); }
    var firstOpen = -1; w.blocks.forEach(function (bb, k) { if (!blockDone(bb) && firstOpen < 0) firstOpen = k; });
    var fresh = renderBlock(w, w.blocks[i], i, firstOpen === i);
    old.replaceWith(fresh);
  }

  A.action('log-set', function (el) {
    var i = +el.getAttribute('data-i'), k = +el.getAttribute('data-k'), x = block(i); if (!x) return;
    var s = x.b.sets[k], row = el.closest('tr');
    if (s.done) { s.done = false; s.reps = null; s.kg = null; s.seconds = null; A.save(); rerenderBlock(i); return; }
    var hold = x.b.kind === 'hold' || (x.b.kind === 'ladder' && x.b.hold);
    var kgIn = row.querySelector('[data-f="kg"]'), repsIn = row.querySelector('[data-f="reps"]'), secIn = row.querySelector('[data-f="seconds"]');
    if (hold) {
      var sec = parseInt(secIn.value, 10);
      if (isNaN(sec) || sec <= 0) { startHold(i, k, s.targetSeconds); return; }
      s.seconds = sec; s.done = true;
    } else {
      var reps = parseInt(repsIn.value, 10);
      if (isNaN(reps)) { A.toast('Enter the reps you did.'); repsIn.focus(); return; }
      s.reps = reps;
      if (kgIn) { var kg = A.toKg(kgIn.value); if (kg == null && s.targetKg !== 0) { A.toast('Enter the weight.'); kgIn.focus(); return; } s.kg = kg == null ? 0 : kg; }
      else s.kg = s.targetKg || 0;
      s.done = true;
      /* a weight typed on the first set becomes the prefill for the rest of the block */
      if (kgIn) x.b.sets.forEach(function (o, j) { if (j > k && !o.done && (o.targetKg == null || o.targetKg === s.targetKg)) o.targetKg = s.kg; });
    }
    A.save();
    rerenderBlock(i);
    var last = x.b.sets.every(function (o) { return o.done; });
    var lastBlock = x.w.blocks.slice(i + 1).every(blockDone);
    if (!(last && lastBlock)) startRest(x.b.rest || 60);
    else { A.toast('All sets done. Finish the workout when you are ready.'); }
  });

  /* ---------------------------------------------------------------- rest bar */
  var rest = { until: 0, total: 0, t: null };
  function startRest(seconds) {
    rest.total = seconds; rest.until = Date.now() + seconds * 1000;
    var bar = document.getElementById('rest-bar');
    if (!bar) {
      bar = A.h('<div class="rest-bar" id="rest-bar"><div class="fill" style="width:0"></div><span class="t">0:00</span><span class="small">rest</span><button class="btn sm" data-action="rest-add">+30 s</button><button class="btn sm" data-action="rest-skip">Skip</button></div>');
      document.body.appendChild(bar);
    }
    clearInterval(rest.t);
    rest.t = setInterval(tickRest, 250);
    tickRest();
  }
  function tickRest() {
    var bar = document.getElementById('rest-bar'); if (!bar) { clearInterval(rest.t); return; }
    var left = Math.max(0, rest.until - Date.now());
    bar.querySelector('.t').textContent = Engine.fmtTime(Math.ceil(left / 1000));
    bar.querySelector('.fill').style.width = (100 * (1 - left / (rest.total * 1000))) + '%';
    if (left <= 0) { stopRest(); A.beep('end'); A.toast('Rest over. Next set.'); }
  }
  function stopRest() { clearInterval(rest.t); var bar = document.getElementById('rest-bar'); if (bar) bar.remove(); }
  A.action('rest-add', function () { rest.until += 30000; rest.total += 30; tickRest(); });
  A.action('rest-skip', stopRest);

  /* a hold runs as a countdown in the timer overlay and logs itself */
  function startHold(i, k, seconds) {
    A.timer.open({ kind: 'countdown', totalMs: seconds * 1000, label: 'Hold' }, { title: A.exName(block(i).b.exerciseId), onFinish: function () {
      var x = block(i); if (!x) return; var s = x.b.sets[k]; s.seconds = seconds; s.done = true; A.save(); rerenderBlock(i);
      var lastBlock = x.w.blocks.slice(i + 1).every(blockDone);
      if (!(x.b.sets.every(function (o) { return o.done; }) && lastBlock)) startRest(x.b.rest || 45);
    } });
  }

  /* ---------------------------------------------------------------- media and swaps */
  A.action('media-toggle', function (el) { var card = el.closest('.block'); if (!card || !card._player) return; card._player.toggle(); el.textContent = card.querySelector('.media').classList.contains('is-playing') ? 'Pause' : 'Play'; });
  A.action('media-step', function (el) { var card = el.closest('.block'); if (card && card._player) { card._player.step(); var tb = card.querySelector('[data-action="media-toggle"]'); if (tb) tb.textContent = 'Play'; } });
  A.action('media-mode', function (el) { var card = el.closest('.block'); if (!card || !card._player) return; var m = card._player.mode === 'anim' ? 'illustration' : 'anim'; card._player.setMode(m); el.textContent = m === 'anim' ? 'Illustration' : 'Animation'; });
  A.action('check-item', function (el) { var x = block(+el.getAttribute('data-i')); if (!x) return; var it = x.b.items[+el.getAttribute('data-k')]; it.done = !it.done; A.save(); rerenderBlock(+el.getAttribute('data-i')); });
  A.action('check-all', function (el) { var i = +el.getAttribute('data-i'), x = block(i); if (!x) return; var all = x.b.items.every(function (it) { return it.done; }); x.b.items.forEach(function (it) { it.done = !all; }); A.save(); rerenderBlock(i); });

  A.action('swap-exercise', function (el) {
    var i = +el.getAttribute('data-i'), x = block(i); if (!x) return;
    var alts = Engine.alternativesFor(x.b.exerciseId, A.profile(), DATA.exerciseById);
    if (!alts.length) return A.toast('No alternatives for this one.');
    A.modal({ title: 'Swap ' + A.exName(x.b.exerciseId), html: '<p class="muted small">Same movement pattern, your equipment. Targets carry over; the weight resets to what you have logged for the new exercise.</p><div class="stack">' + alts.map(function (id) { var e = A.ex(id); return '<button class="option" data-action="do-swap" data-i="' + i + '" data-id="' + id + '"><strong>' + A.esc(e.name) + '</strong><span>' + e.primary.map(function (m) { return DATA.MUSCLES[m]; }).join(', ') + ' · ' + e.level + (Engine.avoids(A.profile(), e) ? ' · loads a flagged joint' : '') + '</span></button>'; }).join('') + '</div>' });
  });
  A.action('do-swap', function (el) {
    var i = +el.getAttribute('data-i'), id = el.getAttribute('data-id'), x = block(i); if (!x) return;
    var plan = A.plan(), st = plan && plan.state[id];
    x.b.exerciseId = id; x.b.substituted = true;
    var kg = st && st.kg != null ? st.kg : (A.ex(id).bw ? 0 : null);
    x.b.sets.forEach(function (s) { if (!s.done) { s.targetKg = kg; s.kg = null; } });
    A.save(); A.closeModal(); rerenderBlock(i);
  });

  /* ---------------------------------------------------------------- WOD and cardio picking */
  A.action('pick-wod', function (el) {
    var pick = el.getAttribute('data-pick') || 'all', i = el.getAttribute('data-i');
    var list = DATA.WODS.filter(function (w) { return pick === 'all' || (pick === 'girls' ? w.kind === 'girl' : pick === 'bodyweight' ? w.bodyweight : true); });
    A.modal({ title: 'Choose a WOD', html: '<div class="stack">' + list.map(function (w) { var best = A.data.prs['wod:' + w.id]; return '<button class="option" data-action="choose-wod" data-id="' + w.id + '"' + (i != null ? ' data-i="' + i + '"' : '') + '><strong>' + A.esc(w.name) + ' <span class="badge">' + w.kind + '</span></strong><span>' + wodHeadline(w) + ' · ' + w.movements.map(function (m) { return A.exName(m.ex); }).join(', ') + '</span>' + (best && best.score ? '<span class="small">Best: ' + Engine.wodScore(w, best.score) + '</span>' : '') + '</button>'; }).join('') + '</div>' });
  });
  A.action('choose-wod', function (el) {
    var id = el.getAttribute('data-id'), i = el.getAttribute('data-i');
    A.closeModal();
    if (i != null && A.activeWorkout()) {
      var x = block(+i); x.b.wodId = id;
      var plan = A.plan(); if (plan) { plan.wodChoice[x.w.dayId] = id; }
      A.save(); rerenderBlock(+i); return;
    }
    var wod = DATA.wodById[id];
    A.startFreeWorkout(wod.name, [
      { kind: 'warmup', items: [{ ex: 'jumping-jack', seconds: 60 }, { ex: 'arm-circles', seconds: 30 }, { ex: 'bodyweight-squat', reps: 10 }, { ex: 'inchworm', reps: 5 }] },
      { kind: 'wod', wod: id },
      { kind: 'cooldown', items: [{ ex: 'childs-pose', seconds: 45 }, { ex: 'hamstring-stretch', seconds: 30 }] }
    ], 'wod');
  });
  A.action('pick-cardio', function () {
    A.modal({ title: 'Cardio session', html: '<div class="stack">' + Object.keys(DATA.CARDIO).map(function (k) { var c = DATA.CARDIO[k]; return '<button class="option" data-action="choose-cardio" data-id="' + k + '"><strong>' + A.esc(c.name) + '</strong><span>' + A.esc(c.zone) + ' · about ' + c.defaultMinutes + ' min</span><span class="small muted">' + A.esc(c.help) + '</span></button>'; }).join('') + '</div>' });
  });
  A.action('choose-cardio', function (el) {
    var id = el.getAttribute('data-id'), c = DATA.CARDIO[id];
    A.closeModal();
    A.startFreeWorkout(c.name, [{ kind: 'cardio', protocol: id, minutes: c.defaultMinutes }], 'cardio');
  });
  A.action('free-ladders', function () {
    A.closeModal();
    A.startFreeWorkout('Bodyweight ladders', [
      { kind: 'warmup', items: [{ ex: 'band-pull-apart', reps: 10 }, { ex: 'leg-swings', reps: 10 }, { ex: 'cat-cow', reps: 8 }, { ex: 'dead-bug', seconds: 30 }] },
      { kind: 'ladder', ladder: 'pullup', rest: 90 }, { kind: 'ladder', ladder: 'squat', rest: 90 }, { kind: 'ladder', ladder: 'dip', rest: 90 },
      { kind: 'ladder', ladder: 'hinge', rest: 90 }, { kind: 'ladder', ladder: 'row', rest: 90 }, { kind: 'ladder', ladder: 'pushup', rest: 90 },
      { kind: 'ladder', ladder: 'antiext', rest: 60 }, { kind: 'ladder', ladder: 'antirot', rest: 60 }, { kind: 'ladder', ladder: 'ext', rest: 60 },
      { kind: 'cooldown', items: [{ ex: 'childs-pose', seconds: 45 }, { ex: 'kneeling-hip-flexor-stretch', seconds: 30 }] }
    ], 'lift');
  });

  /* ---------------------------------------------------------------- clocks and results */
  function timerSpecFor(b, wod) {
    if (b.kind === 'cardio') return { kind: 'segments', segments: DATA.CARDIO[b.protocol].build(b.minutes, b.c25kWeek) };
    var f = wod ? wod.format : b.format, minutes = wod ? wod.minutes : b.minutes, cap = wod ? wod.cap : null;
    if (f === 'amrap') return { kind: 'countdown', totalMs: (minutes || 20) * 60000, label: 'AMRAP', rounds: true };
    if (f === 'emom') return { kind: 'emom', minutes: minutes || 10, rounds: true };
    if (f === 'tabata') return { kind: 'tabata', rounds: 8, workSec: 20, restSec: 10 };
    if (f === 'deathby') return { kind: 'deathby', rounds: true };
    return { kind: 'stopwatch', capMs: cap ? cap * 60000 : null, rounds: f === 'rounds' };
  }
  A.action('start-clock', function (el) {
    var i = +el.getAttribute('data-i'), x = block(i); if (!x) return;
    var wod = x.b.kind === 'wod' ? DATA.wodById[x.b.wodId] : null;
    var spec = timerSpecFor(x.b, wod);
    A.timer.open(spec, { title: wod ? wod.name : x.b.kind === 'cardio' ? DATA.CARDIO[x.b.protocol].name : (DATA.WOD_FORMATS[x.b.format] || {}).label, rounds: !!spec.rounds,
      onFinish: function (res) { openResult(i, res); } });
  });
  A.action('enter-result', function (el) { openResult(+el.getAttribute('data-i'), null); });
  A.action('clear-result', function (el) { var i = +el.getAttribute('data-i'), x = block(i); if (!x) return; x.b.result = null; A.save(); rerenderBlock(i); });

  function openResult(i, res) {
    var x = block(i); if (!x) return;
    var b = x.b, wod = b.kind === 'wod' ? DATA.wodById[b.wodId] : null, f = wod ? wod.format : b.format;
    var html = '';
    if (b.kind === 'cardio') {
      html = '<div class="score-box"><div class="field"><label>Minutes</label><input type="number" id="r-min" inputmode="decimal" value="' + (res ? Math.round(res.elapsedMs / 60000) : b.minutes) + '"></div><div class="field"><label>Distance (optional)</label><input type="text" id="r-dist" placeholder="e.g. 5 km"></div><div class="field"><label>Avg heart rate (optional)</label><input type="number" id="r-hr" inputmode="numeric"></div><div class="field"><label>How did it feel?</label><select id="r-feel"><option>Easy</option><option selected>Right</option><option>Hard</option></select></div></div>';
    } else if (f === 'amrap' || f === 'emom' || f === 'deathby') {
      html = '<div class="score-box"><div class="field"><label>' + (f === 'deathby' ? 'Last full minute' : 'Rounds') + '</label><input type="number" id="r-rounds" inputmode="numeric" value="' + (res && res.rounds != null ? res.rounds : '') + '"></div>' + (f !== 'deathby' ? '<div class="field"><label>Extra reps</label><input type="number" id="r-reps" inputmode="numeric" value="0"></div>' : '') + '</div>';
    } else if (f === 'maxreps' || f === 'tabata') {
      html = '<div class="field"><label>Total reps</label><input type="number" id="r-reps" inputmode="numeric"></div>';
    } else {
      html = '<div class="score-box"><div class="field"><label>Minutes</label><input type="number" id="r-m" inputmode="numeric" value="' + (res ? Math.floor(res.elapsedMs / 60000) : '') + '"></div><div class="field"><label>Seconds</label><input type="number" id="r-s" inputmode="numeric" value="' + (res ? Math.floor((res.elapsedMs % 60000) / 1000) : '') + '"></div></div><div class="field"><label><input type="checkbox" id="r-capped"' + (res && res.done && res.capped ? ' checked' : '') + '> Hit the time cap (enter reps completed below)</label><input type="number" id="r-reps" inputmode="numeric" placeholder="reps at the cap"></div>';
    }
    html += '<div class="field"><label>Notes</label><input type="text" id="r-note" placeholder="scaled? how did it go?"></div><button class="btn primary block" data-action="save-result" data-i="' + i + '">Save</button>';
    A.modal({ title: 'Result', html: html });
  }
  A.action('save-result', function (el) {
    var i = +el.getAttribute('data-i'), x = block(i); if (!x) return;
    var b = x.b, wod = b.kind === 'wod' ? DATA.wodById[b.wodId] : null, f = wod ? wod.format : b.format, r = {};
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    if (b.kind === 'cardio') { r.minutes = parseFloat(g('r-min')) || b.minutes; r.distance = g('r-dist') || null; r.avgHr = parseInt(g('r-hr'), 10) || null; r.feel = g('r-feel'); r.done = true; }
    else if (f === 'amrap' || f === 'emom' || f === 'deathby') { r.rounds = parseInt(g('r-rounds'), 10) || 0; r.reps = parseInt(g('r-reps'), 10) || 0; r.seconds = (wod ? wod.minutes : b.minutes || 0) * 60; }
    else if (f === 'maxreps' || f === 'tabata') { r.reps = parseInt(g('r-reps'), 10) || 0; r.seconds = 20 * 60; }
    else { var capped = document.getElementById('r-capped') && document.getElementById('r-capped').checked; r.seconds = (parseInt(g('r-m'), 10) || 0) * 60 + (parseInt(g('r-s'), 10) || 0); if (capped) { r.finished = false; r.reps = parseInt(g('r-reps'), 10) || 0; } else r.finished = true; }
    r.note = g('r-note') || '';
    b.result = r;
    A.save(); A.closeModal(); rerenderBlock(i);
  });

  /* ---------------------------------------------------------------- finish and abandon */
  A.action('finish-workout', function () {
    var w = A.activeWorkout(); if (!w) return;
    var any = w.blocks.some(function (b) { return (b.sets && b.sets.some(function (s) { return s.done; })) || b.result || (b.items && b.items.some(function (it) { return it.done; })); });
    if (!any) return A.toast('Nothing logged yet. Log a set or abandon.');
    A.modal({ title: 'Finish workout', html: '<div class="field"><label>How hard was it overall? (RPE)</label><div class="chips">' + [5, 6, 7, 8, 9, 10].map(function (n) { return '<button class="chip" data-action="pick-rpe" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div></div><div class="field"><label>Notes</label><textarea id="f-notes" rows="2" placeholder="sleep, energy, anything to remember"></textarea></div><button class="btn primary block lg" data-action="confirm-finish">Save and finish</button>' });
  });
  A.action('pick-rpe', function (el) { document.querySelectorAll('[data-action="pick-rpe"]').forEach(function (c) { c.classList.toggle('on', c === el); }); A._rpe = +el.getAttribute('data-n'); });
  A.action('confirm-finish', function () {
    var w = A.activeWorkout(); if (!w) return;
    var free = w.free || !A.program();
    var plan = free ? A.freePlan() : A.plan();
    var program = free ? { id: 'free', perWeek: 1, days: [{ id: 'free' }], progression: 'free' } : A.program();
    w.rpe = A._rpe || null; w.notes = (document.getElementById('f-notes') || {}).value || '';
    /* a free session progresses loads and ladder rungs but never moves the plan's day pointer */
    var res = Engine.finishWorkout(plan, program, w, A.data.prs, A.profile(), DATA.exerciseById, A.units(), Date.now(), { advance: !free });
    A._rpe = null;
    stopRest(); A.wake.off(); clearInterval(A._wkClock);
    A.save();
    var min = Math.round((w.endedAt - w.startedAt) / 60000);
    var html = '<div class="stats-row"><div class="stat"><span class="v">' + min + '</span><span class="l">minutes</span></div><div class="stat"><span class="v">' + w.kcal + '</span><span class="l">kcal (est.)</span></div><div class="stat"><span class="v">' + res.prs.length + '</span><span class="l">records</span></div></div>';
    if (res.prs.length) html += '<h3 class="mt">New records</h3><ul class="list tight">' + res.prs.map(function (p) { return '<li>' + (p.kind === 'e1rm' ? A.exName(p.exerciseId) + ': ' + A.fmtKg(p.kg) + ' x ' + p.reps + ' (est. 1RM ' + A.fmtKg(p.value) + ')' : p.kind === 'reps' ? A.exName(p.exerciseId) + ': ' + p.reps + ' reps' : DATA.wodById[p.wodId].name + ': ' + Engine.wodScore(DATA.wodById[p.wodId], p.result)) + '</li>'; }).join('') + '</ul>';
    if (res.notes.length) html += '<h3 class="mt">Next time</h3><ul class="list tight">' + res.notes.map(function (n) { return '<li>' + (n.ex ? '<strong>' + A.esc(A.exName(n.ex)) + '</strong>: ' : '') + A.esc(n.text) + '</li>'; }).join('') + '</ul>';
    html += '<button class="btn primary block mt" data-action="after-finish">Done</button>';
    A.modal({ title: 'Nice work', html: html, onClose: function () { A.show('today'); } });
    A.beep('go');
  });
  A.action('after-finish', function () { A.closeModal(); });
  A.action('abandon-workout', function () {
    var w = A.activeWorkout(); if (!w) return;
    A.confirm('Abandon this workout? Logged sets are kept in history but nothing progresses.').then(function (ok) {
      if (!ok) return;
      w.status = 'abandoned'; w.endedAt = Date.now();
      stopRest(); A.wake.off(); clearInterval(A._wkClock);
      A.save(); A.show('today');
    });
  });

  /* ---------------------------------------------------------------- the timer overlay */
  /* A.timer.open(spec, { title, rounds, onFinish(result) }) - spec is an Engine.Timer spec. The overlay ticks
     every 200 ms, beeps on phase changes and the final three seconds, and hands back { elapsedMs, rounds, done }. */
  var T = Engine.Timer, tstate = null;
  A.timer = {
    open: function (spec, opts) {
      A.timer.close();
      tstate = { t: T.create(spec), opts: opts || {}, rounds: 0, lastPhase: null, lastRound: null, lastSec: null, iv: null };
      var root = document.getElementById('timer-root');
      root.innerHTML = '<div class="timer" id="timer"><button class="btn close" data-action="timer-close">Close</button><div class="label" id="tm-label"></div><div class="big" id="tm-big">0:00</div><div class="sub" id="tm-sub"></div><div class="bar"><span id="tm-bar" style="width:0"></span></div>' +
        (tstate.opts.rounds ? '<div class="rounds"><button class="btn" data-action="timer-round-minus">&minus;</button><span><span class="n" id="tm-rounds">0</span><br>rounds</span><button class="btn primary" data-action="timer-round-plus">+1 round</button></div>' : '') +
        '<div class="actions mt"><button class="btn primary" id="tm-toggle" data-action="timer-toggle">Start</button><button class="btn" data-action="timer-finish">Finish</button></div><div class="next" id="tm-next"></div></div>';
      document.getElementById('tm-label').textContent = tstate.opts.title || '';
      A.wake.on();
      A.timer.render();
    },
    close: function () { if (tstate) { clearInterval(tstate.iv); tstate = null; } document.getElementById('timer-root').innerHTML = ''; },
    render: function () {
      if (!tstate) return;
      var v = T.view(tstate.t, Date.now()), s = tstate.t.spec, el = document.getElementById('timer');
      if (!el) return;
      var show = v.remainingMs != null ? v.remainingMs : v.elapsedMs;
      document.getElementById('tm-big').textContent = Engine.fmtTime(Math.ceil(show / 1000));
      var sub = v.label || '';
      if (s.kind === 'stopwatch' && s.capMs) sub = 'Cap ' + Engine.fmtTime(s.capMs / 1000);
      if (s.kind === 'countdown' && s.label) sub = s.label;
      document.getElementById('tm-sub').textContent = sub;
      el.setAttribute('data-phase', v.done ? 'done' : (v.phase || v.zone || ''));
      var total = s.kind === 'countdown' ? s.totalMs : s.kind === 'segments' ? v.totalMs : s.kind === 'stopwatch' ? s.capMs : s.kind === 'emom' ? (s.minutes || 0) * 60000 : s.kind === 'tabata' ? (s.rounds || 8) * ((s.workSec || 20) + (s.restSec || 10)) * 1000 : 0;
      document.getElementById('tm-bar').style.width = total ? Math.min(100, 100 * v.elapsedMs / total) + '%' : '0';
      if (s.kind === 'segments' && v.segIndex != null && s.segments[v.segIndex + 1]) document.getElementById('tm-next').textContent = 'Next: ' + s.segments[v.segIndex + 1].label + ' (' + Engine.fmtTime(s.segments[v.segIndex + 1].seconds) + ')';
      var tg = document.getElementById('tm-toggle'); if (tg) tg.textContent = v.done ? 'Done' : tstate.t.running ? 'Pause' : (v.elapsedMs ? 'Resume' : 'Start');
      /* sounds: phase or minute change, and the last three seconds of a countdown phase */
      var phaseKey = (v.phase || '') + ':' + (v.round || '') + ':' + (v.segIndex == null ? '' : v.segIndex);
      if (tstate.lastPhase != null && phaseKey !== tstate.lastPhase && !v.done) A.beep('go');
      tstate.lastPhase = phaseKey;
      var secLeft = v.remainingMs != null ? Math.ceil(v.remainingMs / 1000) : null;
      if (secLeft != null && secLeft <= 3 && secLeft > 0 && secLeft !== tstate.lastSec && tstate.t.running) A.beep('tick');
      tstate.lastSec = secLeft;
      if (v.done && !tstate.finished) { tstate.finished = true; A.beep('end'); clearInterval(tstate.iv); setTimeout(function () { A.timer.finish(true); }, 800); }
    },
    finish: function (auto) {
      if (!tstate) return;
      var v = T.view(tstate.t, Date.now()), res = { elapsedMs: v.elapsedMs, rounds: tstate.rounds, done: !!auto, capped: tstate.t.spec.kind === 'stopwatch' && !!tstate.t.spec.capMs && v.done };
      var cb = tstate.opts.onFinish;
      A.timer.close(); A.wake.off();
      if (cb) cb(res);
    }
  };
  A.action('timer-toggle', function () {
    if (!tstate) return;
    if (tstate.t.running) { T.pause(tstate.t, Date.now()); clearInterval(tstate.iv); tstate.iv = null; }
    else { T.start(tstate.t, Date.now()); if (!tstate.iv) tstate.iv = setInterval(A.timer.render, 200); if (!tstate.started) { tstate.started = true; A.beep('go'); } }
    A.timer.render();
  });
  A.action('timer-round-plus', function () { if (tstate) { tstate.rounds++; document.getElementById('tm-rounds').textContent = tstate.rounds; A.beep('tick'); } });
  A.action('timer-round-minus', function () { if (tstate && tstate.rounds > 0) { tstate.rounds--; document.getElementById('tm-rounds').textContent = tstate.rounds; } });
  A.action('timer-finish', function () { A.timer.finish(false); });
  A.action('timer-close', function () { A.timer.close(); });
})();
