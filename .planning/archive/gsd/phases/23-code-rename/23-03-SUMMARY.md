---
phase: 23-code-rename
plan: 03
subsystem: refactoring
tags: [typescript, naming, tank, coordinates]

# Dependency graph
requires:
  - phase: 22
    provides: GLOSSARY.md with official terminology mappings
  - phase: 23-02
    provides: Goop lifecycle terminology (GoopShape, GoopTemplate, GoopState)
provides:
  - TANK_WIDTH, TANK_HEIGHT constants (was TOTAL_*)
  - TANK_VIEWPORT_WIDTH, TANK_VIEWPORT_HEIGHT constants (was VISIBLE_*)
  - tankRotation state property (was boardOffset)
  - TankCell interface (was GridCell)
affects: [23-04, 23-05, 23-06, 23-07, future-features]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tank terminology: physical cylinder dimensions and viewport"

key-files:
  created: []
  modified:
    - constants.ts
    - types.ts
    - core/GameEngine.ts
    - core/commands/actions.ts
    - core/GoalManager.ts
    - core/CrackManager.ts
    - utils/gameLogic.ts
    - utils/coordinates.ts
    - utils/coordinateTransform.ts
    - utils/goopRenderer.ts
    - components/GameBoard.tsx
    - hooks/useInputHandlers.ts
    - types/input.ts
    - tests/gameLogic.test.ts
    - tests/coordinates.test.ts
    - tests/coordinateTransform.test.ts

key-decisions:
  - "TANK_WIDTH/TANK_HEIGHT for full cylinder dimensions (was TOTAL_*)"
  - "TANK_VIEWPORT_WIDTH/TANK_VIEWPORT_HEIGHT for visible area (was VISIBLE_*)"
  - "tankRotation for cylinder rotation offset (was boardOffset)"
  - "TankCell for individual cell in the tank grid (was GridCell)"
  - "tankViewport in comments referring to the game viewport (not CSS viewport)"

patterns-established:
  - "Tank terminology: Tank is the cylindrical game area, viewport is visible portion"

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 23 Plan 03: Tank Dimensions & Coordinates Summary

**Renamed dimension constants (TOTAL_* -> TANK_*, VISIBLE_* -> TANK_VIEWPORT_*), boardOffset -> tankRotation, and GridCell -> TankCell across 16 files with zero test breakage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T10:05:00Z
- **Completed:** 2026-01-27T10:13:00Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments
- Renamed TOTAL_WIDTH/TOTAL_HEIGHT to TANK_WIDTH/TANK_HEIGHT
- Renamed VISIBLE_WIDTH/VISIBLE_HEIGHT to TANK_VIEWPORT_WIDTH/TANK_VIEWPORT_HEIGHT
- Renamed boardOffset state property to tankRotation (52 references across 9 files)
- Renamed GridCell interface to TankCell (33 references across 8 files)
- Updated viewport comments to tankViewport where game-related

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename dimension constants to Tank terminology** - `acb044a` (refactor)
2. **Task 2: Rename boardOffset to tankRotation** - `c79f76c` (refactor)
3. **Task 3: Rename GridCell to TankCell** - `96a64c4` (refactor)

## Files Created/Modified
- `constants.ts` - TANK_WIDTH, TANK_HEIGHT, TANK_VIEWPORT_WIDTH, TANK_VIEWPORT_HEIGHT
- `types.ts` - TankCell interface, tankRotation property, updated comments
- `core/GameEngine.ts` - Tank constants and tankRotation
- `core/commands/actions.ts` - Tank constants and tankRotation
- `core/GoalManager.ts` - TankCell type
- `core/CrackManager.ts` - TANK_HEIGHT constant
- `utils/gameLogic.ts` - Tank constants, TankCell type
- `utils/coordinates.ts` - TANK_WIDTH constant, tankRotation param
- `utils/coordinateTransform.ts` - Tank constants, tankRotation param
- `utils/goopRenderer.ts` - Tank constants, TankCell type
- `components/GameBoard.tsx` - Tank constants, tankRotation
- `hooks/useInputHandlers.ts` - Tank constants, TankCell type
- `types/input.ts` - TankCell type
- `tests/gameLogic.test.ts` - Tank constants
- `tests/coordinates.test.ts` - TANK_WIDTH constant
- `tests/coordinateTransform.test.ts` - Tank constants

## Decisions Made
None - followed plan as specified. All mappings came directly from GLOSSARY.md.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all grep checks passed, TypeScript compiled clean, 151 tests passed.

## Next Phase Readiness
- Tank terminology established for dimensions and coordinates
- Ready for 23-04: Complication terminology cleanup
- 4 more plans remain in Phase 23

---
*Phase: 23-code-rename*
*Completed: 2026-01-27*
