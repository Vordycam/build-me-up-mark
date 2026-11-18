# Fitness app - research report and build plan (2026-11-19, pre-go)

Companion files in the same folder: ARCHITECTURE.md (delivery model, data schema, engine, user workflow), PROGRAMS.md (goal playbooks and the program catalogue), SCIENCE.md (evidence and numbers), PROTOCOLS.md (CrossFit benchmarks, formats, bodyweight ladders, cardio intervals), CHAMPIONS.md (champion histories, protocols, quotes, sources). All five move into the repo under docs/ when the build starts.

## 1. Exercise visuals - decision

Requirement: a faceless animation or photo for every exercise, easy to follow, usable in a public static app.

Chosen, two layers:

1. Animation layer - Workout Guide (github.com/bryllim/workout-guide). 302 exercises x 3 SVG frames (top, middle, bottom of the movement), 512x512, faceless line-art figure, consistent style, tiny files. Assets are CC BY-SA 4.0 (credit Bryl Lim and Everkinetic, link the licence, note changes), code MIT. Bundled in the repo, so it is offline from the first load. The frames are recoloured to follow the light / dark theme (that is the "change" we note) and cycled at 0.5-1 s per frame, with a tempo-matched mode during a guided set.
2. Illustration layer - RepDB free dataset (github.com/RepDB/exercise-dataset, release free-708-2026-11). 708 exercises, flat colour illustrations with a start and peak pose, face drawn as a blank oval. Licence: free inside apps and websites with a visible "Exercise data by RepDB (repdb.co)" credit; no redistribution as a dataset. We hotlink from the jsDelivr mirror of RepDB's own repo pinned to the release tag (CORS open, 7-day cache headers verified), and the service worker caches each image on first view. Nothing from RepDB is copied into our repo. Used as the "illustration" view and as the two-pose animation for movements Workout Guide lacks (thruster, wall-ball, box jump, cleans, snatches, push jerk, overhead squat, muscle-up, toes-to-bar, sit-up, ring dip, kettlebell sumo high pull, handstand hold).

Rejected: yuhonas/free-exercise-db (photos of a real person with the face visible; the maintainer says the image origin is unknown and use is at your own risk; upstream admits they were scraped), ExerciseDB and MuscleWiki (terms forbid storing or re-hosting any media), Gym Visual GIF sets (copyrighted), wger (CC BY-SA but a mix of photos, 3D renders and AI line art, inconsistent, some with faces), Open Exercise Art (CC BY-SA, faceless, but single frame and AI-generated).

Verified by eye this session: Workout Guide bench press, squat, pull-up, push-up, deadlift, burpee, kettlebell swing frames; RepDB squat, push-up, pull-up; free-exercise-db bench and squat photos.

## 2. What "not superficial" means here - the coaching model

Three goals, each a playbook of rules that every program in the goal obeys (full table in PROGRAMS.md):

- LEAN: lower body fat, athletic, conditioned. 10-20% deficit, lose 0.5-0.75% bodyweight a week, protein 1.8-2.2 g/kg, 3-4 lifting days at 10-14 sets per muscle per week, 150-250 cardio minutes a week split 80% easy / 20% hard. Champions: Reeves, Kipchoge, Froning / Fraser / Toomey, Goggins.
- CUT: keep the muscle, strip the fat, definition. 15-25% deficit, protein 2.3-3.1 g/kg fat-free mass, keep the loads and 10-14 sets per muscle, 2 HIIT + 2-3 LISS, diet break every 4-6 weeks (MATADOR). Champions: Zane, Nubret, Bumstead, Strebl / Plitt.
- BUFFED: add muscle and strength. 10-20% surplus, gain 0.25-0.5% a week, protein 1.6-2.2 g/kg, 12-20 sets per muscle per week, 5-12 reps, 2-3 min rest on compounds, progression that changes with level (linear, then staged GZCLP, then 5/3/1 waves), deload every 5-6 weeks. Champions: Arnold, Haney, Yates, Coleman, Hall / Bjornsson.

Evidence behind the numbers (SCIENCE.md): Schoenfeld 2017 dose-response (10+ sets a week), Schoenfeld 2016 frequency (2x a week per muscle), Renaissance Periodization volume landmarks, NSCA / ACSM load and rest tables, Robinson 2024 and Refalo 2024 on proximity to failure, Helms 2014 and Refalo 2025 on protein in a deficit, Garthe 2011 on rate of loss, Iraki 2019 on surplus size, Helgerud 2007 (4x4), Tabata 1996, Gibala, Billat, ACSM 2009 on cardio minutes for fat loss, Wewege 2017 on HIIT vs steady state, Byrne 2018 (MATADOR diet breaks), Seiler 2010 on polarized training.

## 3. Programs shipped on day one (details in PROGRAMS.md)

