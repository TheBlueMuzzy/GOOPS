# Sprint 21 — the story's last stretch: ranks 40–49
Started 2026-10-26 · Milestone M5 Beta · Features: F45
What changes for Muzzy: ranking up from 40 to 49 plays the last ten story moments at the console — the Veteran's voice comes back through a crack, the goop talks through the speaker, Management slips ("HUMAN RESOURCE. *OPERATOR"), and a panel under the console rattles: the release valve is named. Stays the same: ranks 0–39, the shift rules, upgrades, the end report (its rank-40 fines and titles are already in).

## F45 🎮 Ranks 40–49 — the speaker comes back, Management slips, the valve is named
Done when: ranks 40–49 each play their story moment from design/story.md "Story moments, rank by rank" (voices, lines and looks), once per device and again from Settings → Replay lessons; the goop speaking through the speaker (41, 43, 48) reads as the goop, not the Veteran; the monitor's glitch (45) and the console panel that rattles (46, 47) play as attention calls; tank looks that need the shift (mouths at 40, every mouth opening at 48) happen in the next shift; every word in en.json, every number in content/; works at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: the last stretch should feel like the walls closing in — the voices you lost come back, the Company starts to crack, and something under your own console is waiting to be opened.
Check: unit tests (moments 40–49 load, voices and looks valid) · e2e/story.mjs (ranks 40–49 play at the console, each line shown, looks fire) with shots looked at · check:full
Checked: unit tests 601 pass (moments 40–49 load, voices/looks/flags valid) · e2e/story.mjs 0–49 ALL PASS (461 ok; 41/45/46 at all 5 portrait sizes) · e2e/eyes.mjs 62 ✓ · shots looked at by Claude (goop41 1100, glitch45 1440, hatch46 360, rank-48 mouths 390): nothing clipped, hatch outline has room · check:full 30/31 at 558d1c2 (24.6 min) — only eyes failed (the mouths' shut wait was wall-clock under load) → fixed ecedba7, eyes alone 62 ✓
- [x] 🤖 1. Ranks 40–49 in moments.json (voices, looks, monitor / crackle / cut flags like F40) + their lines in en.json story.lines — content/story/moments.json
- [x] 🤖 2. "The goop through the speaker" (41, 43, 48): the Veteran's speaker bubble, but the goop's look and lower-case words — a new voice value in the story runner — src/game/lessons/StoryView.tsx
- [x] 🤖 3. Management slips (45): the monitor glitches for a beat ("something that isn't a face") and the slip line ("HUMAN RESOURCE. · *OPERATOR.") types, corrects itself — a new monitor look — src/ui/Console.tsx
- [x] 🤖 4. The release valve is named (46, 47): a console panel that rattles as an attention call (it opens in F64 — The final shift); look numbers in content/ — src/ui/Console.tsx
- [x] 🤖 5. Tank looks in the next shift: mouths appear at 40 (F62 already grows them), every mouth opens at once at the start of the shift after 48 — src/goo/shared/faces.ts
- [x] 🤖 6. e2e: ranks 40–49 play at the console at every portrait size; story.mjs's 0–39 run extended to 49 — e2e/story.mjs
- [x] 🤖 7. Update design/story.md (40–49 built), GDD story section, TDD if a real build choice is made (next free decision D25) — .planning/design/story.md

## Notes
- Muzzy 2026-10-26: picked "Story 40–49" for Sprint 21 (Claude's pick — it starts the chain F45 → F64 — The final shift → F65 — The ending, the longest road left to beta).
- Already built before this sprint (checked in content/): the 40+ silly fine "Talking back to the speaker", the rank titles, the debt line going up after 30, in-shift whispers 31+.
- Muzzy 2026-10-26: asked for F54 — Offline install + replace v1; chose to keep F45 now and leave F54 for the 1.0 /deliver (offline install already built in F38; the rest is the go-live move).
- Claude 2026-10-26 (build): the goop through the speaker = the speaker bubble's place AND its speech wave, in the goop's dark colours (not his light ones) — it's coming out of the speaker, but it's the goop. moments.json looks.goopOutline 'plain' switches it to the in-your-head outline.
- Claude 2026-10-26 (build): 45's slip line is a cut Management line — no Got it, it types, the glitch shows for 0.18 s half a second in, and "*OPERATOR. …" replaces it by itself (looks.cutSeconds after typing).
- Claude 2026-10-26 (build): the hatch shows on the console from rank 46 (art.json console.hatch.fromRank), so ranks 0–45 look the same as before; it rattles 3 × 0.5 s and the moment's outline (look "hatch") points at it.
- Claude 2026-10-26 (surprise): a shift starts with an empty tank, so "every mouth opens at once at the start of the shift" can't happen at the very start — it waits until 3 mouths show (eyes.json chorusMouths), then all open for 1.6 s; marked seen only when it actually plays (D25).
- Claude 2026-10-26 (surprise): this game has no content/devkit/select.json (no Select tab), so data-knobs="hatch" is on the hatch but there's no list to add it to.
- Muzzy 2026-10-26: noted — the hatch and the not-a-face are placeholder drawings by Claude (public/art/ConsoleHatch.svg, public/art/NotAFace.svg) — redraw either any time; the hatch's box is art.json console.hatch.at.
- Muzzy 2026-10-26: the hatch stays from rank 46 (Claude's pick). Feel question ("walls closing in…?") → "approved". F45 ✅.
- Not built (no piece for them yet): 41's grille buzzing with the mouths, 42's glowing pressure line — the words play.
