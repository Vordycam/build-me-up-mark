/* App core: state, tabs, shared UI helpers, the onboarding wizard and the Today tab.
   The other js/app-*.js modules register a tab renderer with App.register(tab, fn) and click handlers with
   App.action(name, fn); every clickable element carries data-action="name" and the handler receives the element.
   Boot happens on DOMContentLoaded at the bottom, after every module has registered.

   Features in this file:
     - theme cycling (Light / Dark / Auto) and the service worker registration
     - modal, toast, confirm, beep and wake-lock helpers shared by every module
     - formatting helpers for loads in the user's units
     - onboarding wizard (goal, level, schedule, equipment and joints, about you, strength) and program choice
     - Today tab: hero card with the next session, week ring, streak, recent PRs, quick actions
     - starting the next planned session or a free session (WOD / cardio) as the active workout */
(function () {
  'use strict';

  var App = {
    data: null,
    tabs: {},
    actions: {},
    players: [],      /* media players mounted by the current render, destroyed on the next */
    current: 'today'
  };
  window.App = App;
  /* click handlers are registered by name; see the delegated listener in the tabs section */
  function action(name, fn) { App.actions[name] = fn; }
  App.action = action;

  /* ---------------------------------------------------------------- state */
  App.save = function () { Storage_.save(App.data); };
  App.units = function () { return App.data.settings.units; };
  App.profile = function () { return App.data.profile; };
  App.plan = function () { return App.data.plan; };
  App.program = function () { return App.data.plan ? DATA.programById[App.data.plan.programId] || null : null; };
  App.ex = function (id) { return DATA.exerciseById[id]; };
  App.activeWorkout = function () { return App.data.workouts.find(function (w) { return w.status === 'active'; }) || null; };

  /* ---------------------------------------------------------------- helpers */
  App.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  App.h = function (html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  App.fmtKg = function (kg, withUnit) { return Engine.fmtLoad(kg, App.units(), withUnit); };
  App.loadVal = function (kg) { var v = Engine.roundLoad(kg, App.units()); return v == null ? '' : String(Math.round(v * 100) / 100); };
  App.toKg = function (v) { return Engine.toKg(v, App.units()); };
  App.bodyKg = function () { var p = App.profile(); return p && p.bodyKg ? p.bodyKg : 75; };
  App.fmtDate = function (t) { var d = new Date(t); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  App.fmtDateTime = function (t) { var d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); };
  App.fmtMin = function (sec) { return Engine.fmtTime(sec); };
  App.goalChip = function (goal) { var g = DATA.GOALS[goal]; return g ? '<span class="chip goal-' + goal + '">' + g.label + '</span>' : ''; };
  App.exName = function (id) { var e = App.ex(id); return e ? e.name : id; };

  /* a static thumbnail: the middle animation frame as an <img> (dark theme inverts it), or the RepDB peak pose */
  App.thumb = function (exId, cls) {
    var e = App.ex(exId);
    var c = 'media media-thumb ' + (cls || '');
    if (!e) return '<div class="' + c + '"></div>';
    if (e.anim) return '<div class="' + c + '"><img class="thumb-img" src="assets/anim/' + e.anim + '/frame-2.svg" alt="" loading="lazy"></div>';
    if (e.repdb) return '<div class="' + c + '"><img class="thumb-img illus" src="' + Media.repdbUrl(e, 'peak') + '" alt="" loading="lazy"></div>';
    return '<div class="' + c + '">' + Media.placeholderSvg() + '</div>';
  };

  /* mount a live player and remember it so a re-render can stop it */
  App.mountMedia = function (el, ex, opts) {
    var p = Media.mount(el, ex, opts || {});
    App.players.push(p);
    return p;
  };
  App.stopPlayers = function () { App.players.forEach(function (p) { try { p.destroy(); } catch (e) {} }); App.players = []; };

  App.toast = function (msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(App._toastT);
    App._toastT = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  };
  App.confirm = function (msg) { return Promise.resolve(window.confirm(msg)); };

  /* one modal at a time. opts: { title, html | node, onClose, wide } -> { el, close } */
  App.modal = function (opts) {
    App.closeModal();
    var root = document.getElementById('modal-root');
    var back = App.h('<div class="modal-back" data-action="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><h2>' + App.esc(opts.title || '') + '</h2><button class="modal-close" data-action="close-modal" aria-label="Close">&times;</button></div><div class="modal-body"></div></div></div>');
    var body = back.querySelector('.modal-body');
    if (opts.node) body.appendChild(opts.node); else body.innerHTML = opts.html || '';
    root.appendChild(back);
    document.body.style.overflow = 'hidden';
    App._modal = { el: back, onClose: opts.onClose, close: App.closeModal };
    return App._modal;
  };
  App.closeModal = function () {
    if (!App._modal) return;
    var m = App._modal; App._modal = null;
    m.el.remove();
    document.body.style.overflow = '';
    if (m.onClose) m.onClose();
  };
  App.action('close-modal', function () { App.closeModal(); });
  App.action('modal-backdrop', function (el, ev) { if (ev.target === el) App.closeModal(); });

  /* short tones from the audio API: no files to cache */
  App.beep = function (kind) {
    if (!App.data.settings.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      App._audio = App._audio || new Ctx();
      var ctx = App._audio, o = ctx.createOscillator(), g = ctx.createGain();
      var f = kind === 'go' ? 880 : kind === 'end' ? 660 : 523, d = kind === 'end' ? .5 : .12;
      o.frequency.value = f; o.type = 'sine'; g.gain.value = .25;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + d);
      if (kind === 'go') { var o2 = ctx.createOscillator(); o2.frequency.value = 1320; o2.connect(g); o2.start(ctx.currentTime + .15); o2.stop(ctx.currentTime + .3); }
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate(kind === 'end' ? [120, 60, 120] : 40);
  };

  App.wake = {
    lock: null,
    on: function () {
      if (!App.data.settings.keepAwake || !navigator.wakeLock || App.wake.lock) return;
      navigator.wakeLock.request('screen').then(function (l) { App.wake.lock = l; l.addEventListener('release', function () { App.wake.lock = null; }); }).catch(function () {});
    },
    off: function () { if (App.wake.lock) { App.wake.lock.release().catch(function () {}); App.wake.lock = null; } }
  };

  /* ---------------------------------------------------------------- tabs and actions */
  App.register = function (tab, fn) { App.tabs[tab] = fn; };

  App.show = function (tab) {
    App.current = tab;
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
    document.querySelectorAll('.tab').forEach(function (s) { s.classList.toggle('active', s.id === 'tab-' + tab); });
    App.render(tab);
    window.scrollTo(0, 0);
  };
  App.render = function (tab) {
    tab = tab || App.current;
    var el = document.getElementById('tab-' + tab);
    if (!el || !App.tabs[tab]) return;
    App.stopPlayers();
    el.innerHTML = '';
    App.tabs[tab](el);
  };

  /* every click is delegated: the nearest element with data-action names the handler */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    var name = el.getAttribute('data-action');
    if (App.actions[name]) { ev.preventDefault(); App.actions[name](el, ev); }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && App._modal) App.closeModal(); });
  document.querySelectorAll('.tab-btn').forEach(function (b) { b.addEventListener('click', function () { App.show(b.getAttribute('data-tab')); }); });

  /* ---------------------------------------------------------------- theme */
  App.applyTheme = function () {
    var mode = Storage_.getTheme();
    var dark = mode === 'dark' || (mode === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var btn = document.querySelector('.theme-btn');
    if (btn) btn.textContent = mode === 'auto' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b1020' : '#ffffff');
  };
  action('cycle-theme', function () {
    var order = ['light', 'dark', 'auto'], cur = Storage_.getTheme();
    Storage_.setTheme(order[(order.indexOf(cur) + 1) % order.length]);
    App.applyTheme();
  });
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', App.applyTheme);

  /* ---------------------------------------------------------------- onboarding wizard */
  var wiz = { step: 0, p: null };
  var STEPS = ['goal', 'level', 'schedule', 'gear', 'you', 'strength'];

  App.openOnboarding = function (existing) {
    var p = existing ? JSON.parse(JSON.stringify(existing)) : { goal: null, level: null, daysPerWeek: 4, location: 'gym', equipment: ['pullup_bar', 'dumbbells', 'bands', 'mat'], joints: [], sex: '', bodyKg: null, heightCm: null, birthYear: null, strength: {} };
    wiz.p = p; wiz.step = 0; wiz.units = App.units();
    renderWizard();
  };
  App.action('open-onboarding', function () { App.openOnboarding(App.profile()); });

  function renderWizard() {
    var p = wiz.p, s = STEPS[wiz.step], html = '';
    html += '<div class="wizard-steps">' + STEPS.map(function (_, i) { return '<span class="' + (i <= wiz.step ? 'on' : '') + '"></span>'; }).join('') + '</div>';
    if (s === 'goal') {
      html += '<p class="muted">What are we building? Each goal has its own playbook: how you eat, lift and do cardio.</p><div class="stack">';
      Object.keys(DATA.GOALS).forEach(function (g) {
        var G = DATA.GOALS[g], pb = DATA.PLAYBOOKS[g];
        html += '<button class="option goal-' + g + (p.goal === g ? ' on' : '') + '" data-action="wiz-goal" data-goal="' + g + '"><strong>' + G.label + '</strong><span>' + App.esc(G.tagline) + '</span><span class="small muted">' + App.esc(pb.who) + '</span></button>';
      });
      html += '</div>';
    } else if (s === 'level') {
      html += '<p class="muted">Be honest here. The level picks the progression style: beginners add weight every session, advanced lifters wave it.</p><div class="stack">';
      Object.keys(DATA.LEVELS).forEach(function (l) {
        var L = DATA.LEVELS[l];
        html += '<button class="option' + (p.level === l ? ' on' : '') + '" data-action="wiz-level" data-level="' + l + '"><strong>' + L.label + '</strong><span>' + App.esc(L.hint) + '</span></button>';
      });
      html += '</div>';
    } else if (s === 'schedule') {
      html += '<div class="field"><label>Sessions a week (lifting and cardio together)</label><div class="chips">' + [3, 4, 5, 6].map(function (n) { return '<button class="chip' + (p.daysPerWeek === n ? ' on' : '') + '" data-action="wiz-days" data-n="' + n + '">' + n + '</button>'; }).join('') + '</div><div class="help">Programs are matched to this. More is not better if you cannot recover.</div></div>';
      html += '<div class="field"><label>Where do you train?</label><div class="grid-2"><button class="option' + (p.location === 'gym' ? ' on' : '') + '" data-action="wiz-loc" data-loc="gym"><strong>Gym</strong><span>Barbells, machines, cables.</span></button><button class="option' + (p.location === 'home' ? ' on' : '') + '" data-action="wiz-loc" data-loc="home"><strong>Home</strong><span>Whatever you own. Pick it next.</span></button></div></div>';
    } else if (s === 'gear') {
      if (p.location === 'home') {
        html += '<div class="field"><label>What do you have at home?</label><div class="chips">' + DATA.HOME_EQUIPMENT.map(function (q) { return '<button class="chip' + (p.equipment.indexOf(q) >= 0 ? ' on' : '') + '" data-action="wiz-equip" data-q="' + q + '">' + App.esc(DATA.EQUIPMENT[q]) + '</button>'; }).join('') + '</div><div class="help">Your bodyweight, a wall, a chair and a towel are always assumed.</div></div>';
      } else {
        html += '<p class="muted">Gym picked, so every exercise is available.</p>';
      }
      html += '<div class="field"><label>Any joint to protect?</label><div class="chips">' + Object.keys(DATA.JOINTS).map(function (j) { return '<button class="chip' + (p.joints.indexOf(j) >= 0 ? ' on' : '') + '" data-action="wiz-joint" data-j="' + j + '">' + DATA.JOINTS[j] + '</button>'; }).join('') + '</div><div class="help">Exercises that load a flagged joint are swapped out where a good stand-in exists and marked in the library.</div></div>';
    } else if (s === 'you') {
      html += '<div class="field"><label>Units</label><div class="chips"><button class="chip' + (wiz.units === 'lb' ? ' on' : '') + '" data-action="wiz-units" data-u="lb">Pounds (lb)</button><button class="chip' + (wiz.units === 'kg' ? ' on' : '') + '" data-action="wiz-units" data-u="kg">Kilograms (kg)</button></div></div>';
      html += '<div class="field"><label>Sex (for benchmark WOD loads and body-fat ranges)</label><div class="chips"><button class="chip' + (p.sex === 'm' ? ' on' : '') + '" data-action="wiz-sex" data-s="m">Male</button><button class="chip' + (p.sex === 'f' ? ' on' : '') + '" data-action="wiz-sex" data-s="f">Female</button><button class="chip' + (p.sex === '' ? ' on' : '') + '" data-action="wiz-sex" data-s="">Prefer not to say</button></div></div>';
      html += '<div class="grid-3"><div class="field"><label>Body weight (' + wiz.units + ')</label><input type="number" inputmode="decimal" id="wiz-weight" value="' + (p.bodyKg ? Math.round(Engine.roundLoad(p.bodyKg, wiz.units)) : '') + '"></div><div class="field"><label>Height (cm)</label><input type="number" inputmode="numeric" id="wiz-height" value="' + (p.heightCm || '') + '"></div><div class="field"><label>Birth year</label><input type="number" inputmode="numeric" id="wiz-year" value="' + (p.birthYear || '') + '"></div></div><div class="help">Weight drives the calorie estimates and the first body-log entry. Birth year sets your heart-rate zones.</div>';
    } else if (s === 'strength') {
      html += '<p class="muted">Optional, but it makes the first weeks right: your best recent set on each lift (weight and reps). Leave blank and the plan starts light and climbs.</p>';
      ['squat', 'bench-press', 'deadlift', 'overhead-press'].forEach(function (id) {
        var s2 = p.strength[id] || {};
        html += '<div class="field"><label>' + App.exName(id) + '</label><div class="grid-2"><input type="number" inputmode="decimal" placeholder="' + wiz.units + '" data-lift="' + id + '" data-k="kg" value="' + (s2.kg ? Math.round(Engine.roundLoad(s2.kg, wiz.units) * 100) / 100 : '') + '"><input type="number" inputmode="numeric" placeholder="reps" data-lift="' + id + '" data-k="reps" value="' + (s2.reps || '') + '"></div></div>';
      });
    }
    html += '<div class="wizard-actions"><button class="btn ghost" data-action="wiz-back"' + (wiz.step === 0 ? ' disabled' : '') + '>Back</button><button class="btn primary" data-action="wiz-next">' + (wiz.step === STEPS.length - 1 ? 'Finish' : 'Next') + '</button></div>';
    var titles = { goal: 'Pick your goal', level: 'Your level', schedule: 'Your week', gear: 'Equipment and joints', you: 'About you', strength: 'Where your lifts are' };
    App.modal({ title: titles[s], html: html });
  }
  function readWizardInputs() {
    var p = wiz.p, s = STEPS[wiz.step];
    if (s === 'you') {
      var w = parseFloat(document.getElementById('wiz-weight').value); p.bodyKg = isNaN(w) ? null : Engine.toKg(w, wiz.units);
      var h = parseInt(document.getElementById('wiz-height').value, 10); p.heightCm = isNaN(h) ? null : h;
      var y = parseInt(document.getElementById('wiz-year').value, 10); p.birthYear = isNaN(y) ? null : y;
    } else if (s === 'strength') {
      document.querySelectorAll('[data-lift]').forEach(function (inp) {
        var id = inp.getAttribute('data-lift'), k = inp.getAttribute('data-k'), v = parseFloat(inp.value);
        p.strength[id] = p.strength[id] || {};
        p.strength[id][k] = isNaN(v) ? null : (k === 'kg' ? Engine.toKg(v, wiz.units) : v);
      });
      Object.keys(p.strength).forEach(function (id) { if (!p.strength[id].kg || !p.strength[id].reps) delete p.strength[id]; });
    }
  }
  action('wiz-goal', function (el) { wiz.p.goal = el.getAttribute('data-goal'); renderWizard(); });
  action('wiz-level', function (el) { wiz.p.level = el.getAttribute('data-level'); renderWizard(); });
  action('wiz-days', function (el) { wiz.p.daysPerWeek = parseInt(el.getAttribute('data-n'), 10); renderWizard(); });
  action('wiz-loc', function (el) { wiz.p.location = el.getAttribute('data-loc'); renderWizard(); });
  action('wiz-equip', function (el) { var q = el.getAttribute('data-q'), i = wiz.p.equipment.indexOf(q); if (i >= 0) wiz.p.equipment.splice(i, 1); else wiz.p.equipment.push(q); renderWizard(); });
  action('wiz-joint', function (el) { var j = el.getAttribute('data-j'), i = wiz.p.joints.indexOf(j); if (i >= 0) wiz.p.joints.splice(i, 1); else wiz.p.joints.push(j); renderWizard(); });
  action('wiz-units', function (el) { readWizardInputs(); wiz.units = el.getAttribute('data-u'); renderWizard(); });
  action('wiz-sex', function (el) { readWizardInputs(); wiz.p.sex = el.getAttribute('data-s'); renderWizard(); });
  action('wiz-back', function () { readWizardInputs(); if (wiz.step > 0) { wiz.step--; renderWizard(); } });
  action('wiz-next', function () {
    var s = STEPS[wiz.step], p = wiz.p;
    if (s === 'goal' && !p.goal) return App.toast('Pick a goal to continue.');
    if (s === 'level' && !p.level) return App.toast('Pick your level.');
    readWizardInputs();
    if (wiz.step < STEPS.length - 1) { wiz.step++; renderWizard(); return; }
    /* finish: save the profile, log the first body weight, offer programs */
    var hadPlan = !!App.data.plan;
    App.data.settings.units = wiz.units;
    App.data.profile = p;
    if (p.bodyKg && !App.data.bodyLog.length) App.data.bodyLog.push({ id: Storage_.newId(), at: Date.now(), kg: p.bodyKg, note: 'From setup' });
    App.save();
    App.closeModal();
    if (hadPlan) { App.toast('Profile updated.'); App.render(); } else App.openProgramPicker();
  });

  /* ---------------------------------------------------------------- program picker */
  App.openProgramPicker = function () {
    var p = App.profile();
    if (!p) return App.openOnboarding();
    var recs = Engine.recommendPrograms(p, DATA.PROGRAMS);
    var html = '<p class="muted">Ranked for your goal, level, schedule and setting. Tap one to read the week map, then start it.</p><div class="stack">';
    recs.slice(0, 6).forEach(function (r, i) {
      var pr = r.program;
      html += '<button class="option' + (i === 0 ? ' on' : '') + '" data-action="open-program" data-id="' + pr.id + '"><strong>' + App.esc(pr.name) + ' ' + App.goalChip(pr.goal) + '</strong><span>' + App.esc(pr.summary) + '</span><span class="small muted">' + r.reasons.join(' · ') + '</span></button>';
    });
    html += '</div><p class="small muted mt">All ' + DATA.PROGRAMS.length + ' programs are on the Plans tab.</p>';
    App.modal({ title: 'Recommended programs', html: html });
  };
  action('open-program-picker', function () { App.openProgramPicker(); });

  /* start (or switch to) a program: the plan is rebuilt from the profile, history is kept */
  App.startProgram = function (programId) {
    var program = DATA.programById[programId], p = App.profile();
    if (!program || !p) return;
    if (App.activeWorkout()) { App.toast('Finish or abandon the current workout first.'); return; }
    if (App.data.plan) {
      var old = App.data.plan;
      App.data.history.push({ programId: old.programId, startedAt: old.startedAt, endedAt: Date.now(), sessions: old.sessions || 0 });
    }
    App.data.plan = Engine.startPlan(program, p, DATA.exerciseById, App.units(), Date.now());
    App.save();
    App.closeModal();
    App.toast('Started ' + program.name + '.');
    App.show('today');
  };

  /* ---------------------------------------------------------------- free sessions */
  App.freePlan = function () {
    if (App.data.plan) return App.data.plan;
    if (!App.data.freePlan) App.data.freePlan = { programId: null, startedAt: Date.now(), dayIndex: 0, round: 0, sessions: 0, state: {}, tm: {}, ladders: {}, c25kWeek: 1, wodChoice: {} };
    return App.data.freePlan;
  };
  App.startFreeWorkout = function (name, blocks, kind) {
    if (App.activeWorkout()) { App.toast('A workout is already in progress.'); App.show('workout'); return; }
    var p = App.profile() || { location: 'gym', equipment: [], joints: [] };
    var fake = { id: 'free', perWeek: 1, days: [{ id: 'free', name: name, kind: kind || 'free', blocks: blocks }], deload: null };
    /* loads and ladder rungs from free sessions live on the plan when there is one, otherwise on a free plan */
    var plan = App.freePlan();
    var w = Engine.buildWorkout(Object.assign({}, plan, { dayIndex: 0 }), fake, p, DATA.exerciseById, App.units(), Date.now());
    w.programId = null; w.free = true;
    App.data.workouts.push(w);
    App.save();
    App.show('workout');
  };
  App.startNextSession = function () {
    var plan = App.plan(), program = App.program(), p = App.profile();
    if (!plan || !program) return App.openProgramPicker();
    if (App.activeWorkout()) return App.show('workout');
    var w = Engine.buildWorkout(plan, program, p, DATA.exerciseById, App.units(), Date.now());
    App.data.workouts.push(w);
    App.save();
    App.show('workout');
  };
  action('start-next', function () { App.startNextSession(); });
  action('resume-workout', function () { App.show('workout'); });
  action('skip-session', function () {
    var plan = App.plan(), program = App.program();
    if (!plan || !program) return;
    App.confirm('Skip ' + program.days[plan.dayIndex % program.days.length].name + ' and move to the next session?').then(function (ok) {
      if (!ok) return;
      plan.dayIndex = (plan.dayIndex + 1) % program.days.length;
      if (plan.dayIndex === 0) plan.round = (plan.round || 0) + 1;
      App.save(); App.render();
    });
  });
  action('go-tab', function (el) { App.show(el.getAttribute('data-tab')); });

  /* ---------------------------------------------------------------- Today tab */
  App.register('today', function (el) {
    var p = App.profile(), plan = App.plan(), program = App.program(), active = App.activeWorkout();
    if (!p) {
      el.appendChild(App.h('<div class="card hero"><h2>Welcome to Build Me Up Mark</h2><p class="muted">Pick Lean, Cut or Buffed and get a real program: evidence-based sets, reps and cardio, with a faceless animation for every exercise so you always know what to do.</p><button class="btn primary lg" data-action="open-onboarding">Set up my plan</button></div>'));
      el.appendChild(App.h('<div class="card"><h3>Or just train</h3><p class="muted small">Browse the library, run a benchmark WOD or a cardio protocol without a plan.</p><div class="row"><button class="btn sm" data-action="go-tab" data-tab="library">Library</button><button class="btn sm" data-action="go-tab" data-tab="plans">WODs and protocols</button></div></div>'));
      return;
    }
    if (active) {
      el.appendChild(App.h('<div class="card hero"><span class="badge">In progress</span><h2>' + App.esc(active.dayName) + '</h2><p class="muted">Started ' + App.fmtDateTime(active.startedAt) + '</p><button class="btn primary lg block" data-action="resume-workout">Resume workout</button></div>'));
    } else if (!plan || !program) {
      el.appendChild(App.h('<div class="card hero"><h2>Choose your program</h2><p class="muted">Profile saved: ' + DATA.GOALS[p.goal].label + ', ' + DATA.LEVELS[p.level].label.toLowerCase() + ', ' + p.daysPerWeek + ' days, ' + p.location + '.</p><button class="btn primary lg" data-action="open-program-picker">See recommendations</button></div>'));
    } else {
      var cd = Engine.currentDay(plan, program), day = cd.day, week = Engine.calendarWeek(plan, Date.now()), deload = Engine.isDeloadWeek(plan, program, Date.now());
      var preview = day.blocks.filter(function (b) { return b.kind === 'strength' || b.kind === 'ladder' || b.kind === 'cardio' || b.kind === 'wod' || b.kind === 'circuit'; }).slice(0, 6).map(function (b) {
        var exId = b.ex || (b.slot ? Engine.resolveSlot(b.slot, p, DATA.exerciseById) : null);
        if (b.kind === 'ladder') { var ls = plan.ladders[b.ladder]; var L = DATA.LADDERS[b.ladder]; exId = L.rungs[Math.min(ls ? ls.rung : 0, L.rungs.length - 1)].ex; }
        if (b.kind === 'cardio') return '<div class="preview-item"><span class="chip">Cardio</span> ' + App.esc(DATA.CARDIO[b.protocol].name) + (b.minutes ? ' · ' + b.minutes + ' min' : '') + '</div>';
        if (b.kind === 'wod') return '<div class="preview-item"><span class="chip">WOD</span> ' + (b.wod.indexOf('pick:') === 0 ? 'Your pick from the benchmark list' : App.esc(DATA.wodById[b.wod].name)) + '</div>';
        if (b.kind === 'circuit') return '<div class="preview-item"><span class="chip">' + b.format.toUpperCase() + '</span> ' + b.items.map(function (it) { return App.exName(it.ex); }).join(', ') + '</div>';
        return '<div class="preview-item">' + App.thumb(exId) + '<span>' + App.esc(App.exName(exId)) + (b.scheme && b.scheme.type === 'sets' ? ' <span class="muted small">' + b.scheme.sets + 'x' + b.scheme.reps + '</span>' : '') + '</span></div>';
      }).join('');
      el.appendChild(App.h('<div class="card hero"><div class="row between"><span class="badge">Week ' + week + (deload ? ' · deload' : '') + ' · ' + App.esc(program.name) + '</span><span class="badge">' + App.esc(day.kind) + ' · ~' + (day.est || 45) + ' min</span></div><h2 class="mt">Next: ' + App.esc(day.name) + '</h2><div class="preview-list">' + preview + '</div><div class="row mt"><button class="btn primary lg" data-action="start-next">Start workout</button><button class="btn ghost sm" data-action="skip-session" style="color:#fff">Skip</button></div></div>'));
    }

    /* the week ring, streak and totals */
    var ws = Engine.weekSummary(App.data.workouts, program, Date.now(), App.data.settings.weekStartsOn);
    var pct = ws.planned ? Math.min(1, ws.thisWeek / ws.planned) : 0, C = 2 * Math.PI * 34;
    var done = App.data.workouts.filter(function (w) { return w.status === 'done'; });
    el.appendChild(App.h('<div class="card"><div class="row between"><div class="stats-row" style="flex:1"><div class="stat"><span class="v">' + ws.thisWeek + '<span class="muted small">/' + ws.planned + '</span></span><span class="l">This week</span></div><div class="stat"><span class="v">' + ws.streakWeeks + '</span><span class="l">Week streak</span></div><div class="stat"><span class="v">' + done.length + '</span><span class="l">Sessions</span></div></div><svg class="ring" viewBox="0 0 84 84" style="color:var(--accent)"><circle class="track" cx="42" cy="42" r="34" style="stroke:var(--bg-3)"/><circle class="bar" cx="42" cy="42" r="34" style="stroke:var(--accent)" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '"/><text x="42" y="48" style="fill:var(--ink)">' + Math.round(pct * 100) + '%</text></svg></div></div>'));

    /* recent PRs */
    var prs = [];
    Object.keys(App.data.prs).forEach(function (k) {
      var r = App.data.prs[k];
      if (r.e1rm) prs.push({ k: k, at: r.e1rm.at, text: App.exName(k) + ': ' + App.fmtKg(r.e1rm.kg) + ' x ' + r.e1rm.reps + ' (est. 1RM ' + App.fmtKg(r.e1rm.value) + ')' });
      else if (r.reps) prs.push({ k: k, at: r.reps.at, text: App.exName(k) + ': ' + r.reps.reps + ' reps' });
      if (r.score && k.indexOf('wod:') === 0) { var wod = DATA.wodById[k.slice(4)]; if (wod) prs.push({ k: k, at: r.score.at, text: wod.name + ': ' + Engine.wodScore(wod, r.score) }); }
    });
    prs.sort(function (a, b) { return b.at - a.at; });
    if (prs.length) el.appendChild(App.h('<div class="card"><div class="card-head"><h3>Recent records</h3><button class="btn sm ghost" data-action="go-tab" data-tab="progress">All progress</button></div><ul class="list tight">' + prs.slice(0, 5).map(function (x) { return '<li class="pr-item"><span>' + App.esc(x.text) + '</span><span class="muted small">' + App.fmtDate(x.at) + '</span></li>'; }).join('') + '</ul></div>'));

    /* quick actions */
    el.appendChild(App.h('<div class="card"><h3>Quick actions</h3><div class="row mt"><button class="btn sm" data-action="log-body">Log body weight</button><button class="btn sm" data-action="pick-wod" data-pick="all">Do a WOD</button><button class="btn sm" data-action="pick-cardio">Cardio session</button><button class="btn sm" data-action="go-tab" data-tab="library">Library</button></div></div>'));

    /* the playbook headline for the goal */
    var pb = DATA.PLAYBOOKS[p.goal];
    el.appendChild(App.h('<div class="card flat"><div class="card-head"><h3>' + App.esc(pb.title) + '</h3><button class="btn sm ghost" data-action="go-tab" data-tab="coach">Coach</button></div><p class="small muted">' + App.esc(pb.lifting) + '</p><p class="small muted">' + App.esc(pb.cardio) + '</p></div>'));
  });

  /* ---------------------------------------------------------------- boot */
  App.boot = function () {
    App.data = Storage_.load();
    App.applyTheme();
    App.show('today');
    if (!App.data.profile) setTimeout(function () { App.openOnboarding(); }, 300);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  };
  document.addEventListener('DOMContentLoaded', App.boot);
})();
