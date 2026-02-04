---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-03
---

# Project State

## Current Position

Phase: 26.1 (Flatten Coordinate System) + SBG Integration
Plan: Phase 26.1-01 executed, SBG rendering ported from Proto 9
Status: SBG rendering works but has edge-of-screen clumping issue
Last activity: 2026-02-03 - Major SBG port from Proto 9

Progress: ██████░░░░ ~60%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

**Current:** Debug SBG edge-of-screen clumping issue
**Status:** Vertex debug added, need to diagnose why blobs collapse at edges
**Branch:** `soft-body-experiment`

### Immediate Issue

When SBG blobs approach the edge of the viewport (left or right), they "clump" or collapse into a small portion of their original shape. This is likely related to:
1. Cylindrical wrapping - cells may wrap around but centroid calculation doesn't handle this
2. Visual coordinates vs physics coordinates mismatch at edges

**Debug tools added:**
- Press backtick (`) for debug panel
- Enable "Show Vertices" checkbox to see numbered vertices and target marker

### What's Working
- SBG appears on lock
- Fill animation with inset path
- Fill pulse (ready-to-pop impulse)
- Same-color blob merging with attraction springs
- Position stays aligned when rotating (fixed!)
- Catmull-Rom smooth curves (not jagged polygons)

### What's NOT Working
- Edge-of-screen clumping/collapse
- Pop particles (droplets) - not implemented yet
- Some sliders may not be connected

### v1.5 Soft-Body Integration Overview

Port soft-body physics visuals from completed prototypes (5b-9) into main game rendering.

| Phase | Name | Goal |
|-------|------|------|
| 25 | Physics Foundation | Port Verlet engine, adapt to game coordinates |
| 26 | Perimeter & Blob System | Replace rect rendering with perimeter-traced blobs |
| 26.1 | Flatten Coordinates | Remove cylindrical projection (DONE) |
| 27 | Active Piece Physics | Falling pieces use soft-body (snappy) |
| 28 | Locked Goop Behavior | Viscosity, fill, ready-to-pop, attraction |
| 29 | Pop & Cascade | Droplets, support detection, loose goop |
| 30 | Polish & Performance | Mobile optimization, parameter tuning |

---

## Proto 9 Final Settings (Source of Truth)

These are the FINAL tweaked values from Proto 9:

| Parameter | Value | Notes |
|-----------|-------|-------|
| WallThickness | 8px | Fill animation wall |
| Damping | 0.97 | High, preserves momentum |
| Stiffness | 1 | Very low, loose springs |
| Pressure | 3.0 | Volume maintenance |
| HomeStiffness | 0.3 | Shape retention |
| InnerStiffness | 0.1 | Inner vertex stability |
| ReturnSpeed | 0.5 | Moderate |
| Viscosity | 2.5 | Honey-like for locked blobs |
| Iterations | 3 | Constraint solver |
| Goopiness | 25px | SVG filter strength |
| AttractRadius | 20px | Tendril detection range |
| AttractStiffness | 0.005 | Tendril pull strength |
| TendrilSize | 10px | Tendril endpoint radius |

---

## Session Continuity

Last session: 2026-02-03
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 147

### Files Modified This Session

**New files:**
- `core/softBody/rendering.ts` - Catmull-Rom curves, inset path, filter matrix

**Modified:**
- `core/softBody/types.ts` - Added wasFullLastFrame, all Proto 9 params
- `core/softBody/physics.ts` - Added applyOutwardImpulse, attraction springs
- `core/softBody/blobFactory.ts` - Initialize wasFullLastFrame
- `hooks/useSoftBodyPhysics.ts` - Fill animation, impulse, attraction springs
- `components/GameBoard.tsx` - Smooth curve rendering, fill animation, vertex debug
- `Game.tsx` - All Proto 9 sliders, vertex debug toggle
- `tests/softBody.test.ts` - Updated for new default values

### Resume Command
```
SBG rendering ported from Proto 9. Main features working but edge clumping bug exists.

NEXT: Debug edge-of-screen clumping
1. Enable vertex debug (backtick → Show Vertices)
2. Lock a piece near edge of screen
3. Rotate to push it to the edge
4. Watch what happens to vertices - they should stay evenly distributed

HYPOTHESIS: Centroid calculation breaks when cells wrap around the cylindrical tank
(some cells at visX=0, others at visX=11 → average is visX=5.5 which is wrong)
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
