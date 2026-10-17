## ▶ RESUME HERE
Goo lab ready: L1 Pillow, L2 Splat, L3 Particles, L4 Jelly (direction A, grid jelly) and L5 Free goo (direction B, playable), all in the planner's Sketches tabs.
Muzzy: play the lab on your phone, then pick A or B (F02b) and a look (F02); note which knobs you moved.
Next question after that: F03, crack colours.

## Where we are
Stage: define · Milestone: — · Sprint: — · Branch: master (default) · Version: v1 was 1.1.13 (package.json; remake numbering decided at /define)
Live: https://thebluemuzzy.github.io/GOOPS/ (v1, deployed from `gh-pages` via `npm run deploy`; stays up until the remake replaces it)

## Key facts
**Run/deploy (v1):** `npm run dev -- --host` · tests `npm run test:run` (210 tests, husky runs them on commit) · deploy `npm run deploy` → gh-pages
**Remake setup:** v1 design docs (PRD, vision, glossary, soft-body, tutorials) → `.planning/research/v1/`. GSD state/phases/investigations → `.planning/archive/gsd/`. BMUZ 1 hooks removed 2026-10-16.
**Planner (PPP):** https://claude.ai/artifact/9oMd5gxAV9troSKtyQWs2z (pilot) — `node ~/.claude/config/bmuz/templates/ppp/build-ppp.mjs .` → republish `.planning/ppp.html` to that URL (gitignored, generated)
**Remote:** github.com/TheBlueMuzzy/GOOPS

## Log
- 2026-10-16 — Goo round 2: research (videos, CodePens, techniques) + goo lab L1–L5; planner gets Sketches tabs and /ppp
- 2026-10-16 — Discovery: v1 review, goo research, GDD draft
- 2026-10-16 — Started the BMUZ 2 remake: old code archived to `archive/goops-v1`, GSD planning archived, /discover begun
