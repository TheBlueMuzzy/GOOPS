# Sprint 02 — a shift that ends in a rupture, with Muzzy's controls and art
Started 2026-10-17 · Milestone M1 Core shift · Features: F17, F18, F19
What changes for Muzzy: no shift clock — it ends in a rupture; the new key map; Wall kick setting; his art on start + end screens. Stays the same: the goo (both styles), the tank, touch controls, score (minus hard drop), Settings layout.

## F17 ⚙️ Pressure → integrity → rupture
Done when: a shift plays the GDD §4 loop — pressure rises and vents, cracks grow with it, open cracks drain integrity, rupture (integrity 0 or overflow) drains pressure to 0 and ends the shift; quota = won.
- [ ] 🤖 1. Pressure rises at a rate, zaps + seals vent it, caps at 100% (replaces shiftMs) — src/engine/shift.ts, content/tuning/shift.json
- [ ] 🤖 2. Cracks come faster with pressure, only where sealable now (at/below the pop line, no goop); win burst removed — src/engine/cracks.ts
- [ ] 🤖 3. Integrity drain per open crack; rupture at 0 or overflow; drain phase (pieces keep coming, no new cracks); end at pressure 0, won if quota met; leftover penalty — src/engine/shift.ts, types.ts
- [ ] 🤖 4. Engine tests for the new loop — tests/engine/
- [ ] 🤖 5. HUD: integrity meter, "Quota met" + "Rupture!" banners, end report — src/ui/App.tsx, content/text/en.json
- [ ] 🤖 6. TDD timers + rules updated (GDD §4 ✅ done 2026-10-17)
Check: unit tests for each rule; a seeded shift runs to a rupture and ends; smoke e2e reaches the end screen.

## F18 🎮 One control set + wall-kick toggle
Done when: keys match the GDD §4 table with the same timings as touch; no hard drop anywhere; Settings → Wall kick switches Rotate vat / Shunt piece.
- [x] 🤖 7. Keys per GDD table (Right Ctrl ccw, Numpad 0 cw, hold R / Right Shift 1.5 s swap, ↑ console; drop Space, ↑-rotate, instant R) — src/input/controls.ts
- [ ] 🤖 8. Remove hard drop from engine, score config and tests
- [ ] 🤖 9. Wall kick setting: Rotate vat (the tank turns a column, goo slides with it) / Shunt piece (v1) — engine option, content/ui/settings.json, src/game/
- [x] 🤖 10. e2e controls check updated — e2e/controls.mjs (every key + gesture; perf/smoke hardDrop uses follow the engine change)
Check: e2e drives every key + gesture; both wall-kick modes tested in the engine.

## F19 🎨 Muzzy's art on the screens
Done when: start and end screens use his art/ SVGs (title, background, end-game screen, coloured buttons); Neon only for bits with no art.
- [ ] 🤖 11. Sort art/ by screen — a sheet of what goes where
- [ ] 🤖 12. Title + background on start, end-game screen behind the report, coloured buttons (kit gets art-skinned buttons first if missing)
- [ ] 🤖 13. Screenshots at phone, landscape, desktop
Check: screenshots at 390×844, 844×390, 1440×900; check:ui passes.

## Tuning (last)
- [ ] 🙋 14. Play a shift on PC + phone, both goo styles (from Sprint 01)
- [ ] 🙋 15. (tuning) Pacing: integrity drain per crack, crack rate curve, rupture drain time

## Notes
- Starting numbers (Claude's guesses, all in content/tuning/shift.json): pressure 0→100% in ~75 s; cracks every 5 s at 0% → 1 s at 100%; rupture drain 5 s.
- F18 controls e2e: a swap between two identical pieces looks like nothing happened, so the check counts swap actions; the drag check compares spins to the real drag time (headless drags are slow: 2 s → 14 columns is right).
