---
phase: 27-active-piece-physics
plan: 01
subsystem: rendering
tags: [soft-body, physics, active-piece, blob-lifecycle]

requires:
  - phase: 26.1
    provides: Flat coordinate system, soft-body physics hook

provides:
  - Active piece blob creation on spawn
  - Blob position sync during fall
  - Clean transition from falling to locked state

affects: [27-02, 28]

tech-stack:
  added: []
  patterns:
    - Active piece blob lifecycle (spawn/sync/cleanup)
    - Blob ID convention (active-{timestamp})

key-files:
  created: []
  modified:
    - components/GameBoard.tsx

key-decisions:
  - "Used spawnTimestamp as blob ID since ActivePiece has no id field"
  - "Remove blob on lock rather than convert - standard sync handles locked state"

patterns-established:
  - "Blob ID prefix: active-{timestamp} for falling pieces, goopGroupId for locked"

issues-created: []

duration: 3min
completed: 2026-02-05
---

# Phase 27 Plan 01: Active Piece Physics Integration Summary

**Wired up soft-body blob lifecycle for active falling pieces - blobs now spawn, track, and cleanup with the piece.**

## Accomplishments

- Active falling pieces now create soft-body blobs on spawn (using `spawnTimestamp` as unique ID)
- Blob target position syncs with piece movement every frame while falling
- Falling blob is automatically removed when piece locks (letting standard locked-goop sync handle the locked state)
- No duplicate blobs - clean handoff from falling to locked state

## Files Modified

- `components/GameBoard.tsx` - Added three useEffect hooks for active piece blob lifecycle:
  1. Creation on spawn (dependency: `spawnTimestamp`)
  2. Position sync every frame (dependency: `x`, `y`, `state`)
  3. Lock transition cleanup (dependency: `activeGoop` ref tracking)

## Decisions Made

1. **Used `spawnTimestamp` as blob ID** - The `ActivePiece` interface doesn't have an `id` field, so `spawnTimestamp` serves as a unique identifier since each piece spawns at a different time.

2. **Blob ID format: `active-{timestamp}`** - This prefix distinguishes active piece blobs from locked goop blobs (which use `goopGroupId`).

3. **Remove blob on lock, don't convert it** - Simpler than calling `lockBlob()`. The existing locked-goop sync useEffect will create proper blobs for the newly locked cells. This avoids potential duplicate blob issues.

4. **All three tasks committed together** - The plan suggested separate commits per task, but the three tasks form a cohesive unit (blob creation, position sync, cleanup) in the same file. A single commit captures the complete feature better than artificially splitting it.

## Issues Encountered

None. Implementation was straightforward following the plan's guidance.

## Verification Results

- [x] `npm run test:run` passes (198 tests)
- [x] TypeScript compiles without errors
- [x] Dev server starts without errors (Build #184)
- [x] Code structure matches plan specification

## Commits

- `6ab8e31` - feat(27-01): Create falling blob on active piece spawn (includes all 3 tasks)

## Next Step

Ready for 27-02-PLAN.md (rendering switch) - the soft-body blobs now exist for falling pieces but are not yet rendered. Plan 02 will switch the visual rendering to use the soft-body blob path instead of the current rect-based rendering.
