---
phase: 23-code-rename
plan: 01
subsystem: core
tags: [refactor, terminology, naming, events]

# Dependency graph
requires:
  - phase: 22-audit-glossary
    provides: Official terminology glossary establishing "fast drop" as canonical term
provides:
  - Consistent fastDrop terminology across entire codebase
  - No vestigial Tetris terminology (soft drop)
affects: [documentation, future-code]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - core/events/GameEvents.ts
    - core/GameEngine.ts
    - core/commands/actions.ts
    - core/ComplicationManager.ts
    - hooks/useInputHandlers.ts
    - types/input.ts
    - types.ts
    - complicationConfig.ts
    - Game.tsx

key-decisions:
  - "Extended scope to rename all softDrop-related identifiers (fields, callbacks, variables) for complete consistency"

patterns-established:
  - "Use official GLOSSARY.md terms in all code identifiers and comments"

issues-created: []

# Metrics
duration: 7min
completed: 2026-01-26
---

# Phase 23 Plan 01: softDrop -> fastDrop Summary

**Renamed all soft drop terminology to fast drop across 9 files, including constants, events, types, fields, callbacks, and comments**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-26T21:21:33Z
- **Completed:** 2026-01-26T21:28:17Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Renamed INPUT_SOFT_DROP to INPUT_FAST_DROP (event type)
- Renamed SOFT_DROP_FACTOR to FAST_DROP_FACTOR (constant)
- Renamed SET_SOFT_DROP to SET_FAST_DROP (action type)
- Updated 12+ code usages in hooks and Game.tsx
- Updated 15+ comments across codebase
- Extended scope to rename related identifiers (isSoftDropping, onSoftDrop, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename constants and event types** - `2592fa5` (refactor)
2. **Task 2: Update all code usages** - `ace177f` (refactor)
3. **Task 3: Update all comments** - `57c3a09` (refactor)

## Files Created/Modified

- `core/events/GameEvents.ts` - INPUT_SOFT_DROP -> INPUT_FAST_DROP, SoftDropPayload -> FastDropPayload
- `core/GameEngine.ts` - SOFT_DROP_FACTOR -> FAST_DROP_FACTOR, isSoftDropping -> isFastDropping, wasSoftDropping -> wasFastDropping, 8 comments
- `core/commands/actions.ts` - SetSoftDropCommand -> SetFastDropCommand, SET_SOFT_DROP -> SET_FAST_DROP
- `core/ComplicationManager.ts` - 1 comment updated
- `hooks/useInputHandlers.ts` - 12 event references, onSoftDrop -> onFastDrop callback, shouldSoftDrop -> shouldFastDrop
- `types/input.ts` - onSoftDrop -> onFastDrop callback interface
- `types.ts` - 2 comments updated
- `complicationConfig.ts` - 2 comments updated
- `Game.tsx` - Event subscription, command imports, unsubSoftDrop -> unsubFastDrop, 2 comments

## Decisions Made

**Extended scope beyond plan:** The plan specified renaming constants, event types, and comments. During execution, also renamed:
- Field names: `isSoftDropping` -> `isFastDropping`, `wasSoftDropping` -> `wasFastDropping`
- Callback names: `onSoftDrop` -> `onFastDrop`, `shouldSoftDrop` -> `shouldFastDrop`
- Variable names: `unsubSoftDrop` -> `unsubFastDrop`

Rationale: Complete terminology consistency. Leaving these would violate the goal of eliminating "soft drop" from the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Path discrepancy**
- **Found during:** Task 1
- **Issue:** Plan referenced `src/` directory but files are in root (e.g., `core/` not `src/core/`)
- **Fix:** Adjusted all file paths to use actual locations
- **Files affected:** All
- **Verification:** Files found and edited successfully

**2. [Rule 2 - Missing Critical] Additional identifier renames**
- **Found during:** Tasks 1-3
- **Issue:** Plan didn't include field/callback/variable renames, but leaving them would result in inconsistent terminology
- **Fix:** Renamed all softDrop-related identifiers throughout codebase
- **Files modified:** GameEngine.ts, useInputHandlers.ts, types/input.ts, Game.tsx
- **Verification:** grep confirms no "soft" terminology remains

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical), 0 deferred
**Impact on plan:** Both fixes necessary for complete terminology consistency. No scope creep beyond the stated goal.

## Issues Encountered

None - plan executed smoothly after path adjustments.

## Next Phase Readiness

- All softDrop terminology eliminated from codebase
- TypeScript compiles clean
- 151 tests pass
- Ready for 23-02-PLAN.md (totalUnits -> totalBlocks)

---
*Phase: 23-code-rename*
*Completed: 2026-01-26*
