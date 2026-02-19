---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-17
---

# Project State

## Current Position

Phase: 33 of 38 (Rank 0 Training Sequence)
Plan: 4 of 4 in current phase — Tutorial v2 UAT round 10
Status: UAT round 10 — E-phase redesign + F1 soft crash fix. ONE REMAINING BUG (see Next Steps).
Last activity: 2026-02-19 — E1/E2 redesign, F1 gen counter fix, message flash fix, E1 pulse still missing

Progress: █████████░ 93%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `feature/tutorial-infrastructure` (Phase 31 complete, Phase 32 complete, Phase 33 in progress)

## Session Changes (2026-02-19)

### UAT Round 7 Bug Fixes (Previous Session)

1. Memoized `trainingDisplayStep` — fixes messages not showing during non-paused steps
2. Pressure cap bypass on 2nd crossing — keep rate at 0 after dismiss, re-cap on next crossing
3. E-phase restructure — Split E1 into E1_SEAL_CRACK, E2_POP_SEALED, E3_SCAFFOLDING (16 steps)
4. C4 pop reminder — Added `reshowAfterMs: 3000, reshowNonDismissible: true`

### UAT Round 8 Bug Fixes (This Session)

5. **E2 message showed immediately instead of as delayed hint** — E2 had `pauseGame: false` with no `messageDelay`, so message appeared instantly on step entry. Replaced `reshowAfterMs` + `reshowNonDismissible` with `messageDelay: 3000` + `nonDismissible: true`. Message now hidden for 3s; if player pops before timer, advances without ever showing message.

6. **E2 soft lock on non-dismissible reshow** — Previous reshowAfterMs handler showed non-dismissible message but didn't ensure goop was poppable. Now using messageDelay approach with `autoSkipMs: 30000` safety valve. Added `nonDismissible` field to StepSetup type and updated messageDelay handler to set `canDismiss(false)` when flag is true.

### UAT Round 9 — E-Phase Flow Audit (This Session)

Full audit of E-phase FTUE flow revealed 4 structural bugs causing cascading issues:

7. **Overflow spawn position too low** — Training mode spawned pieces at row 2 (BUFFER_HEIGHT-1) instead of row 0. Overflow triggered when goop was only 2 rows into visible area. Fixed: spawn at row 0 for all modes.

8. **Leaked setTimeout callbacks between step transitions** — Continuous spawn handler created `setTimeout(0)` + `setTimeout(300)` that persisted across step changes. When E1 advanced to E2 mid-continuous-spawn, the leaked callback unpaused the game between steps. Fixed: track timeouts in `continuousSpawnTimeoutsRef`, clear them in `advanceStep()` and step cleanup.

9. **Message flash on step advance** — `advanceStep()` didn't call `setMessageVisible(false)`. For tap-advance steps (E3→F1), one render frame showed the next step's message before the step setup effect hid it. Fixed: hide message immediately in `advanceStep()`.

10. **D3 discovery interrupt re-fired during E1** — `d3MessageShownRef` reset to `false` on every step change. Even though D3 was already completed during D2, E1 set up the D3 offscreen poll again. Fixed: check `completedSteps` (persistent) not just the ref.

11. **E2 advance armed before message visible** — `pauseGame: false` armed advance immediately, but `messageDelay: 3000` hid the message for 3s. Any pop in those 3s advanced E2 before the user saw "Pop it." Fixed: steps with `messageDelay` start disarmed, arm when message becomes visible.

### UAT Round 10 — E-Phase Redesign + F1 Soft Crash Fix (This Session)

12. **F1 soft crash — continuous spawn handler broke on isPaused guard** — Round 9 added `if (gameEngine.state.isPaused) return;` to prevent leaked unpauses, but training mode auto-pauses on piece lock. The handler was SUPPOSED to undo that auto-pause. Fixed: replaced `isPaused` guard with `stepGenerationRef` counter. `advanceStep()` increments generation; leaked callbacks see stale generation and bail. Training auto-pause is correctly undone.

13. **E1 redesign — two-phase GOAL_CAPTURED flow** — E1 no longer shows a message on entry. Continuous spawn runs freely until crack is sealed. When GOAL_CAPTURED fires: suppress spawns, freeze falling, arm advance. If player pops immediately → skip E2 → E3. After 3s → hint message "Pop the goop to seal the crack." After 3 more seconds → auto-advance to E2. Custom GOOP_POPPED handler marks E2 complete when popping during E1 (so getNextTrainingStep skips E2 → E3 is next).

