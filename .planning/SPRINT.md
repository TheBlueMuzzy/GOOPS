# Sprint 24 — the economy sim: a whole career, rank 0 to 50, every upgrade
Started 2026-10-29 · Milestone M5 Beta · Features: F51
What changes for Muzzy: one command plays whole careers with bots — rank 0 to the final shift, earning XP and scraps and buying upgrades the way different players would — and shows a results page: how many shifts each rank takes, where players get stuck, what every upgrade really does, which upgrades nobody would buy. It measures; it changes no game numbers (balancing is F52 — Balance pass, at 1.0). Stays the same: the game itself.

## F51 🧱 Economy sim: ranks 0–50, every upgrade
Done when: `npm run sim:economy` plays whole careers headless on the real engine + the real content files (rank 0 → the final shift, ranks gained by real XP, scraps earned per level, upgrades bought + equipped by 3 buy styles: spread evenly · rush one band · actives first) for each bot skill (Casual / Focused / Sharp) over many seeds, the same seeds giving the same numbers; it reports shifts needed per rank, win rate per rank band, where careers stall (a rank lost 3+ times in a row), scraps earned vs spent, every upgrade's measured effect (each one on vs off at the ranks it opens), upgrades with no measurable effect, and the final shift's win rate with a real career's upgrades; the results page (e2e-shots/sim/) is published as a planner tab + the findings in research/economy-sim.md in plain words, each with a suggested knob for F52 — Balance pass (no tuning file changed).
why: beta players will play the whole ladder; before F52 — Balance pass tunes it, we need to know where the ladder is too steep, too flat, or has upgrades that do nothing.
Check: unit test that the sim is repeatable (same seed → same career) and that an upgrade bought in the sim reaches the shift's tuning · a short sim run in check:full (few seeds) · the full run's numbers looked at by Claude
Checked:
- [ ] 🤖 1. The career runner: rank 0 → 50 by real XP, scraps per level, buy styles, upgrades applied through the same path the game uses — scripts/bots/career.ts
- [ ] 🤖 2. Upgrade effect runs: each upgrade on vs off at its rank, actives fired by the bots — scripts/bots/career.ts
- [ ] 🤖 3. The command + results page (npm run sim:economy, e2e-shots/sim/index.html) + a quick mode in check:full — scripts/bots/economy.mjs
- [ ] 🤖 4. Tests: repeatable career, upgrades reach the tuning — tests/economySim.test.ts
- [x] 🤖 6. Beta release prep (/deliver, alongside the sim): review through a1d4ecd + security review (no issues), release-checks/beta.md, v0.2.0 notes draft, beta audits → favicon link fixed, B005–B007 logged, F71 + F72 added — index.html
- [ ] 🤖 5. Run it in full, write research/economy-sim.md (findings + a suggested knob each for F52), TDD data/decisions (next free D30), GDD line — .planning/research/economy-sim.md

## Notes
- 2026-10-29, auto mode (Muzzy: "go auto. i'm driving to work"): F51 — Economy sim is the last open beta must; Claude planned this sprint so /deliver beta can go without `--musts-open-ok`. Taste calls → Ask Muzzy lines with a default.
