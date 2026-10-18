# Sprint 03 — a working day at the console
Started 2026-10-17 · Milestone M2 Working day · Features: F20, F21, F22
What changes for Muzzy: the game opens on his console; pull the periscope to start a shift; swipe up from the report to go back; rank up between shifts. Stays the same: the shift, the goo, the HUD (rethink parked), the controls.
Decided at planning: F03 crack colours = v1 (only the matching colour seals) · F05 closed (the rupture decides length) · F08 = v1 numbers to start · no upgrades this slice, but the engine must be ready for all of them (Muzzy: "it's important to be coding with their interactions in mind").

## F20 🧱 Progression + save
Done when: a shift's score turns into XP (v1 formula), ranks and scraps go up, all of it survives a reload, and the next shift plays at the new rank.
- [ ] 🤖 1. XP from score: v1 formula (3,500 + 250 × rank per rank, min 100 × rank per shift, 1 scrap per rank) — content/tuning/progression.json, src/progress/
- [ ] 🤖 2. Saved in the browser, versioned — src/progress/save.ts
- [ ] 🤖 3. Rank feeds the shift (colours, junk, crack quota by rank) — src/ui/App.tsx
- [ ] 🤖 4. Tests: XP maths, multi-rank jumps, the minimum, an old/broken save
Check: unit tests; a reload keeps rank + XP.

## F21 🎮 The console as the menu
Done when: the game opens on Muzzy's console (Example1), the periscope starts a shift, swipe up from the report returns, and the rank meter fills with the shift's XP.
- [ ] 🤖 5. Read v1's ConsoleView.tsx for behaviour; map Example1 to parts
- [ ] 🤖 6. Console screen from his art: base, top, Operator Rank meter (real XP), periscope, gear = settings; repair panels drawn switched off; no upgrades bar / "?" yet; plain start screen retired
- [ ] 🤖 7. Pull the periscope down (drag or tap) → slide into the tank (like Example3)
- [ ] 🤖 8. Swipe up from the end report → console; XP fills the meter, rank-up moment
- [ ] 🤖 9. Kit additions framework-first (e.g. a drag handle)
- [ ] 🤖 10. Screenshots at every size (360 → 2560) + e2e of the whole day
Check: e2e console → periscope → shift → report → swipe up → XP → next shift, no errors, at 9 sizes.

## F22 🧱 Upgrade-ready engine
Done when: the engine takes modifiers worked out from owned upgrades plus active-ability hooks, proven by two test-only upgrades; every v1 upgrade has a home in the plan.
- [ ] 🤖 11. Read all 20 upgrades + actives (design/progression.md + v1 code); sort by what they touch; note what the new loop changes
- [ ] 🤖 12. Design: modifiers + active hooks — TDD
- [ ] 🤖 13. Build the plumbing; two test-only upgrades (passive: tank wears 50% slower; active: next 3 cracks spawn low)
- [ ] 🤖 14. Tests + GDD §5 update
Check: unit tests for both test upgrades; no real upgrade shows in the game.

## Tuning (last)
- [ ] 🙋 15. Play a working day: shift → console → rank up → next shift. Does it pull you into "one more shift"?

## Notes
- Mid-shift console (swipe up / W / ↑) still pauses the shift — v1 kept it running; that's F06 (breakdowns).
