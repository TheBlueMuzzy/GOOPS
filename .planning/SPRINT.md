# Sprint 16 — the goop wakes up and the Veteran talks: ranks 10–30
Started 2026-10-24 · Milestone M5 Beta · Features: F62, F40
What changes for Muzzy: from rank 10 tiny eyes open in big clumps of goop (following the falling piece from 20, worried at high pressure from 30, mouths sketched for 40); each rank-up from 10 to 30 plays its story moment at the console (the Veteran gets chattier, Management colder), whispers turn into words and then names, and at 30 the Veteran is caught and white joins as a normal goop colour. Stays the same: shifts, balance, the zap, the payslip numbers, ranks 0–9's moments.

## F62 🎮 The goop grows eyes and mouths
Done when: eyes picked in a sketch first (Muzzy tunes it); then in BOTH renderers (Jelly + Particle): 10–19 a few tiny eyes in big clumps, closing when zapped · 20–29 eyes in most clumps, following the falling piece / the laser · 30–39 blinking, worried at high pressure, closing in relief when a crack is sealed · 40+ some clumps grow silent mouths; every number in content/tuning/eyes.json, live in the Dev Kit; the renderer is told the rank, pressure and focus point; screenshots at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: the tank is half the game — the goop itself tells the story that something in there is alive.
Check: e2e/eyes.mjs (eyes at 10/20/30/40, none at 9, closing on a zap, looking at the piece) with shots looked at · check:full
- [x] 🤖 1. Eyes sketch: eye size, count per clump, follow speed, blink, worried look, mouth — knobs + presets for ranks 10/20/30/40 + Copy values — .planning/research/sketches/goop-eyes.html
- [ ] 🙋 2. Muzzy tunes the eyes sketch and copies the values — .planning/research/sketches/goop-eyes.html
- [ ] 🤖 3. Jelly eyes (drawn like the zap highlight quad), values live from content/tuning/eyes.json — src/goo/jelly/index.ts
- [ ] 🤖 4. Particle eyes, same values — src/goo/particle/index.ts
- [ ] 🤖 5. The renderer gets rank, pressure and the focus point (falling piece / laser) — src/goo/types.ts
- [ ] 🤖 6. e2e: eyes at 10/20/30/40, closing on a zap, shots at every portrait size — e2e/eyes.mjs

## F40 🎮 The Veteran, ranks 10–29, and his capture at 30
Done when: every rank 10–30 has its moment from design/story.md (voice · lines · look), played once per device at the console like 0–9; whispers grow from feelings to words (15) to names (24), and the Veteran says he hears "no voices" (12); the rank-gated silly fines appear on the payslip and the report wording changes after 30; white joins as a normal colour at 30 (Muzzy 2026-10-24: keep white — the Veteran's clump stands out by behaviour and open eyes, F63); every word in en.json, every number in content/; GDD §5 updated.
why: the middle of the game needs a reason to keep climbing — a friend on the inside, then losing him.
Check: e2e/story.mjs plays every moment 0–30 (right voice, words, once only, replay) with shots at every portrait size · unit tests (whisper stages, fines by rank) · check:full
- [x] 🤖 1. Moments 10–30 as data + their lines — content/story/moments.json
- [x] 🤖 2. New looks the moments need (speaker cut-in, the capture) — src/game/lessons/StoryView.tsx
- [x] 🤖 3. Whisper stages: words from 15, names from 24, "no voices" at 12 — src/game/lessons/storyMoments.ts
- [x] 🤖 4. Rank-gated silly fines + report wording after 30 — src/progress/payslip.ts
- [x] 🤖 5. White at 30: confirm it joins as a normal colour (goo colour + unlock rank) — content/tuning/goo-colors.json
- [x] 🤖 6. e2e: every moment 0–30, shots at every portrait size — e2e/story.mjs
- [x] 🤖 7. Update GDD §5 (story, ranks 10–30) — .planning/GDD.md
- [x] 🤖 8. Muzzy's answers: the alarm's words turn white (moments.json looks.alarmWords #ffffff → --crt-ink on the alarm; story.mjs checks the colour) — content/story/moments.json

## Notes
- Plan OK (Muzzy 2026-10-24: "go" — retro draft kept, white at 30 = (a) keep it, start Sprint 16).
- No open P0/P1 bugs (B001–B003 are P3, not in these files).
- Order: F62 sketch first (task 1) so Muzzy can tune while F40 builds; F62 tasks 3–6 wait on his values.
- Open roadmap question (not this sprint): cut F47 (the zap look) — F67 did it.
- F62 task 1 (8b1f684): goop-eyes.html — zap-look's jelly + Muzzy's zap; a 2-cell piece sweeps the top half for the eyes to follow; Rank 10/20/30/40 buttons, Pressure slider, Seal a crack, Refill; 23 knobs grouped by rank (eye size/pupil/spacing/count/colours, which clumps get eyes at 10 and 20+, follow speed/range, blink, worried brows + pupil shrink, relief, zap close, mouths, piece speed); presets Tiny & shy · Cartoon · Creepy. Faces are a fixed roll per clump (no flicker). Shots looked at (390x844 + 1440x900, every rank, zap, relief).
- F40 tasks 1–7 (helper, merged 2026-10-24: bef54c6 · 1780068 · 5359a5d · c6aac8c · ba602ba · 50d4095 · ed96f9d): moments 10–30 (10–29 the Veteran; 30 = the capture: his line "── kid, they're onto ──" cut off, then Management on the monitor with a red alarm) · moments.json `looks` block (flickerSeconds, alarmSeconds, alarmColour, crackleEvery, cutSeconds) + line flags cut (29, 30) · crackle (25) · monitor flicker (12, 19, 28) / alarm (30); reduce motion = no flicker, steady red · whisper `stages` (8 feelings · 15 words · 24 names) + noVoicesFrom 12 → Management's "THERE ARE NO VOICES…" as an in-shift toast after a whisper · payslip.json caughtRank 30: the association fine comes first, once per device; paydays from 30 use en.json payslip.afterCaught · white at 30 already true (shift.json colorsByRank: 6 colours at 30), a test pins it · e2e/story.mjs 0–30 (237 ok) at every portrait size · GDD §5. Area: check:fast 514 tests green, story/payslip/day ALL PASS. Shots looked at by Claude: capture cut 390, no-voices 360, after-capture payday 390.
- Tank looks for 10, 11, 15, 18, 20, 22, 24, 27 (eyes, whispers, cracks…) can't show at the console: the words play now; the looks wait for F62 and later pieces (story.md allows it). No look yet for 16 (new acronym — monitor blank while he talks) or 30's "last squelch" (the cut just ends his line).
- Ask Muzzy (F40): the after-capture payday words ("Retired colleagues' debts are now yours." · "Remaining passage debt (incl. Operator #0001)") · 2 extra whisper names (Ines, Teodor) beside Odile and Bram · the "no voices" toast is 4 lines at 360 — OK or shorter? · alarm = green words on flashing red — turn the words white?
- Muzzy 2026-10-24 on the F40 Ask Muzzy lines: after-capture payday words "sure" (kept) · Ines + Teodor "yes" (kept) · the 4-line "no voices" toast "do what you think is best" → kept whole (the fine is the joke; it's up only a few seconds and only after a whisper) · alarm words "turn words white" → done (task 8). story.mjs ALL PASS, capture-390 shot looked at (white words on red).
