# Sprint 07 — Goops makes noise, and you can read the cracks
Started 2026-10-19 · Milestone M4 Alpha · Features: F29, F36, F58 · **Auto** (Muzzy: "auto for this sprint")
What changes for Muzzy: the game makes sound (placeholder effects for every big moment, volume in Settings); cracks are easy to read (bubbles from open cracks, an x-ray box when goop covers one, a sealed look); clicking beside the tank no longer zaps goop you can't see. Stays the same: rules and balance (except: a sealed spot never cracks again), goo, HUD, console.
Decided at planning (Muzzy, 2026-10-19): PC first, phone later (F10 waits) · alpha lives at /GOOPS/alpha/ (F37 ✅) · covered cracks draining half stays in beta (F49).

## F29 🧱 Sound basics
- [x] 🤖 1. Install the framework audio module + start-up wiring + Settings sound rows on — src/audio/, src/main.tsx
- [x] 🤖 2. The sound list: every moment that gets a sound (land, merge, ready, zap, seal, crack, poke, rotate, move, swap, machine breaks / fixed, rupture, quota met, periscope, console buttons) — content/audio.json
- [x] 🤖 3. Placeholder sounds made in code (ZzFX → files), logged in credits — public/audio/, content/credits.json
- [x] 🤖 4. Play them from the game's events, on the rules clock (both Dev Kit pauses silence them) — src/game/ShiftStage.tsx
- [x] 🤖 5. Tests + an e2e that reads the audio log for each moment — tests/, e2e/sound.mjs
- [x] 🤖 3b. Recorded CC0 sounds instead of code-made (Kenney / OpenGameArt; Muzzy called code-made "horrible") — public/audio/, content/audio.json, content/credits.json
- [x] 🙋 6. (tuning) Listen: loudness and feel of each sound (Dev Kit Sound tab) — approved as placeholders 2026-10-19; better ones in F53 step 1

## F36 ✨ Readable cracks
- [x] 🤖 1. Open cracks let out an unsteady stream of bubbles (knobs in content/) — src/view/
- [x] 🤖 2. A crack under goop stays visible: dotted white x-ray box, the goop inside slightly see-through, under the visor glitch — src/view/, src/goo/
- [x] 🤖 3. Sealed cracks turn dark grey, and no crack ever forms on a sealed spot again (+ engine test, bots rerun) — src/engine/cracks.ts
- [x] 🤖 4. Screenshots at every size + e2e — e2e/cracks-look.mjs
- [x] 🤖 6. Muzzy's look notes: visor scan lines + tint inside the x-ray box; a pixel red X on a crack covered by the wrong colour ("this one won't seal") + e2e — src/view/tankView.ts, content/tuning/cracks-look.json
- [x] 🤖 7. Covered cracks leak bubbles too, at half the rate, rising up through the goop; sealed cracks none (Muzzy) + e2e — src/view/crackBubbles.ts, content/tuning/cracks-look.json
- [x] 🙋 5. (tuning) Look: bubbles, x-ray box, sealed look — approved 2026-10-19

## F58 🐞 Clicks beside the tank zap goop you can't see
- [x] 🤖 1. Failing test: a click just outside the tank's side hits a hidden column — tests/
- [x] 🤖 2. Fix: only the 12 visible columns take clicks — src/view/geometry.ts, src/game/ShiftStage.tsx
- [x] 🤖 3. e2e: a desktop click beside the tank does nothing — e2e/controls.mjs

## Notes
- F58 (2026-10-19): only the visible tank takes clicks (`geometry.ts screenToVisibleCell`); a click beside/above the tank is a plain tap (rotate). Unit test + e2e/controls.mjs.
- F36 calls (helper, auto): x-ray box + bubbles drawn on the tank canvas UNDER the goo, the goo inside the box thinned to 40% so the box shows through (under the visor glitch for free, no extra canvas on phones) · "covered" = any colour on the crack (a plugged one gets the box too) · bubbles 5/s, gust 0.7, size 0.09, alpha 0.7; box white 0.9 breathing 30%; scar #3a3f4b + 3 stitches #6b7385 — all in content/tuning/cracks-look.json, live · snapshots stay format 1 (sealed spots optional). Bots (20 seeds) with "no crack on a sealed spot": Sharp 100/95/85/55/0% vs 100/95/95/50/0% without — noise, pacing unchanged (~142 s).
- F29 calls (helper, auto): Settings rows on: Master, Sound effects, Menus & buttons, Sound, Mute in background, Mono (Music/Ambience off — none yet) · 26 ids in content/audio.json; one sound per id per frame; pop size → pitch/volume (content/tuning/sound.json); goop.ready climbs a pitch ladder; each machine has its own break sound, one shared "fixed" · silent for now: goop falling after a pop, plugging, the broken-laser prime, abilities · a "console" mix: the tank 6 dB quieter at the console mid-shift · menu/console sounds never vary (Muzzy 2026-10-10) · full Dev Kit pause also mutes (module gap below).
- **Mistake caught (Claude):** my sprint task said "placeholder sounds made in code (ZzFX)" — but Muzzy called code-made sounds "horrible" twice and the audio-setup skill says recorded CC0 for anything he hears. Swapping to recorded Kenney / OpenGameArt CC0 sounds before he hears them (task 3b). Lesson for the BMUZ session: /sprint planning should read the specialist skill's lessons before wording a task.
- Framework (audio module) issues for the framework session, not fixed here (kit copy): the module ignores `devkit:pause` — a tap resumes an AudioContext the full pause suspended (game-side mute is the workaround) · `src/audio/react.ts:16` exhaustive-deps lint warning · the first click of a visit is always silent (files load on unlock — by design).
- Muzzy's listen + look (2026-10-19): sounds "not great, but happy to have sounds" — he'll hunt for better ones himself (gave him the sites). Bubbles great; x-ray okay → wanted it to feel like the visor (scan lines) + a pixel red X on wrong-colour cracks (task 6). The X is drawn under the see-through goop like the rest of the box (so the glitch bends it), which tints it (pink under blue); `xray.gooAlpha` lower = redder.
- e2e/controls.mjs: with 4 Settings tabs (Audio joined) a phone shows the ◀ Audio ▶ picker, not tabs — the test steps to Gameplay now.
