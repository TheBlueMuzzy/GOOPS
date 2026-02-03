---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-02-03
---

# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `soft-body-experiment` — Soft Body Goop (SBG) visual overhaul (ALL PROTOTYPES COMPLETE)

## Next Steps

**Current:** Proto-9 complete, ready for main game integration planning
**Status:** All prototypes (5b-9) COMPLETE
**Branch:** `soft-body-experiment`

### Proto-9 Loose Goop — COMPLETE ✅

**The Goal:**
Test what happens when goop loses support after a pop — soft-body falling and remerging.

**What Works:**
- Support detection: after pop, checks all blobs for support (floor or supported blob below)
- `isLoose` state: blobs that lost support become loose and fall
- Falls at game speed: 0.02 grid units/ms (matches real game loose goop)
- Soft-body wobble during fall (no viscosity = snappy like active piece)
- Same-color merge on landing with fill reset to 0%
- Different-color stacking (no merge)
- Cascade detection: landing may create new loose goop
- **Corrupted shape splitting:** disconnected cells split into separate falling pieces
- **Blob collision fix:** only applies when at least one blob is moving (locked blobs stay grid-aligned)
- **Momentum dampening:** 30% transfer on merge prevents implosion

**Test Modes:**
- **Test A: Stack Pop Cascade** — Multi-cell pieces (4x1, T, J), pop T, J falls and merges
- **Test B: Corrupted Spawner** — Spawn corrupted pieces with rotation to build complex scenarios
- **Default** — Original Proto-8 setup

**Key Files:**
- `prototypes/SoftBodyProto9.tsx` — Loose goop prototype
- Access via: `?proto=9`

**Next Steps:**
- Plan integration of soft-body visuals into main game
- Determine which prototype features to port vs. rebuild

### Proto-8 Pop — COMPLETE ✅

**The Goal:**
Test what happens when goop is cleared — pop effect with droplet residue.

**What Works:**
- Pop effect: click filled blobs to spawn droplets that scatter and fade
- Droplets bounce off floor, exit through sides (matches real game - no side walls)
- Blob-to-blob collision for different colors (push apart, don't overlap)
- Dev menu toggles with ` key
- Save/Load settings to localStorage
- Debug vertex visualization for merged blobs (yellow numbered dots)
- **Ready-to-pop indicator:** Physics-based impulse (one-time outward push when blob fills, settles naturally via springs/damping)

**Pressure System Rebuilt:**
Old area-based pressure had bugs with complex merged shapes (inverted blobs). New approach:
- Radial spring model: each vertex wants to maintain its rest distance from center
- Compressed → pushes out, Stretched → pulls in
- No pressure on falling pieces (only locked blobs)
- Still being tuned - may need adjustment

**Key Technical Findings:**
- Perimeter winding order matters for pressure normals (CCW = outward)
- Added winding detection and auto-reversal if clockwise
- Momentum transfer during merge was causing instability (needs review)
- Ready-to-pop: Physics impulse > continuous animation (more organic, uses existing physics)

**Key Files:**
- `prototypes/SoftBodyProto8.tsx` — Pop mechanics prototype
- Access via: `?proto=8`

**Next:**
- Tune pressure system for good bounciness without instability
- Test pop effect feel
- Proto-9 (Loose Goop) — how freed goop behaves

### Proto-7 Merge — COMPLETE ✅

**The Goal:**
Test dynamic blob generation when pieces lock — the bridge between prototype shapes and real game integration.

**What Works:**
- Grid-based test environment (6x8 cells, 50px each)
- Dynamic blob generation from grid cells (perimeter tracing algorithm)
- Falling pieces are full/solid (no inner cutout) with physics
- Smooth continuous falling (not grid-step) like the real game
- Same-color merge: pieces combine into one blob, new unified inner cutout, fill restarts at 0%
- Different-color: just neighbors, no merge
- Physics momentum transfer on merge (less jarring transition)
- Impact effect on locked pieces when new piece lands (localized to contact points)
- Return Speed slider — controls how fast blobs return to shape (falling pieces use full speed)
- Viscosity slider — honey-like slow return for locked pieces
- Distance-based cross springs — arms of T/L shapes can swing independently
- Solid container — blobs squish against floor/walls with soft damping

**Tuned Default Settings:**
| Parameter | Value | Notes |
|-----------|-------|-------|
| Damping | 0.97 | High, preserves momentum |
| Stiffness | 1 | Very low, loose springs |
| Pressure | 5 | Strong volume maintenance |
| Home Stiffness | 0.01 | Very weak shape pull |
| Inner Stiffness | 0.1 | Slightly stiffer core |
| Return Speed | 0.5 | Moderate return speed |
| Viscosity | 2.5 | Very honey-like |
| Iterations | 3 | Standard |
| Impact Strength | 5 | Subtle squish on landing |
| Impact Radius | 1.5 | cells |
| Fall Speed | 200 | px/sec |

**Key Technical Decisions:**
- `canFallMore` check: piece can only fall if ALL cells can move down (not any)
- Impact uses actual contact points (where cells touch grid), not blob centers
- Per-vertex distance check for localized impulse application
- Cross springs distance-based (75px max) instead of index-based for independent arm movement
- Viscosity/returnSpeed skip for falling pieces (they stay snappy)
- Boundary constraints use soft damping (30%) instead of hard stop

**Key Files:**
- `prototypes/SoftBodyProto7.tsx` — Merge mechanics prototype
- Access via: `?proto=7`

**Next:**
- Proto-8 (Pop) — what happens when goop is cleared?
- Proto-9 (Loose Goop) — how freed goop behaves

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
| 7 | `?proto=7` | COMPLETE — Merge mechanics + viscosity tuning |
| 8 | `?proto=8` | COMPLETE — Pop effects + radial pressure + physics impulse |
| 9 | `?proto=9` | COMPLETE — Loose goop, splitting, cascade, momentum dampening |

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

### Proto-7: Merge — COMPLETE ✅
Dynamic blob generation when pieces lock. Viscosity and return speed tuned for honey-like feel.

### Proto-8: Pop — NEXT
What happens visually when goop is cleared? Options to explore:
- Splat outward animation
- Fade/dissolve
- Particle burst
- Blob shrinks/implodes

### Proto-9: Loose Goop
How does freed goop behave when disconnected?

---

## Session Continuity

Last session: 2026-02-03
**Version:** 1.1.13
**Branch:** soft-body-experiment
**Build:** 117

### Resume Command
```
Proto-9 Loose Goop COMPLETE. Branch: soft-body-experiment
Server: localhost:5177/GOOPS/?proto=9

COMPLETED THIS SESSION:
- Proto-9 loose goop with support detection and cascade
- Corrupted shape splitting into disconnected falling pieces
- Blob collision fix (only applies when blobs are moving)
- Momentum dampening (30%) to prevent implosion on merge
- Test A setup with multi-cell pieces (4x1, T, J)

ALL PROTOTYPES COMPLETE (5b through 9)
NEXT: Plan integration into main game
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
