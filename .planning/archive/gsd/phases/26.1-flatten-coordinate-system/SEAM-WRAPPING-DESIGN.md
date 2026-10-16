# Seam Wrapping Design for Soft-Body Goop (SBG)

**Date:** 2026-02-04
**Status:** Design discussion complete, ready for implementation planning

---

## Overview

This document captures the design discussion for handling cylindrical wrapping of soft-body goop (SBG) at the tank seam. The goal is to allow SBG blobs to seamlessly pass through the seam when the tank rotates, trimming data from one side and rebuilding it on the other.

---

## The Problem

When SBG blobs approach the seam (where column 29 meets column 0), the physics and rendering break:
- Vertices on opposite sides of the seam have X positions far apart (e.g., -450 and +450)
- SVG paths draw lines across the entire screen
- Physics springs calculate wrong distances
- The blob "explodes" or stretches impossibly

Basic goops don't have this problem because they recalculate positions fresh each frame. SBG persists vertex positions, which causes the issue.

---

## The Solution: Dynamic Trim/Rebuild at the Seam

### Spatial Layout

```
tankgrid (30 columns total):

col 0 | col 1 | ... | col 8 | cols 9-20 (VIEWPORT) | col 21 | ... | col 28 | col 29
  ↑                                                                            ↑
SEAM                                                                         SEAM
COLUMN                                                                      COLUMN
(left)                                                                      (right)

← these two columns connect (cylinder wraps) →
```

- **Tank grid:** 30 columns (0-29)
- **Viewport:** 12 columns in the middle (visible to player)
- **Seam columns:** Column 0 (far left) and column 29 (far right)
- **Cylinder wrap:** Column 0 and column 29 are adjacent on the cylinder

### Key Insight

**Goops only lock within the viewport.** They never EXIST on the seam at creation. They only encounter the seam after tank rotation shifts them toward an edge. This means:
- No blob is ever CREATED spanning the seam
- Blobs only APPROACH the seam through movement (tank rotation)
- The seam crossing is a dynamic event, not a creation-time problem

### The Trim/Rebuild Process

When tank rotation causes a goop to cross the seam:

1. **Detect:** Check if any goop data exists in a seam column (0 or 29)
2. **Capture:** Store the chunk of data (cells, vertices, fill state, etc.) in that seam column
3. **Trim:** Remove that data from the original blob, dynamically close the shape
4. **Rebuild:** Create/extend a blob on the opposite seam column with the captured data
5. **Link:** The two pieces share an ID (or linked IDs like BlueA1/BlueA2) to track they're the same logical goop

### Visual Example

Reference image: `/art/wrap_example.png`

**Frame 1-2:** Plus-shaped goop in viewport, moving right toward the seam.

**Frame 3:** Goop approaches right seam. Vertices numbered 1-14 around perimeter.

**Frame 4 (key moment):**
- RIGHT side: Vertices 7, 8 are REMOVED. Shape dynamically closes from 6 → 9.
- LEFT side: NEW piece appears with vertices 6, 7, 8, 9 (the trimmed vertices PLUS connecting vertices needed for a valid closed shape).

**Frame 5-6:** Process continues. More columns cross. Right shrinks, left grows.

**Frame 7:** Entire goop has crossed. Full shape now on left side.

### Data Preservation

When trimming and rebuilding:
- **Same data:** Trimmed data is stored and recreated exactly on the other side
- **Fill state preserved:** Fill % continues across seam, doesn't restart due to shape rebuild
- **Springs recreated:** Spring rest lengths and connections are preserved/recreated from the stored data
- **No visual discontinuity:** Should appear seamless, as if nothing was rebuilt

### Linked Blobs

When a goop spans the seam, it exists as two physical blobs:
- **BlueA1:** Main piece (larger portion)
- **BlueA2:** Seam piece (portion that crossed)

These share:
- Color
- Fill state
- Logical ID / link reference
- Support status (if one has support, the other is considered supported)

They are at opposite ends of the tankgrid, so they never visually touch.

---

## Special Cases

### Full-Row Goop (Ouroboros)

A goop spanning all 30 columns (entire row) wraps around the cylinder like a snake eating its tail.

- It's ONE continuous piece, not two linked pieces
- The seam still trims one end and builds the other end
- No special handling needed - same logic, just no "split" because it's already connected

### Gravity / Falling

**Problem:** In frame 4, the left piece is floating (no support below). Normally it would fall, which would distort the shape.

**Solution:** Linked goops share support status.
- If BlueA1 has support, BlueA2 is also considered supported
- The floating piece doesn't fall because its linked partner has support

**Backup solution:** If physics causes issues, freeze physics ONLY in the seam columns (0 and 29). These columns don't run physics simulation.

### Fill Animation During Seam Crossing

If a goop is filling while crossing the seam:
- Fill state is preserved (same % on both pieces)
- Shape rebuild does NOT restart the fill
- Both pieces show the same fill progress
- Only actual piece additions (new cells locking) restart fill, not seam rebuilds

---

## Implementation Notes

### Trigger

Seam logic triggers on **tank rotation** that causes position recalculation. Check what's in seam columns (0 and 29) and process accordingly.

### Data to Capture/Transfer

When a column crosses the seam, capture:
- Which cells are in that column
- Vertex positions for those cells
- Spring rest lengths
- Fill amount
- Color
- Any other blob state

### Physics Considerations

- Springs should use cylindrical distance (`cylindricalDistanceX`) for calculations
- Seam columns may have frozen physics to prevent falling issues
- Linked blobs should share support checks

### Rendering Considerations

- Each physical blob renders independently
- ClipPath masks to viewport (already implemented)
- The two pieces never visually overlap (they're at opposite ends of tankgrid)
- Goo filter applies to each piece separately

---

## Questions Resolved

| Question | Answer |
|----------|--------|
| Where is the seam? | At tankgrid edges (columns 0 and 29) |
| When does trim/rebuild trigger? | On tank rotation causing position recalc |
| What data is transferred? | Cells, vertices, springs, fill state - entire chunk |
| Do split pieces touch? | No - they're at opposite ends of the tankgrid |
| How handle floating pieces? | Linked blobs share support status |
| What about full-row goops? | One continuous piece, same logic applies |
| Does fill restart on rebuild? | No - fill state preserved, only restarts on actual piece additions |

---

## Next Steps

1. Create detailed implementation plan (PLAN.md)
2. Implement seam detection logic
3. Implement data capture/transfer
4. Implement dynamic shape rebuild
5. Implement linked blob support sharing
6. Test with various goop shapes and rotations

---

## Related Files

- **Design image:** `/art/wrap_example.png` - Visual walkthrough of seam crossing
- **Physics:** `core/softBody/physics.ts` - Has `cylindricalDistanceX` helper
- **Blob factory:** `core/softBody/blobFactory.ts` - Creates blobs from cells
- **Hook:** `hooks/useSoftBodyPhysics.ts` - Manages blob lifecycle
- **Rendering:** `components/GameBoard.tsx` - SBG rendering with clipPath
