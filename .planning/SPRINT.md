# Sprint 07 — Goops makes noise, and you can read the cracks
Started 2026-10-19 · Milestone M4 Alpha · Features: F29, F36, F58 · **Auto** (Muzzy: "auto for this sprint")
What changes for Muzzy: the game makes sound (placeholder effects for every big moment, volume in Settings); cracks are easy to read (bubbles from open cracks, an x-ray box when goop covers one, a sealed look); clicking beside the tank no longer zaps goop you can't see. Stays the same: rules and balance (except: a sealed spot never cracks again), goo, HUD, console.
Decided at planning (Muzzy, 2026-10-19): PC first, phone later (F10 waits) · alpha lives at /GOOPS/alpha/ (F37 ✅) · covered cracks draining half stays in beta (F49).

## F29 🧱 Sound basics
- [x] 🤖 1. Install the framework audio module + start-up wiring + Settings sound rows on — src/audio/, src/main.tsx
- [x] 🤖 2. The sound list: every moment that gets a sound (land, merge, ready, zap, seal, crack, poke, rotate, move, swap, machine breaks / fixed, rupture, quota met, periscope, console buttons) — content/audio.json
- [ ] 🤖 3. Placeholder sounds made in code (ZzFX → files), logged in credits — public/audio/, content/credits.json
- [ ] 🤖 4. Play them from the game's events, on the rules clock (both Dev Kit pauses silence them) — src/game/ShiftStage.tsx
- [ ] 🤖 5. Tests + an e2e that reads the audio log for each moment — tests/, e2e/sound.mjs
- [ ] 🙋 6. (tuning) Listen: loudness and feel of each sound (Dev Kit Sound tab)

## F36 ✨ Readable cracks
- [ ] 🤖 1. Open cracks let out an unsteady stream of bubbles (knobs in content/) — src/view/
- [ ] 🤖 2. A crack under goop stays visible: dotted white x-ray box, the goop inside slightly see-through, under the visor glitch — src/view/, src/goo/
- [ ] 🤖 3. Sealed cracks turn dark grey, and no crack ever forms on a sealed spot again (+ engine test, bots rerun) — src/engine/cracks.ts
- [ ] 🤖 4. Screenshots at every size + e2e — e2e/cracks-look.mjs
- [ ] 🙋 5. (tuning) Look: bubbles, x-ray box, sealed look

## F58 🐞 Clicks beside the tank zap goop you can't see
- [ ] 🤖 1. Failing test: a click just outside the tank's side hits a hidden column — tests/
- [ ] 🤖 2. Fix: only the 12 visible columns take clicks — src/view/geometry.ts, src/game/ShiftStage.tsx
- [ ] 🤖 3. e2e: a desktop click beside the tank does nothing — e2e/controls.mjs

## Notes
