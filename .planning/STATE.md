---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-06
---

# Project State

## Current Position

Phase: 27.1 Physics-Controlled Active Piece
Plan: MASTER-PLAN complete (9/9 tasks) — ALL BUGS FIXED
Status: Physics-controlled falling piece fully working
Last activity: 2026-02-06 - Fixed all 4 critical bugs

Progress: ████████░░ ~80% (core physics working, needs polish)

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

**Completed:** 27.1-01 + 27.1-02 + 27.1-03 (Physics falling fully integrated)
**Branch:** `soft-body-experiment`

### 27.1 Status (2026-02-06)

**ALL CRITICAL BUGS FIXED** — Physics-controlled active piece working.

**Recent Commits:**
- `34fcfcf` fix(27.1): resolve 3 critical physics bugs (rotation, overlap, spawn)
- Previous: rotation sync, Y sync, physics wiring

**Bugs Fixed This Session:**
1. **Visual rotation mismatch** — Added `blob.rotation = pieceRotation * 90`
2. **Pieces overlapping** — Fixed Y coordinate conversion (visual → full grid with BUFFER_HEIGHT)
3. **No second piece after lock** — Physics sync now checks blob timestamp matches current piece
4. **Tank rotation wobble** — Vertices now shift instantly with target position
5. **Displacement bug (X coords)** — Added tankRotation to convert visual X → game grid X

**Key Fixes:**
- Physics collision now correctly converts visual coords to game grid coords
- Y: `fullGridY = visualY + BUFFER_HEIGHT`
- X: `gridX = visualX + tankRotation` (with wrapping)
- Physics sync only updates blob matching current piece's spawnTimestamp

### Known Issues

None critical. Minor polish items:
- Physics "looseness" could be tuned (blobs are a bit wobbly)
- Could optimize by reducing debug variable declarations

### Next Steps

1. Test edge cases (fast fall, rotation near floor, tank rotation during collision)
2. Consider physics parameter tuning for tighter feel
3. Move to next phase or polish current implementation

---

## Session Continuity

Last session: 2026-02-06
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 205

### Resume Command
```
27.1 PHYSICS-CONTROLLED ACTIVE PIECE WORKING.

SESSION ACCOMPLISHMENTS:
- Fixed all 4 critical bugs from previous session
- Fixed additional displacement bug (X coordinate conversion)
- Cleaned up all debug logging (~15 console.log statements removed)
- Tank rotation wobble fixed (instant vertex movement)

WORKING FEATURES:
- Pieces fall with physics simulation
- Pieces stack correctly on each other
- Rotation updates blob shape and vertices
- Tank rotation moves piece instantly (no wobble)
- New pieces spawn correctly after lock

FILES MODIFIED:
- core/softBody/physics.ts (collision detection with tankRotation)
- hooks/useSoftBodyPhysics.ts (pass tankRotation to physics)
- components/GameBoard.tsx (instant vertex shift on tank rotation)
- core/GameEngine.ts (removed debug logs)

Next: Test edge cases, consider physics tuning, or move to next phase
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
