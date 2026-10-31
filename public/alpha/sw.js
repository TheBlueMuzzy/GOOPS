// THE BETA'S LAST WORKER (F54, TDD D33) — served at /GOOPS/alpha/sw.js once Goops 2 lives at /GOOPS/.
// A beta player's phone still has the beta's worker (scope /GOOPS/alpha/), which opens the OLD beta from its cache.
// When that page opens, the browser checks this address for a new worker, finds this one, and it:
//   1. takes over at once (skipWaiting) and deletes the beta's caches (their names end with this scope)
//   2. sends every open beta page to /GOOPS/ (Goops 2 — the same site, so the save and rank are already there)
//   3. unregisters itself, so /GOOPS/alpha/ is plain web pages again (the forwarder, public/alpha/index.html)
// No fetch handler: everything goes to the network.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const scope = self.registration.scope
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.includes(scope)).map((key) => caches.delete(key)))
    // a page can only be sent somewhere by the worker that controls it — so take the open pages first
    await self.clients.claim()
    const pages = await self.clients.matchAll({ type: 'window' })
    const goops = new URL('../', scope).href
    await Promise.all(pages.map((page) => page.navigate(goops).catch(() => {})))
    await self.registration.unregister()
  })())
})
