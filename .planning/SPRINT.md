# Sprint 01 — play one full shift with living goo
Started 2026-10-17 (overnight auto) · Milestone M1 Core shift · Features: F13, F14, F15, F16 (in this order)

## F13 ⚙️ Shift engine
Done when: the v1 shift rules run in a pure, seeded engine with tests (tank wrap, pieces, lock feel, merge, fill, pop, pressure, cracks, score, shift end).
- [x] 🤖 1. Branch `dev/m1-core-shift`, clear v1 code (it lives on `archive/goops-v1`), scaffold Vite + React + TS + Vitest + Playwright — package.json, src/
- [x] 🤖 2. Port the v1 rules into `src/engine/` with v1 values in `content/tuning/shift.json`
- [x] 🤖 3. Unit tests (ported from v1 `tests/` where the rule is the same) — tests/engine/
Check: `npm run test` green; a seeded shift plays to its end in a test. ✓ 100 tests (helper, commit 8eb694d)
Ask Muzzy: see STATE "Questions for Muzzy".   Notes: hard drop added (v1 had none in play); rows are whole numbers (v1 moved in fractions); loose goop lands instantly with a `fall` event.

## F14 🎮 Tank view + controls
Done when: on PC and phone you can spin the tank, rotate, fast-drop, and pop ready blobs, with v1's controls.
- [x] 🤖 1. Tank view: 12 visible columns of 30 around the spin, grid, pressure water, cracks, ghost, fill progress — src/view/
- [x] 🤖 2. Input: drag = spin, tap halves = rotate, drag down = fast drop, tap ready blob = pop; keys — src/input/
Check: Playwright drives a shift on 390×844 and 1280×800; screenshots.

## F15 🫠 Goo overlay: Jelly + Particle
Done when: the goo from the lab sits on the real tank (spinning sloshes it), and Settings switches Jelly ↔ Particle live.
- [ ] 🤖 1. Overlay interface + Jelly renderer from lab-L4-jelly.html — src/goo/jelly/
- [ ] 🤖 2. Particle renderer from lab-L3-particles.html — src/goo/particle/
- [ ] 🤖 3. Muzzy's picks as defaults — content/tuning/goo-*.json
Check: 60 fps full tank both styles (headless GPU); screenshots of each; switching mid-shift keeps the game state.

## F16 🧪 Shift screens
Done when: start a shift from a console-lite screen, see pressure/score/cracks while playing, get an end-of-shift report, open Settings.
- [x] 🤖 1. HUD (pressure, score, cracks) + end-of-shift report — src/ui/
- [x] 🤖 2. Console-lite start (placeholder for the real console) + Settings (goo style) — src/ui/
- [x] 🤖 3. Playwright smoke: start → play → end — e2e/
Check: full flow on phone + desktop sizes.