14. **E2 redesign — immediate non-dismissible message** — Removed `messageDelay: 3000`. Message shows immediately on step entry. Added `nonDismissible` check to default `pauseGame:false` branch in step setup (was only handled in messageDelay path). Green highlight restricts popping to green.

15. **F1 graduation delay** — Added `pauseDelay: 2000` to F1 config. Graduation message now appears 2s after E3 confirm (breathing room) instead of default 400ms.

16. **suppressContinuousSpawnRef** — New ref to stop continuous spawn within a step without pausing the game (E1 after crack sealed). Checked in both the initial PIECE_DROPPED handler AND the deferred setTimeout callbacks (handles race condition where PIECE_DROPPED fires before GOAL_CAPTURED in same lock cycle).

17. **E1 message non-dismissible + pressure freeze** — E1 "Pop to seal" message now has no confirm button (`setCanDismiss(false)`) and freezes pressure (`trainingPressureRate = 0`) while displayed. Pressure resumes when pop advances to E3 (via sync effect). Timer is 4500ms from GOAL_CAPTURED (1500ms fill animation for 4-block T_O + 3000ms post-fill).

18. **Message flash on step transition (re-fix)** — The default `pauseGame:false` branch in the step-change effect set `messageVisible(true)` immediately, before TutorialOverlay could fade out the previous message. Every other branch already used a delay. Fixed: added 200ms delay to match overlay's fade-out timing. Affects steps like B2, C2, E2 that show messages immediately on non-pausing steps.

### Files Changed (This Session)
- `types/training.ts` — Added `nonDismissible` field to StepSetup
- `data/trainingScenarios.ts` — E1: pauseGame:false, messageDelay:999999, advance:pop-goop; E2: removed messageDelay; F1: added pauseDelay:2000
- `data/tutorialSteps.ts` — E1 message: "Pop [the] goop [to] seal the crack."
- `hooks/useTrainingFlow.ts` — All structural fixes: stepGenerationRef, suppressContinuousSpawnRef, E1 custom GOAL_CAPTURED/GOOP_POPPED handlers, nonDismissible in default branch
- `core/GameEngine.ts` — Training spawn position fixed (row 0 for overflow)

### Deferred
- **Fill rendering "almost hole" inversion** — Documented in Known Issues. Needs isolated investigation.

## Next Steps — REMAINING BUG

**E1 green pulse missing when message shows.** The E1 GOAL_CAPTURED handler in `useTrainingFlow.ts` (around line 1172) needs ONE line added inside the 4500ms setTimeout callback, right alongside the other message-show actions:

```typescript
gameEngine.trainingHighlightColor = COLORS.GREEN;
```

This line goes inside the `const t1 = setTimeout(() => { ... }, 4500)` block in the E1 custom handler, next to `setMessageVisible(true)`, `setCanDismiss(false)`, and `gameEngine.trainingPressureRate = 0`.

**What this does:** When the "Pop the goop to seal the crack" message appears 4.5s after crack is covered (1.5s fill + 3s wait), the green goop covering the crack should PULSE (CSS `training-pulse` animation) to draw the player's attention to what to pop. Currently the pulse only starts when E2 is reached (via `highlightGoopColor: COLORS.GREEN` in E2's config). It should also happen in E1 when the message shows.

**Full E1 flow after fix:**
1. Continuous play, crack at pressure line
2. Player covers crack with green goop → GOAL_CAPTURED
3. Spawning stops, falling freezes, advance armed
4. 4.5s later (1.5s fill + 3s): message appears, green goop pulses, pressure freezes, no confirm button
5. Player pops green → message closes, pressure resumes, skip E2 → E3
6. OR 3s more → auto-advance to E2 (also has pulse + non-dismissible message)

**After fixing, test full A1→F1 playthrough. If clean → commit + redeploy.**

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
**Build:** 298

### Resume Command
```
Phase 33 Plan 04 — Tutorial v2 UAT round 10

UAT rounds 7-10 complete. 210 tests pass. Build #298.

ONE REMAINING BUG: E1 green pulse missing when message shows.
Read the "Next Steps — REMAINING BUG" section in STATE.md for exact fix.

WHAT TO DO:
1. Add `gameEngine.trainingHighlightColor = COLORS.GREEN` to the E1
   GOAL_CAPTURED handler's 4500ms setTimeout callback in useTrainingFlow.ts
2. Run tests, restart dev server
3. Full A1→F1 playthrough — verify E1 pulse + all prior fixes
4. If clean → <save> then <deploy>
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
