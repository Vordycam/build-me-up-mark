/* Exercise library assembly. Loads after js/data/exercises-1.js .. exercises-4.js.
   Flattens the groups into DATA.exercises, fills in defaults for omitted fields,
   and builds DATA.exerciseById for O(1) lookup. Nothing here is hand-edited:
   add or change an exercise in the exercises-N.js file that owns its category. */
window.DATA = window.DATA || {};
(function () {
  'use strict';
  var defaults = { alias: [], secondary: [], uni: false, bw: false, slot: null, steps: [], cues: [], mistakes: [],
    easier: null, harder: null, stress: [], tags: [] };
  var list = [];
  (DATA.exerciseGroups || []).forEach(function (group) {
    group.forEach(function (raw) {
      var ex = {};
      Object.keys(defaults).forEach(function (k) { ex[k] = Array.isArray(defaults[k]) ? defaults[k].slice() : defaults[k]; });
      Object.keys(raw).forEach(function (k) { ex[k] = raw[k]; });
      /* media comes from the generated lookup, so a record never has to repeat it */
      var m = (DATA.media || {})[ex.id] || {};
      ex.anim = m.anim || null;
      ex.repdb = m.repdb || null;
      ex.repdbMain = !!m.repdbMain;
      list.push(ex);
    });
  });
  DATA.exercises = list;
  DATA.exerciseById = {};
  list.forEach(function (ex) { DATA.exerciseById[ex.id] = ex; });
})();
