/* Library tab: every exercise, searchable and filterable, with the detail view used across the app.
   Features:
     - search by name or alias; filter chips for muscle group, equipment, level and category
     - grid of cards with a static thumbnail (the middle animation frame)
     - detail modal (App.openExercise): live faceless animation with play / pause / step and speed,
       animation or illustration toggle, steps, cues, common mistakes, muscles, equipment, joint flags,
       easier and harder variations, your record and recent history on the exercise */
(function () {
  'use strict';
  var A = window.App;
  var filt = { q: '', group: null, equip: null, level: null, cat: null };

  var CATS = { strength: 'Strength', cardio: 'Cardio', olympic: 'Olympic', plyo: 'Plyo', mobility: 'Mobility' };

  function matches(ex) {
    if (filt.q) { var q = filt.q.toLowerCase(); if (ex.name.toLowerCase().indexOf(q) < 0 && !ex.alias.some(function (a) { return a.toLowerCase().indexOf(q) >= 0; }) && ex.id.indexOf(q) < 0) return false; }
    if (filt.group) { var g = DATA.VOLUME_GROUPS.find(function (x) { return x.id === filt.group; }); if (!g || !ex.primary.some(function (m) { return g.muscles.indexOf(m) >= 0; })) return false; }
    if (filt.equip === 'bodyweight') { if (ex.equip.some(function (q) { return ['mat', 'wall', 'chair', 'towel'].indexOf(q) < 0; })) return false; }
    else if (filt.equip && ex.equip.indexOf(filt.equip) < 0) return false;
    if (filt.level && ex.level !== filt.level) return false;
    if (filt.cat && ex.cat !== filt.cat) return false;
    return true;
  }

  A.register('library', function (el) {
    var p = A.profile();
    el.appendChild(A.h('<input class="search" type="search" id="lib-q" placeholder="Search ' + DATA.exercises.length + ' exercises" value="' + A.esc(filt.q) + '">'));
    var chips = '<div class="pill-row mb">' + ['', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'].map(function (g) { var label = g ? DATA.VOLUME_GROUPS.find(function (x) { return x.id === g; }).label : 'All muscles'; return '<button class="chip' + ((filt.group || '') === g ? ' on' : '') + '" data-action="lib-filter" data-f="group" data-v="' + g + '">' + label + '</button>'; }).join('') + '</div>';
    chips += '<div class="pill-row mb">' + [['', 'Any equipment'], ['bodyweight', 'Bodyweight only'], ['dumbbells', 'Dumbbells'], ['barbell', 'Barbell'], ['kettlebell', 'Kettlebell'], ['cables', 'Cables'], ['machines', 'Machines'], ['pullup_bar', 'Pull-up bar'], ['bands', 'Bands']].map(function (x) { return '<button class="chip' + ((filt.equip || '') === x[0] ? ' on' : '') + '" data-action="lib-filter" data-f="equip" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    chips += '<div class="pill-row mb">' + [['', 'Any level'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(function (x) { return '<button class="chip' + ((filt.level || '') === x[0] ? ' on' : '') + '" data-action="lib-filter" data-f="level" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
      Object.keys(CATS).map(function (c) { return '<button class="chip' + (filt.cat === c ? ' on' : '') + '" data-action="lib-filter" data-f="cat" data-v="' + c + '">' + CATS[c] + '</button>'; }).join('') + '</div>';
    el.appendChild(A.h('<div>' + chips + '</div>'));
    var list = DATA.exercises.filter(matches);
    var grid = A.h('<div class="ex-grid"></div>');
    list.forEach(function (ex) {
      var flagged = p && Engine.avoids(p, ex), cant = p && !Engine.hasEquipment(p, ex);
      grid.appendChild(A.h('<button class="ex-card" data-action="open-exercise" data-id="' + ex.id + '">' + A.thumb(ex.id, 'wide') + '<span class="name">' + A.esc(ex.name) + '</span><span class="meta">' + ex.primary.slice(0, 2).map(function (m) { return DATA.MUSCLES[m]; }).join(', ') + ' · ' + ex.level + (flagged ? ' · <span class="badge warn">joint</span>' : '') + (cant ? ' · <span class="badge">gear</span>' : '') + '</span></button>'));
    });
    if (!list.length) grid.appendChild(A.h('<div class="empty">Nothing matches. Clear a filter.</div>'));
    el.appendChild(A.h('<p class="small muted">' + list.length + ' exercises</p>'));
    el.appendChild(grid);
    var q = document.getElementById('lib-q');
    q.addEventListener('input', function () { filt.q = q.value; var g = el.querySelector('.ex-grid'); var fresh = A.h('<div class="ex-grid"></div>'); DATA.exercises.filter(matches).forEach(function (ex) { fresh.appendChild(A.h('<button class="ex-card" data-action="open-exercise" data-id="' + ex.id + '">' + A.thumb(ex.id, 'wide') + '<span class="name">' + A.esc(ex.name) + '</span><span class="meta">' + ex.primary.slice(0, 2).map(function (m) { return DATA.MUSCLES[m]; }).join(', ') + '</span></button>')); }); g.replaceWith(fresh); });
  });
  A.action('lib-filter', function (el) { var f = el.getAttribute('data-f'), v = el.getAttribute('data-v'); filt[f] = v || null; A.render('library'); });

  /* ---------------------------------------------------------------- detail */
  A.openExercise = function (id) {
    var ex = A.ex(id); if (!ex) return;
    var p = A.profile(), pr = A.data.prs[id], hist = Engine.exerciseHistory(A.data.workouts, id).slice(0, 5);
    var node = A.h('<div class="ex-detail"></div>');
    var html = '<div class="media-wrap"><div class="media" id="exd-media"></div><div class="media-controls"><button class="btn sm" data-action="exd-toggle">Pause</button><button class="btn sm ghost" data-action="exd-step">Step</button><button class="btn sm ghost" data-action="exd-speed">Slower</button>' + (ex.anim && ex.repdb ? '<button class="btn sm ghost" data-action="exd-mode">Illustration</button>' : '') + '</div></div>';
    html += '<div class="chips mt">' + ex.primary.map(function (m) { return '<span class="chip on">' + DATA.MUSCLES[m] + '</span>'; }).join('') + ex.secondary.map(function (m) { return '<span class="chip">' + DATA.MUSCLES[m] + '</span>'; }).join('') + '</div>';
    html += '<dl class="kv mt"><dt>Level</dt><dd>' + ex.level + '</dd><dt>Type</dt><dd>' + (CATS[ex.cat] || ex.cat) + ' · ' + ex.mech + ' · ' + ex.force + (ex.uni ? ' · one side at a time' : '') + '</dd><dt>Equipment</dt><dd>' + (ex.equip.length ? ex.equip.map(function (q) { return DATA.EQUIPMENT[q]; }).join(', ') : 'None') + '</dd>' + (ex.stress.length ? '<dt>Loads</dt><dd>' + ex.stress.map(function (j) { return DATA.JOINTS[j]; }).join(', ') + (p && Engine.avoids(p, ex) ? ' <span class="badge warn">flagged for you</span>' : '') + '</dd>' : '') + (ex.alias.length ? '<dt>Also called</dt><dd>' + A.esc(ex.alias.join(', ')) + '</dd>' : '') + '</dl>';
    html += '<h3 class="mt">How to do it</h3><ol class="steps">' + ex.steps.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ol>';
    if (ex.cues.length) html += '<h4>Coaching cues</h4><ul class="steps">' + ex.cues.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ul>';
    if (ex.mistakes.length) html += '<h4>Common mistakes</h4><ul class="steps">' + ex.mistakes.map(function (s) { return '<li>' + A.esc(s) + '</li>'; }).join('') + '</ul>';
    if (ex.easier || ex.harder) html += '<div class="row mt">' + (ex.easier ? '<button class="btn sm" data-action="open-exercise" data-id="' + ex.easier + '">Easier: ' + A.esc(A.exName(ex.easier)) + '</button>' : '') + (ex.harder ? '<button class="btn sm" data-action="open-exercise" data-id="' + ex.harder + '">Harder: ' + A.esc(A.exName(ex.harder)) + '</button>' : '') + '</div>';
    if (pr && (pr.e1rm || pr.reps)) html += '<h3 class="mt">Your record</h3><p>' + (pr.e1rm ? A.fmtKg(pr.e1rm.kg) + ' x ' + pr.e1rm.reps + ' (estimated 1RM ' + A.fmtKg(pr.e1rm.value) + ') on ' + A.fmtDate(pr.e1rm.at) : pr.reps.reps + ' reps on ' + A.fmtDate(pr.reps.at)) + '</p>';
    if (hist.length) html += '<h3 class="mt">Recent sessions</h3><ul class="list tight">' + hist.map(function (h) { return '<li><span class="muted small">' + A.fmtDate(h.t) + '</span> ' + h.sets.map(function (s) { return s.seconds != null ? s.seconds + 's' : (s.kg ? A.fmtKg(s.kg, false) + 'x' : '') + s.reps; }).join(', ') + '</li>'; }).join('') + '</ul>';
    html += '<p class="small muted mt">Estimated energy: ' + ex.met + ' METs, about ' + Engine.kcal(ex.met, 10, A.bodyKg()) + ' kcal per 10 minutes of work for you.</p>';
    node.innerHTML = html;
    A.modal({ title: ex.name, node: node });
    var player = A.mountMedia(node.querySelector('#exd-media'), ex, { autoplay: true });
    A._exd = { player: player, slow: false };
  };
  A.action('open-exercise', function (el) { A.openExercise(el.getAttribute('data-id')); });
  A.action('exd-toggle', function (el) { if (!A._exd) return; A._exd.player.toggle(); el.textContent = el.textContent === 'Pause' ? 'Play' : 'Pause'; });
  A.action('exd-step', function () { if (A._exd) { A._exd.player.step(); var b = document.querySelector('[data-action="exd-toggle"]'); if (b) b.textContent = 'Play'; } });
  A.action('exd-speed', function (el) { if (!A._exd) return; A._exd.slow = !A._exd.slow; A._exd.player.setFrameMs(A._exd.slow ? 1200 : 650); el.textContent = A._exd.slow ? 'Faster' : 'Slower'; });
  A.action('exd-mode', function (el) { if (!A._exd) return; var m = A._exd.player.mode === 'anim' ? 'illustration' : 'anim'; A._exd.player.setMode(m); el.textContent = m === 'anim' ? 'Illustration' : 'Animation'; });
})();
