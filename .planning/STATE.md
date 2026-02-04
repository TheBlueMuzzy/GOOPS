---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-04
---

# Project State

## Current Position

Phase: Proto-9 Parity (SBG visual tuning)
Plan: In progress - fixing discrepancies between game SBG and Proto-9
Status: Major physics fixes done, droplet system added, still tuning
Last activity: 2026-02-04 - Proto-9 parity work

Progress: ███████░░░ ~75%

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) integration (v1.5 milestone)

## Next Steps

**Current:** Continue Proto-9 parity tuning
**Status:** Core fixes done, droplets working, but still issues to resolve
**Branch:** `soft-body-experiment`

### Proto-9 Parity: IN PROGRESS (2026-02-04)

**What was fixed this session:**

| Fix | Before | After |
|-----|--------|-------|
| Home Stiffness | 0.3 (30x too stiff) | 0.01 (matches Proto-9) |
| Pressure Center | Calculated centroid | targetX/targetY (stable) |
| Blob Collision | Missing | Restored (MIN_DIST=20, PUSH=0.8) |
| Droplet System | Missing | Full system with gravity, bounce, fade |
| isFalling/isLoose flags | Missing | Added for collision logic |
| Per-color goo filter | All blobs in one group | Each color separate (no cross-merge) |
| Debug sliders | Missing iterations, droplets | All Proto-9 sliders exposed |

**Still needs work:**
- Droplet visuals may need more tuning (cell size scaling: 30px vs Proto's 50px)
- User reports things still "messing up"

### What's Working
- SBG appears on lock
- Fill animation with inset path
- Fill pulse (ready-to-pop impulse)
- Same-color blob merging with attraction springs
- Position stays aligned when rotating
- Seam crossing via goo filter merge
- **Blob collision** - different colors push apart
- **Droplet system** - particles scatter on pop, fall, bounce, fade
- **Per-color goo filter** - unlike colors don't visually merge
- **All Proto-9 sliders** in debug panel (press `)

### What's NOT Working
- Some visual parameter differences from Proto-9 (cell size scaling)
- User still tuning to match Proto-9 look

### Key Discovery: Cell Size Difference

Proto-9 uses `CELL_SIZE = 50px`, game uses `PHYSICS_CELL_SIZE = 30px`.
This affects how droplet size/speed values translate between the two.

Scaling factor: 50/30 = 1.67
- Proto-9 dropletSize 15 → Game needs ~25 for same proportion
- Proto-9 dropletSpeed 100 → Game needs ~167 for same proportion

---

## Proto 9 Final Settings (User-Tweaked)

These are the user's tweaked values from Proto 9:

| Parameter | Proto-9 Value | Game Value (scaled) | Notes |
|-----------|---------------|---------------------|-------|
| HomeStiffness | 0.01 | 0.01 | Fixed from 0.3 |
| Damping | 0.97 | 0.97 | Same |
| Stiffness | 1 | 1 | Same |
| Pressure | 3 | 3 | Same |
| InnerStiffness | 0.1 | 0.1 | Same |
| ReturnSpeed | 0.5 | 0.5 | Same |
| Viscosity | 2.5 | 2.5 | Same |
| Iterations | 3 | 3 | Same |
| Goopiness | 25px | 25px | Same |
| AttractRadius | 20px | 20px | Same |
| AttractStiffness | 0.005 | 0.005 | Same |
| TendrilSize | 10px | 10px | Same |
| WallThickness | 8px | 8px | Same |
| DropletCount | 30 | 30 | Same |
| DropletSpeed | 100 | 167 | Scaled for cell size |
| DropletLifetime | 3s | 3s | Same |
| DropletSize | 15 | 25 | Scaled for cell size |

---

## Session Continuity

Last session: 2026-02-04
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 173

### Files Modified This Session (2026-02-04)

**Modified:**
- `core/softBody/types.ts` - Fixed homeStiffness 0.3→0.01, added Droplet type, isFalling/isLoose flags, droplet params
- `core/softBody/physics.ts` - Fixed pressure calc (use target not centroid), added applyBlobCollisions()
- `core/softBody/blobFactory.ts` - Initialize isFalling/isLoose flags
- `hooks/useSoftBodyPhysics.ts` - Added droplet system, blob collisions, step runs even with no blobs
- `components/GameBoard.tsx` - Per-color goo filter, droplet rendering, droplet trigger on pop (not loose)
- `Game.tsx` - Added iterations slider, droplet sliders to debug panel
- `tests/softBody.test.ts` - Updated expected homeStiffness value

### Resume Command
```
Proto-9 parity work in progress.

DONE:
- Fixed homeStiffness 0.3 → 0.01
- Fixed pressure center (target, not centroid)
- Added blob collision for different colors
- Added droplet system with full physics
- Added all missing debug sliders
- Per-color goo filter groups
- Droplets only on true pop (not loose goop)

STILL TUNING:
- Cell size difference (30px vs 50px) affects visual scaling
- User still seeing issues, needs more adjustment

Debug panel: Press backtick (`) to access all sliders
Proto-9 reference: http://localhost:5173/GOOPS/?proto=9
```

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
