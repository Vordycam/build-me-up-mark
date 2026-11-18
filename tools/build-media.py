#!/usr/bin/env python3
"""Build the exercise media layer for Build Me Up Mark.

What this does
  1. Copies the three animation frames of every exercise we use from a local
     clone of Workout Guide (github.com/bryllim/workout-guide, assets CC BY-SA 4.0)
     into assets/anim/<our-id>/frame-1..3.svg, with two recorded changes:
       - fill="#fff" becomes fill="currentColor" so the inline SVG follows the
         app's light or dark theme;
       - path coordinates are rounded to one decimal on the 512 px canvas,
         which roughly halves the file size with no visible difference.
  2. Checks every RepDB illustration id we reference against RepDB's own
     exercises.json (github.com/RepDB/exercise-dataset) and records whether that
     exercise has a start/peak pair or a single main pose. Nothing from RepDB is
     copied: the app hotlinks the images from RepDB's repository via jsDelivr.
  3. Writes js/data/media.js, the generated lookup the app uses, and the
     attribution files that sit next to the copied frames.

Usage (from the project root; both inputs are read only):
  python -I tools/build-media.py --wg <path to wg-repo/packages/workout-guide> \
                                 --repdb <path to RepDB exercises.json>

The master list below is the single source of truth for which exercise maps to
which Workout Guide slug and which RepDB id. Keep it in sync with
js/data/exercises-*.js (test/data.test.js checks that every exercise has media).
"""
import argparse
import json
import os
import re
import shutil
import sys

REPDB_RELEASE = 'free-708-2026-11'

