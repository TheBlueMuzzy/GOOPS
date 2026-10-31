// RETIRE v1's OFFLINE CACHE (F54, TDD D33) — loaded by Goops 2's own worker (/GOOPS/goops-sw.js, vite.config.ts
// workbox.importScripts). v1's worker kept one cache named "goops-<timestamp>"; when ours takes over the /GOOPS/
// scope, that cache is dead weight on the player's phone, so it goes. Only that name: Goops 2's caches are
// workbox's ("workbox-precache-v2-…") and are never touched here.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => /^goops-\d+$/.test(key)).map((key) => caches.delete(key)))),
  )
})
