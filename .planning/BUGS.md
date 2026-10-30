# Goops — Bugs
Open: 6 (P0 0 · P1 0 · P2 1 · P3 5)
## Open
### B005 · P2 · open · found 2026-10-29 in the beta audit · v0.1.0.36 · headless 390x844 + 360x780, Settings → Text size
Text size 125% and up breaks the console
Steps: 1. Settings → Accessibility → Text size 125 / 150 / 200% 2. back to the console · Expected: the console's words stay inside their spots · Actual: the footer words run together ("V0.1.0.3RANK SELECMUZZYMADE"), "Operator rank / 0 / 3,500 DUE" runs past the right edge at 200%, the monitor text spills out at 200%, the UPGRADES button covers the middle of the Settings gear (tapping its centre hits the badge; its edges still work) · How often: always at 125%+. Look at: src/ui/Console.tsx:308-310 (ArtLayer words grow with the root font size — words drawn on the art should use the art's own size, art.json words.*.text) and the bottom row (Upgrades + gear)
### B007 · P3 · open · found 2026-10-29 in the beta audit · v0.1.0.36 · headless 390x844
Gameplay tab's Goo style row squeezes its description into a thin strip
Steps: 1. Settings → Gameplay · Expected: like Wall kick, the picker under the words · Actual: Goo style's description wraps into a 6-line strip beside its picker · How often: always. Look at: the kit Settings row layout (rows with long descriptions should stack) — framework kit piece
### B004 · P3 · open · found 2026-10-27 in F64 · v0.1.0.30 · headless Chromium under check:full load
zap and twists e2e flake under full-check load
Steps: 1. npm run check:full (32 checks, 3 at a time) · Expected: zap + twists pass · Actual: zap — Particle 390 "white-hot" (293 white of 3916 px) + "droplets spray out" (0 px), Jelly 1100 "goop and beam gone" (73 px left); twists — 1440 r40 "the white goop seals a grown crack" · How often: 1 full run; both pass alone right after (twists 104 ✓, zap all ✓). Look at: checks that sample the look at a wall-clock moment instead of a game-clock one (the known lesson: zap.mjs freezeAfterBeam, white-goop's played-time wait) · 2026-10-27 (F65): twists failed every loaded run since final-shift + ending (two heavy 5-size scripts) joined check:full — not a flake: its seal wait was a 20 s cap on ~9 s of game time → 60 s cap (a condition: no cost when idle); ending.mjs got the same (and a shake watcher). Proven: ending + twists + zap side by side all pass. Zap left: it samples the look at wall-clock moments. · 2026-10-29 (check:full at 37a514b, 34 checks, 28.3 min): twists failed 1920 r40 wild goop (4 checks) under load, ALL PASS alone right after; devkit-live failed in 1 s ("no <meta name="app-version">" — the page on its port wasn't the game's build yet), all pass alone right after.
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
### B006 · P3 · fixed 2026-10-29 (UI kit 0.35.4, installed as 0.37.3 in v0.2.0) · found 2026-10-29 in the beta audit · v0.1.0.36 · headless 390x844, Text size 200%
Settings tab picker breaks words mid-word at 200%
Steps: 1. Text size 200% 2. open Settings · Expected: tab names whole · Actual: "Acces/sibilit/y" · How often: always at 200%. Look at: the kit's selector status text (overflow-wrap) — a framework kit piece → report to the framework session
