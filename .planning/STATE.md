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

**Current:** Proto-5c Cell Wall Rendering
**Status:** IN PROGRESS — Inner regions not responding to physics correctly
**Branch:** `soft-body-experiment`
**Server:** `localhost:5201/GOOPS/?proto=5c`

### CRITICAL RESUME CONTEXT — Proto-5c Cell Wall Experiment

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

**Current Problem (UNSOLVED):**
For the Corrupt shape, the inner cutouts don't respond to physics like T and U do. They just rotate/translate but don't wobble or rebound when dragged.

**What's Been Tried:**

1. **Simple inset toward center** — Failed for complex shapes (T-shape notches didn't work)

2. **Proper path offset with vertex normals** — Works for T and U, but Corrupt shape has self-intersecting perimeter that breaks it

3. **Split Corrupt into 3 separate blobs** — Works but then they're not connected (no single outer gooey shell)

4. **Hybrid approach (CURRENT):**
   - Outer: Single complex Corrupt perimeter (for gooey merging)
   - Inner: 3 separate simple `InnerRegion` shapes with their own physics vertices
   - Added `innerRegions?: InnerRegion[]` to Blob interface
   - Added physics simulation (integrate + applyHomeForce) for innerRegion vertices
   - **STILL NOT WORKING** — inner regions don't wobble like T/U do

**The Difference:**
- T and U: `getInsetPath(blob.vertices.map(v => v.pos))` — uses OUTER vertices which ARE physics-simulated
- Corrupt: `region.vertices.map(v => v.pos)` — uses separate innerRegion vertices

The T/U inner cutouts follow the OUTER vertices' deformation. The Corrupt inner regions have their OWN vertices that aren't getting the same physics wobble.

**Possible Fixes to Try:**
1. Make innerRegion vertices follow/interpolate from nearest outer vertices
2. Apply same physics forces to innerRegion vertices that outer vertices get
3. Different architecture — maybe inner should track outer, not simulate independently

**Key Files:**
- `prototypes/SoftBodyProto5c.tsx` — Main prototype file (~1200 lines)

**Key Code Sections:**

```typescript
// InnerRegion interface (line ~47)
interface InnerRegion {
  offsetX: number;
  offsetY: number;
  points: Vec2[];           // Local home coordinates
  vertices: InnerVertex[];  // Physics-simulated vertices
}

// Blob interface includes optional innerRegions
interface Blob {
  vertices: Vertex[];           // Outer (gooey)
  innerVertices: InnerVertex[]; // Inner (for simple shapes)
  innerRegions?: InnerRegion[]; // For complex shapes like Corrupt
  // ... other fields
}

// Physics simulation for innerRegions (in integrate and applyHomeForce functions)
if (blob.innerRegions) {
  for (const region of blob.innerRegions) {
    // Vertices get damping, gravity, and strong home force
    // But they're NOT deforming like outer vertices do
  }
}

// Rendering (LAYER 2, around line 1150)
if (blob.innerRegions) {
  // Uses region.vertices.map(v => v.pos) — the physics-simulated positions
  // Then applies getInsetPath for wall thickness
}
```

**The T/U approach that WORKS:**
Their inner cutout is computed from `blob.vertices` (the OUTER gooey vertices). As the outer vertices deform from physics, the inner cutout follows because it's computed FROM those outer positions.

**The Corrupt approach that DOESN'T WORK:**
The inner regions have their OWN separate vertices. These vertices get physics simulation (integrate + home force), but they don't "feel" the same deformations that the outer vertices experience from the springs and pressure.

**Possible Solution Direction:**
Instead of giving innerRegions their own physics vertices, compute their positions as an OFFSET from nearby outer vertices. This way when the outer wobbles, the inner wobbles too (because it's derived from outer).

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
| 5c | `?proto=5c` | IN PROGRESS — Cell wall experiment |

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

### Proto-6: Fill/Pour
How does goop visually "fill" into a piece shape?

### Proto-7: Pop
What happens visually when goop is cleared?

### Proto-8: Loose Goop
How does freed goop behave when disconnected?

---

## Session Continuity

Last session: 2026-01-31
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 107

### Resume Command
```
Continue Proto-5c cell wall experiment. Branch: soft-body-experiment
Server: localhost:5201/GOOPS/?proto=5c

PROBLEM: Corrupt shape inner cutouts don't wobble/rebound like T and U.
- T/U inner cutouts derive from OUTER vertices (which have physics)
- Corrupt inner regions have SEPARATE vertices that don't feel same deformation

SOLUTION DIRECTION: Inner should be computed FROM outer, not simulated independently.

File: prototypes/SoftBodyProto5c.tsx
Key sections: InnerRegion interface, integrate(), applyHomeForce(), LAYER 2 rendering
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
