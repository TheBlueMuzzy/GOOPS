# Sprint 21 — the story's last stretch: ranks 40–49
Started 2026-10-26 · Milestone M5 Beta · Features: F45
What changes for Muzzy: ranking up from 40 to 49 plays the last ten story moments at the console — the Veteran's voice comes back through a crack, the goop talks through the speaker, Management slips ("HUMAN RESOURCE. *OPERATOR"), and a panel under the console rattles: the release valve is named. Stays the same: ranks 0–39, the shift rules, upgrades, the end report (its rank-40 fines and titles are already in).

## F45 🎮 Ranks 40–49 — the speaker comes back, Management slips, the valve is named
Done when: ranks 40–49 each play their story moment from design/story.md "Story moments, rank by rank" (voices, lines and looks), once per device and again from Settings → Replay lessons; the goop speaking through the speaker (41, 43, 48) reads as the goop, not the Veteran; the monitor's glitch (45) and the console panel that rattles (46, 47) play as attention calls; tank looks that need the shift (mouths at 40, every mouth opening at 48) happen in the next shift; every word in en.json, every number in content/; works at every portrait size (390x844, 360x780, ~1100 wide, 1440x900, 1920x1080 — portrait only).
why: the last stretch should feel like the walls closing in — the voices you lost come back, the Company starts to crack, and something under your own console is waiting to be opened.
Check: unit tests (moments 40–49 load, voices and looks valid) · e2e/story.mjs (ranks 40–49 play at the console, each line shown, looks fire) with shots looked at · check:full
- [ ] 🤖 1. Ranks 40–49 in moments.json (voices, looks, monitor / crackle / cut flags like F40) + their lines in en.json story.lines — content/story/moments.json
- [ ] 🤖 2. "The goop through the speaker" (41, 43, 48): the Veteran's speaker bubble, but the goop's look and lower-case words — a new voice value in the story runner — src/game/lessons/StoryView.tsx
- [ ] 🤖 3. Management slips (45): the monitor glitches for a beat ("something that isn't a face") and the slip line ("HUMAN RESOURCE. · *OPERATOR.") types, corrects itself — a new monitor look — src/ui/Console.tsx
- [ ] 🤖 4. The release valve is named (46, 47): a console panel that rattles as an attention call (it opens in F64 — The final shift); look numbers in content/ — src/ui/Console.tsx
- [ ] 🤖 5. Tank looks in the next shift: mouths appear at 40 (F62 already grows them), every mouth opens at once at the start of the shift after 48 — src/goo/shared/faces.ts
- [ ] 🤖 6. e2e: ranks 40–49 play at the console at every portrait size; story.mjs's 0–39 run extended to 49 — e2e/story.mjs
- [ ] 🤖 7. Update design/story.md (40–49 built), GDD story section, TDD if a real build choice is made (next free decision D25) — .planning/design/story.md

## Notes
- Muzzy 2026-10-26: picked "Story 40–49" for Sprint 21 (Claude's pick — it starts the chain F45 → F64 — The final shift → F65 — The ending, the longest road left to beta).
- Already built before this sprint (checked in content/): the 40+ silly fine "Talking back to the speaker", the rank titles, the debt line going up after 30, in-shift whispers 31+.
