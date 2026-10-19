# Sprint 08 — Goops teaches you
Started 2026-10-19 · Milestone M4 Alpha · Features: F12, F30, F32
What changes for Muzzy: a written step-by-step plan for "your first day" to approve; then, the first time each machine (visor, laser, controls) breaks, a short guided moment walks you through what broke and how to fix it — shown once, replayable from Settings. Stays the same: the shift, rules, balance, sound and looks; the first-day tutorial itself is built next (F31, after the phone gesture fixes).
Decided at planning (Muzzy, 2026-10-19): the tutorial is **v1 style, fully scripted** (a staged day, every step set up, you can't fail, ends in free play — v1 Tutorial v3) · teach on PC first: F12 no longer waits for F10 (phone gesture wording slots in after the phone check) · the lesson runner is built in Goops now and noted for the framework session to lift into a module later (that session is busy).

## F12 ❓ Tutorial: "your first day", taught as a scripted day
- [x] 🤖 1. The step list for the new loop: v1 Tutorial v3's 15 steps rewritten for pressure → cracks → integrity → rupture (no hard drop, console start, plain how-to-play, no story voice), plus the three first-breakdown lessons; GDD tutorial section updated — .planning/research/tutorial.md, .planning/GDD.md
- [ ] 🙋 2. Read the step list: approve, or say what to change

## F30 🧱 Lesson runner
- [ ] 🤖 1. Training hooks in the engine: chosen next pieces, placed cracks, pressure held or set, cracks/breakdowns off unless a step asks — src/engine/
- [ ] 🤖 2. The runner: steps from data files, v1's patterns (pause-show-dismiss, act-to-advance, wait-then-hint, position / pressure gates), on the rules clock — src/game/lessons/, content/lessons/
- [ ] 🤖 3. The lesson look: kit message box + a pointer at a tank cell or HUD item (game-ui) — src/game/lessons/
- [ ] 🤖 4. Dev Kit: jump to / replay any step; every lesson timing live — content/lessons/, content/devkit.json
- [ ] 🤖 5. Tests + an e2e that plays a sample lesson start to finish — tests/, e2e/lessons.mjs

## F32 🎮 First-breakdown lessons (visor, laser, controls)
- [ ] 🤖 1. Visor lesson: the first visor break → what broke, go to the console, fix it — content/lessons/visor.json
- [ ] 🤖 2. Laser lesson — content/lessons/laser.json
- [ ] 🤖 3. Controls lesson — content/lessons/controls.json
- [ ] 🤖 4. Each shows once (remembered on the device), "Replay lessons" in Settings + e2e — src/game/, e2e/lessons.mjs
- [ ] 🙋 5. (tuning) Try them: wording, timing, pointers

## Notes