# (our id, Workout Guide slug or None, RepDB id or None)
MASTER = [
    # --- horizontal push ---
    ('bench-press', 'bench-press', 'bench-press'),
    ('incline-bench-press', 'incline-bench-press', 'incline-bench-press'),
    ('close-grip-bench-press', 'close-grip-bench-press', 'close-grip-bench-press'),
    ('decline-bench-press', 'decline-bench-press', 'decline-bench-press'),
    ('dumbbell-bench-press', 'dumbbell-bench-press', 'db-bench-press'),
    ('incline-dumbbell-press', 'incline-dumbbell-press', 'incline-db-press'),
    ('machine-chest-press', 'machine-chest-press', 'chest-press-machine'),
    ('dumbbell-fly', 'dumbbell-fly', 'db-fly'),
    ('cable-fly', 'cable-fly', 'cable-fly'),
    ('pec-deck', 'pec-deck', 'pec-deck'),
    ('push-up', 'push-up', 'push-up'),
    ('knee-push-up', 'knee-push-up', 'knee-push-ups'),
    ('incline-push-up', 'incline-push-up', 'incline-push-ups'),
    ('wall-push-up', 'wall-push-up', 'wall-push-ups'),
    ('decline-push-up', 'decline-push-up', 'decline-push-up'),
    ('diamond-push-up', 'diamond-push-up', 'diamond-push-ups'),
    ('wide-push-up', 'wide-push-up', 'wide-grip-push-ups'),
    ('archer-push-up', 'archer-push-up', 'archer-push-ups'),
    ('pseudo-planche-push-up', None, 'pseudo-planche-push-ups'),
    ('explosive-push-up', 'explosive-push-up', 'plyo-push-up'),
    ('dip', 'dip', 'dips'),
    ('bench-dip', 'bench-dip', 'bench-dips'),
    ('assisted-dip', 'assisted-dip', 'assisted-dips'),
    ('weighted-dip', 'weighted-dip', None),
    ('ring-dip', None, 'ring-dips'),
    # --- vertical push ---
    ('overhead-press', 'overhead-press', None),
    ('push-press', 'push-press', 'push-press'),
    ('push-jerk', None, 'push-jerk'),
    ('seated-dumbbell-press', 'seated-dumbbell-press', 'dumbbell-shoulder-press'),
    ('standing-dumbbell-press', 'standing-dumbbell-press', None),
    ('arnold-press', 'arnold-press', 'arnold-press'),
    ('machine-shoulder-press', 'machine-shoulder-press', 'machine-shoulder-press'),
    ('landmine-press', 'landmine-press', None),
    ('pike-push-up', 'pike-push-up', 'pike-push-ups'),
    ('feet-elevated-pike-push-up', 'feet-elevated-pike-push-up', None),
    ('wall-handstand-push-up', 'wall-handstand-push-up', 'handstand-push-ups'),
    ('handstand-push-up', 'handstand-push-up', 'handstand-push-ups'),
    ('wall-walk', 'wall-walk', None),
    ('handstand-hold', None, 'handstand-hold'),
    ('lateral-raise', 'lateral-raise', 'lateral-raise'),
    ('cable-lateral-raise', 'cable-lateral-raise', 'cable-lateral-raise'),
    ('front-raise', 'front-raise', 'dumbbell-front-raise'),
    ('rear-delt-fly', 'rear-delt-fly', 'rear-delt-fly'),
    ('face-pull', 'face-pull', 'face-pull'),
    ('band-pull-apart', 'band-pull-apart', None),
    ('upright-row', 'upright-row', 'upright-row'),
    ('shrug', 'shrug', 'shrug'),
    ('dumbbell-shrug', 'dumbbell-shrug', 'db-shrug'),
    # --- horizontal pull ---
    ('barbell-row', 'barbell-row', 'barbell-row'),
    ('pendlay-row', 'pendlay-row', 'pendlay-row'),
    ('t-bar-row', 't-bar-row', 't-bar-row'),
    ('one-arm-dumbbell-row', 'one-arm-dumbbell-row', None),
    ('dumbbell-bent-over-row', 'dumbbell-bent-over-row', 'bent-over-db-row'),
    ('chest-supported-row', 'chest-supported-row', 'chest-supported-db-row'),
    ('seated-cable-row', 'seated-row', 'seated-cable-row'),
    ('machine-row', 'machine-row', 'chest-supported-machine-row'),
    ('inverted-row', 'inverted-row', 'inverted-row'),
    ('banded-row', 'banded-row', 'banded-standing-row'),
    ('towel-row', 'towel-row', None),
    # --- vertical pull ---
    ('pull-up', 'pull-up', 'pull-up'),
    ('chin-up', 'chin-up', 'chin-ups'),
    ('neutral-grip-pull-up', 'neutral-grip-pull-up', 'neutral-grip-pull-ups'),
    ('weighted-pull-up', 'weighted-pull-up', 'weighted-pull-up'),
    ('assisted-pull-up', 'assisted-pull-up', 'assisted-pull-ups'),
    ('negative-pull-up', 'negative-pull-up', 'negative-pull-ups'),
    ('scapular-pull-up', 'scapular-pull-up', 'scapular-pull-ups'),
    ('dead-hang', 'dead-hang', None),
    ('lat-pulldown', 'lat-pulldown', 'lat-pulldown'),
    ('wide-grip-lat-pulldown', 'wide-grip-lat-pulldown', None),
    ('close-grip-lat-pulldown', 'close-grip-lat-pulldown', 'close-grip-lat-pulldown'),
    ('straight-arm-pulldown', 'straight-arm-pulldown', 'straight-arm-pulldown'),
    ('muscle-up', None, 'muscle-ups'),
    # --- squat ---
    ('squat', 'squat', 'squat'),
    ('front-squat', 'front-squat', 'front-squat'),
    ('goblet-squat', 'goblet-squat', 'goblet-squat'),
    ('bodyweight-squat', 'bodyweight-squat', 'bodyweight-squat'),
    ('jump-squat', 'jump-squat', 'jump-squat'),
    ('hack-squat', 'hack-squat', 'hack-squat'),
    ('leg-press', 'leg-press', 'leg-press'),
    ('smith-machine-squat', 'smith-machine-squat', 'smith-machine-squat'),
    ('box-squat', None, 'box-squat'),
    ('overhead-squat', None, 'overhead-squat'),
    ('thruster', None, 'thruster'),
    ('wall-ball', None, 'wall-ball'),
    ('bulgarian-split-squat', 'bulgarian-split-squat', 'bulgarian-split-squat'),
    ('split-squat', 'split-squat', 'split-squat'),
    ('pistol-squat', 'pistol-squat', 'pistol-squat'),
    ('assisted-pistol-squat', 'assisted-pistol-squat', None),
    ('shrimp-squat', 'shrimp-squat', None),
    ('cossack-squat', 'cossack-squat', 'cossack-squat'),
    ('wall-sit', 'wall-sit', 'wall-sit'),
    ('leg-extension', 'leg-extension', 'leg-extension'),
    ('step-up', 'step-up', 'step-ups'),
    ('sumo-squat', 'dumbbell-sumo-squat', 'sumo-squat'),
    # --- hinge ---
    ('deadlift', 'deadlift', 'deadlift'),
    ('sumo-deadlift', 'sumo-deadlift', 'sumo-deadlift'),
    ('trap-bar-deadlift', 'trap-bar-deadlift', None),
    ('romanian-deadlift', 'romanian-deadlift', 'romanian-deadlift'),
    ('dumbbell-romanian-deadlift', 'dumbbell-romanian-deadlift', 'dumbbell-romanian-deadlift'),
    ('single-leg-romanian-deadlift', 'single-leg-romanian-deadlift', 'single-leg-romanian-deadlift'),
    ('good-morning', 'good-morning', 'good-morning'),
    ('rack-pull', 'rack-pull', 'rack-pull'),
    ('hip-thrust', 'hip-thrust', 'hip-thrust'),
    ('dumbbell-hip-thrust', 'dumbbell-hip-thrust', 'dumbbell-hip-thrust'),
    ('glute-bridge', 'glute-bridge', 'glute-bridge'),
    ('single-leg-glute-bridge', 'single-leg-glute-bridge', 'single-leg-glute-bridge'),
    ('barbell-glute-bridge', 'barbell-glute-bridge', 'barbell-glute-bridge'),
    ('kettlebell-swing', 'kettlebell-swing', 'kettlebell-swing'),
    ('back-extension', 'back-extension', 'back-extension'),
    ('reverse-hyperextension', 'reverse-hyperextension', None),
    ('nordic-hamstring-curl', 'nordic-hamstring-curl', 'nordic-hamstring-curl'),
    ('lying-leg-curl', 'lying-leg-curl', 'leg-curl'),
    ('seated-leg-curl', 'seated-leg-curl', 'seated-leg-curl'),
    ('stability-ball-hamstring-curl', 'stability-ball-hamstring-curl', 'ball-leg-curl'),
    ('kettlebell-sumo-high-pull', None, 'kettlebell-sumo-high-pull'),
    ('power-clean', None, 'clean'),
    ('squat-clean', None, 'clean'),
    ('hang-power-clean', None, 'hang-power-clean'),
    ('clean-and-jerk', None, 'clean-and-jerk'),
    ('power-snatch', None, 'snatch'),
    ('dumbbell-snatch', None, 'dumbbell-snatch'),
    # --- lunge ---
    ('forward-lunge', 'forward-lunge', 'lunge'),
    ('reverse-lunge', 'reverse-lunge', 'reverse-lunge'),
    ('walking-lunge', 'walking-lunge', 'walking-lunge'),
    ('lateral-lunge', 'lateral-lunge', None),
    # --- calves ---
    ('standing-calf-raise', 'standing-calf-raise', 'standing-calf-raise'),
    ('seated-calf-raise', 'seated-calf-raise', 'seated-calf-raise'),
    ('single-leg-calf-raise', 'single-leg-calf-raise', 'single-leg-calf-raise'),
    ('donkey-calf-raise', 'donkey-calf-raise', 'donkey-calf-raise'),
    ('calf-raise', 'calf-raise', 'bodyweight-calf-raise'),
    # --- arms ---
    ('barbell-curl', None, 'barbell-curl'),
    ('dumbbell-curl', 'bicep-curl', 'bicep-curl'),
    ('hammer-curl', 'hammer-curl', 'hammer-curl'),
    ('ez-bar-curl', 'ez-bar-curl', 'ez-bar-curl'),
    ('preacher-curl', 'preacher-curl', 'preacher-curl'),
    ('incline-dumbbell-curl', 'incline-dumbbell-curl', 'incline-db-curl'),
    ('cable-curl', 'cable-curl', 'cable-curl'),
    ('skull-crusher', 'skull-crusher', 'skull-crusher'),
    ('dumbbell-skull-crusher', 'dumbbell-skull-crusher', 'db-skull-crusher'),
    ('tricep-pushdown', 'tricep-pushdown', 'tricep-pushdown'),
    ('overhead-tricep-extension', 'overhead-tricep-extension', 'overhead-tricep-extension'),
    ('tricep-kickback', 'tricep-kickback', 'tricep-kickback'),
    ('wrist-curl', 'wrist-curl', 'barbell-wrist-curl'),
    # --- core ---
    ('plank', 'plank', 'plank'),
    ('side-plank', 'side-plank', 'side-plank'),
    ('dead-bug', 'dead-bug', 'dead-bug'),
    ('bird-dog', 'bird-dog', 'bird-dog'),
    ('hollow-body-hold', 'hollow-body-hold', 'hollow-body-hold'),
    ('hollow-rock', 'hollow-rock', None),
    ('crunch', 'crunch', 'crunches'),
    ('bicycle-crunch', 'bicycle-crunch', 'bicycle-crunch'),
    ('reverse-crunch', 'reverse-crunch', 'reverse-crunches'),
    ('cable-crunch', 'cable-crunch', 'cable-crunch'),
    ('sit-up', None, 'sit-ups'),
    ('hanging-knee-raise', 'hanging-knee-raise', 'hanging-knee-raise'),
    ('hanging-leg-raise', 'hanging-leg-raise', 'hanging-leg-raise'),
    ('lying-leg-raise', 'lying-leg-raise', 'lying-leg-raise'),
    ('captains-chair-knee-raise', 'captains-chair-knee-raise', 'captains-chair-leg-raise'),
    ('toes-to-bar', None, 'toes-to-bar'),
    ('v-up', 'v-up', 'v-ups'),
    ('russian-twist', 'russian-twist', 'russian-twist'),
    ('pallof-press', 'pallof-press', 'cable-pallof-press'),
    ('cable-woodchop', 'cable-woodchop', None),
    ('copenhagen-plank', 'copenhagen-plank', 'copenhagen-plank'),
    ('ab-wheel-rollout', 'ab-wheel', 'ab-wheel-rollout'),
    ('superman', 'superman', 'superman'),
    ('flutter-kick', 'flutter-kick', 'flutter-kicks'),
    ('mountain-climber', 'mountain-climber', 'mountain-climbers'),
    ('plank-shoulder-tap', 'plank-shoulder-tap', None),
    ('farmer-carry', 'farmer-carry', 'dumbbell-farmers-walk'),
    # --- conditioning ---
    ('burpee', 'burpee', 'burpees'),
    ('jumping-jack', 'jumping-jack', 'jumping-jacks'),
    ('high-knees', 'high-knees', 'high-knees'),
    ('skater-hop', 'skater-hop', None),
    ('plank-jack', 'plank-jack', None),
    ('jump-rope', 'jump-rope', 'jump-rope'),
    ('double-under', 'jump-rope', 'jump-rope'),
    ('box-jump', None, 'box-jump'),
    ('battle-ropes', 'battle-ropes', 'battle-ropes'),
    ('bear-crawl', 'bear-crawl', 'bear-crawl'),
    ('inchworm', 'inchworm', 'inchworm'),
    ('running', 'running', 'running'),
    ('walking', 'walking', 'walking'),
    ('treadmill-incline-walk', 'treadmill-incline-walk', 'incline-treadmill-walk'),
    ('rowing', 'rowing', 'rowing-machine'),
    ('cycling', 'cycling', 'stationary-bike'),
    ('assault-bike', 'assault-bike', 'air-bike'),
    ('elliptical', 'elliptical', 'elliptical-trainer'),
    ('stair-climber', 'stair-climber', 'stair-climber'),
    ('swimming', 'swimming', None),
    ('sled-push', None, 'sled-push'),
    # --- mobility and warm-up ---
    ('cat-cow', 'cat-cow-stretch', 'cat-cow'),
    ('worlds-greatest-stretch', 'worlds-greatest-stretch', 'worlds-greatest-stretch'),
    ('childs-pose', 'childs-pose', 'childs-pose'),
    ('kneeling-hip-flexor-stretch', 'kneeling-hip-flexor-stretch', 'kneeling-hip-flexor-stretch'),
    ('hamstring-stretch', 'hamstring-stretch', 'bench-hamstring-stretch'),
    ('standing-quad-stretch', 'standing-quad-stretch', 'standing-quad-stretch'),
    ('doorway-chest-stretch', 'doorway-chest-stretch', None),
    ('cross-body-shoulder-stretch', 'cross-body-shoulder-stretch', None),
    ('butterfly-stretch', 'butterfly-stretch', 'butterfly-stretch'),
    ('wall-calf-stretch', 'wall-calf-stretch', 'standing-calf-stretch'),
    ('leg-swings', 'leg-swings-stretch', None),
    ('arm-circles', 'arm-circles', None),
    ('scapular-push-up', 'scapular-push-up', None),
    ('pigeon-stretch', None, 'pigeon-stretch'),
    ('downward-dog', None, 'downward-dog'),
    ('ninety-ninety', None, '90-90-hold'),
    ('banded-lateral-walk', 'banded-lateral-walk', None),
    ('clamshell', 'clamshell', None),
]

