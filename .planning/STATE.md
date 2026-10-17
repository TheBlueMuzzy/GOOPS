## ▶ RESUME HERE
🌙 Overnight auto build (2026-10-17, Muzzy: "move ahead and make the game as best as you can… auto mode").
Claude's audit + call: GO, bounded to M1 "Core shift" (F13–F16: engine, tank view + controls, Jelly/Particle goo switch, shift screens) on branch `dev/m1-core-shift`. Rules = v1 as shipped where M0 is open; every such call is listed under "Questions for Muzzy" below. NOT built tonight (need Muzzy's taste calls): real console menu, breakdowns, progression/ranks, story, tutorial.
Status: see SPRINT.md ticks.

## Where we are
Stage: develop (overnight M1) · Milestone: M1 Core shift · Sprint: 01 · Branch: master (default) · Version: v1 was 1.1.13 (package.json; remake numbering decided at /define)
Live: https://thebluemuzzy.github.io/GOOPS/ (v1, deployed from `gh-pages` via `npm run deploy`; stays up until the remake replaces it)

## Questions for Muzzy (from the overnight build)
- **UI style:** I picked the kit's **Neon** (dark, glowing console readout; the goo stays the brightest thing on screen). Other options: clean, cozy, cartoon, pixel (pick sheet: framework/ui-kit/screenshots/pick-sheet.png). Keep Neon?
- **Console-lite:** the start screen is a plain menu (Start shift · Settings) standing in for the real console-as-menu (pillar 1). The console's design is still open.
- **Controls I changed from v1:** R swaps instantly (v1: hold R for 1.5 s); ↑ also rotates clockwise (v1: Q/E only). Swipe up / W / Space opens the Console (pause) menu.
- **Rank:** every shift plays at rank 1 rules (no progression yet).
- **Hard drop:** v1 had none in play (its HardDropCommand was never called). Added one (drops to the ghost and locks, 2 pts/row) for keyboard/tests; touch still uses drag-down fast drop. Want a hard-drop gesture?
- **Off the centre line:** a wall kick moves the piece off the middle column for the rest of its fall (v1 did this too). That breaks "always falls down the middle" — keep or snap back?
- **Crack vs pop line:** v1 spawns cracks up to one row ABOVE the pop line while the line is between rows, so a fresh crack can briefly be un-sealable. Kept as v1 — fix?
- **Win burst:** after you meet the quota, v1 sprays extra cracks; here they count as bonus seals, and past 90% pressure all cracks clear. OK?
- **Overflow** (no room to spawn) ends the shift — won if the quota is met, else lost. OK?
- **Leftover penalty:** 50 points per goop cell left at the end (score can't go below 0), as v1.
- **Rows are whole steps:** v1 moved the piece in fractions of a row; now it steps a row at a time and the goo glides between (smoother to look at, simpler rules).

## Key facts
**Run/deploy (v1):** `npm run dev -- --host` · tests `npm run test:run` (210 tests, husky runs them on commit) · deploy `npm run deploy` → gh-pages
**Remake setup:** v1 design docs (PRD, vision, glossary, soft-body, tutorials) → `.planning/research/v1/`. GSD state/phases/investigations → `.planning/archive/gsd/`. BMUZ 1 hooks removed 2026-10-16.
**Planner (PPP):** https://claude.ai/artifact/9oMd5gxAV9troSKtyQWs2z (pilot) — `node ~/.claude/config/bmuz/templates/ppp/build-ppp.mjs .` → republish `.planning/ppp.html` to that URL (gitignored, generated)
**Remote:** github.com/TheBlueMuzzy/GOOPS

## Log
- 2026-10-16 — Goo round 2: research (videos, CodePens, techniques) + goo lab L1–L5; planner gets Sketches tabs and /ppp
- 2026-10-16 — Discovery: v1 review, goo research, GDD draft
- 2026-10-16 — Started the BMUZ 2 remake: old code archived to `archive/goops-v1`, GSD planning archived, /discover begun
