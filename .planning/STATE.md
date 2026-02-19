---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-17
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 4 of 4 in current phase — Tutorial v2 UAT round 7 bug fixes
Status: Deploying — all fixes applied, 210 tests pass
Last activity: 2026-02-19 — Save + commit + deploy (UAT round 7 fixes)

Progress: █████████░ 93%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Session Changes (2026-02-19)

### UAT Round 7 Bug Fixes (This Session)

1. **Messages not showing during non-paused steps** (`useTrainingFlow.ts`) — ROOT CAUSE: `trainingDisplayStep` created a new object on every render. TutorialOverlay's useEffect depended on `[activeStep]` (reference equality), so during non-paused steps (game ticking at 40-60fps), the "swap" branch's 160ms timeout was perpetually reset — message never faded back in. Fixed by memoizing `trainingDisplayStep` with `useMemo` keyed on `currentStep?.id`, `messageVisible`, and `retryMessage`. This also fixes C2's pop message not showing (yellow pulsing with no message).

2. **Pressure cap bypass on 2nd crossing** (`useTrainingFlow.ts`) — After dismissing 1st 95% cap message, pressure rate was restored immediately. But pressure was already at 95%, so the re-cap interval's `belowThreshold` crossing detection never fired (pressure never dropped below cap to set the flag). Fixed: keep pressure rate at 0 after dismiss. Re-cap interval now waits for pressure to drop below cap (from player popping), then resumes rate. When pressure rises back to cap, re-caps. No infinite loop, no bypass.

3. **E-phase restructure: F1 before E1 race** (`trainingScenarios.ts`, `types/training.ts`, `tutorialSteps.ts`) — E1 advanced immediately on crack-sealed, jumping straight to F1 before player could pop or see scaffolding message. Split E1 into 3 steps:
   - **E1_SEAL_CRACK**: Brief intro → continuous spawn → seal the high crack
   - **E2_POP_SEALED**: Green goop pulses → 3s pop reminder (non-dismissible) → pop
   - **E3_SCAFFOLDING**: 1.5s pause delay (pop animation settles) → scaffolding concept message → tap to dismiss → F1

4. **C4 pop reminder missing** (`trainingScenarios.ts`) — After blue merge, C4 had no reshow timer. Added `reshowAfterMs: 3000, reshowNonDismissible: true` so "Pop it" re-shows if player doesn't act within 3s.

### Files Changed
- `hooks/useTrainingFlow.ts` — Memoized trainingDisplayStep, pressure cap re-watch rewrite, E1 reference update
- `types/training.ts` — Added E1_SEAL_CRACK, E2_POP_SEALED, E3_SCAFFOLDING step IDs (16 steps total)
- `data/trainingScenarios.ts` — E-phase split into 3 steps, C4 reshowAfterMs added
- `data/tutorialSteps.ts` — New messages for E1/E2/E3

### Deferred
- **Fill rendering "almost hole" inversion** — Documented in Known Issues. Needs isolated investigation.

## Next Steps

**Deployed.** Phase 33 Plan 04 UAT complete. Next: continue Phase 33 Plan 05 or move to Phase 34.

**What was rebuilt (2026-02-15):**
- 14 steps (down from 19), 6 phases (A:1, B:4, C:4, D:3, E:1, F:1)
- All new step IDs, messages, and scenario configs
- 6 new features: continuousSpawn, pressureCap, periodicCrackInterval, autoSkipMs, persistent D3 discovery, F1 ending states
- Pop-lowers-pressure works natively (no engine change needed)
- F1 graduation: pressure caps at 95% → practice message → swipe up → console
- F1 overflow: "Training is over. Swipe up to end." → console

**Files changed:**
- `types/training.ts`: New step IDs (14), new StepSetup fields (5)
- `data/trainingScenarios.ts`: Full rewrite (14 steps)
- `data/tutorialSteps.ts`: Full rewrite (new messages + F1 ending messages)
- `hooks/useTrainingFlow.ts`: Full rewrite (~700 lines, extracted helpers)
- `core/GameEngine.ts`: Added `trainingPopLowersPressure` property
- `Game.tsx`: Updated dev jump button step IDs
- `components/TrainingHUD.tsx`: Updated comment

**Known gaps to test:**
- Swipe-up exit gesture needs to emit INPUT_SWIPE_UP during F1 ending
- F1 overflow detection depends on GAME_OVER event firing in training mode
- Persistent D3 discovery trigger if D3 auto-skips
- Continuous spawning timing (300ms delay between piece-landed and next spawn)
- Pressure cap at 95% triggers F1 ending message correctly

### Key Technical Changes This Session

**PieceSpawn Refactor (types/training.ts, useTrainingFlow.ts)**
- Replaced `size: number` with `shape: GoopShape` + optional `rotation: number`
- Spawn logic now finds actual shape templates from TETRA_NORMAL/PENTA_NORMAL/HEXA_NORMAL
- Applies rotation via `getRotatedCells()` for initial orientation
- B1: blue T_I horizontal (rotation:1), B3: yellow T_T, B4: blue T_O (2x2), D2: green T_O

**Per-Blob Shake (GameBoard.tsx)**
- Removed per-color-group shake (was shaking ALL blobs of same color)
- Added `isBlobShaking = blob.id === shakingGroupId` check on each blob's `<g>` in both goo-filter and cutout sections
- Each blob shakes independently when rejected

**Training Input Gating (useInputHandlers.ts, GameBoard.tsx, Game.tsx)**
- `disableSwap`: Skips hold interval entirely (no radial graphic, no swap event)
- `disablePop`: All goop taps trigger shake+rejection when `AllowedControls.pop===false`
- `trainingHighlightColor`: Wrong-color taps trigger shake+rejection
- All three passed as props: Game.tsx → GameBoard → useInputHandlers

