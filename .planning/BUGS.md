# Goops — Bugs
Open: 3 (P0 0 · P1 0 · P2 0 · P3 3)
## Open
### B003 · P3 · open · found 2026-10-20 in F38 · v0.0.0.3 · headless Chromium under check:full load
A returning player's update can wait a visit on a busy device
Steps: 1. e2e/sw-update.mjs inside check:full (22 checks at once) · Expected: the new worker takes over on the first visit (skipWaiting + clientsClaim are in the built sw.js, inside workbox's async loader) · Actual: once in 3 full runs it was still "waiting installed" after 20.5 s, so the page stayed on the old version (the bug-file check then saw the old version too) · How often: 1 of 3 full runs; 5 of 5 alone (again 2026-10-23 at 4a2adbd: failed in check:full, then 2 of 2 alone — sw code untouched since F38). Worst case for a player: the update arrives one visit later. Look at: skipWaiting called inside the loader's callback vs at the top of sw.js (vite-plugin-pwa `workbox.inlineWorkboxRuntime` / injectManifest)
### B001 · P3 · open · found 2026-10-20 in F31 · v0.0.0.0 · headless 390x844
Lesson outline crowds the screen edge
Steps: 1. 390x844 phone size 2. a lesson that outlines the next-piece window · Expected: room round the outline (breathing room) · Actual: the outline sits ~2 px from the screen edge, and the LASER bar's outline almost touches the CONTROLS label · How often: always at 390 (logged by a Sprint 10 helper, not re-shot since)
### B002 · P3 · open · found 2026-10-20 in F31 · v0.0.0.0 · all
Swap unlock lesson lines run long
Steps: 1. reach rank 3 2. the swap unlock lesson · Expected: about 15 words like the other lines · Actual: keys 15, phone 18, mouse 22 words · How often: always — a wording call for Muzzy (he'll rewrite the script later)
## Fixed (newest first)
