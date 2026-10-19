# Sprint 09 — every promotion brings something new
Started 2026-10-19 · Milestone M4 Alpha · Features: F59, F60
What changes for Muzzy: from rank 1 a next-piece window sits top centre (where the goop comes from); the cracks count moves to the bottom beside a shorter integrity bar; swap is off until rank 3, then it trades the falling piece with the next one; the console gets an Upgrades button (grey with your scraps until rank 5, then it opens — in alpha it says the first upgrades arrive in the next update); each unlock gets a line on the end report and an interrupt lesson at the start of the first shift after it. The CRT look becomes one piece any panel can take. Stays the same: the shift, the machines, the existing lessons, the controls you already use, kick style (a Settings toggle from the start).
Decided at planning (Muzzy, 2026-10-19): rank 1 = next piece shown · rank 3 = swap unlocked · rank 5 = upgrading unlocked (scraps bank from rank 1). The held piece is gone ("basically just the 'next piece' now") → Goop Hold Viewer (22) and Goop Window (28) are retired; their slots get new upgrades in beta for the new pacing. Unlock lessons are interrupts at the start of the first shift after the unlock. HUD (Muzzy): window top centre; integrity shorter with cracks to its right → 3 machine bars over 2 bars. Alpha has no upgrades — fine, beta comes soon and upgrades are key there.

## F59 🎮 Rank unlocks (window 1 · swap 3 · upgrades 5)
Check: unit tests for swap-with-next and the unlock rule · e2e/unlocks.mjs at ranks 0/1/3/5 (window shows from 1, swap only from 3, Upgrades button opens at 5, each unlock lesson fires once) · shots at 390x844, 360x780, 1440x900 looked at · Muzzy plays ?rank=0 → 5 on PC and phone
- [x] 🤖 1. Unlock ranks in content + one "what's unlocked at this rank" rule the HUD, input and console all ask — content/tuning/progression.json, src/progress/progression.ts
- [x] 🤖 2. Swap trades the falling piece with the next one (it appears where the falling one was; the old one goes back to the window); no held piece, no hold filled at shift start; tests — src/engine/shift.ts, tests/
- [x] 🤖 3. Swap off before its rank: Right Shift, R and the phone hold do nothing (no hold-progress ring); the first-day plan keeps swap off in free play — src/input/controls.ts, src/ui/App.tsx, .planning/research/tutorial.md
- [x] 🤖 4. HUD: next-piece window top centre (from rank 1, place + size in content); cracks moves to the bottom beside a shorter integrity bar → 3 machine bars over integrity + cracks — src/ui/App.tsx, content/tuning/hud.json
- [x] 🤖 5. Upgrades button at the console: grey with the scraps count until rank 5, then opens a screen with scraps and "The first upgrades arrive in the next update" — src/ui/Console.tsx, content/text/en.json
- [ ] 🤖 6. Unlock moments: a line on the end report's rank-up + an interrupt lesson at the start of the first shift after each unlock (window, swap), the pink outline on the Upgrades button at the console; once per device, Replay lessons covers them — content/lessons/, src/game/lessons/
- [ ] 🤖 7. Docs: GDD §4 (swap = trade with next, controls table note, unlock table), upgrades-map (Hold Viewer + Window retired → 2 slots to refill), TDD data files — .planning/GDD.md, .planning/design/upgrades-map.md, .planning/TDD.md
- [ ] 🤖 8. Prove it: e2e for ranks 0 / 1 / 3 / 5 (what shows, swap on/off, lessons fire once) + shots at 390x844, 360x780 and desktop windows; add to check:full — e2e/unlocks.mjs, scripts/check-all.mjs

## F60 🧱 Screen look, reusable
Check: monitor shots before/after match · switching presets in the Dev Kit changes the look live · the second use (next-piece window) takes a few lines · check:full green
- [ ] 🤖 9. Pull the CRT look (glow, scan lines, typing + block cursor, wobble) out of the monitor into one reusable piece — src/game/crt.ts, src/game/crt.css
- [ ] 🤖 10. Applying it = one wrapper or class with a preset name; the monitor uses it, looks unchanged (shot before/after) — src/ui/Console.tsx
- [ ] 🤖 11. Presets in content (green DOS = today's look, plus amber and off), each live in the Dev Kit — content/tuning/crt.json
- [ ] 🤖 12. Prove it's quick: put it on the next-piece window's frame (or where Muzzy picks) in a few lines; note it for the framework session as a kit effect — src/ui/App.tsx, .planning/STATE.md

## Notes
- Muzzy, 2026-10-19: "render shaders" (reusable looks) are a component category to get better at. F60 is the first step: its findings go in .planning/research/looks-module.md (the look = surface × engine × layers × when × clock), like lesson-module.md. While doing F60, give the CRT's scan-line knobs the same names as the x-ray box's (three scan-line versions exist today).
- Tech calls (Claude): unlock ranks live in progression.json (`unlocks: { nextPiece: 1, swap: 3, upgrades: 5 }`) and one function answers "is X unlocked at rank N" — no rank numbers in UI code. `?rank=` keeps working as before. Swap stays a 1.5 s hold (tank.holdToSwapMs; the Goop Swap upgrade still shortens it in beta). Swapping back and forth is allowed (it's just choosing between two pieces). Lesson shifts keep swap off.
