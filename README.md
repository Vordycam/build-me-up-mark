# Build Me Up Mark (TriForm)

A coach-grade fitness app that runs anywhere: pick **Lean**, **Cut** or **Buffed**, answer six questions, and get a real program with a faceless animation for every exercise, benchmark CrossFit WODs, home bodyweight ladders and cardio protocols. Plain HTML, CSS and JavaScript, installable as a PWA, works fully offline, all data on your device.

Live: https://vordycam.github.io/build-me-up-mark/

## What it does

- **Three goals, three playbooks.** Each goal carries evidence-based rules for energy, protein, lifting volume, cardio minutes, progression and deloads (docs/SCIENCE.md has the sources).
- **16 programs.** Arnold's Golden Six, 5x5 linear, GZCLP with its staged progression, PHUL, 5/3/1 Boring But Big, 6-day push/pull/legs, Dorian Yates' Blood and Guts, Frank Zane's pyramid split, a Shred protocol, Lean Foundations, Engine Builder, Hybrid Athlete, and a home version of every goal.
- **Guided workouts.** One exercise at a time with the animation, steps, cues and mistakes; prefilled targets; a done button per set; an automatic rest timer; swap to an alternative that fits your equipment and joints; full-screen clocks for AMRAP, EMOM, for-time, Tabata, death-by and interval sessions.
- **Progression done for you.** Linear, double, pyramid, GZCLP tiers (5x3+ to 6x2+ to 10x1+ and the resets), 5/3/1 waves with training-max bumps, and the bodyweight ladders that move you up a rung at 3x8.
- **30 benchmark WODs.** 20 Girls, 6 Heroes and house formats with the crossfit.com Rx loads in your units, scaling, and your best scores.
- **Cardio protocols.** Zone 2, Norwegian 4x4, Tabata, Gibala, Billat 30/30, 400 m repeats, Concept2 500s, jump rope, long easy sessions and the nine-week Couch to 5K.
- **Progress.** Body log and trend, estimated 1RM trends, weekly hard sets per muscle against your goal's target band, cardio minutes, a 12-week heat map, full history.
- **Coach.** The playbooks, the studies behind them, and the champions each program is built on, with verified titles and sourced quotes.
- **209 exercises**, each with our own coaching text, muscles, equipment, level, joint-stress flags, easier and harder variations, and a MET value for calorie estimates.

## Project layout

```
index.html              app shell and tab bar
styles.css              all styles (tokens, light and dark themes, components)
sw.js                   service worker: shell precache + media cache
manifest.webmanifest    PWA manifest
js/data/                static content: taxonomy, exercises (4 files), media map (generated), programs, wods, ladders, cardio, champions
js/storage.js           localStorage persistence, backup and restore
js/media.js             the faceless animation player (SVG frames) and RepDB illustration hotlinks
js/engine.js            every rule: units, e1RM, slot resolution, plans, workout builder, progression, PRs, analysis, timers
js/app.js               core: state, modals, onboarding wizard, Today tab, boot
js/app-workout.js       guided workout, rest bar, timer overlay, WOD and cardio picking, finish
js/app-library.js       exercise library and detail view
js/app-plans.js         programs, WODs, ladders, cardio protocols
js/app-progress.js      body log, charts, history
js/app-coach.js         playbooks and champions
js/app-settings.js      settings, offline download, backup, credits
assets/anim/<id>/       three SVG frames per exercise (Workout Guide, CC BY-SA 4.0)
tools/build-media.py    copies and shrinks the frames, validates RepDB ids, writes js/data/media.js
test/engine.test.js     Node tests for the data and the engine
docs/                   the research this app was built from
```

## Development

No build step. Open `index.html` through any static server (the service worker needs http), or just push to `main`: GitHub Pages serves the root.

```
node --test test/engine.test.js
```

To regenerate the media layer (needs a clone of Workout Guide and RepDB's `exercises.json`):

```
python -I tools/build-media.py --wg <workout-guide/packages/workout-guide> --repdb <exercises.json>
```

Bump `CACHE` in `sw.js` whenever the shell changes, or installed apps keep serving the old files.

## Credits and licences

- Code: MIT (see LICENSE).
- Exercise animations: [Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim, building on [Everkinetic](https://github.com/everkinetic/data), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Changes: recoloured to `currentColor` and coordinates rounded (assets/anim/ATTRIBUTION.md).
- Exercise data by [RepDB (repdb.co)](https://repdb.co): flat illustrations are shown from RepDB's own repository under its free-tier licence and are not stored here.
- Benchmark workout standards from crossfit.com. Ladders after the r/bodyweightfitness Recommended Routine. Couch to 5K after the NHS plan.

Not medical advice. Check with a doctor before starting a program.
