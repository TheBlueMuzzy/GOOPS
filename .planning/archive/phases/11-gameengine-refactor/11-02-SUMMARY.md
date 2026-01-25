---
phase: 11-gameengine-refactor
plan: 02
subsystem: core
tags: [gameengine, refactor, managers, separation-of-concerns]

requires:
  - phase: 11-01
    provides: tick() split into focused methods

provides:
  - ComplicationManager class for complication spawning/resolution
  - GoalManager class for goal spawning and capture handling
  - Reduced GameEngine responsibilities

affects: [testing, future-features]

tech-stack:
  added: []
  patterns: ["Manager classes operate on state passed to them", "Singleton pattern for managers"]

key-files:
  created: [core/ComplicationManager.ts, core/GoalManager.ts]
  modified: [core/GameEngine.ts, core/commands/actions.ts, components/GameBoard.tsx]

key-decisions:
  - "Managers don't own state - they operate on state passed to them"
  - "Singleton exports for easy access from GameEngine and commands"

patterns-established:
  - "Manager pattern: focused classes that receive state, perform logic, return results"

issues-created: []

duration: 18min
completed: 2026-01-21
---

# Plan 11-02 Summary: Extract ComplicationManager and GoalManager

## What Was Built

Extracted complication and goal logic from GameEngine into two focused manager classes, reducing GameEngine responsibilities and improving separation of concerns.

## Line Count Changes

| File | Lines | Notes |
|------|-------|-------|
| ComplicationManager.ts | 178 | NEW - complication spawning, checking, resolution |
| GoalManager.ts | 96 | NEW - goal spawning and capture handling |
| GameEngine.ts | 576 | Down from 673 (Plan 11-01) |

## Extracted to ComplicationManager

- **checkComplications()** - Check and spawn complications based on state
- **spawnComplication()** - Create new complication of given type
- **resolveComplication()** - Reset counters and set cooldowns
- **checkLightsTrigger()** - LIGHTS trigger logic on piece lock

## Extracted to GoalManager

- **trySpawnGoal()** - Spawn goal marks at regular intervals
- **handleGoals()** - Handle captured/destroyed goals, show floating text

## Task Commits

1. **Task 1: Extract ComplicationManager** - `f2b0aed` (refactor)
2. **Task 2: Extract GoalManager** - `554c27d` (refactor)
3. **UAT Fixes** - `5f99b80` (fix)
   - Primed groups now shake like invalid pieces
   - Heat meter doesn't increase during CONTROLS cooldown
   - Changed "CAPTURED!" to "Laser to Seal" (theming)
   - Changed "GOAL CLEARED!" to "SEALED!" (theming)

## Verification

- [x] `npx tsc --noEmit` - No TypeScript errors
- [x] `npm run test:run` - All 81 tests pass
- [x] ComplicationManager handles all complication logic
- [x] GoalManager handles all goal logic
- [x] Human verified gameplay works correctly

## Deviations from Plan

None - plan executed as specified plus UAT fixes for discovered issues.

## Phase 11 Complete

Both plans in Phase 11 (GameEngine Refactor) are now complete:
- Plan 11-01: tick() refactored from 159 to 22 lines
- Plan 11-02: ComplicationManager and GoalManager extracted

GameEngine.ts reduced from 811 lines (before phase) to 576 lines (28% reduction).
