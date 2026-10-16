---
phase: 19-multicolor-pieces
plan: 01
subsystem: pieces
tags: [types, algorithm, BFS, graph, multicolor]

# Dependency graph
requires:
  - phase: none
    provides: none (foundation work)
provides:
  - PieceDefinition.cellColors optional field for per-cell colors
  - pieceUtils.ts with isConnected, findBestSplit, splitPiece functions
affects: [19-02 spawn integration, 19-03 rendering, piece preview, piece locking]

# Tech tracking
tech-stack:
  added: []
  patterns: [BFS connectivity check, bitmask enumeration for subset partitioning]

key-files:
  created: [utils/pieceUtils.ts, tests/pieceUtils.test.ts]
  modified: [types.ts]

key-decisions:
  - "Return indices from findBestSplit (not coordinates) for rotation safety"
  - "Use Set for O(1) neighbor lookup in connectivity check"
  - "Early exit on perfect 50/50 split for performance"

patterns-established:
  - "Per-cell color arrays parallel to cells array"
  - "Graph-based connectivity via BFS for polyomino validation"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 19 Plan 01: Add Per-Cell Colors & Split Algorithm Summary

**Added `cellColors` field to PieceDefinition and created pieceUtils.ts with BFS connectivity check and bitmask enumeration for finding balanced contiguous bipartitions.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T22:06:00Z
- **Completed:** 2026-01-24T22:09:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended PieceDefinition with optional `cellColors?: string[]` for per-cell color support
- Created pieceUtils.ts with 4 utility functions (coordKey, isConnected, findBestSplit, splitPiece)
- Algorithm enumerates all 2^n subsets and finds most balanced bipartition where both groups are connected
- Comprehensive test coverage: 21 new tests covering I/T/O/S/Z pieces and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cellColors to PieceDefinition** - `0c5cd2f` (feat)
2. **Task 2: Create split algorithm in pieceUtils.ts** - `b414acf` (feat)

## Files Created/Modified

- `types.ts` - Added `cellColors?: string[]` to PieceDefinition interface
- `utils/pieceUtils.ts` - New file with coordKey, isConnected, findBestSplit, splitPiece
- `tests/pieceUtils.test.ts` - New file with 21 tests for pieceUtils functions

## Decisions Made

- Return indices from findBestSplit rather than coordinates to preserve cell order (rotation-safe)
- Use Set<string> with "x,y" keys for O(1) neighbor lookup in BFS
- Early exit when perfect 50/50 split found (balance === 0)
- For n=2-8 cells, 2^n enumeration is fast enough (max 256 iterations)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Types ready: PieceDefinition supports per-cell colors
- Algorithm ready: splitPiece() can be called from spawn logic
- Tests passing: 133 total (21 new for pieceUtils)
- Ready for 19-02: Integrate split into piece spawning at rank 20+

---
*Phase: 19-multicolor-pieces*
*Completed: 2026-01-24*
