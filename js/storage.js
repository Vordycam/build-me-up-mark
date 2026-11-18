/* Storage: everything the user creates lives in one localStorage key, plus JSON backup and restore.
   Shape (version 1):
     settings  { units: 'lb'|'kg', weekStartsOn: 0..6 (1 = Monday), sound: true, keepAwake: true }
     profile   null | { goal, level, daysPerWeek, location: 'gym'|'home', equipment: [], joints: [], sex: 'm'|'f'|'',
                        bodyKg, heightCm, birthYear, strength: { 'squat': {kg, reps}, ... } }
     plan      null | { programId, startedAt, dayIndex, round, state: {exId: {...}}, tm: {exId: kg}, ladders: {ladderId: {rung, reps, seconds, kg}},
                        c25kWeek, wodChoice: {dayId: wodId} }   - see Engine.startPlan
     workouts  [ workout ]  - see Engine.buildWorkout; status 'done' or 'abandoned' once finished
     prs       { exId: { e1rm: {kg, reps, value, at, workoutId}, reps: {reps, at}, time: {seconds, at}, score: {rounds, reps, at} } }
     bodyLog   [ { id, at, kg, bodyFat, waistCm, chestCm, hipsCm, armCm, thighCm, note } ]
     history   [ { programId, startedAt, endedAt, sessions } ]  - previous plans
   The theme is stored separately under THEME_KEY so index.html can read it before the app loads. */
(function () {
  'use strict';

  var KEY = 'bmum-data-v1';
  var THEME_KEY = 'bmum-theme';

  function defaultData() {
    return {
      version: 1,
      settings: { units: 'lb', weekStartsOn: 1, sound: true, keepAwake: true },
      profile: null,
      plan: null,
      freePlan: null,   /* loads and ladder rungs from free sessions when no program is running */
      workouts: [],
      prs: {},
      bodyLog: [],
      history: []
    };
  }

  function valid(data) {
    return data && typeof data === 'object' && Array.isArray(data.workouts) && Array.isArray(data.bodyLog) && data.settings;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      var data = JSON.parse(raw);
      if (!valid(data)) return defaultData();
      /* fill in anything a future version adds, so old backups keep working */
      var d = defaultData();
      Object.keys(d).forEach(function (k) { if (data[k] === undefined) data[k] = d[k]; });
      Object.keys(d.settings).forEach(function (k) { if (data.settings[k] === undefined) data.settings[k] = d.settings[k]; });
      return data;
    } catch (e) {
      console.error('Failed to load data:', e);
      return defaultData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Failed to save data:', e);
      return false;
    }
  }

  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; } }
  function setTheme(mode) { try { localStorage.setItem(THEME_KEY, mode); } catch (e) {} }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function exportJson(data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'build-me-up-mark-backup-' + stamp() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function importJson(file, onDone) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!valid(data)) { onDone(null, 'That file does not look like a Build Me Up Mark backup.'); return; }
        onDone(data, null);
      } catch (e) {
        onDone(null, 'Could not read that file as JSON.');
      }
    };
    reader.onerror = function () { onDone(null, 'Could not read the file.'); };
    reader.readAsText(file);
  }

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  window.Storage_ = {
    KEY: KEY,
    defaultData: defaultData,
    load: load,
    save: save,
    getTheme: getTheme,
    setTheme: setTheme,
    exportJson: exportJson,
    importJson: importJson,
    newId: newId
  };
})();
