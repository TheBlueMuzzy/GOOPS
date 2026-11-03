# Sprint 31 — Every rank rule in one place
Started 2026-11-02 · Milestone M6 1.0 · Features: F78, F79
(Replanned 2026-11-02 before any task started: Muzzy — the rank pivot goes before F73 — Crisp pixel type, which is back to 🟢 ready.)
What changes for Muzzy: every rank gate in Goops (colours, junk, breakdowns, twists, the Veteran, the final shift, titles, upgrades, story moments, scraps grants) lives in ONE file, content/tuning/ladder.json, shown as a chart in a new Dev Kit "Ladder" tab — move a beat there and the running game follows. Stays the same: the game plays exactly as today (still 51 ranks — the 30-rank ladder is the next sprint, F80 — The 30-rank ladder).

## F78 🧱 One rank ladder file
Done when: a framework module (framework/ladder) — a ladder file of named beats → rank (+ per-rank scraps grants, titles, the top rank), `rankOf(name)` / `beatsAt(rank)` read live (Dev Kit edits apply while it runs — module contract), a Dev Kit "Ladder" tab showing the chart (rank · tank changes · upgrade · story/scraps) where a beat's rank can be changed live, its own tests + README · Goops installs it, content/tuning/ladder.json holds TODAY's numbers, and every system reads its gate from it (the old fromRank / unlockRank / caughtRank / colorsByRank … fields are gone) · story moments find their rank through the ladder · the game plays exactly as before (every test + e2e unchanged and green)
why: Muzzy 2026-11-02: "ensure the architecture makes pivots like this easier (hardcoding stuff can lead to really tough refactors)" — a rank change should be one number in one file.
Check: the ladder module's own tests · install-module's checks · check:fast · check:full (nothing changes in play) · e2e/ladder.mjs: the Dev Kit Ladder tab lists every beat; moving one (wild 40 → 39) changes the running game at once; no console errors · Claude looks at the Ladder tab at 390x844 + 1440x900
- [x] 🤖 1. The ladder module in the framework: beats → rank, per-rank grants/titles, maxRank; rankOf / beatsAt, live; tests; README — a new ladder/ module beside ~/Documents/dev/framework/saves/ (built in Goops first as src/ladder/, self-contained for extract.mjs — see Notes)
- [ ] 🤖 2. The Dev Kit "Ladder" tab: the chart, a beat's rank editable live, saved to the game's ladder file (only its own keys) — ~/Documents/dev/framework/devkit/kit/DevKit.tsx
- [x] 🤖 3. Goops installs it; content/tuning/ladder.json with today's numbers (51 ranks) — content/tuning/ladder.json
- [x] 🤖 4. Every system asks the ladder: progression (unlocks, titles, maxRank), shift (colours, junk, quota steps), breakdowns, twists, whiteGoop, finalShift, payslip, eyes chorus, art hatch, upgrades' ranks — the old fields removed — src/engine/config.ts
- [x] 🤖 5. Story moments reach their rank through the ladder (keyed by beat / slot, not a rank number) — content/story/moments.json
- [ ] 🤖 6. e2e: the Ladder tab + a live move; add to check:full; TDD §1/§3 + Decisions (Muzzy's pivot) — e2e/ladder.mjs

## F79 🧱 No rank numbers in code or tests
Done when: src/goo/shared/faces.ts' 10 / 20 / 30 / 40 become ladder beats (faces on, late looks, worried, mouths) · tests, e2e and the bots ask the ladder (`rankOf('wild')`, `?rank=${rankOf('wild')}`) instead of restating ranks (~285 test lines, ~240 e2e lines, ~24 script lines — audit 2026-11-02) · a lint rule refuses a bare rank number in game code, tests and e2e (0 allowed), in the framework lint module · comments that name old rank numbers say the beat instead
why: so the next sprint's 30-rank ladder (F80 — The 30-rank ladder) changes content only — no test or code edits.
Check: lint (the new rule) green on Goops · a trial move of one beat in ladder.json (e.g. wild 40 → 41) keeps check:fast green with no test edit, then put back · check:full
- [ ] 🤖 1. faces.ts: its rank thresholds → ladder beats — src/goo/shared/faces.ts
- [ ] 🤖 2. A shared rankOf helper for tests + e2e; tests ask it — tests/ladder.ts
- [ ] 🤖 3. e2e + bots ask it (?rank=…) — e2e/start.mjs
- [ ] 🤖 4. The lint rule (framework lint module), on in Goops — ~/Documents/dev/framework/lint/kit/rules.mjs
- [ ] 🤖 5. The trial move (one beat moved, nothing else edited, checks green) + check:full — content/tuning/ladder.json

## Notes
- Audit 2026-11-02 (helper, spot-checked by Claude): rank gates live in 14 fields across 9 content files; one code file hard-codes ranks (faces.ts: 10/20/30/40 — checked); moments.json keyed by rank number (51 keys); en.json story keys named by rank (r0sign…); saves keep totalXp (rank worked out). Tests ~285 lines / e2e ~240 / scripts ~24 restate ranks.
- Plan: .planning/research/ladder-30.md (the 30-rank table, the scrap drip, Muzzy's answers §7).
- Muzzy 2026-11-02: no beta players — no save remap (F81 cut); the ladder before F73 — Crisp pixel type; ~45–50 shifts to the top; the Veteran's +8 "feels right"; growing cracks reworked → F83 — Growing cracks take a new crack's place. Earlier the same day: F49 — Covered cracks drain half? (bot rerun) yes (half wear + half bubbles); F46 — Operator Journal cut.
- F78 calls (Claude, auto mode 2026-11-02):
  - The module is built in Goops first — `src/ladder/` (ladder.ts + index.ts + README, no game imports) — so the framework session can lift it with extract.mjs; Goops' binding is `src/progress/ladder.ts` (rankOf, maxRank). The engine asks it directly (twists, whiteGoop, finalShift, machines, config steps) — engine configs no longer carry a rank.
  - ladder.json shape (for the Dev Kit Ladder tab, F78 task 2): `maxRank` · `beats { name: rank }` · groups `titles`, `upgrades`, `story` (`{ name: rank }`, asked as "titles.technician") · `grants { scraps: { beat: n } }` (empty today; progression scrapsAt + the bots already add it) · `_help` + `_ranges` [0, 60, 1] for every number.
  - 35 beats; names: firstDay nextPiece visorBreaks swap junk1 whisperCold laserBreaks upgradesShop controlsBreak junk2 whispersFeelings junk3 fifthColour facesOn noVoices fineHearingVoices whispersWords fineTalkingToGoop twoColourPieces lateLooks whispersNames sixthColour cracksGrow veteranCaught worried whiteGoop pendingRetirement wildGoop mouths quotaEaseEnds fineTalkingBack hatch eyesChorus seventhColour finalShift.
  - Step tables name beats (shift.json colorsByBeat / junkByBeat / quota.addByBeat: the counts stayed in shift.json). The quota's −6 runs from cracksGrow to a new beat quotaEaseEnds (40). The debt's afterRank = veteranCaught (same 30). Silly fines name a beat each (payslip.json sillyFines: "firstDay" = always).
  - Story: moments.json keys stay their ids ("0"…"50" — the ranks they were written for), so tips-memory ids (story:31) and every e2e seen-list stay valid; ladder.json `story` says which rank each plays at (re-point, never rename; two on a rank play in the ladder's order). Whisper stages name beats.
  - Upgrades: `upgradeRank(def)` (src/progress/upgradeShop.ts) asks the ladder; a test's own UpgradeBook names its ranks in `ranks` (tests/upgradeShop.test.ts); test-only upgrades sit at 0.
  - faces.ts' 10 / 20 / 30 / 40 switched to the beats now (F79 task 1's code part — it was one line each).
  - Test edits were field-name reads only: colorsByRank → colorsByBeat, tuning.caughtRank → rankOf('veteranCaught'), dueRanks → dueMoments (ids), momentFor(id), u.rank → upgradeRank(u), tuning.maxRank → maxRank(); restated numbers untouched (F79). 694 → 708 tests (+14 ladder).
- Kept for F73 — Crisp pixel type (measured 2026-11-02 when it was planned first): the kit (framework 0.39.0) has no font snapping — fonts.json `pixelSize` is documentation only (ui-kit/kit/fonts/gameFonts.ts); body = 18 px floor × Text size, × font-scale 1.25 per step (applyStyle.ts). Goops: kit 0.37.3, only Nokia (all four roles); F76's art-words floor in app.css + main.tsx. Pixel Operator 8 isn't on disk (the sketch embeds it as base64).
