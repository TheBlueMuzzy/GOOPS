# Sprint 30 — Goops sounds finished and shows who made it
Started 2026-11-02 · Milestone M6 1.0 · Features: F53, F55
What changes for Muzzy: the placeholder beeps become the sounds he picks (plus sounds for the moments that have none yet), and Settings → About → Credits opens a list of who made Goops and every font, sound and art piece. Stays the same: the rules, the look, the balance; no music and a silent intercom (Muzzy 2026-11-02).

## F53 🎮 Final sound
Done when: every sound moment plays a sound Muzzy picked (or kept) · the moments built since F29 that have none get one (periscope zoom, the valve, the zap beam, the ending — the list in task 2 is the full set) · every file evened out (audio:check green) and credited in content/credits.json · no music and no intercom voice in 1.0 (Muzzy 2026-11-02) — GDD §6 says so
why: Muzzy 2026-10-19: "add a step during polish to update sounds" — 1.0 shouldn't sound like a placeholder.
Check: npm run audio:check · check:framework (audio + credits) · every sound key in content/audio.json has a file (test) · Claude plays a shift and the moments in the list, console clean · check:full
- [x] 🤖 1. Update the audio module 0.4.0 → 0.5.0 (install-module.mjs audio .) and run its checks — src/audio/
- [ ] 🤖 2. The sound shopping list: the 26 sounds today (what plays each, the file now) + the moments with no sound (periscope zoom in/out, the valve, the zap beam, the ending, the white goop, rank-up…) — .planning/research/sound-list.md
- [ ] 🙋 3. Muzzy hunts the sounds and drops them in one folder (names from the list) — .planning/research/sound-list.md
- [ ] 🤖 4. Trim, even out loudness, wire into the sound moments, credit each — content/audio.json
- [ ] 🤖 5. The new moments call their sounds (zoom, valve, zap beam, ending…) — src/audio/
- [ ] 🤖 6. A test: every sound in content/audio.json has its file; GDD §6: no music, silent intercom for 1.0 — .planning/GDD.md
- [ ] 🤖 7. (tuning) Muzzy listens; volumes one at a time in the Dev Kit's Sound tab — content/audio.json

## F55 🎮 Credits screen
Done when: Settings → About → Credits opens the UI kit's Credits screen: Muzzy's lines first, then every entry in content/credits.json · ‹ goes back to Settings · fits at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080), the list scrolls inside its card · Settings only (Muzzy 2026-11-02, not after the ending)
Check: e2e/credits.mjs (opens from Settings, back, every portrait size, every credits.json entry listed, no console errors) · screenshots looked at by Claude · check:framework
- [ ] 🤖 1. Turn the Credits row on and open the kit's Credits from it — content/ui/settings.json
- [ ] 🙋 2. Muzzy writes his lines (name, role, thanks) — content/text/en.json
- [ ] 🤖 3. e2e: open, back, every portrait size, every entry listed; add to check:full — e2e/credits.mjs

## Notes
- Measured 2026-11-02 before planning: content/audio.json has 26 sounds and `music.tracks` is empty; settings.json already has About → Credits (`"on": false`) and the kit has a `Credits` block (src/ui/kit/blocks/frontend.tsx) — F55 is wiring, not building.
- Muzzy 2026-11-02 (Sprint 30 plan): music — none for 1.0 · intercom voice — silent · Credits — from Settings only.
- Left out: F73 — Crisp pixel type (waits on the UI kit's font-grid rounding, not in kit 0.39.0) · F57 — Colour-blind help (a should; the musts first).
- F53 task 1 (2026-11-02): audio 0.4.0 → 0.5.0 installed (audio-check, conformance, engine changed; src/audio added to eslint's ignores). Its hand step is only for a game that ran `audio:check --fix` on 0.4.x — Goops never did (no audio-originals/), so nothing to do. audio:check today: 34 sounds, 4 placeholders too quiet (tank spin ×2, button tap, +1) — evened in task 4 on Muzzy's files, not now. check:fast exit 0.
