/* Media: the faceless exercise visuals.
   Two layers, chosen per exercise from the generated map in js/data/media.js:
     1. Animation - three SVG frames bundled in assets/anim/<id>/ (Workout Guide, CC BY-SA 4.0). The frames are
        fetched once, cached in memory (and by the service worker), inlined so they take the theme colour,
        and cycled 1 -> 2 -> 3 -> 2 so the movement reads as a loop.
     2. Illustration - RepDB's flat start / peak drawings, hotlinked from the jsDelivr mirror of RepDB's repository
        pinned to a release tag. Never copied into this repo (RepDB's licence allows in-app use with credit).
        Shown as the "Illustration" view, and as a two-pose animation for the few exercises without frames.
   Respects prefers-reduced-motion: the player shows the middle frame and offers manual stepping instead. */
(function () {
  'use strict';

  var svgCache = {};          /* url -> Promise<string> */
  var FRAME_MS = 650;         /* default time per frame */
  var SEQUENCE = [1, 2, 3, 2]; /* loop order */

  function animBase(ex) { return ex && ex.anim ? 'assets/anim/' + ex.anim + '/' : null; }
  function animUrls(ex) {
    var base = animBase(ex);
    return base ? [base + 'frame-1.svg', base + 'frame-2.svg', base + 'frame-3.svg'] : [];
  }
  function repdbUrl(ex, pose) {
    if (!ex || !ex.repdb) return null;
    var p = ex.repdbMain ? 'main' : (pose || 'peak');
    return 'https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@' + (window.DATA && DATA.REPDB_RELEASE || 'main') + '/images/flat/' + ex.repdb + '-' + p + '.webp';
  }
  function repdbUrls(ex) {
    if (!ex || !ex.repdb) return [];
    return ex.repdbMain ? [repdbUrl(ex, 'main')] : [repdbUrl(ex, 'start'), repdbUrl(ex, 'peak')];
  }

  function fetchSvg(url) {
    if (!svgCache[url]) {
      svgCache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url); return r.text(); })
        .then(function (text) {
          /* keep only the <svg> element; strip XML prologues and anything else */
          var i = text.indexOf('<svg');
          return i >= 0 ? text.slice(i) : text;
        })
        .catch(function (e) { delete svgCache[url]; throw e; });
    }
    return svgCache[url];
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Mount a player into `el` for exercise `ex`.
     opts: { mode: 'anim'|'illustration'|'auto', frameMs, autoplay, onError }
     Returns a handle: { play, pause, toggle, step, setFrameMs, setMode, destroy, mode }. */
  function mount(el, ex, opts) {
    opts = opts || {};
    var frameMs = opts.frameMs || FRAME_MS;
    var timer = null, idx = 0, frames = null, destroyed = false, paused = !(opts.autoplay !== false);
    var mode = opts.mode || 'auto';
    if (mode === 'auto') mode = ex && ex.anim ? 'anim' : (ex && ex.repdb ? 'illustration' : 'none');
    el.innerHTML = '';
    el.classList.add('media');
    el.setAttribute('data-mode', mode);

    var stage = document.createElement('div');
    stage.className = 'media-stage';
    el.appendChild(stage);

    function showFrame(i) {
      if (!frames || destroyed) return;
      idx = i;
      stage.innerHTML = frames[SEQUENCE[i] - 1];
      var svg = stage.querySelector('svg');
      if (svg) { svg.removeAttribute('width'); svg.removeAttribute('height'); svg.setAttribute('aria-hidden', 'true'); }
    }
    function tick() { showFrame((idx + 1) % SEQUENCE.length); }
    function play() {
      if (destroyed || mode !== 'anim' || !frames || reducedMotion()) return;
      if (timer) return;
      paused = false;
      timer = setInterval(tick, frameMs);
      el.classList.add('is-playing');
    }
    function pause() {
      if (timer) { clearInterval(timer); timer = null; }
      paused = true;
      el.classList.remove('is-playing');
    }
    function step() { pause(); showFrame((idx + 1) % SEQUENCE.length); }

    function mountIllustration() {
      var urls = repdbUrls(ex);
      if (!urls.length) { stage.innerHTML = '<div class="media-empty" aria-hidden="true">' + placeholderSvg() + '</div>'; return; }
      var wrap = document.createElement('div');
      wrap.className = 'media-illus';
      urls.forEach(function (u, i) {
        var img = document.createElement('img');
        img.src = u; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        img.className = 'media-illus-img' + (i === 0 ? ' is-on' : '');
        img.onerror = function () { img.classList.add('is-broken'); if (opts.onError) opts.onError(u); };
        wrap.appendChild(img);
      });
      stage.appendChild(wrap);
      if (urls.length === 2 && !reducedMotion()) {
        var on = 0;
        timer = setInterval(function () {
          on = 1 - on;
          var imgs = wrap.querySelectorAll('img');
          imgs[0].classList.toggle('is-on', on === 0);
          imgs[1].classList.toggle('is-on', on === 1);
        }, 1100);
      }
    }

    function mountAnim() {
      var urls = animUrls(ex);
      stage.innerHTML = '<div class="media-loading" aria-hidden="true"></div>';
      Promise.all(urls.map(fetchSvg)).then(function (texts) {
        if (destroyed) return;
        frames = texts;
        showFrame(1); /* middle frame first so the still looks like the movement */
        if (!paused) play();
      }).catch(function () {
        if (destroyed) return;
        if (ex && ex.repdb) { mode = 'illustration'; el.setAttribute('data-mode', mode); stage.innerHTML = ''; mountIllustration(); }
        else stage.innerHTML = '<div class="media-empty">' + placeholderSvg() + '</div>';
      });
    }

    if (mode === 'anim') mountAnim();
    else if (mode === 'illustration') mountIllustration();
    else stage.innerHTML = '<div class="media-empty" aria-hidden="true">' + placeholderSvg() + '</div>';

    return {
      get mode() { return mode; },
      play: play, pause: pause, step: step,
      toggle: function () { if (timer) pause(); else play(); },
      setFrameMs: function (ms) { frameMs = ms; if (timer) { pause(); play(); } },
      setMode: function (m) {
        if (m === mode) return;
        pause(); mode = m; frames = null; stage.innerHTML = ''; el.setAttribute('data-mode', mode);
        if (mode === 'anim') { paused = false; mountAnim(); } else mountIllustration();
      },
      destroy: function () { destroyed = true; pause(); el.innerHTML = ''; }
    };
  }

  function placeholderSvg() {
    return '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="32" cy="12" r="6"/><path d="M32 18v18M20 26h24M32 36l-9 18M32 36l9 18"/></svg>';
  }

  /* Warm the cache for every animated exercise so the library works fully offline.
     onProgress(done, total) is called after each exercise. Resolves with the number of failures. */
  function prefetchAll(exercises, onProgress) {
    var list = exercises.filter(function (ex) { return ex.anim; });
    var done = 0, failed = 0;
    function next(i) {
      if (i >= list.length) return Promise.resolve(failed);
      return Promise.all(animUrls(list[i]).map(function (u) { return fetch(u, { cache: 'force-cache' }).then(function (r) { if (!r.ok) failed++; }).catch(function () { failed++; }); }))
        .then(function () { done++; if (onProgress) onProgress(done, list.length); return next(i + 1); });
    }
    return next(0);
  }

  window.Media = { animUrls: animUrls, repdbUrl: repdbUrl, repdbUrls: repdbUrls, mount: mount, prefetchAll: prefetchAll, placeholderSvg: placeholderSvg };
})();
