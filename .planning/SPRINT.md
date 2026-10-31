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
