---
phase: 33-rank-0-training-sequence
plan: 01
subsystem: tutorial
tags: [training, tutorial, scripted-sequence, types, data]

requires:
  - phase: 31-tutorial-infrastructure
    provides: TutorialStepId, IntercomMessage, tutorial state machine
  - phase: 32-journal-system
    provides: JournalPageId, journal unlock system
provides:
  - TrainingStepId type (17 steps across 7 phases)
  - TrainingStep interface with StepSetup, StepAdvance
  - TRAINING_SEQUENCE data (17 scripted steps)
  - Helper functions (getNextTrainingStep, isTrainingComplete, getPhaseSteps, getTrainingStep)
affects: [33-02 flow controller, 33-03 intercom scripts, 33-04 training HUD]

tech-stack:
  added: []
  patterns: [scripted-sequence over discrete-scenarios, step-based flow control]

key-files:
  created: [types/training.ts, data/trainingScenarios.ts]
  modified: []

key-decisions:
  - "Scripted sequence (17 steps, 1 continuous session) over discrete scenarios (6 separate games)"
  - "Used COLORS.RED hex values matching getPaletteForRank() convention"
  - "markComplete field links training steps to TutorialStepId for journal unlocks"
  - "Intercom message content deferred to 33-03 — types define structure, not text"

patterns-established:
  - "TrainingStep with setup/pauseGame/advance pattern for flow controller consumption"
  - "Phase grouping (A-G) with TRAINING_PHASE_NAMES for display"

issues-created: []

duration: 47min
completed: 2026-02-08
---

# Phase 33 Plan 01: Training Scenario Data Model & Configs Summary

**Scripted 17-step rank 0 training sequence with 7 phases (A-G), replacing 6 discrete training scenarios with one continuous guided experience**

## Performance

- **Duration:** 47 min
- **Started:** 2026-02-08T10:43:19Z
- **Completed:** 2026-02-08T11:30:31Z
- **Tasks:** 3 (2 auto + 1 decision checkpoint)
- **Files created:** 2

## Accomplishments
- Defined TrainingStep type system with setup/advance discriminated unions
- Created 17-step scripted training sequence covering all core mechanics
- User-approved design: one continuous guided tutorial instead of discrete levels
- Helper functions for sequence progression and phase grouping

## Task Commits

1. **Task 1: Define TrainingScenario types** — `1d522ac` (feat) — initial discrete model
2. **Task 2: Create training scenario configs** — `f23d912` (feat) — initial 6 scenarios
3. **Task 3: Decision checkpoint** — approved with major redesign
4. **Rework: Scripted sequence model** — `f6644ad` (feat) — replaced discrete with scripted

**Note:** Commits 1-2 created the initial discrete scenario model. After the decision checkpoint, the user provided a fundamentally different vision (one continuous scripted tutorial). Commit 3 rewrote both files to match.

## Files Created
- `types/training.ts` — TrainingStepId, TrainingPhase, StepSetup, StepAdvance, TrainingStep types
- `data/trainingScenarios.ts` — TRAINING_SEQUENCE (17 steps), helper functions, phase names

## Decisions Made
- **Scripted over discrete:** User redesigned training from 6 separate games to one continuous guided session with choreographed piece/crack spawns
- **Phase structure (A-G):** Console Briefing → Goop Basics → Popping & Merging → Cracks & Matching → Pressure Mastery → Crack Sealing → Scaffolding
- **Hex colors:** Used COLORS.RED etc. (hex values) matching engine convention, not string names
- **Deferred content:** Intercom message text belongs in 33-03, not the data model

## Deviations from Plan

### Design Pivot at Checkpoint

The plan defined 6 discrete training scenarios (0TA-0TF), each a separate constrained game. During the decision checkpoint, the user provided a completely different vision: one continuous scripted tutorial with 17 steps across 7 phases. The rework replaced the entire data model.

**Impact:** Both files were rewritten. The type system changed from TrainingScenario (game constraints) to TrainingStep (scripted directions). This is a design improvement — the scripted approach teaches mechanics in context rather than in isolation.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Path correction: src/ → root**
- **Found during:** Task 1
- **Issue:** Plan referenced `src/types/` and `src/data/` but project has no `src/` directory
- **Fix:** Created files at `types/training.ts` and `data/trainingScenarios.ts`
- **Committed in:** `1d522ac`

## Issues Encountered
None

## Next Phase Readiness
- Training step types and sequence data ready for 33-02 (GameEngine training mode & flow controller)
- Flow controller will interpret StepSetup/StepAdvance to orchestrate game state
- Intercom message content (keywords + fullText) to be defined in 33-03
- UI behavior (modal collapse animation, journal button fly-to) for 33-04

---
*Phase: 33-rank-0-training-sequence*
*Completed: 2026-02-08*
