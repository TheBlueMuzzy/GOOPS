## ▶ RESUME HERE
🌙 Overnight build done (2026-10-17): M1 "Core shift" plays end to end — one full shift, v1 rules, Jelly or Particle goo (Settings → Gameplay → Goo style). Branch `dev/m1-core-shift` (not delivered).
Play: https://claude.ai/artifact/6kKDMuj25K2fEMoVUj5rrg (private build) · or on this PC: http://localhost:5173 · phone: http://192.168.1.152:5173 (dev server left running)
Sprint 03 built — a working day at the console (F20 ✅ progression · F21 console · F22 ✅ upgrade-ready engine). Muzzy: play a day (shift → console → rank up → next shift) and answer the F21 questions in SPRINT Notes. Reviewed through: b3835ad.
NOT built (need your taste calls first): the real console menu, breakdowns, ranks/progression, story, tutorial, sound.

## Where we are
Stage: develop (overnight M1) · Milestone: M2 Working day · Sprint: 03 · Branch: master (default) · Version: v1 was 1.1.13 (package.json; remake numbering decided at /define)
Live: https://thebluemuzzy.github.io/GOOPS/ (v1, deployed from `gh-pages` via `npm run deploy`; stays up until the remake replaces it)

## Answered 2026-10-17 (written into GDD §4/§6) → build next sprint
- **New shift loop** (pressure → cracks → tank integrity → rupture → drain; quota = success, score = rating) — GDD §4. Replaces the 75 s pressure timer, win burst and "overflow ends the shift" (overflow now triggers a rupture; pieces keep coming during the drain).
- **Wall kick** = Settings toggle: Rotate vat / Shunt piece. **Hard drop removed** everywhere. **Cracks** only form where they can be sealed right now (v1's one-row-above bug fixed).
- **Controls** = one set, same timing (GDD §4 table): drop Space, ↑-rotate, instant R; add Right Ctrl (ccw), Numpad 0 (cw), hold Right Shift (swap), ↑ = console.
- **Art:** use Muzzy's `art/` SVGs (end screen, title, background, buttons) — I missed them overnight. Neon only where there's no art.
- Fill look: good for now. Black goop: decide later (rank 50). Leftover penalty: kept (part of the new loop's end).
- Info only, no answer needed: start screen is a placeholder for the console · every shift is rank 1 · pops are a placeholder until the zap is designed · rows are whole steps · the falling piece draws fully filled.

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
