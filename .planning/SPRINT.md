# Sprint 33 — Thirty ranks that feel right
Started 2026-11-03 · Milestone M6 1.0 · Features: F49, F82
What changes for Muzzy: the climb to the top is about 45–50 shifts for a Sharp player, and covering a crack with any goop buys time (half wear per covered cell). Stays the same: the upgrades, the story, the look, the ending; the Casual bot still stays near the start (Muzzy 2026-10-30: fine).

## F49 🎮 Covered cracks drain half? (bot rerun)
Done when: each crack cell with any goop on it (any colour) wears the tank at half speed, a cell with none at full speed — a half-covered crack wears 75% · the half is a Dev Kit knob (shift.json integrity.coveredDrainMult 0.5) · wear and bubbles ask the same "is it covered?" engine check · bubbles stay as built (cracks-look.json bubbles.covered 0.5, its own looks knob) · GDD says so
why: Muzzy 2026-11-02: "yes — a crack covered by goop wears the tank at half speed, and its bubbles come at half the rate too". Per cell: Muzzy 2026-11-03 (Claude's pick) — matches the bubbles, rewards partial cover.
Check: unit tests (open / covered / half-covered / wrong colour; red first) · check:fast · e2e cracks-look, final-shift, white-goop
- [x] 🤖 1. Red test first: open cells wear fully, covered cells half, wrong colour counts as covered — tests/engine/crackBand.test.ts
- [x] 🤖 2. The rule + the knob integrity.coveredDrainMult (typed, _help, _ranges) — src/engine/shift.ts
- [x] 🤖 3. One shared "is this cell covered?" in the engine; the bubbles use it too — src/view/crackBubbles.ts
- [x] 🤖 4. GDD §4 (the integrity bullet) + TDD Decisions — .planning/GDD.md

## F82 🧱 Balance on 30 ranks
Done when: a full sim:economy run shows the Sharp bot reaching the top in ~45–50 shifts (Muzzy 2026-11-03: the target is Sharp's; Focused just follows) · no rank band is a wall or a free pass: quota looked at per band, incl. two-colour pieces 15 → growing cracks 17 and the white goop 20 inside the quota ease 17–24 · the final shift: the Veteran saved about half (bots:final) · a trial SWAP of two beats stays green, or what it finds is fixed · no setting or help text still talks about 50 ranks · research/economy-sim.md has the before/after
why: Muzzy 2026-11-02: "this would help the game not feel so impossibly long". F52 — Balance pass tuned everything to 50 ranks.
Check: sim:economy full before + after · bots:final · check:fast · check:full · Muzzy plays and judges the pace
- [x] 🤖 1. Baseline: a full sim:economy run BEFORE F49 — Covered cracks drain half? (bot rerun), numbers saved — .planning/research/economy-sim.md
- [x] 🤖 2. A full run with F49 — Covered cracks drain half? (bot rerun) in: its effect on its own — .planning/research/economy-sim.md
- [ ] 🤖 3. Read quota per band; fix only what the numbers show (15 → 17, white goop at 20) — content/tuning/shift.json
- [ ] 🤖 4. The trial: swap two beats in the ladder, check:fast + e2e, put them back; fix what it finds (Sprint 32 retro) — content/tuning/ladder.json
- [ ] 🤖 5. Settings + help text still on 50 ranks (eyes.json minClump10 etc., quota / progression / white goop notes, career.ts loadout50) — content/tuning/eyes.json
- [ ] 🤖 6. (tuning) XP per rank → Sharp ~45–50 shifts — content/tuning/progression.json
- [x] 🤖 7. (tuning) The final shift after half wear: the Veteran saved about half — content/tuning/finalShift.json
- [ ] 🙋 8. Muzzy plays a few shifts and judges the pace (the bots have never been compared with his real play) — content/tuning/progression.json

## Notes
- Asked of the framework at PLANNING (Sprint 31 retro): nothing new; the Ladder tab + rank lint rule stay with framework-43 (ROADMAP Parking lot).
- Open bugs: P0 0, P1 0; the 7 P3s wait unless this sprint's files touch them.
- Planning finds (helper's report, Claude read the code): bubbles.covered 0.5 is already built (src/view/crackBubbles.ts), so F49 — Covered cracks drain half? (bot rerun) adds only the wear. `crack.plugged` means matching goop on every cell, so it is NOT Muzzy's "covered". The Veteran's wear follows integrity lost, so half wear moves the final shift — task 7.
- Muzzy 2026-11-03: the sprint plan yes · covered = per cell · the 45–50 target = the Sharp bot.
- F82 baseline (2026-11-03, commit 6c1df66, before F49 — Covered cracks drain half? (bot rerun); 72 careers, 31,525 shifts, 1,572 s): shifts to the final — Sharp 34.5–37, Focused 32.5–33.5; Casual never gets there (won 1%). Ranks 18–29 are one shift a rank at 98–100% won; ranks 24–29 shifts last 260–436 s and pay 51–112k XP against a need of ~10k. Ranks 12–17 are the only slow band (Sharp 1.3–1.6 shifts a rank, 65–77% won). So XP per rank alone can't add the shifts where the climb is flat — task 3 / 6 read this. Final shift (career upgrades): Focused 100%, Sharp 70%.
- F49 red first: tests/engine/crackBand.test.ts — 4 of 5 new tests failed on the old engine (the wrong-colour one passes on both, by design), green after; all 726 unit tests pass.
- F49 for the record: `cellCovered` (src/engine/twists.ts) is now the one "goop on this cell?" test; the view's crackIsOpen asks it.
- F82 run with F49 — Covered cracks drain half? (bot rerun) in (0e97ffa; 31,522 shifts): pace unchanged (Sharp 34.5–37, Focused 32.5–33.5), shift length +0–3 s early, up to +11 s late. Half wear barely moves careers because the bots rarely lose to wear alone.
- Tuning: finalShift.json vet.wearPerIntegrity 3.5 → 4.5 — why: half wear let the bots save the Veteran too often (seeds 8001–8200: Focused 73%, Sharp 56% at 3.5). Swept 3.5 / 4 / 4.5 / 5 / 5.5; result at 4.5: Focused 55%, Sharp 48%; fresh seeds 9001–9200 in research/economy-sim.md. Muzzy's target: about half.
- F82 trials (Focused + Sharp careers, 8 seeds, effect-seeds 1; none kept, shift.json + upgrades.json back as they were):
  - Trial 1, quota discount removed (cracksGrow −6 → 0): Sharp 43–48.5 shifts, Focused 43.5–48.5. Sharp wins 38–40% at 18–23, longest losing run 5–6, then every shift from 22.
  - Trial 2, cracksGrow −2, quotaEaseEnds +3: Sharp 37–39, Focused 34.5–37.5. Every shift still won from 22.
  - Trial 3, trial 2 + Crack Down chargePerSeal 0.25 → 0.1: no change in pace, every shift still won from 22.
  - Trial 4, trial 2 + the bots never buy Crack Down: Sharp 49–63, Focused 58–82; ranks 25–29 won 13–29% of shifts (24 wins in 83–183 shifts per rank), longest losing run up to 20.
  - Finding: Crack Down (unlocks at 22) IS the step. With it every Sharp shift from 22 on is won; without it those ranks are a wall. The XP goal never bites at the top: 62–121k XP a shift against a need of ~10k.
- Ask Muzzy: Crack Down's power vs the quota (the sprint plan said upgrades stay the same, so this is his call).
