# Sprint 33 — Thirty ranks that feel right
Started 2026-11-03 · Milestone M6 1.0 · Features: F49, F82
What changes for Muzzy: the climb to the top is about 45–50 shifts for a Sharp player, and covering a crack with any goop buys time (half wear per covered cell). Stays the same: the upgrades, the story, the look, the ending; the Casual bot still stays near the start (Muzzy 2026-10-30: fine).

## F49 🎮 Covered cracks drain half? (bot rerun)
Done when: each crack cell with any goop on it (any colour) wears the tank at half speed, a cell with none at full speed — a half-covered crack wears 75% · the half is a Dev Kit knob (shift.json integrity.coveredDrainMult 0.5) · wear and bubbles ask the same "is it covered?" engine check · bubbles stay as built (cracks-look.json bubbles.covered 0.5, its own looks knob) · GDD says so
why: Muzzy 2026-11-02: "yes — a crack covered by goop wears the tank at half speed, and its bubbles come at half the rate too". Per cell: Muzzy 2026-11-03 (Claude's pick) — matches the bubbles, rewards partial cover.
Check: unit tests (open / covered / half-covered / wrong colour; red first) · check:fast · e2e cracks-look, final-shift, white-goop
- [ ] 🤖 1. Red test first: open cells wear fully, covered cells half, wrong colour counts as covered — tests/engine/crackBand.test.ts
- [ ] 🤖 2. The rule + the knob integrity.coveredDrainMult (typed, _help, _ranges) — src/engine/shift.ts
- [ ] 🤖 3. One shared "is this cell covered?" in the engine; the bubbles use it too — src/view/crackBubbles.ts
- [ ] 🤖 4. GDD §4 (the integrity bullet) + TDD Decisions — .planning/GDD.md

## F82 🧱 Balance on 30 ranks
Done when: a full sim:economy run shows the Sharp bot reaching the top in ~45–50 shifts (Muzzy 2026-11-03: the target is Sharp's; Focused just follows) · no rank band is a wall or a free pass: quota looked at per band, incl. two-colour pieces 15 → growing cracks 17 and the white goop 20 inside the quota ease 17–24 · the final shift: the Veteran saved about half (bots:final) · a trial SWAP of two beats stays green, or what it finds is fixed · no setting or help text still talks about 50 ranks · research/economy-sim.md has the before/after
why: Muzzy 2026-11-02: "this would help the game not feel so impossibly long". F52 — Balance pass tuned everything to 50 ranks.
Check: sim:economy full before + after · bots:final · check:fast · check:full · Muzzy plays and judges the pace
- [ ] 🤖 1. Baseline: a full sim:economy run BEFORE F49 — Covered cracks drain half? (bot rerun), numbers saved — .planning/research/economy-sim.md
- [ ] 🤖 2. A full run with F49 — Covered cracks drain half? (bot rerun) in: its effect on its own — .planning/research/economy-sim.md
- [ ] 🤖 3. Read quota per band; fix only what the numbers show (15 → 17, white goop at 20) — content/tuning/shift.json
- [ ] 🤖 4. The trial: swap two beats in the ladder, check:fast + e2e, put them back; fix what it finds (Sprint 32 retro) — content/tuning/ladder.json
- [ ] 🤖 5. Settings + help text still on 50 ranks (eyes.json minClump10 etc., quota / progression / white goop notes, career.ts loadout50) — content/tuning/eyes.json
- [ ] 🤖 6. (tuning) XP per rank → Sharp ~45–50 shifts — content/tuning/progression.json
- [ ] 🤖 7. (tuning) The final shift after half wear: the Veteran saved about half — content/tuning/finalShift.json
- [ ] 🙋 8. Muzzy plays a few shifts and judges the pace (the bots have never been compared with his real play) — content/tuning/progression.json

## Notes
- Asked of the framework at PLANNING (Sprint 31 retro): nothing new; the Ladder tab + rank lint rule stay with framework-43 (ROADMAP Parking lot).
- Open bugs: P0 0, P1 0; the 7 P3s wait unless this sprint's files touch them.
- Planning finds (helper's report, Claude read the code): bubbles.covered 0.5 is already built (src/view/crackBubbles.ts), so F49 — Covered cracks drain half? (bot rerun) adds only the wear. `crack.plugged` means matching goop on every cell, so it is NOT Muzzy's "covered". The Veteran's wear follows integrity lost, so half wear moves the final shift — task 7.
- Muzzy 2026-11-03: the sprint plan yes · covered = per cell · the 45–50 target = the Sharp bot.
