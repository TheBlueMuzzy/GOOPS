---
phase: 21-piece-shapes
plan: 01
subsystem: core
tags: [constants, timing, types, enum]

# Dependency graph
requires:
  - phase: 20
    provides: Expanding cracks overhaul
provides:
  - Timing constants for 75-second game
  - PieceType enum with 61 values (7 original + 54 new)
  - Zone threshold constants for pressure-based spawning
affects: [21-02, 21-03]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - constants.ts
    - types.ts
    - core/GameEngine.ts

key-decisions:
  - "75-second game with 3 zones of 25 seconds each"
  - "Kept original 7 tetromino values for backwards compatibility"

patterns-established: []

issues-created: []

# Metrics
duration: 5min
completed: 2026-01-26
---

# Phase 21 Plan 01: Timing + Types Summary

**Extended game to 75 seconds with 54 new PieceType enum values and zone threshold constants for pressure-based piece spawning.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-01-26T19:06:00Z
- **Completed:** 2026-01-26T19:08:30Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Extended game time from 60s to 75s (3 zones of 25s each)
- Faster fast-drop (SOFT_DROP_FACTOR 6 to 8) for snappier controls
- Added 54 new PieceType enum values (Tetra, Penta, Hexa + corrupted variants)
- Defined zone thresholds for pressure-based piece size selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Update timing constants** - `f4ee165` (feat)
2. **Task 2: Add PieceType enum values** - `2139986` (feat)
3. **Task 3: Add piece size constants** - `44b0b57` (feat)

**Plan metadata:** `11c5e55` (docs: complete plan)

## Files Created/Modified

- `constants.ts` - INITIAL_TIME_MS, zone thresholds, corruption/mirror chances
- `types.ts` - PieceType enum expanded from 7 to 61 values
- `core/GameEngine.ts` - INITIAL_SPEED, SOFT_DROP_FACTOR

## Decisions Made

- Keep original 7 tetromino values (I, J, L, O, S, T, Z) for backwards compatibility with existing save data
- Use underscore naming convention for new pieces (T_I, P_L_C, H_X, etc.)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Types foundation complete - ready for Plan 02 (piece definitions)
- All constants in place for spawn logic in Plan 03

---
*Phase: 21-piece-shapes*
*Completed: 2026-01-26*
