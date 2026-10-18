# Sprint 04 — machines that break, fixed at the console
Started 2026-10-18 · Milestone M3 Breakdowns · Features: F23, F24, F25
What changes for Muzzy: from rank 2 machines break (visor at 2, laser at 4, controls at 6); you repair them at your console while the tank crawls at 25%. Stays the same: the shift loop, the goo, ranks.
Decided at planning (Muzzy, 2026-10-18): triggers = v1's meters · softer effects · the tank SLOWS at the console mid-shift · repairs simplified, walked through one by one (below).

## F23 🧱 Breakdowns in the engine
Done when: three meters fill/drain by v1's rules, break at their threshold (from their unlock rank), apply their effect, and repair via an action; cooldowns as v1; upgrade hooks ready; tests.
- [x] 🤖 1. Meters (content/tuning/breakdowns.json): laser drains per zapped cell, refills per landed piece · visor signal holds for a grace, then fades unless fast-dropping · controls heat per tank turn, cools when idle
- [x] 🤖 2. Effects: broken laser = two taps to zap (prime, then pop) · visor glitch grows as its signal falls (the game draws it) · broken controls = held spin at half speed, single presses/swipes normal
- [x] 🤖 3. Unlock ranks (visor 2, laser 4, controls 6), cooldown after repair max(8, 20 − (rank − unlock)) s, several can be broken at once; upgrade modifier hooks
- [ ] 🤖 4. Mid-shift console: swipe up / W / ↑ → the real console, the tank runs at 25% (`consoleTimeScale`); the gear opens the pause menu (Settings, End shift) which fully pauses; pull the periscope to return
- [x] 🤖 5. Tests + GDD §4/§5 + TDD

## F24 🎮 Repairs at the console
Done when: a broken machine's panel lights up on the console and its repair (below) fixes it, with mouse and finger, at every size; the shift shows stand-in meters.
- [ ] 🤖 6. Laser: 2 random sliders of 4 light up, each needing left or right; the others stay unlit
- [ ] 🤖 7. Lights (visor): top slider light blinks fast → slide up (it turns off) → a colour button blinks until pressed, then another (never the same twice in a row), then a third → bottom light blinks fast → slide down → fixed
- [ ] 🤖 8. Controls: the dial — turn it to the blinking corner and it locks by itself; 3 corners
- [ ] 🤖 9. One shared drag/tap part, framework-first (kit) · stand-in meters in the shift (like v1's beside the tank; real home = the parked HUD rethink)
- [ ] 🤖 10. e2e: each break + repair (mouse + finger), 9 sizes

## F25 ✨ Visor glitch — sketch first
Done when: Muzzy picked a glitch look in a sketch, and it's in the game, driven by the visor signal, built so a pixel filter can stack on top later.
- [x] 🤖 11. Research glitch-shader references (VHS, signal loss, scanlines, chromatic split, block tearing…) → `/sketch` with knobs + presets
- [ ] 🙋 12. Pick a look (send your own references too)
- [x] 🤖 13. Into the game as the visor effect (stand-in flicker until then); post-process chain ready for a pixel filter

## Tuning (last)
- [ ] 🙋 14. Play: breakdowns feel like a fair interruption, not a punishment? Repairs tactile?

## Notes
- Engine ↔ screens contract written first (src/engine/types.ts: MachineId, MachineState, state.machines, repair action, breakdown/repaired/prime events) so F23 and F24 build in parallel.
- F23 (helper, 208 tests): machines live in `src/engine/machines.ts`, switched on by `createShift(…, { breakdowns })` (content/tuning/breakdowns.json) — off without it, so old shifts are unchanged. Differences from v1 (GDD §5, D08): priming does NOT restart the fill (softer); during a cooldown a meter stays 0.05 above its break point (needs one more push to break); the visor fades from where it is; flicker/overflare = game-side visuals. New modifiers laserDrainMult, visorGraceMult, controlsCoolMult, breakdownCooldownMult.
- Ask Muzzy (F23): broken laser — should a primed group refill before the second zap (v1) or pop right away (built)? · cooldown margin 0.05 OK, or v1's "breaks the moment the cooldown ends" (margin 0)?
- F25 sketch (helper): 4 looks (Cheap LCD visor = default, VHS tape, Digital datamosh, Analog CRT static), 13 knobs that scale with amount, Degrade/Repair, pixel filter toggle + order swap. Colour is never changed (colour is the rule); no white flashes (WCAG). Glitch pass 0.08 ms on the PC GPU; real phone check needed once it's in. Research: research/visor-glitch.md. Ask Muzzy: which look/mix · faint glass frame at amount 0? · HUD stays clean on top (planned)? · CRT at 0.95 too much?
- Muzzy's sketch values 2026-10-18 ("this is fun"): his 'now' = Preset 2 (scan/rgb/roll/tear/tearSize/block/vignette/curve 1, noise 0.55, flicker 0.5, blockSize 27, dead 0.65, dropout 0.05, pixelate on 4 px, pixels BEFORE glitch). His doubt: fake goo in the sketch + can't play through it → judge it in the real game (task 13 helper; dev ?visor=0.6 to lock a level).
- F25 in the game (helper): src/view/visorFx.ts overlay (tank + goo → glitch → pixels), Muzzy's look in content/tuning/visor-fx.json; amount from visor health (0 at ≥0.95, 1 at the break point); the HUD stays clean on top. Pixel filter turned OFF by default (it was on all the time with the sketch values — a whole-game look Muzzy called 'eventually'); his size/order kept. Dev: ?visor=0.6 / ?visor=off, ?pixel=on/off (dev builds only). 60 fps both goo styles at 390x844@3x on the PC; phone check pending. From a full visor: 0→1 glitch in ~4.7 s without fast-dropping.
