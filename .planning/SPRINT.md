# Sprint 27 — Goops 2 ready to take over the main address
Started 2026-10-31 · Milestone M6 1.0 · Features: F54
What changes for Muzzy: nothing live yet — the switch itself happens at the 1.0 /deliver, with Muzzy (his note, 2026-10-26: once it sits at /GOOPS/, every update reaches v1 players). This sprint builds it and proves it on a copy laid out like the real site: Goops 2 at /GOOPS/, its offline install taking over from v1's, /GOOPS/alpha/ forwarding installed beta players there with their progress, v1 retired. Stays the same: the beta at /GOOPS/alpha/ keeps working until the switch.

## F54 🧱 Offline install + replace v1 at the live address
Done when: a build for /GOOPS/ (web path, manifest id / scope / start_url, its offline worker at /GOOPS/sw.js) · a v1 player opening /GOOPS/ gets Goops 2 (v1's worker and caches retired; no reload loop; v1's saves ignored — a fresh start, never a crash) · /GOOPS/alpha/ forwards to /GOOPS/ (an installed beta app opens Goops 2; the beta save — same site — keeps its rank) · v1 retired from the site fully (no /v1/ copy) · offline works at /GOOPS/ · deploy.js publishes to the root in one step with a --dry-run that lists exactly what changes on gh-pages (read only) — the real deploy waits for /deliver with Muzzy · TDD decision.
why: 1.0 = Goops 2 replaces v1 at the old address (M6 goal) — players keep one link.
Check: e2e/sw-update.mjs on a static copy laid out like gh-pages (v1 stand-in at the root + the beta at alpha/ → the new layout): v1 player → Goops 2, offline; installed beta → forwarded, rank kept; no reload loop; page errors watched · deploy --dry-run output read · check:full
Checked:
- [ ] 🤖 1. Spike (read only): what v1 leaves on players' devices (its worker file + scope, cache names, localStorage keys — any clash with Goops 2's?) and what's on gh-pages now; write the findings into Notes — scripts/deploy.js
- [ ] 🤖 2. Build for /GOOPS/: vite base, manifest id / scope / start_url, the offline worker at /GOOPS/sw.js taking over from v1's (v1's caches cleared, v1's saves ignored) — vite.config.ts
- [ ] 🤖 3. /GOOPS/alpha/ becomes a forwarding page + a worker that hands installed beta players to /GOOPS/ (their save is the same site's, so their rank stays) — public/manifest.json
- [ ] 🤖 4. deploy.js: publish to the root, retire v1's files and alpha/'s old build (keep only the forwarder there), --dry-run lists every change — scripts/deploy.js
- [ ] 🤖 5. e2e/sw-update.mjs: the v1 player, the installed beta player and offline on a copy laid out like gh-pages; no reload loop; page errors watched — e2e/sw-update.mjs
- [ ] 🤖 6. TDD decision (next free D number) + the live address in docs (README, STATE Key facts after the switch, GDD if it names /alpha/) — .planning/TDD.md

## Notes
- Muzzy 2026-10-31 (planning): v1 at /GOOPS/v1/? — "no" (retire it fully) · v1 players start Goops 2 fresh — "yes".
- NEVER push to gh-pages in this sprint: deploy.js runs only with --dry-run; the switch is /deliver's, with Muzzy.
- Open bugs: B003 (P3, sw-update's first-visit update can time out under check:full load) is in e2e/sw-update.mjs, which this sprint changes — fix it if the cause shows up. No open P0/P1.
- Task 1 spike (read only — origin/gh-pages @ c5a3187 "Deploy alpha v0.2.0.0", 2026-10-29; v1 code from archive/goops-v1):
  - **v1's worker:** /GOOPS/sw.js, registered by v1's index.html as `./sw.js` on load (+ `reg.update()` every load) → scope /GOOPS/. Hand-written: skipWaiting on install; on activate deletes EVERY cache but its own, then clients.claim; fetch = network first, caches every same-origin GET, offline → cache.
  - **v1's cache:** one cache named `goops-<timestamp>` (live: `goops-1772344620277`). Goops 2's caches are workbox's (`workbox-precache-v2-<scope>`) → no clash; the new worker deletes `/^goops-\d+$/` by name.
  - **v1's saves:** localStorage `gooptris_save_v3` (+ the older `gooptris_save_v2`, migrated away by v1 itself); its settings live inside that save. Nothing else (no sessionStorage / IndexedDB outside v1's prototypes). Goops 2's keys: `goops-progress`, `goops-first-day`, `goops-fps`, `kit-settings:GOOPS`, `kit-tips:GOOPS`, `kit-whats-new:GOOPS`, Dev Kit `devkit*` → **no clash**: Goops 2 never reads v1's keys, so a v1 player starts fresh with nothing to handle (v1's keys are left alone, untouched).
  - **Beta save = same keys at /GOOPS/:** localStorage is per origin (thebluemuzzy.github.io), and the kit's keys use only the FIRST folder (`kit-settings:GOOPS` at both /GOOPS/alpha/ and /GOOPS/) → rank, settings, tips and the first day all carry over as they are.
  - **v1's manifest** has no `id` → its id is its start_url = /GOOPS/. Goops 2's manifest id /GOOPS/ = the same app to the browser: an installed v1 app should become Goops 2 (Chrome refreshes name/icons on its own schedule).
  - **The same file name would trip main.tsx's rule:** v1's worker is /GOOPS/sw.js, so a v1 player's page would look like it "already ran under our worker" and reload once on its first visit. → Goops 2's worker gets a NEW name at /GOOPS/ (task 2 decides it); registering a new script for the same scope replaces v1's registration, and /GOOPS/sw.js simply goes away (404).
  - **gh-pages root now (v1, 13 files):** .gitignore, index.html, index.css, manifest.json, sw.js, assets/index-8b6746b3.js, assets/index-903cfe14.css, fonts/AmazonEmber.ttf, fonts/AmazonEmber-Bold.ttf, fonts/FromWhereYouAre.ttf, icons/apple-touch-icon.png, icons/icon-192.png, icons/icon-512.png. **alpha/ now: 99 files** (the v0.2.0.0 build + chunks kept by `--add`: art, audio, fonts, icons, assets, index.html, manifest.json, sw.js, workbox-*.js).
  - **v1 already wipes others' caches:** its activate deletes every cache but its own — harmless now (v1 never updates again), noted so nobody is surprised.
