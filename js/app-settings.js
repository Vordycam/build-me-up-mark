/* Settings tab.
   Features:
     - units (lb / kg), week start day, sounds, keep the screen awake during a workout
     - appearance (same cycle as the header button)
     - edit the profile (reopens the onboarding wizard with the current answers)
     - download every animation for offline use (warms the service worker's media cache)
     - backup to a JSON file and restore from one
     - credits and licences, the research docs, and a full reset */
(function () {
  'use strict';
  var A = window.App;

  A.register('settings', function (el) {
    var s = A.data.settings, p = A.profile();
    el.appendChild(A.h('<div class="card"><h3>Units and week</h3><div class="field"><label>Loads</label><div class="chips"><button class="chip' + (s.units === 'lb' ? ' on' : '') + '" data-action="set-units" data-u="lb">Pounds</button><button class="chip' + (s.units === 'kg' ? ' on' : '') + '" data-action="set-units" data-u="kg">Kilograms</button></div><div class="help">Everything is stored in kilograms and shown in your choice, so switching is safe.</div></div><div class="field"><label>Week starts on</label><div class="chips"><button class="chip' + (s.weekStartsOn === 1 ? ' on' : '') + '" data-action="set-weekstart" data-d="1">Monday</button><button class="chip' + (s.weekStartsOn === 0 ? ' on' : '') + '" data-action="set-weekstart" data-d="0">Sunday</button></div></div></div>'));
    el.appendChild(A.h('<div class="card"><h3>Training</h3><div class="field"><label><input type="checkbox" data-action="toggle-sound"' + (s.sound ? ' checked' : '') + '> Beeps on timers and rest</label></div><div class="field"><label><input type="checkbox" data-action="toggle-awake"' + (s.keepAwake ? ' checked' : '') + '> Keep the screen awake during a workout</label></div><div class="field"><label>Appearance</label><div class="chips">' + ['light', 'dark', 'auto'].map(function (m) { return '<button class="chip' + (Storage_.getTheme() === m ? ' on' : '') + '" data-action="set-theme" data-m="' + m + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</button>'; }).join('') + '</div></div></div>'));
    el.appendChild(A.h('<div class="card"><h3>Profile</h3>' + (p ? '<p class="small muted">' + DATA.GOALS[p.goal].label + ' · ' + DATA.LEVELS[p.level].label + ' · ' + p.daysPerWeek + ' days · ' + p.location + (p.joints.length ? ' · protecting ' + p.joints.map(function (j) { return DATA.JOINTS[j].toLowerCase(); }).join(', ') : '') + '</p>' : '<p class="small muted">No profile yet.</p>') + '<button class="btn sm" data-action="open-onboarding">' + (p ? 'Edit profile' : 'Set up') + '</button></div>'));
    el.appendChild(A.h('<div class="card"><h3>Offline</h3><p class="small muted">The app shell is already cached. Animations are cached as you view them; download them all once to have every exercise offline.</p><button class="btn sm" data-action="download-anims" id="dl-btn">Download all animations</button><div class="progress-bar mt hidden" id="dl-bar"><span style="width:0"></span></div></div>'));
    el.appendChild(A.h('<div class="card"><h3>Backup</h3><p class="small muted">Everything lives on this device. Export a backup now and then, and before switching phones.</p><div class="row"><button class="btn sm" data-action="export-backup">Export backup</button><label class="btn sm">Restore<input type="file" accept="application/json,.json" id="restore-file" class="sr-only"></label></div></div>'));
    el.appendChild(A.h('<div class="card flat"><h3>Credits and licences</h3><p class="small">Exercise animations by <a href="https://github.com/bryllim/workout-guide" rel="nofollow" target="_blank">Workout Guide</a> (Bryl Lim, building on <a href="https://github.com/everkinetic/data" rel="nofollow" target="_blank">Everkinetic</a>), <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="nofollow" target="_blank">CC BY-SA 4.0</a>; the frames were recoloured to follow the theme and rounded to reduce size.</p><p class="small">Exercise data by <a href="https://repdb.co" rel="nofollow" target="_blank">RepDB (repdb.co)</a>: the flat illustrations are shown from RepDB\'s repository under its free-tier licence.</p><p class="small">Benchmark workout standards from crossfit.com. Bodyweight ladders after the r/bodyweightfitness Recommended Routine. Couch to 5K after the NHS plan. Training science: see docs/SCIENCE.md in the repository.</p><p class="small muted">Not medical advice. Check with a doctor before starting a program, and stop anything that hurts.</p></div>'));
    el.appendChild(A.h('<div class="card flat"><h3>Danger zone</h3><button class="btn danger sm" data-action="reset-all">Erase everything on this device</button></div>'));
    var f = document.getElementById('restore-file');
    if (f) f.addEventListener('change', function () {
      var file = f.files && f.files[0]; if (!file) return;
      Storage_.importJson(file, function (data, err) {
        if (err) return A.toast(err);
        A.confirm('Replace everything on this device with the backup from ' + file.name + '?').then(function (ok) { if (!ok) return; A.data = data; A.save(); A.toast('Restored.'); A.show('today'); });
      });
    });
  });
  A.action('set-units', function (el) { A.data.settings.units = el.getAttribute('data-u'); A.save(); A.render('settings'); });
  A.action('set-weekstart', function (el) { A.data.settings.weekStartsOn = +el.getAttribute('data-d'); A.save(); A.render('settings'); });
  A.action('toggle-sound', function (el) { A.data.settings.sound = el.checked; A.save(); });
  A.action('toggle-awake', function (el) { A.data.settings.keepAwake = el.checked; A.save(); });
  A.action('set-theme', function (el) { Storage_.setTheme(el.getAttribute('data-m')); A.applyTheme(); A.render('settings'); });
  A.action('export-backup', function () { Storage_.exportJson(A.data); });
  A.action('download-anims', function (el) {
    el.disabled = true; var bar = document.getElementById('dl-bar'); bar.classList.remove('hidden');
    Media.prefetchAll(DATA.exercises, function (done, total) { bar.querySelector('span').style.width = (100 * done / total) + '%'; el.textContent = 'Downloading ' + done + ' of ' + total; })
      .then(function (failed) { el.textContent = failed ? 'Done, ' + failed + ' failed' : 'All animations are offline'; });
  });
  A.action('reset-all', function () {
    A.confirm('Erase your profile, plan, history and records on this device? Export a backup first if you want to keep them.').then(function (ok) {
      if (!ok) return;
      A.data = Storage_.defaultData(); A.save(); A.toast('Erased.'); A.show('today'); setTimeout(function () { A.openOnboarding(); }, 300);
    });
  });
})();