D_ATTR = re.compile(r' d="([^"]+)"')
TOKEN = re.compile(r'([MmZzLlHhVvCcSsQqTtAa])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)')


def fmt_num(src):
    """One decimal place, no trailing zeros, leading-dot form for values under 1 (".3", "-.3")."""
    v = round(float(src), 1)
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('', '-', '-0'):
        return '0'
    if s.startswith('0.'):
        return s[1:]
    if s.startswith('-0.'):
        return '-' + s[2:]
    return s


def shrink_path(d):
    """Re-serialise path data with rounded numbers. Path data packs numbers tightly ("2.3.9" is two numbers,
    "11.1" is one), so after rounding a separator is put back wherever two numbers would otherwise fuse."""
    out = []
    prev_num = None
    for cmd, num in TOKEN.findall(d):
        if cmd:
            out.append(cmd)
            prev_num = None
            continue
        s = fmt_num(num)
        if prev_num is not None:
            # no separator needed before a sign, or before a ".x" when the previous number already has a dot
            if not (s.startswith('-') or (s.startswith('.') and '.' in prev_num)):
                out.append(' ')
        out.append(s)
        prev_num = s
    return ''.join(out)


def shrink(svg):
    """Round every path coordinate to one decimal place and switch the fill to currentColor."""
    svg = svg.replace('fill="#fff"', 'fill="currentColor"')
    return D_ATTR.sub(lambda m: ' d="' + shrink_path(m.group(1)) + '"', svg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--wg', required=True, help='path to workout-guide/packages/workout-guide')
    ap.add_argument('--repdb', required=True, help='path to RepDB exercises.json')
    ap.add_argument('--out', default='.', help='project root')
    a = ap.parse_args()

    repdb = json.load(open(a.repdb, encoding='utf-8'))
    poses = {}
    for e in repdb['exercises']:
        flat = (e.get('images') or {}).get('flat') or {}
        poses[e['id']] = 'main' if 'main' in flat else 'pair'

    wg_assets = os.path.join(a.wg, 'assets')
    out_anim = os.path.join(a.out, 'assets', 'anim')
    os.makedirs(out_anim, exist_ok=True)

    media = {}
    problems = []
    raw_bytes = out_bytes = 0
    seen = set()
    for our_id, wg, rep in MASTER:
        if our_id in seen:
            problems.append('duplicate id ' + our_id)
        seen.add(our_id)
        entry = {}
        if wg:
            src = os.path.join(wg_assets, wg)
            if not os.path.isdir(src):
                problems.append('%s: Workout Guide slug %s not found' % (our_id, wg))
            else:
                dst = os.path.join(out_anim, our_id)
                os.makedirs(dst, exist_ok=True)
                for n in (1, 2, 3):
                    p = os.path.join(src, 'frame-%d.svg' % n)
                    svg = open(p, encoding='utf-8').read()
                    raw_bytes += len(svg)
                    small = shrink(svg)
                    out_bytes += len(small)
                    open(os.path.join(dst, 'frame-%d.svg' % n), 'w', encoding='utf-8', newline='\n').write(small)
                entry['anim'] = our_id
                entry['animSource'] = wg
        if rep:
            if rep not in poses:
                problems.append('%s: RepDB id %s not found' % (our_id, rep))
            else:
                entry['repdb'] = rep
                if poses[rep] == 'main':
                    entry['repdbMain'] = True
        if not entry:
            problems.append('%s: no media at all' % our_id)
        media[our_id] = entry

    # the generated lookup the app reads
    lines = [
        '/* GENERATED by tools/build-media.py - do not edit by hand.',
        '   Maps each exercise id to its animation folder (assets/anim/<id>/frame-1..3.svg,',
        '   Workout Guide, CC BY-SA 4.0) and / or its RepDB illustration id (hotlinked,',
        '   see js/media.js). repdbMain marks exercises RepDB draws as a single pose. */',
        'window.DATA = window.DATA || {};',
        'DATA.REPDB_RELEASE = %s;' % json.dumps(REPDB_RELEASE),
        'DATA.media = {',
    ]
    for k in media:
        lines.append('  %s: %s,' % (json.dumps(k), json.dumps(media[k], separators=(',', ':'))))
    lines.append('};')
    os.makedirs(os.path.join(a.out, 'js', 'data'), exist_ok=True)
    open(os.path.join(a.out, 'js', 'data', 'media.js'), 'w', encoding='utf-8', newline='\n').write('\n'.join(lines) + '\n')

    # licence and attribution next to the copied frames
    shutil.copy(os.path.join(a.wg, 'LICENSE-ASSETS'), os.path.join(out_anim, 'LICENSE-ASSETS'))
    attribution = """# Attribution for assets/anim

The animation frames in this folder are from Workout Guide by Bryl Lim
(https://github.com/bryllim/workout-guide, https://bryllim.com), licensed under
Creative Commons Attribution-ShareAlike 4.0 International
(https://creativecommons.org/licenses/by-sa/4.0/). Workout Guide's first-pose
frames build on Everkinetic (https://github.com/everkinetic/data), also CC BY-SA 4.0.

Changes made for Build Me Up Mark (tools/build-media.py):
- the fill colour #fff was replaced with currentColor so the figure follows the app's theme;
- path coordinates were rounded to one decimal place on the 512 px canvas to reduce file size;
- folders were renamed to this app's exercise ids (the original slug is recorded in js/data/media.js as animSource).

These frames remain licensed under CC BY-SA 4.0; see LICENSE-ASSETS in this folder.
"""
    open(os.path.join(out_anim, 'ATTRIBUTION.md'), 'w', encoding='utf-8', newline='\n').write(attribution)

    anim = sum(1 for v in media.values() if 'anim' in v)
    rep_only = sum(1 for v in media.values() if 'repdb' in v and 'anim' not in v)
    print('exercises: %d  with animation: %d  illustration only: %d' % (len(media), anim, rep_only))
    print('frames: %.1f MB -> %.1f MB' % (raw_bytes / 1048576, out_bytes / 1048576))
    for p in problems:
        print('PROBLEM:', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
