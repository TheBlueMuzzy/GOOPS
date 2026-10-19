# Sprint 08 — Goops teaches you
Started 2026-10-19 · Milestone M4 Alpha · Features: F12, F30, F32
What changes for Muzzy: a written step-by-step plan for "your first day" to approve; then, the first time each machine (visor, laser, controls) breaks, a short guided moment walks you through what broke and how to fix it — shown once, replayable from Settings. Stays the same: the shift, rules, balance, sound and looks; the first-day tutorial itself is built next (F31, after the phone gesture fixes).
Decided at planning (Muzzy, 2026-10-19): the tutorial is **v1 style, fully scripted** (a staged day, every step set up, you can't fail, ends in free play — v1 Tutorial v3) · teach on PC first: F12 no longer waits for F10 (phone gesture wording slots in after the phone check) · the lesson runner is built in Goops now and noted for the framework session to lift into a module later (that session is busy).

## F12 ❓ Tutorial: "your first day", taught as a scripted day
- [x] 🤖 1. The step list for the new loop: v1 Tutorial v3's 15 steps rewritten for pressure → cracks → integrity → rupture (no hard drop, console start, plain how-to-play, no story voice), plus the three first-breakdown lessons; GDD tutorial section updated — .planning/research/tutorial.md, .planning/GDD.md
- [x] 🙋 2. Read the step list: approve, or say what to change — answered 2026-10-19 (research/tutorial.md §8: real rupture ending; swap locked behind a rank → F59; progressive breakdown lessons; tank frozen for the first repair; console-visit note ×5)

## F30 🧱 Lesson runner
- [x] 🤖 1. Training hooks in the engine: chosen next pieces, placed cracks, pressure held or set, cracks/breakdowns off unless a step asks — src/engine/
- [x] 🤖 2. The runner: steps from data files, v1's patterns (pause-show-dismiss, act-to-advance, wait-then-hint, position / pressure gates), on the rules clock — src/game/lessons/, content/lessons/
- [x] 🤖 3. The lesson look: kit message box + a pointer at a tank cell or HUD item (game-ui) — src/game/lessons/
- [x] 🤖 4. Dev Kit: jump to / replay any step; every lesson timing live — content/lessons/, content/devkit.json
- [x] 🤖 5. Tests + an e2e that plays a sample lesson start to finish — tests/, e2e/lessons.mjs

## F32 🎮 First-breakdown lessons (visor, laser, controls)
- [x] 🤖 1. Visor lesson: the first visor break → what broke, go to the console, fix it — content/lessons/visor.json
- [x] 🤖 2. Laser lesson — content/lessons/laser.json
- [x] 🤖 3. Controls lesson — content/lessons/controls.json
- [x] 🤖 4. Each shows once (remembered on the device), "Replay lessons" in Settings + e2e — src/game/, e2e/lessons.mjs
- [x] 🤖 6. Console visits: W / ↑ / flick up go straight to the console; the first 5 mid-shift visits say the tank runs at 25% there; the very first breakdown lesson says the game is fully paused for it (Muzzy) — src/game/, content/text/en.json
- [ ] 🙋 5. (tuning) Try them: wording, timing, pointers

## Notes
- F30 (helper, 2026-10-19): engine training mode (src/engine/training.ts, `createShift({ training })` + `engine.train(...)`), a Goops-free step machine (src/game/lessons/runner.ts, patterns.ts, lessonTypes.ts) + Goops adapter (goopsLessons.ts, LessonView.tsx on the kit Callout), Dev Kit Lessons tab, `?lesson=<id>&step=<n>`, shared timings content/tuning/lessons.json, sample lesson content/lessons/sample.json. Tutorial §6 checklist: most done; stubbed = remember on device, screen events (only shiftStarted), checkpoints; not done = queue refill rule, zap filter by group, freeze the tank at the console, Replay lessons (F32), finishing day one (F31), pointers at console parts.
- F32 (helper, 2026-10-19): built — the three lessons + console note as data (content/lessons/), src/game/lessons/firstBreakdowns.ts (when they start), runner pieces (TDD §2b Lessons → F32), console tags in src/ui/RepairPanels.tsx / Console.tsx, Replay lessons row. e2e/lessons.mjs plays a REAL visor break at rank 2 through by real input (incl. the repair), checks once-per-device, Replay, leaving before the repair, the 5 console notes, full-speed play after; screenshots of each lesson's V1 + console steps at 1440x900 / 390x844 in e2e-shots/lessons/f32-*. Calls for Muzzy to review: step 4 split into "Fixed! …prevent it" (Got it) + "Pull the periscope down to go back" (points at the periscope); mouse wording for "go to the console" is "Flick up for the console." (per the table; W works too); the console note has a Got it and closes itself after ~6 s (on a phone it can sit over the periscope); it's skipped on a phone on its side (no free room); a queued lesson whose machine was already fixed skips to "Fixed!"; the Dev Kit's ▶ on a breakdown lesson still starts a training shift (nothing broken) — use `__goops.breakMachine('<machine>', true)` in a real shift instead.
- Look nits (screenshots): on a phone the bubble pointing at floor goop covers the "0% PSI" readout; the welcome ring round the spawning piece overlaps "CRACKS". The kit Callout has no "keep clear of" list → ask the framework session (Callout avoid boxes); log, not fixing in-game.
- F32 review (low, 8a8ab85..06a707f): one fix — a lesson running when the tank ruptured froze the rupture drain at the console; now the rupture drops the lesson (unseen → plays at the next break) + e2e check. Design calls for Muzzy (helper): step 4 split into "Fixed! how to prevent" + "pull the periscope down"; mouse players get "Flick up for the console"; console note has Got it + closes itself after ~6 s, skipped on a phone on its side; Dev Kit ▶ on a breakdown lesson starts a training shift with nothing broken (use `__goops.breakMachine('visor', true)` in a real shift); Replay lessons also resets the console-note count. Nit: on desktop V1 covers the PSI readout (same Callout "keep clear of" ask).
