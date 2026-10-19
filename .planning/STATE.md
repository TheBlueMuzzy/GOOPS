## ▶ RESUME HERE
2026-10-19 01:45 — **F27 approved ✅ → Sprint 05 done (F26 + F27); M3 Breakdowns complete.** Next: `/sprint` for sprint 06. Still open from F26: Muzzy's message-timing playtest (carried as a 🙋 task). Branch `dev/m1-core-shift` (not delivered), check:fast green (289 tests), every e2e script green, reviewed through the F27 cleanup commit.
F27 final (2026-10-19): **crack hill** (`cracks.band` "hill": most likely row halfway from each column's goop to the pressure line, `spread` 0.3, never above the line; empty columns borrow height from stacks ≤ 4 columns away; cracks > 75% up drain at half, unseen) · drain 0.0005 · half pause stops the goo too (Muzzy: you can't click in it) · fonts = Nokia Cellphone FC (Muzzy's Dev Kit pick). Why: cracks formed low in EMPTY columns (~9 in 10 cracks are there), so drop-wait-pop met the quota; then the halfway band drew a visible flat line. Bots: research/balance-bots.md (bottom). Shots: `node e2e/crack-spread.mjs`. Lesson (game-only): report crack heights split by empty vs goop columns — an average "above the goop" hid that it was height above the floor (Muzzy caught it).
Late 2026-10-18 (sprint tasks 24–36): readout says PSI, sits on the BENT pressure line (visor curve), stays under the top row near the top · clicks pick the goop you SEE under the curve (single cells near corners rotated the piece) · visor glitch waits for an empty meter, then builds over rampMs 4 s (machines count brokenMs) · repairs proven to refill meters (e2e) · poking goop that can't pop jiggles it (`poke` knob in both goo files; e2e/poke.mjs) · console labels CONTROLS / LASER / VISOR · **portrait only** (Muzzy) · keep 12 visible columns (Muzzy). Parking lot: readable cracks (bubbles, x-ray, sealed look, half drain when covered).
Built 2026-10-18: Muzzy's own HUD layout (one top row · bottom panel LASER/CONTROLS/VISOR + INTEGRITY · pressure readout on the line, slide/mirror in Settings · landing-strip chevrons) · plain-word messages at the stack · 4-step repairs + "fewer steps" upgrade hook · machines pause at the console · curved-TV visor always on in the vat, only over the tank · Dev Kit in Goops (0.18.0): every tuning file LIVE, ⏸ full / ◐ half pause, Snapshots + Bugs, Fonts tab with Muzzy's font library (8-bit Pusab not shipped — licence) · keys move the view · less slosh (spinCarry 0.5) · **new shift arc** (F27, worked out by maths: `.planning/research/balance-arc.md`): drain 0.001, +2% integrity per seal, crack rate hockey stick 10→45/min (curve 3), seal vent 1 s (+ sealVentMult upgrade hook), band halfwayPerColumn; seals during the rupture count.
**Sprint 06 (2026-10-19): know what alpha is + phone gestures** — **F07 ✅ decided:** alpha = the playable game for Muzzy + friends (no upgrades, no story), beta = story + upgrades + all three rank twists, 1.0 = polished; Dev Kit on for alpha → ROADMAP M4 (F28–F38) / M5 / M6, GDD §7. F02 closed ✅. **F10 waits on Muzzy's phone checklist** (`research/gestures.md` §3) → then F28 gesture fixes. Ready for the next sprint now: F29 sound basics, F36 readable cracks (should), F37 versions ❓; F12 tutorial after F10.
**Muzzy next:** sprint 06's 🙋 tasks when the drafts land · message timing playtest whenever (F26 task 6, carried).
**Two Claude sessions (Muzzy, 2026-10-18):** a SEPARATE session owns `dev/framework` + `~/.claude` (BMUZ) — framework v0.9 "Every game wired the same" (F59–F72: hooks first (F68), then F61 conformance pack…). THIS (Goops) session never edits the framework or BMUZ files; framework changes for Goops arrive on a branch this session merges. Open Dev Kit nit for that session: the closed-panel PAUSED pill overlaps "CRACKS" on a 390 phone.
Play: PC http://localhost:5173/?rank=4 (or ?rank=6) · phone http://192.168.1.152:5173 · private build https://claude.ai/artifact/6kKDMuj25K2fEMoVUj5rrg (last rebuilt before the Dev Kit work — rebuild before sharing) · bots: `npm run bots` → https://claude.ai/artifact/94yNKpzjvFNXxVzJoM75R7 · planner https://claude.ai/artifact/9oMd5gxAV9troSKtyQWs2z
NOT built yet: upgrades (engine ready), story, tutorial, sound.

## Where we are
Stage: develop · Milestone: M0 Design decided (M1–M3 built ✅) · Sprint: 06 (F10 gestures, F07 releases) · Doing: F10 + F07 drafts · Branch: dev/m1-core-shift · Version: v1 was 1.1.13 (package.json; remake numbering decided at /define)
Live: https://thebluemuzzy.github.io/GOOPS/ (v1, deployed from `gh-pages` via `npm run deploy`; stays up until the remake replaces it)

## Answered 2026-10-17 (written into GDD §4/§6) → build next sprint
- **New shift loop** (pressure → cracks → tank integrity → rupture → drain; quota = success, score = rating) — GDD §4. Replaces the 75 s pressure timer, win burst and "overflow ends the shift" (overflow now triggers a rupture; pieces keep coming during the drain).
- **Wall kick** = Settings toggle: Rotate vat / Shunt piece. **Hard drop removed** everywhere. **Cracks** only form where they can be sealed right now (v1's one-row-above bug fixed).
- **Controls** = one set, same timing (GDD §4 table): drop Space, ↑-rotate, instant R; add Right Ctrl (ccw), Numpad 0 (cw), hold Right Shift (swap), ↑ = console.
- **Art:** use Muzzy's `art/` SVGs (end screen, title, background, buttons) — I missed them overnight. Neon only where there's no art.
- Fill look: good for now. Black goop: decide later (rank 50). Leftover penalty: kept (part of the new loop's end).
- Info only, no answer needed: start screen is a placeholder for the console · every shift is rank 1 · pops are a placeholder until the zap is designed · rows are whole steps · the falling piece draws fully filled.

## Key facts
**Reviewed through:** 9bae7ea (+ its one cleanup) — /code-review low on 456487b^..9bae7ea, 2026-10-19
**Last full check:** F27 done commit, 2026-10-19 — no `check:full` yet; ran every e2e script one at a time (shift-smoke, controls, repairs, visor, poke, day, devkit-live, crack-spread, hud-shots) + check:fast, all green
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
