/* Plans tab: programs, benchmark WODs, bodyweight ladders and cardio protocols.
   Features:
     - your current program: week, round, next session, change or restart
     - the full program catalogue filtered by goal, each with a detail modal (why it works, the week map with
       every block, cardio and deload notes, the champion behind it) and a start / switch button
     - benchmark WODs by kind with your best score, a detail modal (movements with Rx loads in your units,
       scaling, the story) and "do it now"
     - the nine ladders with your current rung highlighted
     - cardio protocols with the segment preview and "start now" */
(function () {
  'use strict';
  var A = window.App;
  var view = { goal: null, wodKind: 'girl' };

  A.register('plans', function (el) {
    var p = A.profile(), plan = A.plan(), program = A.program();
    if (!view.goal) view.goal = p ? p.goal : 'buffed';
    if (plan && program) {
      var cd = Engine.currentDay(plan, program), week = Engine.calendarWeek(plan, Date.now());
      el.appendChild(A.h('<div class="card prog-card goal-' + program.goal + '"><div class="card-head"><div><span class="badge accent">Your program</span><h2>' + A.esc(program.name) + '</h2></div>' + A.goalChip(program.goal) + '</div><p class="muted small">Week ' + week + ' of ' + program.weeks + ' · round ' + ((plan.round || 0) + 1) + ' · ' + (plan.sessions || 0) + ' sessions logged · next: ' + A.esc(cd.day.name) + '</p><div class="progress-bar"><span style="width:' + Math.min(100, 100 * week / program.weeks) + '%"></span></div><div class="row mt"><button class="btn sm" data-action="open-program" data-id="' + program.id + '">Week map</button><button class="btn sm ghost" data-action="open-program-picker">Change program</button></div></div>'));
    }
    /* programs */
    el.appendChild(A.h('<h2 class="mb">Programs</h2>'));
    el.appendChild(A.h('<div class="chips mb">' + Object.keys(DATA.GOALS).map(function (g) { return '<button class="chip' + (view.goal === g ? ' on' : '') + '" data-action="plans-goal" data-g="' + g + '">' + DATA.GOALS[g].label + '</button>'; }).join('') + '</div>'));
    DATA.PROGRAMS.filter(function (pr) { return pr.goal === view.goal; }).forEach(function (pr) {
      var ch = DATA.championById[pr.champion];
      el.appendChild(A.h('<button class="card prog-card goal-' + pr.goal + '" style="width:100%;text-align:left" data-action="open-program" data-id="' + pr.id + '"><div class="card-head"><h3>' + A.esc(pr.name) + '</h3><span class="badge">' + pr.level.join(' / ') + '</span></div><p class="small">' + A.esc(pr.summary) + '</p><p class="small muted">' + pr.perWeek + ' sessions a week · ' + pr.weeks + ' weeks · ' + pr.location.join(' or ') + (ch ? ' · after ' + A.esc(ch.name.split(',')[0].split(' and ')[0]) : '') + '</p></button>'));
    });
    /* WODs */
    el.appendChild(A.h('<h2 class="mb mt">Benchmark WODs</h2>'));
    el.appendChild(A.h('<div class="chips mb">' + [['girl', 'The Girls'], ['hero', 'Heroes'], ['house', 'House']].map(function (x) { return '<button class="chip' + (view.wodKind === x[0] ? ' on' : '') + '" data-action="plans-wod-kind" data-k="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>'));
    var wl = A.h('<ul class="list card flat"></ul>');
    DATA.WODS.filter(function (w) { return w.kind === view.wodKind; }).forEach(function (w) {
      var best = A.data.prs['wod:' + w.id];
      wl.appendChild(A.h('<li><div class="row between" data-action="open-wod" data-id="' + w.id + '" style="cursor:pointer"><div><strong>' + A.esc(w.name) + '</strong><div class="small muted">' + A.wodHeadline(w) + ' · ' + w.movements.map(function (m) { return A.exName(m.ex); }).join(', ') + '</div></div><div class="small" style="text-align:right">' + (best && best.score ? '<strong>' + Engine.wodScore(w, best.score) + '</strong><br><span class="muted">best</span>' : '<span class="muted">no score yet</span>') + '</div></div></li>'));
    });
    el.appendChild(wl);
    /* ladders */
    el.appendChild(A.h('<h2 class="mb mt">Bodyweight ladders</h2><p class="small muted">The r/bodyweightfitness progressions. 3 sets of 5-8; at 3x8 you move up a rung. Your rung is highlighted.</p>'));
    Object.keys(DATA.LADDERS).forEach(function (lid) {
      var L = DATA.LADDERS[lid], ls = plan && plan.ladders[lid];
      var cur = ls ? ls.rung : (p ? Engine.ladderStartRung(lid, p) : 0);
      el.appendChild(A.h('<details class="card flat"><summary><strong>' + A.esc(L.name) + '</strong> <span class="muted small">rung ' + (cur + 1) + ' of ' + L.rungs.length + ': ' + A.esc(A.exName(L.rungs[cur].ex)) + '</span></summary><div class="rung-list mt">' + L.rungs.map(function (r, i) { return '<div class="rung' + (i === cur ? ' now' : i < cur ? ' past' : '') + '" data-action="open-exercise" data-id="' + r.ex + '" style="cursor:pointer"><span class="n">' + (i + 1) + '</span>' + A.thumb(r.ex) + '<span>' + A.esc(r.label || A.exName(r.ex)) + (r.seconds ? ' <span class="muted small">hold</span>' : '') + (r.weighted ? ' <span class="muted small">add load</span>' : '') + '</span></div>'; }).join('') + '</div>' + (ls ? '<div class="row mt"><button class="btn sm ghost" data-action="ladder-down" data-l="' + lid + '">Rung down</button><button class="btn sm ghost" data-action="ladder-up" data-l="' + lid + '">Rung up</button></div>' : '') + '</details>'));
    });
    /* cardio */
    el.appendChild(A.h('<h2 class="mb mt">Cardio protocols</h2>'));
    var cl = A.h('<div class="stack"></div>');
    Object.keys(DATA.CARDIO).forEach(function (k) {
      var c = DATA.CARDIO[k];
      cl.appendChild(A.h('<div class="card flat"><div class="card-head"><div><strong>' + A.esc(c.name) + '</strong><div class="small muted">' + A.esc(c.zone) + ' · about ' + c.defaultMinutes + ' min</div></div><button class="btn sm primary" data-action="choose-cardio" data-id="' + k + '">Start</button></div><p class="small muted">' + A.esc(c.help) + '</p></div>'));
    });
    el.appendChild(cl);
    el.appendChild(A.h('<div class="card flat mt"><h3>Heart-rate zones</h3><p class="small muted">Your estimated max is ' + (p ? Engine.hrMax(p) : 185) + ' bpm (220 minus age).</p><ul class="list tight">' + DATA.HR_ZONES.map(function (z) { var mx = p ? Engine.hrMax(p) : 185; return '<li><strong>' + z.label + '</strong> ' + Math.round(mx * z.pct[0] / 100) + '-' + Math.round(mx * z.pct[1] / 100) + ' bpm <span class="muted small">' + A.esc(z.feel) + '</span></li>'; }).join('') + '</ul></div>'));
  });
  A.action('plans-goal', function (el) { view.goal = el.getAttribute('data-g'); A.render('plans'); });
  A.action('plans-wod-kind', function (el) { view.wodKind = el.getAttribute('data-k'); A.render('plans'); });
  A.action('ladder-up', function (el) { var l = el.getAttribute('data-l'), ls = A.plan().ladders[l]; if (ls.rung < DATA.LADDERS[l].rungs.length - 1) { ls.rung++; ls.reps = 5; ls.seconds = 10; A.save(); A.render('plans'); } });
  A.action('ladder-down', function (el) { var l = el.getAttribute('data-l'), ls = A.plan().ladders[l]; if (ls.rung > 0) { ls.rung--; ls.reps = 5; ls.seconds = 10; A.save(); A.render('plans'); } });

  /* ---------------------------------------------------------------- program detail */
  function blockLine(b, p) {
    var exId = b.ex || (b.slot ? Engine.resolveSlot(b.slot, p || { location: 'gym' }, DATA.exerciseById) : null);
    if (b.kind === 'warmup') return 'Warm-up: ' + b.items.map(function (it) { return A.exName(it.ex); }).join(', ');
    if (b.kind === 'cooldown') return 'Cool-down: ' + b.items.map(function (it) { return A.exName(it.ex); }).join(', ');
    if (b.kind === 'strength') { var s = b.scheme, dose = s.type === 'sets' ? s.sets + 'x' + (s.range ? s.range[0] + '-' + s.range[1] : s.reps) + (s.amrapLast ? '+' : '') : s.type === 'pyramid' ? s.reps.join('/') : s.type === 'gzclp' ? s.tier : s.type === '531' ? '5/3/1' + (s.bbb ? ' + BBB' : '') : s.type === 'amrap' ? s.sets + ' x max' : ''; return A.exName(exId) + (b.slot ? '*' : '') + ' ' + dose; }
    if (b.kind === 'hold') return A.exName(exId) + ' ' + b.sets + 'x' + b.seconds + ' s';
    if (b.kind === 'ladder') return DATA.LADDERS[b.ladder].name;
    if (b.kind === 'circuit') return (DATA.WOD_FORMATS[b.format] || {}).label + (b.minutes ? ' ' + b.minutes + ' min' : '') + ': ' + b.items.map(function (it) { return A.exName(it.ex); }).join(', ');
    if (b.kind === 'wod') return 'WOD: ' + (b.wod.indexOf('pick:') === 0 ? 'your pick' : DATA.wodById[b.wod].name);
    if (b.kind === 'cardio') return 'Cardio: ' + DATA.CARDIO[b.protocol].name + (b.minutes ? ' ' + b.minutes + ' min' : '');
    return b.kind;
  }
  A.openProgram = function (id) {
    var pr = DATA.programById[id]; if (!pr) return;
    var p = A.profile(), plan = A.plan(), ch = DATA.championById[pr.champion], isCurrent = plan && plan.programId === id;
    var html = '<div class="row mb">' + A.goalChip(pr.goal) + '<span class="chip">' + pr.level.join(' / ') + '</span><span class="chip">' + pr.perWeek + ' days</span><span class="chip">' + pr.weeks + ' weeks</span><span class="chip">' + pr.location.join(' or ') + '</span></div>';
    html += '<p>' + A.esc(pr.summary) + '</p><h3>Why it works</h3><p class="small">' + A.esc(pr.why) + '</p>';
    if (ch) html += '<div class="card flat champ-card"><strong>' + A.esc(ch.name) + '</strong> <span class="muted small">' + A.esc(ch.titles) + '</span><blockquote>' + A.esc(ch.quote) + '</blockquote><p class="small">' + A.esc(ch.principle) + '</p></div>';
    html += '<h3>The week</h3><div class="week-map">' + pr.days.map(function (d, i) { return '<div class="week-day' + (isCurrent && i === plan.dayIndex % pr.days.length ? ' now' : '') + '"><span class="d">' + (i + 1) + '</span><div><strong>' + A.esc(d.name) + '</strong> <span class="muted small">' + d.kind + ' · ~' + (d.est || 45) + ' min</span><ul class="list tight small">' + d.blocks.map(function (b) { return '<li>' + A.esc(blockLine(b, p)) + '</li>'; }).join('') + '</ul></div></div>'; }).join('') + '</div><p class="small muted">* resolved to your equipment at session time.</p>';
    html += '<h3>Cardio</h3><p class="small">' + A.esc(pr.cardioNote) + '</p>' + (pr.deload && pr.deload.note ? '<h3>Deload</h3><p class="small">' + A.esc(pr.deload.note) + '</p>' : '');
    html += '<div class="mt">' + (isCurrent ? '<button class="btn block" data-action="restart-program" data-id="' + id + '">Restart from week 1</button>' : '<button class="btn primary block lg" data-action="start-program" data-id="' + id + '">' + (plan ? 'Switch to this program' : 'Start this program') + '</button>') + '</div>';
    A.modal({ title: pr.name, html: html });
  };
  A.action('open-program', function (el) { A.openProgram(el.getAttribute('data-id')); });
  A.action('start-program', function (el) {
    var id = el.getAttribute('data-id');
    if (!A.profile()) { A.closeModal(); A.openOnboarding(); return; }
    if (A.plan()) A.confirm('Switch programs? Your history and records stay; the plan pointer and loads restart from your profile.').then(function (ok) { if (ok) A.startProgram(id); });
    else A.startProgram(id);
  });
  A.action('restart-program', function (el) { var id = el.getAttribute('data-id'); A.confirm('Restart ' + DATA.programById[id].name + ' from week 1?').then(function (ok) { if (ok) A.startProgram(id); }); });

  /* ---------------------------------------------------------------- WOD detail */
  A.openWod = function (id) {
    var w = DATA.wodById[id]; if (!w) return;
    var best = A.data.prs['wod:' + id], hist = [];
    A.data.workouts.forEach(function (wk) { if (wk.status !== 'done') return; wk.blocks.forEach(function (b) { if (b.kind === 'wod' && b.wodId === id && b.result) hist.push({ t: wk.startedAt, r: b.result }); }); });
    hist.sort(function (a, b) { return b.t - a.t; });
    var html = '<p><span class="badge">' + w.kind + '</span> ' + A.wodHeadline(w) + '</p><p class="small">' + A.esc(w.story) + '</p>';
    html += '<div class="wod-card">' + w.movements.map(function (m) { return '<div class="mv" data-action="open-exercise" data-id="' + m.ex + '" style="cursor:pointer">' + A.thumb(m.ex) + '<span class="name">' + A.esc(A.exName(m.ex)) + (m.note ? ' <span class="muted small">' + A.esc(m.note) + '</span>' : '') + '</span><span class="muted small">' + A.movementDose(w, m) + '</span></div>'; }).join('') + '</div>';
    html += '<dl class="kv mt"><dt>Rx</dt><dd>As listed' + (w.bodyweight ? ', no equipment but a bar or floor' : '') + '</dd><dt>Intermediate</dt><dd>' + A.esc(w.scaling.intermediate) + '</dd><dt>Beginner</dt><dd>' + A.esc(w.scaling.beginner) + '</dd></dl>';
    if (best && best.score) html += '<p class="mt"><strong>Your best:</strong> ' + Engine.wodScore(w, best.score) + ' <span class="muted small">' + A.fmtDate(best.score.at) + '</span></p>';
    if (hist.length) html += '<ul class="list tight">' + hist.slice(0, 6).map(function (h) { return '<li><span class="muted small">' + A.fmtDate(h.t) + '</span> ' + Engine.wodScore(w, h.r) + (h.r.note ? ' <span class="muted small">' + A.esc(h.r.note) + '</span>' : '') + '</li>'; }).join('') + '</ul>';
    html += '<p class="small muted mt">Standard from crossfit.com/benchmark/' + id + '. Scaling marked "gym convention" is common practice, not the official page.</p>';
    html += '<button class="btn primary block lg mt" data-action="choose-wod" data-id="' + id + '">Do it now</button>';
    A.modal({ title: w.name, html: html });
  };
  A.action('open-wod', function (el) { A.openWod(el.getAttribute('data-id')); });
})();
