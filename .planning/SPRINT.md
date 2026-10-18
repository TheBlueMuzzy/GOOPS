# Sprint 05 — read the shift where you're looking
Started 2026-10-18 · Milestone M3 Breakdowns (follow-up) · Features: F26, F27
What changes for Muzzy: where the meters sit and where big moments show up (3 layouts to try, then your pick), then one balance change. Stays the same: rules, goo, console, repairs, ranks.
Decided at planning (Muzzy, 2026-10-18): sketch 3 layouts (A meters hug the tank · B a strip near the pop line · C big moments just above the stack).

## F26 🎮 HUD + messages rethink
why: Muzzy (2026-10-17): "My focus is so heavily on the bottom of the tank, that the top UI is vanishing… the message it sends didn't show up in a place that matched my focus… good UI early helps me understand how to give you bug/balance feedback"
Done when: Muzzy picked a layout after playing it with the real goo; it's in the game at all 9 sizes; big moments (quota met, rupture, why it ended) show where the player is looking.
- [x] 🤖 1. Inventory: every meter and message the shift shows now + v1's (what, when, where) → research/hud-inventory.md
- [x] 🤖 2. The layouts in the real game behind two Settings rows — "Meters (test)" Top / Hug the tank / Bottom strip and "Messages (test)" Centre / At the stack (A/B/C split so Muzzy can mix) — playable with the real Jelly/Particle goo (Muzzy's F25 note: a sketch with fake goo can't be judged)
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
- Task 2 (2026-10-18), decisions: Settings → Gameplay → "Meters (test)" + "Messages (test)", read live (src/game/hudLayout.ts). **Hug tags are kit HudText in a kit PinnedBox** (1 unit = 1 px, never bigger than normal text), placed each frame by ShiftStage with a CSS translate — not canvas text: the kit's real font/halo/text-size setting for free, and the e2e can measure them for overlaps. The rim (integrity glow) IS canvas (tankView.ts, colours in tank.json `rim*`), drawn just outside the tank so it never covers goop or the off-screen crack arrows. Tags sit UNDER the tank (cracks · tank % · score), or in a column beside its bottom-right corner on a sideways phone (no room under a 170 px tank). Sideways phone + Hug: the Console button sits beside the tank's top corner, so the tank takes the full height. Strip on a sideways phone: a column beside the tank (200 px room — the crack line is wider than the meters); the strip's crack line is small text so it stays on one row.
- Messages: words in en.json → messages, numbers in content/tuning/messages.json. One cooldown shared by both "refused" reasons (2.5 s). "Pressure near max" re-arms only below 75% (no flicker at the 85% line). No warnings during a rupture. "At the stack" messages are only as wide as the tank (kit --kit-toasts-start/-end) so they never cover the meters beside it; on a sideways phone they wrap to 2 lines. Engine: `reject` for a zap now carries `reason` ('aboveLine' wins over 'filling' — waiting alone can't fix it); empty-cell / turn rejects have none.
- Kit: 0.14.0 ToastStack `place="at"` (+ `--kit-toasts-at`), 0.14.1 HudText `live` (a % that changes 10×/s kept re-playing its entrance → looked faded and flickered).
- Rank 6 in the HUD check (all three machine meters on) + a 5-digit score at every size, all 6 combos.
