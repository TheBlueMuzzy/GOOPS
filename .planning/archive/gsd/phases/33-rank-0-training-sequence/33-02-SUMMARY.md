---
phase: 33-rank-0-training-sequence
plan: 02
subsystem: tutorial
tags: [training, game-engine, flow-controller, hooks]

requires:
  - phase: 33-rank-0-training-sequence
    plan: 01
    provides: TrainingStep, TrainingStepId, TRAINING_SEQUENCE, getNextTrainingStep, isTrainingComplete
  - phase: 31-tutorial-infrastructure
    provides: TutorialStepId, SaveData.tutorialProgress, useTutorial hook
provides:
  - GameEngine.startTraining() method
  - GameEngine.isTrainingMode and maxPieceSize properties
  - GameEngine.pendingTrainingPalette for training mode interception
  - useTrainingFlow hook for training sequence management
  - TRAINING_SCENARIO_COMPLETE event type
affects: [33-03 intercom scripts, 33-04 training HUD]

tech-stack:
  added: []
  patterns: [pendingTrainingPalette interception in enterPeriscope, tick-system gating by isTrainingMode]

key-files:
  created: [hooks/useTrainingFlow.ts]
  modified: [core/GameEngine.ts, core/events/GameEvents.ts, Game.tsx]

key-decisions:
  - "Training mode skips complications, goals, cracks, heat, lights, active charges in tick() — only loose goop and active piece gravity run"
  - "pendingTrainingPalette pattern: hook sets palette on engine, enterPeriscope() checks it to decide startTraining() vs startRun()"
  - "Training uses effectively infinite timer (999999ms) — no time pressure during tutorial"
  - "No goal counting in training — goalsTarget=0, flow controller manages completion via step advancement"
  - "maxPieceSize filters piece pool in spawnNewPiece() — falls back to unfiltered pool if all pieces exceed limit"

patterns-established:
  - "Engine property interception: set engine.pendingTrainingPalette before session start to redirect enterPeriscope()"
  - "Training tick gating: isTrainingMode flag skips normal gameplay systems in tick()"

issues-created: []

duration: 12min
completed: 2026-02-08
---

# Phase 33 Plan 02: GameEngine Training Mode & Flow Controller Summary

**Added training mode to GameEngine and built useTrainingFlow hook for rank 0 scripted sequence management**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-08T20:18:44Z
- **Completed:** 2026-02-08T20:30:49Z
- **Tasks:** 2 (both auto)
- **Files created:** 1
- **Files modified:** 3

## Accomplishments
- GameEngine has parallel training path (startTraining) alongside normal play (startRun)
- Piece spawning respects maxPieceSize constraint when set
- Training tick() skips all normal gameplay systems (complications, goals, cracks, heat, lights)
- useTrainingFlow hook manages training state from SaveData and configures engine
- Game.tsx wired with minimal changes (hook call + import)
- TRAINING_SCENARIO_COMPLETE event added for completion signaling

## Task Commits

1. **Task 1: Add training mode to GameEngine** — `34a58c2` (feat)
2. **Task 2: Build training flow controller and wire into Game.tsx** — `8244883` (feat)

## Files Created
- `hooks/useTrainingFlow.ts` — Training sequence management hook

## Files Modified
- `core/GameEngine.ts` — startTraining(), isTrainingMode, maxPieceSize, pendingTrainingPalette, tick() gating, enterPeriscope() interception
- `core/events/GameEvents.ts` — TRAINING_SCENARIO_COMPLETE event type
- `Game.tsx` — useTrainingFlow hook integration

## Decisions Made
- **pendingTrainingPalette interception:** Rather than restructuring the command/periscope flow, added a simple property that enterPeriscope() checks to decide which start method to call
- **No goal counting in training:** The scripted sequence model doesn't use discrete scenario goals — the flow controller manages step-by-step advancement
- **Tick gating:** Training mode disables all normal gameplay systems in tick() except loose goop physics and active piece gravity

## Deviations from Plan

### Data Model Mismatch (Design Pivot in 33-01)

The plan referenced `TrainingConfig`, `TrainingScenario`, `getNextTrainingScenario` — types from the original discrete scenario model. Phase 33-01 was reworked to a scripted sequence model with `TrainingStep`, `TrainingStepId`, `getNextTrainingStep`. All code was adapted to use the actual types.

**Impact:** The startTraining() method takes a palette array instead of a TrainingConfig object. The useTrainingFlow hook works with TrainingStep/getNextTrainingStep instead of TrainingScenario/getNextTrainingScenario. Functionally equivalent.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Path correction: src/ to root**
- **Issue:** Plan referenced `src/core/`, `src/hooks/`, `src/components/` but project has no `src/` prefix
- **Fix:** Used actual paths: `core/`, `hooks/`, `Game.tsx`

**2. [Rule 1 - Auto-fix] enterPeriscope interception pattern**
- **Issue:** Plan said "at rank 0, check isInTraining, call startNextScenario() instead of startRun()" but Game.tsx doesn't directly call startRun() — it goes through enterPeriscope()
- **Fix:** Added pendingTrainingPalette property that enterPeriscope() checks, allowing the hook to configure training before the user triggers periscope entry

## Issues Encountered
None

## Next Phase Readiness
- GameEngine training mode ready for 33-03 (intercom message content and step-by-step orchestration)
- useTrainingFlow provides advanceStep() and completeCurrentStep() for the flow controller to call
- The step setup (spawnPiece, spawnCrack, pressureRate, etc.) will be interpreted by the flow controller in 33-03/33-04
- maxPieceSize can be set per-step by the flow controller

---
*Phase: 33-rank-0-training-sequence*
*Completed: 2026-02-08*
