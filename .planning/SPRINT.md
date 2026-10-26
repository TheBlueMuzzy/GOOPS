# Sprint 22 — the final shift (rank 50): the boss level
Started 2026-10-26 · Milestone M5 Beta · Features: F64
What changes for Muzzy: reaching rank 50 plays the boss shift — every goop and crack galaxy black (any goop merges with any, seals any crack), goop falling faster and more often, the Veteran dropping in as a white clump to seal the cracks you can't reach (shrinking with each), and three trips to the console to open the release valve; win → a placeholder "the valve opens" until F65 — The ending. Stays the same: ranks 0–49, the end report, upgrades.

## F64 🎮 The final shift (rank 50) — all black, the onslaught, the Veteran helps, 3 valve stages
Done when: rank 50's shift plays as design/story.md "The final shift": all goop and cracks galaxy black (any goop merges with any, any goop seals any crack), faster and more frequent goop, the Veteran drops in first ("oh! hi!" … "oof") and seals the cracks you can't reach, shrinking with each; seals (his too) count to valve stage 1 / 2 / 3 at 6 / 8 / 10, counting paused while a stage waits at the console; the valve panel at the console plays Muzzy's mini-game (task 5; the shift runs slower there, like repairs) and the hatch from F45 — Ranks 40–49 story is where it opens; you lose if he's used up, the goop goes over the top, or integrity hits 0; the third stage = a win (placeholder until F65 — The ending); every number in content/, every word in en.json; works at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: the last shift should feel slightly overwhelming — a boss level: no colour sorting, just place and pop while it overruns you, with the one friend you have left giving himself up so you can open the valve.
Check: unit tests (black merges/seals everything, valve counting + pause, the three losses, his shrink) · bot run of rank 50 (win rate, length, how bots lose) · e2e/final-shift.mjs with shots looked at · check:full
- [ ] 🤖 1. Rules at rank 50: all goop + cracks one galaxy-black colour, faster / more frequent spawns, seals count to 3 valve stages (6 / 8 / 10, paused while a stage waits), the three losses — new content/tuning/finalShift.json — src/engine/shift.ts
- [ ] 🤖 2. Pace proof: bot run of rank 50 (same settings on several seeds first, to see the swing) — how often bots win, how long, which way they lose; tune finalShift.json toward "slightly overwhelming", log it in Notes — scripts/bots/runShift.ts
- [ ] 🤖 3. The Veteran in the final shift: drops in first as a falling white clump with his lines, seeks the cracks you can't reach, shrinks per seal (his seals count), used up = a loss — src/engine/whiteGoop.ts
- [ ] 🤖 4. The galaxy-black look: black goop + black cracks with shimmering stars, Jelly and Particle — src/goo/shared/palette.ts
- [ ] 🙋 5. Muzzy designs the valve mini-game (how opening each stage works) — .planning/design/story.md
- [ ] 🤖 6. The release-valve panel at the console mid-shift: "valve's open on your console — go!", Muzzy's mini-game from task 5, the shift slowed like repairs, the hatch from F45 — Ranks 40–49 story opens — src/ui/RepairPanels.tsx
- [ ] 🤖 7. Rank 50's story moment (MON → him, design/story.md row 50) + the win (placeholder "the valve opens" until F65 — The ending) and the lose screens — content/story/moments.json
- [ ] 🤖 8. e2e: the final shift at every portrait size — black goop, his help + shrink, each valve stage, each loss, the win — e2e/final-shift.mjs
- [ ] 🤖 9. Update design/story.md (final shift built), GDD, TDD (data file + decisions; next free D26) — .planning/design/story.md

## Notes
- Muzzy 2026-10-26: Sprint 22 plan OK ("/develop").
- Muzzy 2026-10-26: "for the valve mini game. let's stop before you code that." → tasks 1–4 get built; the valve panel (task 6) waits for his design (task 5). Options on the table: a) the repair motion with valve art · b) turn a wheel · c) hold a lever — or his own.