**Pressure Color Filter (useTrainingFlow.ts, types/training.ts)**
- New `advancePressureAboveColor` StepSetup field
- When set, pressure-above-pieces poll only checks cells of that color
- C1B uses `COLORS.YELLOW` — triggers when pressure covers yellow T, not all blues

**Highlight System (GameEngine.ts, useTrainingFlow.ts, GameBoard.tsx, actions.ts)**
- `trainingHighlightColor` on GameEngine + returned from useTrainingFlow
- CSS `training-pulse` animation: scale 1→1.06 with `transform-box: fill-box`
- Pop color restriction in PopGoopCommand: rejects pops of non-matching color
- C1C highlights YELLOW (pop yellow → C2 shows blue merge + solidify timing)

**B-Phase Single-Fall Flow (trainingScenarios.ts)**
- All 3 messages during SAME first piece fall: B1 (goop intro) → B1B at 25% → B2 at 40%
- B2: no separate piece spawn, no reshow, pauseGame:false, fast-drop enabled mid-fall
- B4_PRACTICE: new step after B3, spawns blue 2x2, "Practice what you've learned"
- 16 total steps across 6 phases

### Decisions Made

- Typography: 18px minimum body, CSS classes with !important, full project sweep
- Journal layout: accordion (single column) over sidebar+content (two column)
- TEXT_MANIFEST.md as editable text source-of-truth
- Garble system: bracket notation, no partial corruption
- Training mode: pendingTrainingPalette interception, tick gates, freezeFalling
- Advance arming prevents dismiss-tap from triggering advance
- B2 keywords: "down" and "press" are white, not green
- C-phase: pop yellow (not blue) → demonstrates merge + solidify timing with blue-on-blue

### Pipeline Architecture Session (2026-02-10)

**Goal:** Design a "Lossless Pipeline" integrating BMUZ + GSD + Agent Teams.

**Installed:**
- Agent Teams feature flag enabled globally (~/.claude/settings.json)
- `/build-with-agent-team` skill installed (~/.claude/skills/build-with-agent-team/)

**Architecture Explored (4-Agent Team):**
- Lead (user handler), Scribe (docs), Builder (code), Researcher (eyes)
- Scribe updates STATE/ROADMAP/SUMMARY/PRD/CLAUDE.md/memory in real-time
- Researcher uses Playground (design exploration) + Playwright (automated testing)
- Wrapper skill reads GSD PLAN.md and orchestrates AT team

**Critical Concerns Identified:**
- Token cost: 4 agents = 3-5x cost per session (too expensive for small tasks)
- AT is experimental (no session resume, known bugs, could change)
- Lead context bloat from message relaying (not actually "lean")
- GSD plans are sequential — parallel agents don't add speed
- Non-coders can't debug team coordination failures

**Revised Direction:**
- Enhanced single-agent with smart automation as default
- Agent Teams as opt-in power mode for big plans only
- Better hooks for auto-saving STATE.md (solve context loss without AT)
- Playground for non-CLI visual interaction (JSON config files)
- Subagents for parallel research (already works, no AT needed)

**User's Core Needs (refined):**
1. Low cost
2. Lossless memory + vision capture
3. Project manager that doesn't fall out of GSD loop
4. Simple, covers non-coder mistakes
5. End-to-end with flexible entry points
6. Parallel research + documentation
7. Non-CLI interaction methods

**Status:** Designing final architecture. No code built yet for pipeline skill.

### Known Issues

- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box
- Some SVG text in Art.tsx not yet standardized
- Per-step crack spawning now active (spawnCrack handler in useTrainingFlow.ts)
- **Fill rendering "almost hole" inversion**: When a fill shape nearly closes a hole (vertices almost touching), `fillRule="evenodd"` causes inverted colors at the near-connection point. The inset algorithm treats near-touching vertices as "opposite sides" and limits inset too aggressively. Fix options: try `nonzero` fill rule, or fix inset algorithm for near-touching vertices. Files: `core/softBody/rendering.ts` (`getInsetSoftBlobPath`), `components/GameBoard.tsx` (fill cutout path).

### Roadmap Evolution

- Milestone v1.5 shipped: Soft-body goop rendering, 4 completed phases (2026-02-08)
- Milestone v1.6 created: Progressive Tutorial, 8 phases (Phase 31-38)

---

## Session Continuity

Last session: 2026-02-19
**Version:** 1.1.13
**Branch:** feature/tutorial-infrastructure
**Build:** 286

### Resume Command
```
Phase 33 Plan 04 — Tutorial v2 UAT

Tutorial v2 rebuilt and UAT rounds 1-4 complete. 210 tests pass.
Tutorial2.md synced with implementation (including implementation notes).

Critical engine discoveries documented:
- PIECE_DROPPED fires BEFORE training pause (setTimeout(0) required)
- tickLooseGoop also emits PIECE_DROPPED (activeGoop guard required)
- All cracks use pressure-line formula (same as spawnGoalMark)

WHAT TO DO:
1. Run full A1→F1 flow — verify all fixes from rounds 1-4
2. Key things to test:
   - D2 retry: piece fills naturally → pop → droplets → message (smooth, ~4s)
   - E1 crack spawns at pressure line (not forced high)
   - F1 continuous play works (pieces keep spawning after each lands)
   - F1 pressure rises to 95% → practice message → swipe up → console
   - F1 overflow → end message → swipe up → console
   - Pieces don't change shape while falling (loose goop merge fixed)
3. If all pass → <deploy>
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
