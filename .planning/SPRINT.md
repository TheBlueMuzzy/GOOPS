# Sprint 20 — every upgrade from rank 10 to 38 in the shop
Started 2026-10-26 · Milestone M5 Beta · Features: F43, F48
What changes for Muzzy: the console's Upgrades screen fills up to rank 38 — Junk Uniformer 10, Goop Swap 12, Sealing Bonus 18, Tougher Tank 22, Quick Fix 28, Slow Cracks 30, Crack Matcher 32 — and each works in real shifts. Stays the same: ranks 2–9, the four actives and their buttons, the story, ranks 0–39.

## F43 🎮 Upgrades ranks 10–38 (rank 22 = Tougher Tank, rank 28 = Quick Fix — F48)
Done when: Junk Uniformer (10), Goop Swap (12), Sealing Bonus (18), Tougher Tank (22), Slow Cracks (30) and Crack Matcher (32) are bought with scraps and change real shifts as the upgrades-map's new-loop versions; seeded, and a shift with none of them plays exactly as before (no extra rng calls when off); every number in content/tuning/upgrades.json, live in the Dev Kit; the Upgrades screen shows every card at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only); GDD §5 / TDD §2c / upgrades-map updated.
why: the middle ranks hand you a tool for each new threat (junk, split pieces, growing cracks) — the "spike, then ease" rhythm v1 had, so ranking up feels like earning relief.
Check: unit tests (each upgrade's effect; no-upgrade shifts unchanged with the same seed) · e2e/upgrades.mjs (each one measured in a real shift, level 4 vs none; cards fit at every portrait size) with shots looked at · check:full
- [x] 🤖 1. Junk Uniformer (junkSameColorChance, 0.10 a level) + Crack Matcher (crackColorBias, 0.25 a level: the next piece takes the lowest crack's colour) — one rng call only when > 0; unit tests — src/engine/shift.ts
- [x] 🤖 2. Goop Swap: the swap hold 1.5 s − 0.25 s a level (min 0.5 s), read by the input layer (swapHoldTimeMult); tests — src/input/controls.ts
- [x] 🤖 3. Sealing Bonus: each sealed crack adds extra active charge (abilityChargePerSealMult, + a level); tests — src/engine/abilities.ts
- [x] 🤖 4. Tougher Tank (22, integrityDrainMult) + Slow Cracks (30, crackEveryMult — also slows crack growth) into upgrades.json (engine ready) — content/tuning/upgrades.json
- [x] 🤖 5. Players' words for all of them (en.json upgrades.items); Upgrades screen cards fit at every portrait size; each measured in a real shift — e2e/upgrades.mjs
- [x] 🤖 6. Update GDD §5, TDD §2c, upgrades-map (ranks 10–38 decided + built) — .planning/design/upgrades-map.md
- [x] 🤖 7. (tuning) Per-level steps from v1 for now; the bots check them in F51 — content/tuning/upgrades.json

## F48 🎮 Quick Fix upgrade at rank 28 (fewer repair steps)
Done when: Quick Fix (rank 28, 2 levels) takes 1 / 2 steps off every console repair (never below 1), bought with scraps; the repair panels show the shorter repair; in upgrades.json.
why: late-game repairs stop feeling like a tax — the machines still break, you just fix them faster.
Check: unit test (repairSteps with fewer) · e2e/upgrades.mjs (a repair at level 2 takes 2 fewer steps) · check:full
- [x] 🤖 1. Quick Fix in upgrades.json at rank 28 (laser/visor/controlsRepairFewerSteps byLevel [1, 2] — the hook exists: resolveUpgrades().fewerRepairSteps → src/game/repairs.ts); test — content/tuning/upgrades.json
- [x] 🤖 2. e2e: a repair at Quick Fix 2 takes 2 fewer steps (stacks with a max machine fix, never below 1) — e2e/upgrades.mjs
- [x] 🤖 3. Players' words (en.json upgrades.items) + upgrades-map "Needs other work first" line → built at 28 — .planning/design/upgrades-map.md

## Notes
- Muzzy 2026-10-26 (planning): rank 28 = Quick Fix (F48, Claude's pick — the slot Goop Window left); Sealing Bonus = seals add extra active charge (Claude's pick — v1's code brought breakdowns back sooner, a bug).
- Claude's calls (change any): v1's ranks and level counts kept (passives 4 levels, Quick Fix 2); Crack Matcher biases the piece made for the next window (so the window shows it).
- Built by helper (2eef0f5..e44575a, merged 2026-10-26): check:fast 599 tests · e2e/upgrades.mjs 332 checks. Measured max vs none in a real shift: junk biggest colour 27% → 55% · swap hold 1.51 → 0.52 s (key + mouse) · one seal charges Cooldown Booster 0.25 → 0.40 · tank wear ×0.5 · next crack 5.9 → 9.3 s · 11/11 new pieces in the crack's colour (vs 1/8) · repairs 4/3/4 → 3/2/3 (QF1) → 2/1/2 (QF2), 1/1/1 with every machine fix maxed.
- Helper's calls: new tank.json holdToSwapMinMs 500 (the swap floor); chances (junk, crack colour) are 0 = off, resolveUpgrades = (neutral + sum) × product (TDD D24); Crack Matcher = lowest crack not yet plugged (a grown crack: its lowest cell), main colour only, wild stays wild, never lesson pieces, Colorizer wins while running; Sealing Bonus counts per sealed cell (a grown crack seals cell by cell); Quick Fix card shows a count (0 → 1 → 2); Tougher Tank card reads "−37%" at level 3 (−37.5 rounded) — a minus means less wear. Golden test: with every F43 chance off, shifts match the engine before F43 (7b8ae0b); breaking the "only roll when > 0" guard turned it red both ways.
