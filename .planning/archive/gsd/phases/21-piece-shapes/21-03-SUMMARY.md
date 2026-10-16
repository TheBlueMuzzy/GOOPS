---
phase: 21-piece-shapes
plan: 03
subsystem: gameplay
tags: [spawning, polyominoes, corruption, mirroring]

requires:
  - phase: 21-01
    provides: timing constants (INITIAL_TIME_MS, zone thresholds)
  - phase: 21-02
    provides: piece definitions (TETRA/PENTA/HEXA arrays)
provides:
  - Zone-based piece spawning (Tetra→Penta→Hexa)
  - Corruption system (15% non-contiguous variants)
  - Mirror system (50% flip for asymmetric pieces)
affects: [balance, difficulty-curve]

tech-stack:
  added: []
  patterns: [time-based-zone-selection, piece-mirroring]

key-files:
  created: []
  modified: [core/GameEngine.ts]

key-decisions:
  - "Used maxTime instead of INITIAL_TIME_MS for zone calculation to support PRESSURE_CONTROL upgrade scaling"
  - "Added startRun() updates for consistency with spawnNewPiece()"

patterns-established:
  - "Zone selection: elapsed time / 3 determines Tetra/Penta/Hexa"
  - "Corruption applied at spawn time, not definition time"

issues-created: []

duration: 35min
completed: 2026-01-27
---

# Phase 21 Plan 03: Spawn Logic Summary

**Pressure-based piece spawning with zone transitions, 15% corruption, and 50% mirroring for asymmetric pieces**

## Performance

- **Duration:** 35 min
- **Started:** 2026-01-27T00:45:47Z
- **Completed:** 2026-01-27T01:20:27Z
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 1

## Accomplishments

- Implemented `getPiecePoolByZone()` for time-based size selection
- Implemented `maybeApplyMirror()` for asymmetric piece variety
- Updated `spawnNewPiece()` and `startRun()` to use new system
- Zone transitions: Tetra (0-25s) → Penta (25-50s) → Hexa (50-75s)

## Task Commits

Each task was committed atomically:

1. **Task 1-2: Add helpers** - `231f763` (feat)
2. **Task 3: Update spawnNewPiece** - `a9c2038` (feat)

## Files Created/Modified

- `core/GameEngine.ts` - Added getPiecePoolByZone(), maybeApplyMirror(), updated spawnNewPiece() and startRun()

## Decisions Made

- Used `maxTime` instead of `INITIAL_TIME_MS` for zone calculation — supports PRESSURE_CONTROL upgrade scaling proportionally
- Updated `startRun()` in addition to `spawnNewPiece()` for consistency at game start

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated startRun() for consistency**
- **Found during:** Task 3 (spawnNewPiece update)
- **Issue:** startRun() also used old PIECES array for initial piece
- **Fix:** Updated to use TETRA_NORMAL pool at game start
- **Files modified:** core/GameEngine.ts
- **Verification:** Game starts correctly with tetra piece
- **Committed in:** a9c2038

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Necessary for consistency. No scope creep.

## Issues Encountered

None

## Next Phase Readiness

- Phase 21 (Piece Shapes) complete
- v1.3 milestone: 1/1 phases complete
- Ready for milestone completion or next milestone planning

---
*Phase: 21-piece-shapes*
*Completed: 2026-01-27*
