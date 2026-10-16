---
phase: 31-tutorial-infrastructure
plan: 01
subsystem: tutorial
tags: [tutorial, state-machine, events, localStorage, hooks]

# Dependency graph
requires:
  - phase: 25-27.1
    provides: event bus patterns, SaveData persistence patterns
provides:
  - TutorialStepId/TutorialStep/TutorialTrigger/IntercomMessage/TutorialState types
  - useTutorial hook (state machine with rank-based and event-based triggers)
  - Tutorial event types (TRIGGERED/COMPLETED/DISMISSED) on event bus
  - SaveData tutorialProgress persistence
  - Placeholder tutorial steps data structure
affects: [31-02, 31-03, 32, 33, 34, 35, 36, 37, 38]

# Tech tracking
tech-stack:
  added: []
  patterns: [tutorial state machine, discriminated union triggers, event-driven tutorial progression]

key-files:
  created:
    - types/tutorial.ts
    - hooks/useTutorial.ts
    - data/tutorialSteps.ts
  modified:
    - types.ts
    - utils/storage.ts
    - core/events/GameEvents.ts

key-decisions:
  - "Tutorial payload types use string for stepId (not TutorialStepId import) to avoid circular dependency with GameEvents"
  - "SaveData version key stays gooptris_save_v3 — tutorialProgress is additive with migration fallback"
  - "useTutorial accepts saveData/setSaveData callback pattern (matches existing App.tsx save mutation pattern)"

patterns-established:
  - "Discriminated union triggers: TutorialTrigger with type field for ON_RANK_REACH, ON_EVENT, ON_GAME_START, ON_FIRST_ACTION, MANUAL"
  - "Tutorial step data separated from state machine logic (data/tutorialSteps.ts vs hooks/useTutorial.ts)"
  - "Tutorial events emitted on state changes for UI layer to subscribe to"

issues-created: []

# Metrics
duration: 7min
completed: 2026-02-08
---

# Phase 31 Plan 01: Tutorial Infrastructure Summary

**Tutorial state machine with discriminated-union triggers, SaveData persistence, and event bus integration for tutorial step lifecycle**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-02-08
- **Completed:** 2026-02-08
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments
- Tutorial type system with TutorialStepId, TutorialStep, TutorialTrigger (5 trigger types), IntercomMessage, and TutorialState
- useTutorial hook: state machine that activates steps based on rank changes and event bus subscriptions, persists completions via SaveData callback
- SaveData extended with tutorialProgress field (additive migration, no version bump)
- Three new tutorial event types on GameEventBus (TRIGGERED/COMPLETED/DISMISSED) with typed payloads
- Placeholder tutorial steps (WELCOME, ROTATE_INTRO) for testing infrastructure

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tutorial types and state machine** - `11965ac` (feat)
2. **Task 2: Extend SaveData with tutorial persistence** - `7c8072b` (feat)
3. **Task 3: Add tutorial event types to event bus** - `0d36acd` (feat)

## Files Created/Modified
- `types/tutorial.ts` - TutorialStepId, TutorialStep, TutorialTrigger, IntercomMessage, TutorialState types
- `hooks/useTutorial.ts` - Tutorial state machine hook with rank/event triggers, SaveData persistence, event emission
- `data/tutorialSteps.ts` - TUTORIAL_STEPS array with WELCOME and ROTATE_INTRO placeholders
- `types.ts` - Added tutorialProgress to SaveData interface
- `utils/storage.ts` - Default tutorialProgress in getDefaultSaveData(), migration fallback in loadSaveData()
- `core/events/GameEvents.ts` - TUTORIAL_STEP_TRIGGERED/COMPLETED/DISMISSED events with payload types

## Decisions Made
- Tutorial payload types use `string` for stepId rather than importing TutorialStepId — avoids circular dependency (GameEvents -> tutorial types -> GameEvents), consistent with SaveData using `string[]`
- SaveData version key stays `gooptris_save_v3` — tutorialProgress addition is handled with migration fallback for missing field
- useTutorial follows the saveData/setSaveData callback pattern used throughout App.tsx for state persistence

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Tutorial state machine ready for UI layer (Plan 31-02: Intercom text system, Plan 31-03: TutorialOverlay)
- Placeholder steps can be replaced with real content in Phase 33
- Event bus hooks ready for TutorialOverlay subscription

---
*Phase: 31-tutorial-infrastructure*
*Completed: 2026-02-08*
