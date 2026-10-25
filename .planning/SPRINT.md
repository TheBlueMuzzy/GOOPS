# Sprint 18 — the goop starts acting up: rank twists at 20, 30, 40
Started 2026-10-25 · Milestone M5 Beta · Features: F39
What changes for Muzzy: from rank 20 some pieces fall in two colours (they lock as two clumps); from 30 cracks grow into the cells next to them — a grown crack is sealed only when every cell is covered, then counts as its size toward the quota; from 40 some pieces are wild goop that seals any crack, with a look picked in a sketch (rainbow wave · oil-slick sheen · pearl glow). Stays the same: ranks 0–19, story moments, upgrades, the console. F42 (active abilities) is next sprint (same engine file).

## F39 🎮 Rank twists as v1: two-colour pieces (20), growing cracks (30), wild goop (40) — sketch first for the wild look
Done when: the wild goop's look is picked in a sketch (Muzzy tunes it); from rank 20 a share of pieces split into two even, connected colour halves that lock as two clumps; from rank 30 cracks grow into neighbouring cells (goop covering a cell stops it), a grown crack is ONE crack sealed only when all its cells are covered by its colour and then counts as its cell count toward the quota (Muzzy 2026-10-25), open cracks drain per cell, the white goop seals a grown crack whole in sealTime × its size; from rank 40 a share of pieces are wild goop: seals any crack, a normal piece landing next to a wild clump turns that whole clump its colour; faces work on wild and two-colour clumps; every chance and timing in content/tuning/twists.json, live in the Dev Kit, seeded so tests repeat; GDD updated; screenshots at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: the tank should feel more alive the longer you work there — the goop holding hands (20), waking up (30), then helping you (40) — each a new skill to read, with a story reason Management lies about.
Check: unit tests (split, growth, multi-cell seal + quota count, wild seal + takeover) · e2e/twists.mjs with shots looked at · check:full
- [x] 🤖 1. Wild-goop look sketch: 3 looks on a real-feeling tank (v1 rainbow wave · oil-slick sheen · pearl glow), knobs + presets + Copy values — .planning/research/sketches/wild-goop.html
- [ ] 🙋 2. Pick and tune the wild look in the sketch, press Copy values — .planning/research/sketches/wild-goop.html
- [ ] 🤖 3. Two-colour pieces from 20: even connected halves, per-cell colours through lock, two clumps; numbers in content/tuning/twists.json; unit tests — src/engine/pieces.ts
- [ ] 🤖 4. Growing cracks from 30: one crack over many cells, sealed only when every cell is covered, counts its size toward the quota, drains per cell; the white goop seals it whole in sealTime × size; unit tests — src/engine/cracks.ts
- [ ] 🤖 5. Wild goop from 40: seals any crack, a normal piece landing next to it takes the whole wild clump; unit tests — src/engine/shift.ts
- [ ] 🤖 6. Looks: two-colour pieces glow as they fall, wild goop in Muzzy's picked look (Jelly + Particle), grown cracks' bubbles/x-ray, faces on wild + two-colour clumps — src/goo/shared/palette.ts
- [ ] 🤖 7. e2e: each twist at 20 / 30 / 40 with shots at every portrait size, in check:full — e2e/twists.mjs
- [ ] 🤖 8. Update GDD rank twists (+ upgrades-map: Slow Cracks slows growth) — .planning/GDD.md

## Notes
- Muzzy 2026-10-25: a grown crack is harder to seal (cover the whole crack), so sealing it counts its cell count toward the quota. Claude's calls with it: open cracks drain per cell (a growing crack gets more urgent); the white goop seals a grown crack whole in sealTime × its size.
- Muzzy 2026-10-25: wild look — v1 cycled every goop colour (0.4 s each, a rainbow wave across the screen; on phones whole clumps flashed one colour), which made wild goop look exactly like a real colour for moments. Claude's pick: a sheen that's never a real goop colour (and not white — that's the Veteran). Sketch with 3 looks first. "go auto".
- Starting numbers from v1 (research/v1/PRD.md): split 25% from 20, wild 15% from 40, a crack cell rolls to grow every 5–10 s, chance (10% + pressure) × 0.5 if a leaf × max(0.1, 1 − 0.25 × hops from the root). Corrupt pieces are never split or wild; wild is never split.
- Auto run: the sketch is built first and published; the rules (tasks 3–5) go ahead in a helper with the oil-slick sheen as the stand-in look, live-tunable, and switch to Muzzy's pick when he copies values.
