# Sprint 10 — phone controls you can trust, then "your first day"
Started 2026-10-20 · Milestone M4 Alpha · Features: F10, F28, F31
What changes for Muzzy: after his phone session, the phone touches follow his calls (two thumbs, tapping goop that isn't ready) and every touch number becomes a live Dev Kit knob; a fresh save (rank 0) plays the guided first day and finishes at rank 1. Stays the same: keyboard + mouse controls, the HUD, the machines, the rank unlocks, the breakdown lessons (they only gain their phone wording).

## F10 ❓ Phone gestures without conflicts
Check: Muzzy's 14-line phone session done and written up · his calls on C-1 (two thumbs) and C-2 (tap on goop vs rotate) in GDD §4
- [ ] 🤖 1. Refresh the phone checklist for today's game (C-10 already fixed by F58; swap = trade with the next piece from rank 3; the HUD's top-right is pause; play link at ?rank=3), then write the session results + Muzzy's calls into GDD §4 and gestures.md — .planning/research/gestures.md
- [ ] 🙋 2. The 10-minute phone session (14 lines, note any that misbehave), then decide two thumbs (C-1) and tap on goop that isn't ready (C-2) — .planning/research/gestures.md

## F28 🎮 Gesture fixes
Check: e2e/gestures.mjs with real fingers (touch events) covers every tank gesture + the fixed collisions, in check:full · touch knobs live in the Dev Kit · Muzzy re-checks the lines that failed on his phone
- [x] 🤖 3. Touch numbers out of code into content (drag lock, dead zone, flick time + distance, quick-flick drop), in rem so they feel the same on every phone; live in the Dev Kit — src/input/controls.ts, content/tuning/tank.json
- [x] 🤖 4. Cheap clear fixes: a flick only counts when the drag was locked up/down (C-6, C-8) + whatever the session turns up — src/input/controls.ts
- [ ] 🤖 5. Muzzy's calls on two thumbs (C-1) and tap on goop vs rotate (C-2) — src/input/controls.ts, src/game/ShiftStage.tsx
- [x] 🤖 6. Finger e2e for every tank gesture (tap halves, drag spin, drag down, flicks, hold-to-swap, slow press, diagonal lock, second finger); add to check:full — e2e/gestures.mjs, scripts/check-all.mjs
- [ ] 🤖 7. Phone wording into every lesson's Phone slot (breakdown + unlock lessons) — content/lessons/
- [ ] 🤖 8. (tuning) tap / hold timings from the session notes (holdDelayMs, holdToSwapMs, thresholds) — content/tuning/tank.json

## F31 🎮 Your first day
Check: e2e/first-day.mjs plays the whole day A1→F3 (keys + finger) and lands at rank 1 · leaving mid-day restarts the phase · Replay lessons replays it · shots at 390x844, 360x780, 1440x900 · Muzzy plays it
- [x] 🤖 9. Spike: check the lesson runner against tutorial.md §6 (the "must be able to do" list) and build what's missing — src/game/lessons/goopsLessons.ts, src/engine/training.ts
- [ ] 🤖 10. The 15 steps as data (phases A–F), Keys / Mouse / Phone wordings — content/lessons/first-day.json, content/text/en.json
- [ ] 🤖 11. Wire it: rank 0 starts the day, leaving mid-day restarts the phase, finishing → rank 1 (never on a replay), Replay lessons covers it — src/ui/App.tsx, src/game/lessons/
- [ ] 🤖 12. Prove it: the whole day end to end + shots; add to check:full — e2e/first-day.mjs, scripts/check-all.mjs
- [ ] 🤖 13. Update GDD (first day) + tutorial.md (built status) + lesson-module.md (findings) — .planning/research/tutorial.md
- [ ] 🙋 14. Play the first day (PC, then phone) — .planning/research/tutorial.md

## Notes
- Tech calls (Claude, 2026-10-20): touch numbers go in tank.json next to holdDelayMs / holdToSwapMs; distances in rem (screen pixels feel different on small vs big / dense phones). No open P0/P1 bugs.
- F28 tasks 3–4 (Claude, 2026-10-20): new tank.json knobs dragLockRem 0.625 · dragDeadZoneRem 1.25 · flickMs 300 · flickRem 3.125 · flickDropMs 150 (= the old 10 px / 20 px / 300 ms / 50 px / 150 ms at 16 px) with _help; the root font size is read once per press (a Dev Kit edit counts from the next touch). C-6: a flick needs the drag locked up/down. C-8: a flick up needs the finger never to have gone more than one drag lock below its start — my call: a strict "never below" would let a 1-px thumb wobble eat real flicks. The console-only path (a lesson waiting on the console) follows the same rules. Task 4's "+ whatever the session turns up" still waits on Muzzy's phone session. No content/devkit/select.json exists in Goops yet, so there was no knob-placement test to update.
- F31 task 9 spike (Claude, 2026-10-20): tutorial.md §9 has the table. Built: piece fallback rule (`then`, decided as each piece comes in), `freeCrack` in view / just out of view, `overflowRail` event; runner `if`, hint `from`/`unless`/`again`, interrupt `from`/`to`, step `ensure`; colour gates + `{ crack }`/`{ goop }` pointers + `bar-integrity` in a new pure `goopsGates.ts`; "play" now runs before "rules" (D14). Surprises: normal play used to wipe the rails (F1 couldn't be written); hints were never cancelled by doing the thing; App hides the game's own "Above the pressure line" / "Still filling" while ANY lesson message is up, and C1 / C3 rely on them → no-message step or a reaction (task 10). Left for task 11 (all App): console/pause per step, A1 → B1 across the periscope (`startAtConsole` then `lessonPlay.start(id, "B1")`), report screen event + tag, CRACKS tag, rank 0 → 1, saving the checkpoint. A worktree has no node_modules/vite: the e2e scripts need a junction to the main checkout's.
- F28 task 6 (Claude, 2026-10-20): `e2e/gestures.mjs` (port 5391, in check:full): 36 finger checks, ~42 s, green 3 runs in a row. C-1 / C-2 / C-3 are one block each marked "Muzzy's call pending — F28 task 5" (they assert today's behaviour; flip them after his calls). Every gesture behaved as gestures.md §1a says (only stale bit: T8 still says "swaps with the held one", it's the next piece now). Surprises, all test-side: each CDP touch event waits for a frame (100–150 ms headless, ~30–60 ms with the GPU flags repairs.mjs uses), so awaiting each step made a 4-step flick 230–600 ms, past flickMs — the script fires a swipe's steps without awaiting each (CDP keeps the order). CDP multi-touch: a `touchEnd` lifts the fingers it LISTS (a touchMove leaving one out does not lift it). The "first tap after a drag loses its click" pitfall never showed — the game listens to pointer events, not clicks.
- Retro change from Sprint 09: helper briefs name the next free TDD decision number (next free: D14); a HUD change gets a quick mock-up or a 30-second play before it's built.
