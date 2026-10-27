# Goops — Bugs
Open: 4 (P0 0 · P1 0 · P2 0 · P3 4)
## Open
### B004 · P3 · open · found 2026-10-27 in F64 · v0.1.0.30 · headless Chromium under check:full load
zap and twists e2e flake under full-check load
Steps: 1. npm run check:full (32 checks, 3 at a time) · Expected: zap + twists pass · Actual: zap — Particle 390 "white-hot" (293 white of 3916 px) + "droplets spray out" (0 px), Jelly 1100 "goop and beam gone" (73 px left); twists — 1440 r40 "the white goop seals a grown crack" · How often: 1 full run; both pass alone right after (twists 104 ✓, zap all ✓). Look at: checks that sample the look at a wall-clock moment instead of a game-clock one (the known lesson: zap.mjs freezeAfterBeam, white-goop's played-time wait) · 2026-10-27 (F65): twists failed every loaded run since final-shift + ending (two heavy 5-size scripts) joined check:full — not a flake: its seal wait was a 20 s cap on ~9 s of game time → 60 s cap (a condition: no cost when idle); ending.mjs got the same (and a shake watcher). Proven: ending + twists + zap side by side all pass. Zap left: it samples the look at wall-clock moments.
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
