# Sprint 05 — read the shift where you're looking
Started 2026-10-18 · Milestone M3 Breakdowns (follow-up) · Features: F26, F27
What changes for Muzzy: where the meters sit and where big moments show up (3 layouts to try, then your pick), then one balance change. Stays the same: rules, goo, console, repairs, ranks.
Decided at planning (Muzzy, 2026-10-18): sketch 3 layouts (A meters hug the tank · B a strip near the pop line · C big moments just above the stack).

## F26 🎮 HUD + messages rethink
why: Muzzy (2026-10-17): "My focus is so heavily on the bottom of the tank, that the top UI is vanishing… the message it sends didn't show up in a place that matched my focus… good UI early helps me understand how to give you bug/balance feedback"
Done when: Muzzy picked a layout after playing it with the real goo; it's in the game at all 9 sizes; big moments (quota met, rupture, why it ended) show where the player is looking.
- [x] 🤖 1. Inventory: every meter and message the shift shows now + v1's (what, when, where) → research/hud-inventory.md
- [ ] 🤖 2. The layouts in the real game behind two Settings rows — "Meters (test)" Top / Hug the tank / Bottom strip and "Messages (test)" Centre / At the stack (A/B/C split so Muzzy can mix) — playable with the real Jelly/Particle goo (Muzzy's F25 note: a sketch with fake goo can't be judged)
- [ ] 🙋 3. Play A / B / C and pick (or mix)
- [ ] 🤖 4. Build the pick for real (new parts kit-first), drop the others
- [ ] 🤖 5. HUD checks at 9 sizes + "big moments show near the stack" check · update GDD
- [ ] 🤖 6. (tuning) message timing and loudness

## F27 ❓ Integrity / crack balance talk — after F26 works
- [ ] 🤖 7. Bot runs: how shifts end (cracks vs pressure 100%), cracks sealed vs drain
- [ ] 🙋 8. Play a few shifts with the new HUD — what feels unfair?
- [ ] 🤖 9. Numbers + cause → 2–3 single knobs with a prediction each
- [ ] 🙋 10. Pick one knob → content/tuning

## Notes
- Inventory (task 1): research/hud-inventory.md. v1 also kept almost everything away from the bottom; it never showed the crack count, quota or why a shift ended during play. Missing today: why a zap was refused, 'machine broke → swipe up', integrity low, pressure near max.
