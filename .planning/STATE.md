---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-01-31
---

# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) visual overhaul (Proto-5c IN PROGRESS)

## Next Steps

**Current:** Proto-7 Pop
**Status:** NOT STARTED
**Branch:** `soft-body-experiment`

### Proto-6 Fill/Pour — COMPLETE ✅

**The Goal:**
- Fill rises from bottom inside the cell wall "container"
- Fill color matches outer goop exactly
- When 100% filled, looks like solid goop (no visible seam)
- Shake animation when clicking before 100%
- Boop scale pulse when fill reaches 100%

**The Solution: "Trim" Approach**

Instead of adding a fill layer, we **clip the inner cutout** to reveal the goop underneath:

```
LAYER 1: Outer goop (solid, filtered)
LAYER 2: Inner cutout (bgColor, CLIPPED to unfilled portion only)
```

**How it works:**
- The inner cutout is clipped with a rect that only shows the "unfilled" area (above fill line)
- As fill increases, the clip rect shrinks from bottom up
- This reveals the goop underneath as the "fill"
- At 100% fill, cutout disappears entirely → solid goop shows

**Why this is better than previous attempts:**
- The "fill" IS the outer goop, so it has the same gooey edges
- No seam because we're not trying to match two different paths
- Simpler architecture (2 layers instead of 3)
- Like After Effects "trim" effect — revealing rather than adding

**What Works:**
- Fill amount (0-1) per blob, auto-fills over time
- Fill effect via clipped cutout (reveals goop from bottom up)
- Shake animation on early click (CSS keyframes)
- Boop scale animation at 100% (scale from center)
- Reset button to empty all containers
- No visible seam at any fill level

**Key Files:**
- `prototypes/SoftBodyProto6.tsx` — Complete fill/pour mechanics

### Proto-5c Cell Wall Experiment — SOLVED

**The Goal:**
Render goop with a "cell wall" effect:
- **Outer edge** = gooey silhouette that stretches and merges (like Proto-5b)
- **Inner edge** = stable boundary that barely moves
- **Cell wall** = the visible filled ring BETWEEN outer and inner
- **Interior** = empty space for future "time to pop" fill

**The Approach:**
1. Layer 1: Render outer gooey shape with goo filter (filled, like 5b)
2. Layer 2: Render inner shape on top with background color (cuts out the middle)
3. Result: visible cell wall ring

**The Problem (SOLVED):**
Corrupt shape inner cutouts weren't wobbling like T/U shapes because they had separate physics vertices instead of deriving from the outer vertices.

**The Fix:**
Added `outerVertexIndices` to `InnerRegion` interface. Each inner region corner maps to a specific outer vertex. At render time, inner positions are derived directly from outer vertex positions (not simulated separately).

Mappings for Corrupt shape:
- Top-left square → outer vertices [0, 1, 2, 19]
- Top-right square → outer vertices [12, 13, 14, 11]
- Stem rectangle → outer vertices [5, 8, 7, 6]

**Key Code:**
```typescript
interface InnerRegion {
  outerVertexIndices?: number[];  // Maps corners to outer vertices (for wobble)
  // ... other fields
}

// Rendering: use outer vertex positions when available
if (region.outerVertexIndices) {
  worldPoints = region.outerVertexIndices.map(idx => blob.vertices[idx].pos);
} else {
  worldPoints = region.vertices.map(v => v.pos);  // fallback
}
```

**Key Files:**
- `prototypes/SoftBodyProto5c.tsx` — Main prototype file

### Proto-5c Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Filter | Medium preset | Blur 8, Alpha 20/-12 |
| Wall Thickness | 8px | Inset amount for inner cutout |
| Inner Home Stiffness | 0.5 | Very stiff (for stable inner) |
| Goopiness | 25px | Break distance for tendrils |
| Tendril End Radius | 10px | Bead size at string ends |
| Tendril Skinniness | 0.7 | Middle thins when stretched |

### Proto Access URLs

| Proto | URL | Status |
|-------|-----|--------|
| 5b | `?proto=5b` | COMPLETE — Gold standard goo filter |
| 5c | `?proto=5c` | COMPLETE — Cell wall rendering |
| 6 | `?proto=6` | COMPLETE — Fill/Pour mechanics (trim approach) |

---

## Previous Proto Results (Complete)

### Proto-5b: Gold Standard ✅

Single perimeter shapes with gooey SVG filter:
- T, U, and Corrupted T shapes
- Attraction springs with mozzarella pull
- Beads-on-string tendrils
- Corrupted shapes work with pressure disabled

**Gold Standard Settings:**
| Parameter | Value |
|-----------|-------|
| Blur | 8 |
| Alpha Mult | 20 |
| Alpha Offset | -12 |
| Goopiness | 25px |
| Attraction Radius | 20px |
| Attraction Strength | 0.005 |

### Proto 1-4: Complete ✅

See full details in sections below.

---

## Remaining Prototypes

### Proto-7: Pop
What happens visually when goop is cleared?

### Proto-8: Loose Goop
How does freed goop behave when disconnected?

---

## Session Continuity

Last session: 2026-01-31
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 110

### Resume Command
```
Proto-6 Fill/Pour COMPLETE. Branch: soft-body-experiment
Server: localhost:5173/GOOPS/?proto=6

COMPLETED: Fill mechanics with "trim" approach:
- 2-layer architecture: Outer goop (filtered) + Inner cutout (clipped)
- No separate fill layer — the goop IS the fill
- Cutout clipped to unfilled area, shrinks from bottom up as fill increases
- At 100%, cutout gone → solid goop visible
- No seam because "fill" has same gooey edges as outer

NEXT: Proto-7 Pop — What happens when goop is cleared?
File: prototypes/SoftBodyProto6.tsx (complete)
```

---

## Proto 1-4 Results (Reference)

### Proto-1: Single Blob Physics ✅
- Verlet + springs + pressure + Catmull-Rom
- Damping 0.975, Gravity 30, Stiffness 20, Pressure 2.5

### Proto-2: Blob Follows Cursor ✅
- Two-layer architecture (data drives render)
- Home Stiffness 0.03 for laggy/stretchy follow

### Proto-3: Rotation Stress Test ✅
- Rapid 90° rotations stable
- Home Stiffness 0.18 for snappy recovery

### Proto-4: Two Blobs Attraction ✅
- Per-vertex attraction radii (outer=1.5x, inner=0.3x)
- Variable stiffness ramp (10% → 100%)
- Break distance 60 for stickiness

---

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
