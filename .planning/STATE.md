## ▶ RESUME HERE
🌙 Overnight auto build (2026-10-17, Muzzy: "move ahead and make the game as best as you can… auto mode").
Claude's audit + call: GO, bounded to M1 "Core shift" (F13–F16: engine, tank view + controls, Jelly/Particle goo switch, shift screens) on branch `dev/m1-core-shift`. Rules = v1 as shipped where M0 is open; every such call is listed under "Questions for Muzzy" below. NOT built tonight (need Muzzy's taste calls): real console menu, breakdowns, progression/ranks, story, tutorial.
Status: see SPRINT.md ticks.

## Where we are
Stage: develop (overnight M1) · Milestone: M1 Core shift · Sprint: 01 · Branch: master (default) · Version: v1 was 1.1.13 (package.json; remake numbering decided at /define)
Live: https://thebluemuzzy.github.io/GOOPS/ (v1, deployed from `gh-pages` via `npm run deploy`; stays up until the remake replaces it)

## Questions for Muzzy (from the overnight build)
- (filled in as the build hits them)

## Key facts
**Run/deploy (v1):** `npm run dev -- --host` · tests `npm run test:run` (210 tests, husky runs them on commit) · deploy `npm run deploy` → gh-pages
**Remake setup:** v1 design docs (PRD, vision, glossary, soft-body, tutorials) → `.planning/research/v1/`. GSD state/phases/investigations → `.planning/archive/gsd/`. BMUZ 1 hooks removed 2026-10-16.
**Planner (PPP):** https://claude.ai/artifact/9oMd5gxAV9troSKtyQWs2z (pilot) — `node ~/.claude/config/bmuz/templates/ppp/build-ppp.mjs .` → republish `.planning/ppp.html` to that URL (gitignored, generated)
**Remote:** github.com/TheBlueMuzzy/GOOPS

## Log
- 2026-10-16 — Goo round 2: research (videos, CodePens, techniques) + goo lab L1–L5; planner gets Sketches tabs and /ppp
- 2026-10-16 — Discovery: v1 review, goo research, GDD draft
- 2026-10-16 — Started the BMUZ 2 remake: old code archived to `archive/goops-v1`, GSD planning archived, /discover begun
