/* Cardio protocols. Each one expands to a list of timed segments the interval timer can run:
     { label, seconds, zone: 'warmup'|'easy'|'hard'|'rest'|'cooldown' }
   'steady' protocols take a minutes argument from the program block; 'c25k' takes the user's current week.
   Zones (% of max heart rate, HRmax about 220 minus age): Z1 50-60, Z2 60-70, Z3 70-80, Z4 80-90, Z5 90-100.
   Talk test: Zone 2 is full sentences, Zone 4 is a few words, Zone 5 is no words. */
window.DATA = window.DATA || {};
(function () {
'use strict';

function seg(label, seconds, zone) { return { label: label, seconds: seconds, zone: zone }; }
function repeat(n, fn) { var out = []; for (var i = 0; i < n; i++) out = out.concat(fn(i + 1)); return out; }

DATA.CARDIO = {
  zone2: { id: 'zone2', name: 'Zone 2 steady', kind: 'steady', defaultMinutes: 35, zone: 'Z2 (60-70% HRmax)',
    help: 'Conversational pace on anything: walk, jog, bike, row, swim. The base every other session is built on. Research on elite endurance athletes shows most of their training sits here.',
    build: function (minutes) { return [seg('Easy warm-up', 180, 'warmup'), seg('Zone 2: full sentences', Math.max(60, minutes * 60 - 360), 'easy'), seg('Cool down', 180, 'cooldown')]; } },
  'long-easy': { id: 'long-easy', name: 'Long easy session', kind: 'steady', defaultMinutes: 60, zone: 'Z2',
    help: 'The long one. Same effort as Zone 2, just longer, to build the aerobic base. Grow it by about 10% a week.',
    build: function (minutes) { return [seg('Easy warm-up', 300, 'warmup'), seg('Long and easy', Math.max(60, minutes * 60 - 600), 'easy'), seg('Cool down', 300, 'cooldown')]; } },
  'norwegian-4x4': { id: 'norwegian-4x4', name: 'Norwegian 4x4', kind: 'intervals', defaultMinutes: 38, zone: 'Z4-Z5 work, Z2 recovery',
    help: '4 x 4 minutes at 90-95% HRmax with 3 minutes of easy recovery. Helgerud 2007 found it raised VO2max about 7% in 8 weeks, three times a week. Run, row or bike.',
    build: function () { return [seg('Warm-up', 600, 'warmup')].concat(repeat(4, function (i) { return [seg('Interval ' + i + ' of 4: hard', 240, 'hard'), seg('Easy recovery', 180, 'rest')]; })).concat([seg('Cool down', 300, 'cooldown')]); } },
  tabata: { id: 'tabata', name: 'Tabata (any movement)', kind: 'intervals', defaultMinutes: 14, zone: 'Z5 all-out',
    help: 'The original 1996 protocol: 8 x 20 s all-out with 10 s rest, four minutes. Tabata ran it on a bike at 170% of VO2max; use a bike, rower, rope or burpees and go truly hard.',
    build: function () { return [seg('Warm-up', 300, 'warmup')].concat(repeat(8, function (i) { return [seg('Round ' + i + ' of 8: all out', 20, 'hard'), seg('Rest', 10, 'rest')]; })).concat([seg('Cool down', 240, 'cooldown')]); } },
  'tabata-bike': { id: 'tabata-bike', name: 'Tabata on the bike', kind: 'intervals', defaultMinutes: 14, zone: 'Z5 all-out', ex: 'assault-bike',
    help: 'Tabata on an air bike or spin bike: 8 x 20 s all-out, 10 s rest. Two rounds of the protocol with 2 minutes between if you are a monster.',
    build: function () { return [seg('Warm-up spin', 300, 'warmup')].concat(repeat(8, function (i) { return [seg('Round ' + i + ' of 8: all out', 20, 'hard'), seg('Rest', 10, 'rest')]; })).concat([seg('Cool down spin', 240, 'cooldown')]); } },
  'tabata-rope': { id: 'tabata-rope', name: 'Jump-rope Tabata', kind: 'intervals', defaultMinutes: 14, zone: 'Z5', ex: 'jump-rope',
    help: 'Two Tabata blocks on the rope with two minutes between. Single-unders fast, double-unders if you have them.',
    build: function () { var block = function (b) { return repeat(8, function (i) { return [seg('Block ' + b + ' round ' + i + ': rope', 20, 'hard'), seg('Rest', 10, 'rest')]; }); }; return [seg('Warm-up: easy rope', 180, 'warmup')].concat(block(1)).concat([seg('Rest between blocks', 120, 'rest')]).concat(block(2)).concat([seg('Cool down', 120, 'cooldown')]); } },
  gibala: { id: 'gibala', name: 'Gibala 10 x 60/60', kind: 'intervals', defaultMinutes: 28, zone: 'Z4-Z5 work, easy recovery',
    help: 'Martin Gibala\'s practical HIIT: 10 x 60 seconds at about 90% HRmax with 60 seconds easy. Same fitness gains as much longer steady sessions.',
    build: function () { return [seg('Warm-up', 300, 'warmup')].concat(repeat(10, function (i) { return [seg('Interval ' + i + ' of 10: hard', 60, 'hard'), seg('Easy', 60, 'rest')]; })).concat([seg('Cool down', 180, 'cooldown')]); } },
  'billat-30-30': { id: 'billat-30-30', name: 'Billat 30/30', kind: 'intervals', defaultMinutes: 28, zone: 'Z5 work, Z2 float', ex: 'running',
    help: 'Veronique Billat\'s 30 s at your fastest sustainable 6-minute pace, 30 s easy jog, 15 rounds. Builds VO2max with less strain than longer repeats.',
    build: function () { return [seg('Warm-up jog', 600, 'warmup')].concat(repeat(15, function (i) { return [seg('30 s fast (' + i + ' of 15)', 30, 'hard'), seg('30 s easy', 30, 'rest')]; })).concat([seg('Cool down jog', 300, 'cooldown')]); } },
  'run-400s': { id: 'run-400s', name: '400 m repeats', kind: 'intervals', defaultMinutes: 35, zone: 'Z5 at 5K pace', ex: 'running',
    help: '6 x 400 m at 5K race pace with 90 s jog recovery. Build to 10-12 repeats over a block. About 90-120 s per 400 m for most people; the timer runs 100 s work by default.',
    build: function () { return [seg('Warm-up jog', 600, 'warmup')].concat(repeat(6, function (i) { return [seg('400 m repeat ' + i + ' of 6', 100, 'hard'), seg('Jog recovery', 90, 'rest')]; })).concat([seg('Cool down jog', 300, 'cooldown')]); } },
  'row-500s': { id: 'row-500s', name: 'Rowing 4 x 500 m', kind: 'intervals', defaultMinutes: 25, zone: 'Z4-Z5', ex: 'rowing',
    help: 'Concept2\'s classic: 4 x 500 m hard with 2 minutes easy between. Add a repeat every week or two up to 8. About 2 minutes per 500 m; the timer runs 120 s.',
    build: function () { return [seg('Warm-up row', 300, 'warmup')].concat(repeat(4, function (i) { return [seg('500 m hard (' + i + ' of 4)', 120, 'hard'), seg('Easy paddle', 120, 'rest')]; })).concat([seg('Cool down row', 180, 'cooldown')]); } },
  'jump-rope-intervals': { id: 'jump-rope-intervals', name: 'Jump-rope intervals', kind: 'intervals', defaultMinutes: 20, zone: 'Z3-Z4', ex: 'jump-rope',
    help: 'Ten rounds of 45 s rope, 15 s rest. Beginners start at 30/30. A cheap, portable conditioning session.',
    build: function () { return [seg('Warm-up: easy rope', 180, 'warmup')].concat(repeat(10, function (i) { return [seg('Rope ' + i + ' of 10', 45, 'hard'), seg('Rest', 15, 'rest')]; })).concat([seg('Cool down', 120, 'cooldown')]); } },
  c25k: { id: 'c25k', name: 'Couch to 5K', kind: 'c25k', defaultMinutes: 30, zone: 'Z2-Z3', ex: 'running',
    help: 'The NHS nine-week plan: three runs a week, each with a 5-minute brisk-walk warm-up and cool-down. Repeat any week you find hard. By week 9 you run 30 minutes without stopping.',
    weeks: [
      [{ run: 60, walk: 90, times: 8 }],
      [{ run: 90, walk: 120, times: 6 }],
      [{ run: 90, walk: 90, times: 1 }, { run: 180, walk: 180, times: 1 }, { run: 90, walk: 90, times: 1 }, { run: 180, walk: 180, times: 1 }],
      [{ run: 180, walk: 90, times: 1 }, { run: 300, walk: 150, times: 1 }, { run: 180, walk: 90, times: 1 }, { run: 300, walk: 0, times: 1 }],
      [{ run: 300, walk: 180, times: 2 }, { run: 300, walk: 0, times: 1 }],
      [{ run: 300, walk: 180, times: 1 }, { run: 480, walk: 180, times: 1 }, { run: 300, walk: 0, times: 1 }],
      [{ run: 1500, walk: 0, times: 1 }],
      [{ run: 1680, walk: 0, times: 1 }],
      [{ run: 1800, walk: 0, times: 1 }]
    ],
    build: function (minutes, week) {
      var w = Math.min(Math.max(1, week || 1), 9);
      var out = [seg('Brisk walk warm-up', 300, 'warmup')];
      DATA.CARDIO.c25k.weeks[w - 1].forEach(function (p) {
        for (var i = 0; i < p.times; i++) { out.push(seg('Run', p.run, 'hard')); if (p.walk) out.push(seg('Walk', p.walk, 'easy')); }
      });
      out.push(seg('Brisk walk cool-down', 300, 'cooldown'));
      return out;
    } }
};

DATA.HR_ZONES = [
  { id: 'Z1', label: 'Zone 1', pct: [50, 60], feel: 'Very easy, recovery.' },
  { id: 'Z2', label: 'Zone 2', pct: [60, 70], feel: 'Easy. Full sentences. Where most cardio minutes belong.' },
  { id: 'Z3', label: 'Zone 3', pct: [70, 80], feel: 'Moderate. Short sentences.' },
  { id: 'Z4', label: 'Zone 4', pct: [80, 90], feel: 'Hard. A few words.' },
  { id: 'Z5', label: 'Zone 5', pct: [90, 100], feel: 'All out. No words.' }
];
})();
