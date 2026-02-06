---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-05
---

# Project State

## Current Position

Phase: 27.1 Physics-Controlled Active Piece
Plan: MASTER-PLAN complete (9/9 tasks) — but has critical bugs
Status: Deep debugging session revealed multiple interacting bugs
Last activity: 2026-02-05 - Debug session, identified root causes

Progress: ████░░░░░░ ~40% (wiring done, bugs identified, fixes needed)

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

**Completed:** 27.1-01 + 27.1-02 (Physics falling integrated)
**Branch:** `soft-body-experiment`

### 27.1 Status (2026-02-05)

**MASTER-PLAN COMPLETE** — But deep debugging revealed critical bugs.

**Commits:**
- `c053204` feat: update scaling parameters for 30px cells
- `043e8c0` feat: add physics step context and getActivePieceState
- `74404bb` feat: wire physics to Game.tsx and GameEngine
- `7cb7839` refactor: remove Y sync from GameBoard to physics
- `200cc95` feat: sync blob shape on piece rotation

**Debug Fixes Applied This Session:**
1. Active blob removal bug: Added `if (blob.id.startsWith('active-')) continue;` in GameBoard.tsx:261 — blobs with "active-{timestamp}" IDs were being removed by locked goop sync
2. Rotation sync spam: Added refs to track previous rotation — dependency array `activeGoop?.cells` created new array reference each render
3. Rotation math shift: Changed from average Y to minimum Y as anchor — preserved piece top position
4. Wrong Y on blob recreation: Added safeguard `activeGoop.y <= 5` — tank rotation effect re-ran when blob removed, using floor position

### Known Issues (Remaining Bugs)

**Critical — Must Fix Before Phase Complete:**

1. **Visual rotation doesn't match physics**
   - Ghost piece rotates correctly
   - Actual falling blob does NOT visually rotate
   - Blob shape updates in gridCells, but rendering doesn't reflect it
   - Likely: physics blob vs visual rendering disconnect

2. **Pieces lock inside each other**
   - First piece lands correctly
   - Second piece spawns and slams into exact same space (overlapping)
   - Collision detection passes but placement is wrong
   - Likely: Grid state not updated after first piece locks

3. **Fast fall breaks subsequent spawns**
   - Press S for fast fall, piece hits bottom
   - NO pieces fall after that — spawning stops
   - Likely: State machine stuck or blob cleanup issue

4. **Tank rotation causes wobble (minor)**
   - Falling piece should move instantly when tank rotates
   - Instead: Springs toward new position with wobble
   - Expected: Instant X update, keep smooth Y falling

### Next Steps

**Do NOT attempt fixes without reading debug logs first:**
1. Add more console logging to identify exact failure points
2. Check grid state after piece locks (is cell marked occupied?)
3. Check blob lifecycle during fast fall (is cleanup correct?)
4. Verify rendering pulls from blob.gridCells correctly

---

## Session Continuity

Last session: 2026-02-05
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 204

### Resume Command
```
27.1 MASTER-PLAN executed but HAS CRITICAL BUGS.

SESSION ACCOMPLISHMENTS:
- Deep debugging with extensive console logging
- Fixed 4 interacting bugs (blob removal, rotation spam, rotation math, blob Y position)
- Identified 4 remaining critical bugs (listed in Known Issues)
- Fall speed confirmed correct: ~38.5 px/sec = ~780ms per cell
- Floor collision detection working: [FLOOR HIT] logs at cell.y=15

REMAINING BUGS (DO NOT FIX WITHOUT DEBUG LOGS):
1. Visual rotation doesn't match physics (ghost rotates, blob doesn't)
2. Pieces lock inside each other (second piece overlaps first)
3. Fast fall breaks subsequent spawns (no pieces after fast fall)
4. Tank rotation causes wobble (should be instant X move)

FILES WITH DEBUG LOGGING:
- core/softBody/physics.ts (stepActivePieceFalling debug)
- components/GameBoard.tsx (blob lifecycle logging)

Next: Add more targeted logging, identify exact failure points
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
