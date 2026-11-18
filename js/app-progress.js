/* Progress tab: body log, strength trends, weekly volume, cardio minutes, the activity heat map and history.
   Features:
     - body log form (weight, body fat, waist and other girths, note) with a weight trend line and the goal's
       body-fat range for context
     - estimated 1RM trend for any lift you have logged, as an inline SVG chart
     - this week's hard sets per muscle group against the goal's target band
     - easy and hard cardio minutes this week against the playbook target
     - a 12-week heat map of sessions
     - workout history with a detail modal (every set, result, notes) and delete */
(function () {
  'use strict';
  var A = window.App;
  var view = { lift: null };
  var WEEK = 7 * 86400000;

  /* a small line chart: points [{t, v}], returns SVG markup */
  function lineChart(points, fmt) {
    if (!points.length) return '<div class="empty small">No data yet.</div>';
    var W = 600, H = 200, pad = 36;
    var vs = points.map(function (p) { return p.v; }), ts = points.map(function (p) { return p.t; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs); if (hi === lo) { hi += 1; lo -= 1; }
    var t0 = Math.min.apply(null, ts), t1 = Math.max.apply(null, ts); if (t1 === t0) t1 = t0 + 1;
    var x = function (t) { return pad + (W - pad - 10) * (t - t0) / (t1 - t0); }, y = function (v) { return H - pad / 2 - (H - pad) * (v - lo) / (hi - lo); };
    var d = points.map(function (p, i) { return (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    var grid = [lo, (lo + hi) / 2, hi].map(function (v) { return '<line class="grid" x1="' + pad + '" x2="' + (W - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="lbl" x="2" y="' + (y(v) + 3) + '">' + fmt(v) + '</text>'; }).join('');
    var dots = points.map(function (p) { return '<circle class="dot" r="3.5" cx="' + x(p.t) + '" cy="' + y(p.v) + '"/>'; }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + grid + '<path class="line" d="' + d + '"/>' + dots + '<text class="lbl" x="' + pad + '" y="' + (H - 2) + '">' + A.fmtDate(t0) + '</text><text class="lbl" x="' + (W - 10) + '" y="' + (H - 2) + '" text-anchor="end">' + A.fmtDate(t1) + '</text></svg>';
  }

  A.register('progress', function (el) {
    var p = A.profile(), goal = p ? p.goal : 'lean', now = Date.now();
    var ws = Engine.startOfWeek(now, A.data.settings.weekStartsOn);
    /* body log */
    var log = A.data.bodyLog.slice().sort(function (a, b) { return a.at - b.at; });
    var last = log[log.length - 1];
    var card = A.h('<div class="card"><div class="card-head"><h3>Body</h3><button class="btn sm primary" data-action="log-body">Log</button></div>' + (last ? '<div class="stats-row"><div class="stat"><span class="v">' + A.fmtKg(last.kg, false) + '</span><span class="l">' + A.units() + ' · ' + A.fmtDate(last.at) + '</span></div><div class="stat"><span class="v">' + (last.bodyFat ? last.bodyFat + '%' : '–') + '</span><span class="l">body fat</span></div><div class="stat"><span class="v">' + (last.waistCm ? last.waistCm : '–') + '</span><span class="l">waist cm</span></div></div>' : '<p class="muted small">Log your weight weekly, same day and time.</p>') + lineChart(log.map(function (b) { return { t: b.at, v: Engine.roundLoad(b.kg, A.units()) }; }), function (v) { return Math.round(v); }) + '<p class="small muted">' + A.esc(DATA.PLAYBOOKS[goal].bodyFat) + ' ' + A.esc(DATA.PLAYBOOKS[goal].energy) + '</p></div>');
    el.appendChild(card);
    /* strength trend */
    var lifted = {};
    A.data.workouts.forEach(function (w) { if (w.status === 'done') w.blocks.forEach(function (b) { if (b.kind === 'strength' && b.sets && b.sets.some(function (s) { return s.done && s.kg; })) lifted[b.exerciseId] = true; }); });
    var lifts = Object.keys(lifted);
    if (!view.lift || !lifted[view.lift]) view.lift = lifts.indexOf('squat') >= 0 ? 'squat' : lifts[0] || null;
    var sc = A.h('<div class="card"><div class="card-head"><h3>Strength</h3>' + (lifts.length ? '<select id="pg-lift">' + lifts.map(function (id) { return '<option value="' + id + '"' + (id === view.lift ? ' selected' : '') + '>' + A.esc(A.exName(id)) + '</option>'; }).join('') + '</select>' : '') + '</div>' + (view.lift ? lineChart(Engine.strengthTrend(A.data.workouts, view.lift).map(function (x) { return { t: x.t, v: Engine.roundLoad(x.e1rm, A.units()) }; }), function (v) { return Math.round(v); }) + '<p class="small muted">Estimated one-rep max per session (Epley). The trend matters more than any single point.</p>' : '<p class="muted small">Log a few sessions to see your lifts climb.</p>') + '</div>');
    el.appendChild(sc);
    var sel = sc.querySelector('#pg-lift'); if (sel) sel.addEventListener('change', function () { view.lift = sel.value; A.render('progress'); });
    /* weekly volume */
    var rep = Engine.volumeReport(A.data.workouts, DATA.exerciseById, goal, ws, ws + WEEK);
    el.appendChild(A.h('<div class="card"><h3>This week: hard sets per muscle</h3><p class="small muted">Target for ' + DATA.GOALS[goal].label + ': ' + rep[0].target[0] + '-' + rep[0].target[1] + ' sets a week on the big groups. Primary muscles count a full set, secondary a half.</p><div class="bars mt">' + rep.map(function (g) { var max = g.target[1] * 1.3; return '<div class="bar-row ' + g.status + '"><span>' + g.label + '</span><div class="bar"><span style="width:' + Math.min(100, 100 * g.sets / max) + '%"></span><i style="left:' + (100 * g.target[0] / max) + '%"></i><i style="left:' + (100 * g.target[1] / max) + '%"></i></div><span>' + g.sets + '</span></div>'; }).join('') + '</div></div>'));
    /* cardio minutes */
    var cm = Engine.cardioMinutes(A.data.workouts, ws, ws + WEEK);
    el.appendChild(A.h('<div class="card"><h3>This week: cardio</h3><div class="stats-row"><div class="stat"><span class="v">' + cm.easy + '</span><span class="l">easy min</span></div><div class="stat"><span class="v">' + cm.hard + '</span><span class="l">hard min</span></div><div class="stat"><span class="v">' + (cm.easy + cm.hard) + '</span><span class="l">total</span></div></div><p class="small muted">' + A.esc(DATA.PLAYBOOKS[goal].cardio) + '</p></div>'));
    /* heat map, 12 weeks, columns are weeks, rows are days */
    var cols = '';
    for (var k = 11; k >= 0; k--) {
      var from = ws - k * WEEK, cells = '';
      for (var d = 0; d < 7; d++) {
        var a = from + d * 86400000, n = A.data.workouts.filter(function (w) { return w.status === 'done' && w.startedAt >= a && w.startedAt < a + 86400000; }).length;
        cells += '<div class="cell' + (n >= 2 ? ' l3' : n === 1 ? ' l2' : '') + '" title="' + A.fmtDate(a) + ': ' + n + '"></div>';
      }
      cols += '<div class="col">' + cells + '</div>';
    }
    el.appendChild(A.h('<div class="card"><h3>Last 12 weeks</h3><div class="heat mt">' + cols + '</div></div>'));
    /* history */
    var hist = A.data.workouts.filter(function (w) { return w.status !== 'active'; }).sort(function (a, b) { return b.startedAt - a.startedAt; });
    var hl = A.h('<div class="card"><h3>History</h3>' + (hist.length ? '<ul class="list">' + hist.slice(0, 40).map(function (w) { return '<li class="hist-item" data-action="open-workout" data-id="' + w.id + '" style="cursor:pointer"><div><strong>' + A.esc(w.dayName) + '</strong>' + (w.status === 'abandoned' ? ' <span class="badge">abandoned</span>' : '') + (w.prs && w.prs.length ? ' <span class="badge ok">PR</span>' : '') + '<div class="small muted">' + A.fmtDateTime(w.startedAt) + (w.endedAt ? ' · ' + Math.round((w.endedAt - w.startedAt) / 60000) + ' min' : '') + (w.kcal ? ' · ' + w.kcal + ' kcal' : '') + '</div></div><span class="muted">&rsaquo;</span></li>'; }).join('') + '</ul>' : '<p class="muted small">Your finished sessions will show here.</p>') + '</div>');
    el.appendChild(hl);
  });

  /* ---------------------------------------------------------------- body log */
  A.action('log-body', function () {
    var last = A.data.bodyLog.slice().sort(function (a, b) { return b.at - a.at; })[0] || {};
    A.modal({ title: 'Log body', html: '<div class="grid-2"><div class="field"><label>Weight (' + A.units() + ')</label><input type="number" inputmode="decimal" id="bl-kg" value="' + (last.kg ? A.loadVal(last.kg) : '') + '"></div><div class="field"><label>Body fat %</label><input type="number" inputmode="decimal" id="bl-bf" value="' + (last.bodyFat || '') + '"></div><div class="field"><label>Waist cm</label><input type="number" inputmode="decimal" id="bl-waist" value="' + (last.waistCm || '') + '"></div><div class="field"><label>Chest cm</label><input type="number" inputmode="decimal" id="bl-chest" value="' + (last.chestCm || '') + '"></div><div class="field"><label>Hips cm</label><input type="number" inputmode="decimal" id="bl-hips" value="' + (last.hipsCm || '') + '"></div><div class="field"><label>Arm cm</label><input type="number" inputmode="decimal" id="bl-arm" value="' + (last.armCm || '') + '"></div></div><div class="field"><label>Note</label><input type="text" id="bl-note"></div><button class="btn primary block" data-action="save-body">Save</button>' });
  });
  A.action('save-body', function () {
    var g = function (id) { var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; };
    var kg = A.toKg(document.getElementById('bl-kg').value);
    if (kg == null) return A.toast('Enter your weight.');
    A.data.bodyLog.push({ id: Storage_.newId(), at: Date.now(), kg: kg, bodyFat: g('bl-bf'), waistCm: g('bl-waist'), chestCm: g('bl-chest'), hipsCm: g('bl-hips'), armCm: g('bl-arm'), note: document.getElementById('bl-note').value || '' });
    if (A.data.profile) A.data.profile.bodyKg = kg;
    A.save(); A.closeModal(); A.toast('Logged.'); A.render();
  });

  /* ---------------------------------------------------------------- workout detail */
  A.action('open-workout', function (el) {
    var w = A.data.workouts.find(function (x) { return x.id === el.getAttribute('data-id'); }); if (!w) return;
    var html = '<p class="muted small">' + A.fmtDateTime(w.startedAt) + (w.endedAt ? ' · ' + Math.round((w.endedAt - w.startedAt) / 60000) + ' min' : '') + (w.kcal ? ' · ' + w.kcal + ' kcal' : '') + (w.rpe ? ' · RPE ' + w.rpe : '') + '</p>' + (w.notes ? '<p>' + A.esc(w.notes) + '</p>' : '');
    html += '<ul class="list">' + w.blocks.map(function (b) {
      if (b.sets) { var d = b.sets.filter(function (s) { return s.done; }); if (!d.length) return ''; return '<li><strong>' + A.esc(A.exName(b.exerciseId)) + '</strong><div class="small">' + d.map(function (s) { return s.seconds != null ? s.seconds + ' s' : (s.kg ? A.fmtKg(s.kg, false) + ' x ' : '') + s.reps; }).join(', ') + '</div></li>'; }
      if (b.result) { var wod = b.wodId ? DATA.wodById[b.wodId] : null; var txt = b.kind === 'cardio' ? b.result.minutes + ' min' + (b.result.distance ? ' · ' + A.esc(b.result.distance) : '') : wod ? Engine.wodScore(wod, b.result) : (b.result.rounds != null ? b.result.rounds + ' rounds + ' + (b.result.reps || 0) : Engine.fmtTime(b.result.seconds || 0)); return '<li><strong>' + A.esc(wod ? wod.name : b.kind === 'cardio' ? DATA.CARDIO[b.protocol].name : (DATA.WOD_FORMATS[b.format] || {}).label || b.kind) + '</strong><div class="small">' + txt + (b.result.note ? ' · ' + A.esc(b.result.note) : '') + '</div></li>'; }
      return '';
    }).join('') + '</ul>';
    html += '<button class="btn danger sm mt" data-action="delete-workout" data-id="' + w.id + '">Delete this session</button>';
    A.modal({ title: w.dayName, html: html });
  });
  A.action('delete-workout', function (el) {
    var id = el.getAttribute('data-id');
    A.confirm('Delete this session from history? Records already set stay.').then(function (ok) { if (!ok) return; A.data.workouts = A.data.workouts.filter(function (w) { return w.id !== id; }); A.save(); A.closeModal(); A.render(); });
  });
})();
