---
phase: 23-code-rename
plan: 04
subsystem: core
tags: [refactoring, naming, types, events, actions]

# Dependency graph
requires:
  - phase: 23-03
    provides: Tank dimensions and coordinate terminology
provides:
  - TankSystem enum (was ComplicationType)
  - laserCharge state field (was laserCapacitor)
  - prePoppedGoopGroups tracking (was primedGroups)
  - goopGroupId property (was groupId)
  - SpinTankCommand, RotateGoopCommand, PopGoopCommand actions
affects: [phase-23-05, phase-23-06, phase-23-07]

# Tech tracking
tech-stack:
  added: []
  patterns: [TankSystem terminology for complications]

key-files:
  created: []
  modified:
    - types.ts
    - core/ComplicationManager.ts
    - core/GameEngine.ts
    - core/commands/actions.ts
    - components/GameBoard.tsx
    - Game.tsx
    - complicationConfig.ts
    - hooks/useControlsMinigame.ts
    - hooks/useLightsMinigame.ts
    - hooks/useLaserMinigame.ts
    - hooks/useInputHandlers.ts
    - utils/gameLogic.ts
    - utils/goopRenderer.ts
    - tests/gameLogic.test.ts

key-decisions:
  - "TankSystem enum replaces ComplicationType - values unchanged (LASER, LIGHTS, CONTROLS)"
  - "INPUT_BLOCK_TAP event kept as-is - describes user input, not game action"
  - "Variable isPrimed renamed to isPrePopped for consistency"

patterns-established:
  - "TankSystem terminology for complication types"
  - "goopGroupId for goop group identification"
  - "Action commands use glossary terms: SpinTank, RotateGoop, PopGoop"

issues-created: []

# Metrics
duration: 10min
completed: 2026-01-27
---

# Phase 23 Plan 04: Complication System Summary

**TankSystem enum and action command renames - ComplicationType -> TankSystem, 163 total references updated**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-27T15:30:49Z
- **Completed:** 2026-01-27T15:40:58Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Renamed ComplicationType enum to TankSystem (79 refs across 10 files)
- Renamed laserCapacitor -> laserCharge and primedGroups -> prePoppedGoopGroups (22 refs)
- Renamed groupId -> goopGroupId (62 refs across 7 files)
- Renamed action commands: SpinTankCommand, RotateGoopCommand, PopGoopCommand

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename ComplicationType to TankSystem** - `3401a82` (refactor)
2. **Task 2: Rename laser and primed terminology** - `f202b41` (refactor)
3. **Task 3: Rename groupId and action commands** - `a5a352f` (refactor)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `types.ts` - TankSystem enum, BlockData.goopGroupId, GameState fields
- `core/ComplicationManager.ts` - TankSystem usages, laserCharge, prePoppedGoopGroups
- `core/GameEngine.ts` - State initialization and logic with new names
- `core/commands/actions.ts` - SpinTankCommand, RotateGoopCommand, PopGoopCommand
- `components/GameBoard.tsx` - isPrePopped variable, TankSystem imports
- `Game.tsx` - Command imports and usages
- `complicationConfig.ts` - TankSystem enum usages
- `hooks/use*Minigame.ts` - TankSystem imports (3 files)
- `hooks/useInputHandlers.ts` - goopGroupId references
- `utils/gameLogic.ts` - goopGroupId in group logic (27 refs)
- `utils/goopRenderer.ts` - goopGroupId in rendering (11 refs)
- `tests/gameLogic.test.ts` - Test helper with goopGroupId

## Decisions Made
- TankSystem enum values kept identical (LASER, LIGHTS, CONTROLS) - only type name changed
- INPUT_BLOCK_TAP event name kept unchanged - it describes user input, not the action
- Variable `isPrimed` renamed to `isPrePopped` for consistency with prePoppedGoopGroups

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- All complication-related terminology now uses TankSystem
- Ready for 23-05: Crack System (CrackCell, GoalMark terminology)
- Phase 23 (Code Rename) is 4/7 plans complete

---
*Phase: 23-code-rename*
*Completed: 2026-01-27*
