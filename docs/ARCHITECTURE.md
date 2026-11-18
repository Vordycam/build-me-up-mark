# Fitness app - architecture, data schema and workflow (draft, pre-go)

## 1. Delivery model (mirrors ThursDink)

- Plain HTML + CSS + vanilla JS, no build step, no framework, no backend.
- Installable PWA: `manifest.webmanifest`, `sw.js` (stale-while-revalidate app shell, versioned cache name), works offline.
- Hosted by GitHub Pages from `main` of a new repo under Vordycam, so the live URL is `https://vordycam.github.io/<repo>/`.
- All user data lives in `localStorage` under one versioned key, with JSON export / import for backup (same shape as ThursDink's `Storage_`).
- Light / dark appearance chosen before first paint (same `data-theme` trick as ThursDink).
- Tests: Node's built-in runner (`node --test`), the engine loaded into the test realm with seeded `Math.random` and a hand-moved `Date.now`, plus a jsdom click-through smoke and headless-Chrome screenshots before every push.

## 2. Exercise visuals - decision

Source: **RepDB free exercise dataset** (github.com/RepDB/exercise-dataset, release tag `free-708-2026-11`).

- 708 exercises, each with 1-2 flat 512x512 WebP illustrations ("start" and "peak" pose, or a single "main" pose for holds). The figures are drawn **without facial features** - genuinely faceless, clean, consistent style, light background.
- Rich metadata per exercise: category, force type, mechanic, difficulty, equipment, body part, primary / secondary muscles, goals, tags (push_day, knee_safe, ...), unilateral / bodyweight flags, step-by-step instructions, coaching tips, MET value (for calorie estimates).
- License (LICENSE-DATA.md v1.0): free for personal and commercial use **inside applications and websites**; a visible "Exercise data by RepDB (repdb.co)" credit is required; no republishing as a dataset; images may be resized / cropped / recolored; no generative-AI derivation.
- How we comply: the app **hotlinks** images from the jsDelivr CDN mirror of RepDB's own repo pinned to the release tag (`https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@free-708-2026-11/images/flat/<id>-peak.webp`). CORS is open, cache headers are 7 days, and the service worker caches each image on first view so it is available offline afterwards. We never copy the image folder into our repo, so the "no redistribution as a dataset" term is not in play. The credit line goes in the About screen, the footer and the README.
- Animation: each exercise card alternates the start and peak poses (CSS cross-fade / flip at about 1 second per phase, with a tempo-matched option during a guided set). Holds and stretches show the single pose with a breathing pulse. This gives a clear, faceless "animation" of every movement with nothing to license beyond the credit line.
- Our own exercise table carries a `repdbId` link; a small number of CrossFit movements that RepDB lacks (double-unders, wall walks, GHD sit-ups, knees-to-elbows) map to the nearest illustrated movement (jump rope, handstand hold, sit-ups, hanging knee raise) with a note.
- Rejected: yuhonas/free-exercise-db (photos of a real, recognisable person; image provenance questioned in the project's own issue tracker), ExerciseDB / MuscleWiki (commercial GIFs, no redistribution), wger (CC-BY-SA mixed drawings and photos, inconsistent, not faceless), stock GIF sites (per-item licences, not a library).

## 3. Data schema (all persisted under one key, versioned)

```
AppData v1
  settings      { units: 'kg'|'lb', theme, sex, heightCm, birthYear, restTimerSound, weekStartsOn }
  profile       { goal: 'lean'|'cut'|'buffed', level: 'beginner'|'intermediate'|'advanced',
                  daysPerWeek: 3..6, location: 'gym'|'home'|'both', equipment: [equipmentId...],
                  injuries: ['knee'|'shoulder'|'lower_back'...] }      // drives tag filters like knee_safe
  plan          { programId, startedAt, weekIndex, dayIndex, trainingMaxes: {exerciseId: kg},
                  progressionState: {exerciseId: {stage, lastWeight, lastReps, failures}} }
  workouts[]    { id, programId, weekIndex, dayIndex, startedAt, endedAt, status: 'active'|'done'|'abandoned',
                  blocks[]: { kind: 'strength'|'circuit'|'amrap'|'emom'|'fortime'|'interval'|'steady'|'mobility',
                              exerciseId, sets[]: { target: {reps|time|distance, weight|rpe|pct}, done: {reps, weight, time, rpe}, at },
                              rounds, timeCapSec, result: {rounds, reps, seconds, calories} },
                  notes, rpeOverall, kcalEstimate }
  prs           { exerciseId: { e1rm: {value, at, workoutId}, maxReps: {...}, bestTime: {...} } }
  bodyLog[]     { at, weightKg, bodyFatPct, waistCm, chestCm, hipsCm, armCm, thighCm, photo? }
  cardioLog[]   { at, mode: 'run'|'bike'|'row'|'rope'|'walk'|'swim', protocol, minutes, distanceKm, avgHr, zone }
  streak        { current, best, lastWorkoutDate }
```

Static content shipped in the app (not user data):

```
EXERCISES[]   { id, name, aliases[], repdbId, category, force, mechanic, equipment[], bodyPart,
                primary[], secondary[], level, unilateral, bodyweight, met,
                steps[], cues[], mistakes[], tags[], scaling: {easier: id, harder: id} }
PROGRAMS[]    { id, name, goal, level, daysPerWeek, location, weeks, description, champion?,
                phases[]: { name, weeks, days[]: { name, blocks[]: { kind, exerciseId|slot, scheme } } },
                progression: 'linear'|'double'|'gzclp'|'531'|'wave'|'ladder', deload: {every, how} }
WODS[]        { id, name, kind: 'girl'|'hero'|'house', format, timeCapSec, movements[], rx: {m, f}, scaled: {...}, story }
PROGRESSIONS  { pushup: [ids...], pullup: [...], squat: [...], hinge: [...], dip: [...], row: [...] }
CHAMPIONS[]   { id, name, era, titles, goal, philosophy, signatureWorkout, quote, source }
```

A `slot` in a program day (for example `{slot: 'horizontal_push'}`) is resolved at plan time against the profile's equipment and injuries, so one template produces a gym version and a home version without duplicating the plan.

## 4. Engine (pure functions, unit-tested, no DOM)

- `recommendProgram(profile)` - picks the best program for goal x level x days x location.
- `buildWorkout(plan, programs, profile)` - resolves today's day template into concrete blocks with loads (from training maxes / last performance) and rest times.
- `progress(plan, workout)` - applies the program's progression rule after a logged session (linear add, double progression, GZCLP stage fail-over, 5/3/1 cycle bump, bodyweight ladder step).
- `e1rm(weight, reps)` (Epley / Brzycki average), `prsAfter(workout)`, `kcal(met, minutes, weightKg)`.
- `weeklyVolume(workouts)` sets per muscle group per week versus the goal's target band (MEV-MRV) for the review screen.
- `timer` state machine for AMRAP / EMOM / Tabata / intervals / rest (tick-driven, testable with a fake clock).

## 5. User workflow

1. First open: pick goal (Lean / Cut / Buffed) with a plain description of what each means and who it is for; then level, days per week, where you train, what equipment you have, any joint to protect.
2. The app recommends a program and shows the full weekly map (what each day does and why), with alternatives.
3. Home screen: "Today" card (next session, estimated time, what you need), streak, this week's progress ring, last PRs.
4. Guided workout: one exercise at a time, faceless animation up top, steps + cues below, target sets with prefilled weight, big "done" button per set, automatic rest timer, swap button (shows alternatives for the same slot), and a notes field. Circuits and WODs get a full-screen clock (AMRAP / EMOM / for-time with cap, Tabata).
5. Finish: summary, PRs hit, estimated calories, RPE, and the progression preview ("next time: 62.5 kg").
6. Library tab: every exercise, filterable by muscle, equipment, goal, level and tag, each with its animation, steps, cues, mistakes, easier / harder variants, and your history on it.
7. Plans tab: browse all programs by goal; switch program (keeps history); WOD list with Rx / scaled standards and your best times; home ladders with your current rung.
8. Progress tab: body log with trend lines, strength trends per lift (e1rm), weekly volume per muscle vs target, cardio minutes by zone, workout calendar heat map.
9. Coach tab: champion insights, goal playbooks (training, cardio, nutrition targets, recovery), and the "why" behind each program.
10. Settings: units, appearance, backup / restore, credits (RepDB attribution), reset.
