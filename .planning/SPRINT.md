# Sprint 25 — the quota unlocks your rank, then tune the climb
Started 2026-10-29 · Milestone M6 1.0 · Features: F74, F52
What changes for Muzzy: XP fills the rank meter, but the rank only moves once a quota has been met during that rank — meeting it doubles that shift's XP; repairs at the console cost real shift time (75%, Focus Mode → 50% → 25%); the whole climb aims at 60–80 shifts for a player like him. Stays the same: the story moments, the first day, the final shift.

## F74 🎮 Rank lock — the quota is the key
Done when: a rank-up needs BOTH the XP goal AND a quota met during this rank (a met quota stays met until the rank-up, even over later shifts that miss it); while the quota isn't met the XP stops at the goal (the meter sits full); a shift that meets its quota earns double its XP (content: progression.json quotaXpMult 2); the first day and the final shift work as today; the save keeps "quota met this rank" and old saves load (an upgrade step); the console's rank meter says QUOTA NEEDED when the XP is full but no quota is met; the end report shows the quota line (met → "Quota met — rank unlocked" + the doubled XP; missed while full → "Rank locked: meet a quota"); Management explains it on the monitor the first time the lock holds; every word in en.json, every number in content/; every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080).
why: Muzzy 2026-10-29: "you can earn the xp cap but can't actually rank up unless you fill the quota… quota = key to the rank lock. XP goal met = allowed to rank up IF you've met quota during this rank. meeting quota can add a big chunk of XP" — today XP alone ranks you up, so the quota means nothing (the F51 sim: no bot meets it from rank 10, ranks fly by anyway).
Check: unit tests (the lock, the cap, the bonus, a met quota carried over, the first day + final shift untouched, save upgrade + golden save) · e2e/rank-lock.mjs (full meter + missed quota → locked, the next shift meets it → rank-up; every portrait size; page errors watched) with shots looked at · check:full
Checked:
- [ ] 🤖 1. The rule: rank-up = XP goal + a quota met this rank; XP stops at the goal while locked; first day + final shift untouched — src/progress/progression.ts
- [ ] 🤖 2. Quota-met bonus (the shift's XP × quotaXpMult 2) and "quota met this rank" in the save, with an upgrade step for old saves — src/progress/save.ts
- [ ] 🤖 3. Show the lock: QUOTA NEEDED on the console's rank meter; the end report's quota line + the doubled XP — src/ui/Console.tsx
- [ ] 🤖 4. Management explains the lock on the monitor the first time it holds — content/story/moments.json
- [ ] 🤖 5. Tests + e2e/rank-lock.mjs at every portrait size, shots looked at; update GDD §5 (progression) + design/progression.md + TDD decision (next free D31) — e2e/rank-lock.mjs

## F52 🧱 Balance pass
Done when: the quota rule lives in shift.json (tunable); the sim plays the rank lock and leaves Dense Goop off for the final shift; after Muzzy's calibration shifts, a Focused/Sharp career takes ~60–80 shifts (Muzzy: "a human probably takes 60-80 honestly, the higher end being because they fail things"); console time 75% with Focus Mode at 2 levels (50% → 25%); Goop Dump can't farm or wipe the score with Colorizer, Colorizer is a short burst, Pressure Control's first level is felt, Slow Cracks no longer costs final-shift wins; a before/after sim table on the planner; Muzzy plays it and says how the climb feels.
why: the F51 sim's findings (research/economy-sim.md) + Muzzy's answers 2026-10-29.
Check: the full sim before/after · check:full · Muzzy's play
Checked:
- [x] 🤖 1. The quota rule (colours + rank) into content/tuning/shift.json — same numbers first (golden shifts unchanged) — src/engine/config.ts
- [ ] 🤖 2. The sim plays the rank lock; bots take Dense Goop off for the final shift (economy.json) — scripts/bots/career.ts
- [ ] 🙋 3. Calibrate: 3 shifts at rank 5 + 3 at rank 25 (RANK SELECT) — how long the tank lasted, cracks sealed / needed
- [ ] 🤖 4. Pace to 60–80 shifts a career: XP per rank, quota per rank (tuning) — content/tuning/progression.json
- [ ] 🤖 5. Console time 75%; Focus Mode 2 levels → 50% / 25% (tuning) — content/tuning/breakdowns.json
- [ ] 🤖 6. Upgrades: Goop Dump smaller, Colorizer shorter, Pressure Control level 1 felt, Slow Cracks' final-shift cost (tuning) — content/tuning/upgrades.json
- [ ] 🤖 7. Sim re-run, before/after table on the planner tab, findings + GDD numbers updated — .planning/research/economy-sim.md
- [ ] 🙋 8. Play the tuned game: the climb, a mid-rank shift, the final shift — how does it feel?

## Notes
- Muzzy 2026-10-29 (planning): the rank lock is the quota's real job (new rule → F74 — Rank lock, built before the tuning) · XP past the goal while locked: "stops at the goal" · quota bonus: "double that shift's XP sounds interesting" · console time: "keep it as it is. we CAN make the game run at 75% while at the console, and have upgrades knock 25% off that" → Focus Mode 2 levels ("freeing up scrap is good") · a career for a human: 60–80 shifts.
- No open P0/P1. B005 (P2, the console at big Text size) waits on the UI kit change (framework session).
- F73 — Crisp pixel type waits on the UI kit's size rounding (Muzzy: "after").
