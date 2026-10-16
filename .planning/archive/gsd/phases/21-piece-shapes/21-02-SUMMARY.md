---
phase: 21-piece-shapes
plan: 02
subsystem: core
tags: [pieces, polyomino, tetra, penta, hexa, spawn]

# Dependency graph
requires:
  - phase: 21-01
    provides: PieceType enum values, timing constants
provides:
  - TETRA_PIECES array (10 pieces)
  - PENTA_PIECES array (22 pieces)
  - HEXA_PIECES array (22 pieces)
  - ALL_NEW_PIECES combined array (54 pieces)
affects: [21-03 spawn logic, piece selection, gravity calculation]

# Tech tracking
tech-stack:
  added: []
  patterns: [makePiece factory pattern for consistent piece creation]

key-files:
  created: []
  modified: [constants.ts]

key-decisions:
  - "Coordinates normalized around (0,0) for rotation support"
  - "Normal pieces have contiguous cells (edge-touching)"
  - "Corrupted pieces have non-contiguous cells (corner-touching patterns)"
  - "Original PIECES array preserved for backwards compatibility"

patterns-established:
  - "Piece arrays grouped by size: TETRA, PENTA, HEXA"
  - "Each size has NORMAL, CORRUPTED, and combined arrays"

issues-created: []

# Metrics
duration: 4min
completed: 2026-01-26
---

# Phase 21 Plan 02: Piece Definitions Summary

**54 polyomino piece shapes defined from SVG source - 10 Tetra, 22 Penta, 22 Hexa with normal and corrupted variants**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-26T19:38:16Z
- **Completed:** 2026-01-26T19:42:40Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Parsed Minos.svg to extract 54 piece coordinate definitions
- Created TETRA_PIECES (5 normal + 5 corrupted = 10 pieces, 4 cells each)
- Created PENTA_PIECES (11 normal + 11 corrupted = 22 pieces, 5 cells each)
- Created HEXA_PIECES (11 normal + 11 corrupted = 22 pieces, 6 cells each)
- Added ALL_NEW_PIECES combined export for convenience

## Task Commits

Each task was committed atomically:

1. **Task 1: Define tetra piece shapes** - `ccf3b08` (feat)
2. **Task 2: Define penta piece shapes** - `c4349df` (feat)
3. **Task 3: Define hexa piece shapes** - `9dc2554` (feat)

**Plan metadata:** (pending)

## Files Created/Modified

- `constants.ts` - Added 107 lines of piece definitions

## Decisions Made

- Coordinates normalized relative to piece center for proper rotation behavior
- Normal pieces = contiguous (edge-touching cells)
- Corrupted pieces = non-contiguous (corner-touching patterns for selective popping)
- Original PIECES array (SRS tetrominoes) preserved for backwards compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- All 54 piece definitions ready for spawn logic
- Plan 03 can implement pressure-zone-based piece selection
- Piece arrays exported and accessible from constants.ts

---
*Phase: 21-piece-shapes*
*Completed: 2026-01-26*