Lean: Lean Foundations (beginner, full body + Zone 2 / Couch to 5K), Engine Builder (intermediate, strength + 4x4 + scaled Girls), Hybrid Athlete (advanced, PHUL power days + WODs + polarized cardio), Lean at Home (bodyweight ladders + bodyweight WODs + jump rope).
Cut: Definition 3-day (beginner), Zane Pyramid (intermediate, three-way split, descending pyramids), Shred Protocol (advanced PPL with a heavy top set, pump finishers, optional two-a-days, carb-cycling note), Cut at Home.
Buffed: Golden Six (Arnold's beginner routine), 5x5 Linear, GZCLP (full staged engine), PHUL, 5/3/1 Boring But Big (training-max waves and automatic resets), PPL 6-day (Coleman) with Yates' Blood and Guts 4-day as the alternative, Buffed at Home.
Plus: 20 benchmark Girls and 6 Hero WODs with crossfit.com Rx standards and scaling; Tabata This, Fight Gone Bad, Death-by and house AMRAP / EMOM builders; cardio protocols (Zone 2, 4x4, Tabata, Gibala, Billat 30/30, 400 m repeats, Concept2 500s, jump rope, Couch to 5K, long easy); the six r/bodyweightfitness ladders with the core triplet and automatic rung progression.

## 4. Exercise library

About 180 curated exercises authored by us: name, aliases, muscles, equipment, level, 4-6 steps, 2-3 coaching cues, common mistakes, easier and harder swaps, an animation id (Workout Guide) and / or an illustration id (RepDB), MET value from the Compendium of Physical Activities for calorie estimates. Every movement used by a program, WOD, ladder or cardio protocol is covered, plus the usual gym alternatives for each slot (horizontal push, vertical push, horizontal pull, vertical pull, squat, hinge, lunge, carry, core, conditioning) so the same plan resolves for a gym or a home setup.

## 5. App (ARCHITECTURE.md has the schema and the engine list)

Same delivery model as ThursDink: plain HTML / CSS / JS, installable PWA with a versioned service worker, GitHub Pages from main of a new repo under Vordycam, all data in localStorage with JSON backup / restore, light and dark appearance.

Tabs: Today (next session, streak, week ring, PRs), Workout (guided, one exercise at a time with the animation, steps, cues, set targets with prefilled loads, automatic rest timer, swap, full-screen WOD clocks), Library (filterable, with history per exercise), Plans (programs by goal, WODs with personal bests, ladders with current rung, cardio protocols), Progress (body log trends, strength trends by estimated 1RM, weekly sets per muscle vs the goal band, cardio minutes by zone, calendar heat map), Coach (goal playbooks, champion insights, the why behind each program), Settings (units, appearance, backup, credits, reset).

Engine (pure functions, unit-tested with a fake clock): program recommendation, workout builder with slot resolution, progression rules (linear, double, GZCLP stages, 5/3/1 cycles, ladder rungs), e1RM and PR detection, calorie estimate, weekly volume audit, timer state machine.

Quality bar: every feature commented at the top of its block (what it does, where its data lives, what it must not change), Node unit tests for the engine, a jsdom click-through smoke, headless-Chrome screenshots in light and dark, then commit and push, then a check of the live URL.

## 6. Open choices for the go message

- App and repo name. Proposed: TriForm (three physique forms), alternatives ForgeFit, IronCoach. The repo name becomes the URL: vordycam.github.io/<name>.
- Default units: lb (CrossFit standards are published in lb; kg always available with one tap) unless you prefer kg.
- Anything to leave out of the first build.

## Sources (key)

Media: https://github.com/bryllim/workout-guide ; https://github.com/everkinetic/data ; https://github.com/RepDB/exercise-dataset (LICENSE-DATA.md, ATTRIBUTION.md) ; https://github.com/yuhonas/free-exercise-db/issues/12 ; https://exercisedb.notion.site/ExerciseDB-API-Terms-of-Use-226983b728ca8090bf7be79564e4b356 ; https://api.musclewiki.com/api-terms ; https://wger.de/api/v2/exerciseimage/
Science: https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth ; https://lookgreatnaked.com/blog/how-many-sets-do-you-need-to-perform-to-maximize-muscle-gains ; https://link.springer.com/10.1007/s40279-016-0543-8 ; https://www.strongerbyscience.com/rest-times-for-muscle-growth/ ; https://biolayne.com/reps/issue-23/is-training-to-failure-overrated/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710 ; https://pubmed.ncbi.nlm.nih.gov/28401638/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC5803575 ; https://health.clevelandclinic.org/exercise-heart-rate-zones-explained ; https://pubmed.ncbi.nlm.nih.gov/20861519/
Programs: https://thefitness.wiki/routines/gzclp/ ; https://thefitness.wiki/5-3-1-primer/ ; https://jimwendler.com/blogs/jimwendler-com/101077382-boring-but-big ; https://www.strengthlog.com/phul-workout-routine/ ; https://liftvault.com/programs/bodybuilding/metallicadpa-ppl/ ; https://www.strengthlog.com/strengthlogs-upper-lower-program-4-days-week/ ; https://startingstrength.com/article/programming-a-smooth-nlp
CrossFit and home: https://www.crossfit.com/benchmark/fran (and the other benchmark slugs) ; https://www.crossfit.com/heroes ; https://crossfit.com/essentials/crossfit-terms-explained ; https://redditbwf.github.io/wiki/recommended_routine.html ; https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/ ; https://www.concept2.com/training/plans/500m-erg-test
Champions: https://liftvault.com/programs/bodybuilding/arnold-schwarzenegger-workout-routine-golden-six/ ; https://frankzane.com/the-growth-program-then-and-now-frank-zane/ ; https://stevereeves.com/bodybuilding ; https://fitnessvolt.com/lee-haney-stimulate-dont-annihilate/ ; https://fitnessvolt.com/dorian-yates-one-all-out-set-growth ; https://generationiron.com/ronnie-coleman-favorite-6-day-workout-split/ ; https://fitnessvolt.com/chris-bumstead-current-workout-split-2023-olympia ; https://coachweb.com/exercises/sport-workouts/2137/mf-interviews-crossfit-champion-rich-froning ; https://barbend.com/hafthor-bjornsson-lifting-heavy-too-often ; https://marathonhandbook.com/how-eliud-kipchoge-trains-for-a-marathon/ ; https://run247.com/race-guides/david-goggins-4x4x48-challenge-date-advice-how-to
