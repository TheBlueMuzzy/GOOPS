## ▶ RESUME HERE
🌙 Overnight build done (2026-10-17): M1 "Core shift" plays end to end — one full shift, v1 rules, Jelly or Particle goo (Settings → Gameplay → Goo style). Branch `dev/m1-core-shift` (not delivered).
Play: https://claude.ai/artifact/6kKDMuj25K2fEMoVUj5rrg (private build) · or on this PC: http://localhost:5173 · phone: http://192.168.1.152:5173 (dev server left running)
Muzzy: play a shift on PC + phone, try both goo styles, then answer "Questions for Muzzy" below (most are v1 rule calls I kept).
NOT built (need your taste calls first): the real console menu, breakdowns, ranks/progression, story, tutorial, sound.

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
- **Goo — fill look:** goop that just landed is drawn darker + see-through above a rising fill line; when it's ready it pulses with a faint halo. Invented tonight (not in the sketches) — knobs unfilledAlpha / unfilledDim / readyGlow / readyPulse in content/tuning/goo-*.json. Right feel?
- **Goo — falling piece** is drawn fully "filled"; it only starts filling once it lands. OK?
- **Particle hard drop:** the goo falls at its own speed (max 11 cells/s), so it arrives ~1.5–2 s after the piece has already locked. Faster?
- **Pops (both):** a quiet shrink/drain placeholder until the laser "explode/harden" zap is designed.
- **Black goop** (#1a1a2e, rank 50) barely shows on the dark tank — only by its shine.
- **Rows are whole steps:** v1 moved the piece in fractions of a row; now it steps a row at a time and the goo glides between (smoother to look at, simpler rules).

## Key facts
**Run (remake):** `npm run dev -- --host` · checks `npm run check:fast` (127 tests + build + lint + UI rules) · e2e `npm run e2e:smoke`, `npm run e2e:controls`, `node e2e/perf.mjs` · goo lab (dev only) `/goo-lab.html` · preview build `npx vite build --base ./ --outDir dist-preview` → republish to the Play artifact
**v1:** branch `archive/goops-v1` (old run/deploy: `npm run deploy` → gh-pages, still live)
**Remake setup:** v1 design docs (PRD, vision, glossary, soft-body, tutorials) → `.planning/research/v1/`. GSD state/phases/investigations → `.planning/archive/gsd/`. BMUZ 1 hooks removed 2026-10-16.
**Planner (PPP):** https://claude.ai/artifact/9oMd5gxAV9troSKtyQWs2z (pilot) — `node ~/.claude/config/bmuz/templates/ppp/build-ppp.mjs .` → republish `.planning/ppp.html` to that URL (gitignored, generated)
**Remote:** github.com/TheBlueMuzzy/GOOPS

## Log
- 2026-10-17 — Overnight M1 build: clean remake scaffold (React 19 + Vite 7), engine (v1 rules, 100 tests), tank view + v1 controls, Jelly/Particle goo switch, kit UI (Neon); ui-kit 0.10.5 (phone HUD fix)
- 2026-10-17 — F02 picked: L4 Jelly; F02b = A (grid); /sketch command made
- 2026-10-16 — Goo round 2: research (videos, CodePens, techniques) + goo lab L1–L5; planner gets Sketches tabs and /ppp
- 2026-10-16 — Discovery: v1 review, goo research, GDD draft
- 2026-10-16 — Started the BMUZ 2 remake: old code archived to `archive/goops-v1`, GSD planning archived, /discover begun
