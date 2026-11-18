/* Service worker: the app shell is precached so everything works offline; exercise media is cached as it is viewed.
   Strategy:
     - shell (html, css, js, data, icons): stale-while-revalidate - serve from cache instantly, refresh in the background;
     - media (assets/anim/* frames and the RepDB illustrations on cdn.jsdelivr.net): cache-first, kept in a separate
       cache that survives shell updates, so "Download all animations" in Settings only ever has to run once.
   Bump CACHE whenever js/, styles.css or index.html changes, or installed apps keep the old files. */
var CACHE = 'bmum-shell-v1';
var MEDIA = 'bmum-media-v1';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/data/taxonomy.js',
  './js/data/media.js',
  './js/data/exercises-1.js',
  './js/data/exercises-2.js',
  './js/data/exercises-3.js',
  './js/data/exercises-4.js',
  './js/data/exercises.js',
  './js/data/programs.js',
  './js/data/wods.js',
  './js/data/ladders.js',
  './js/data/cardio.js',
  './js/data/champions.js',
  './js/storage.js',
  './js/media.js',
  './js/engine.js',
  './js/app.js',
  './js/app-workout.js',
  './js/app-library.js',
  './js/app-plans.js',
  './js/app-progress.js',
  './js/app-coach.js',
  './js/app-settings.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k !== MEDIA) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isMedia(url) {
  return url.indexOf('/assets/anim/') >= 0 || url.indexOf('cdn.jsdelivr.net/gh/RepDB/') >= 0;
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = e.request.url;
  if (isMedia(url)) {
    e.respondWith(
      caches.open(MEDIA).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          if (cached) return cached;
          return fetch(e.request).then(function (resp) {
            if (resp && (resp.ok || resp.type === 'opaque')) cache.put(e.request, resp.clone());
            return resp;
          });
        });
      })
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request, { ignoreSearch: true }).then(function (cached) {
        var network = fetch(e.request).then(function (resp) {
          if (resp && resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(function () { return cached; });
        return cached || network;
      });
    })
  );
});
