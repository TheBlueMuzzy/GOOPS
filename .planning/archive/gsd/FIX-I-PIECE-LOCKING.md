# Fix: I-Piece (Straight) Locking Bug

## Symptom (from Muzzy)
- Straight pieces (I-shaped: T_I, P_I, H_I) don't lock reliably
- Drop a 4x1 on its skinny side (vertical) — it just sits there, never locks
- Have to make ~10 moves before force-lock kicks in
- **Horizontal orientation works fine** — only vertical is broken
- All other piece shapes lock normally

## Root Cause: Y Offset Bug in `getActivePieceState()`

**File:** `hooks/useSoftBodyPhysics.ts` lines 487-493

```typescript
// CURRENT (BUGGY):
let minY = activeBlob.gridCells[0]?.y ?? 0;
for (const cell of activeBlob.gridCells) {
    if (cell.y < minY) minY = cell.y;
}
const gridY = minY + BUFFER_HEIGHT;
```

This computes `gridY = minVisualY + BUFFER_HEIGHT`. This is only correct when the piece's smallest cell Y offset is 0.

### Why I-Pieces Are Different

Every non-I piece has minimum cell Y offset = 0. All three I-pieces have **negative** Y offsets:

| Piece | Cells (y offsets) | Min Y Offset | Error |
|-------|-------------------|--------------|-------|
| T_I | -1, 0, 1, 2 | **-1** | 1 row too high |
| P_I | -2, -1, 0, 1, 2 | **-2** | 2 rows too high |
| H_I | -2, -1, 0, 1, 2, 3 | **-2** | 2 rows too high |
| T_L | 0, 1, 2, 0 | 0 | correct |
| T_T | 0, 1, 2, 1 | 0 | correct |
| T_S | 0, 1, 1, 2 | 0 | correct |
| T_O | 0, 1, 0, 1 | 0 | correct |
| (all penta/hexa non-I) | 0+ | 0 | correct |

### Why Horizontal I-Pieces Work

When T_I rotates to horizontal, cells become `[-1,0], [0,0], [1,0], [2,0]` — all Y offsets are 0. The bug disappears. This matches Muzzy's observation exactly.

### How Wrong piece.y Breaks Locking

1. `getActivePieceState()` returns gridY that's 1-2 rows too high
2. `syncActivePieceFromPhysics` (GameEngine.ts:1505) sets `activeGoop.y = gridY` (wrong)
3. `checkCollision` in `RotateGoopCommand` (actions.ts:139) and `SpinTankCommand` (actions.ts:43) uses `piece.y + cell.y` — with wrong piece.y, collision checks are **more lenient**
4. Rotations/spins succeed that shouldn't → each resets lock timer (`lockStartTime = null`, `lockResetCount++`)
5. Timer never accumulates to 500ms
6. Eventually `lockResetCount >= 10` triggers force-lock (~10 moves)

### Additional Factor: Tall Aspect Ratio

When a vertical I-piece rotates to horizontal, the blob's `gridCells` jump 3+ rows above the floor (GameBoard.tsx rotation anchoring at line 396-399). This makes `isColliding` flip to `false` for multiple frames, further resetting the timer. Other pieces only jump 0-1 rows.

### Possible Second Issue

Muzzy reports the piece never locks even without input. The physics collision detection (`stepActivePieceFalling` in physics.ts:681-709) appears correct from code analysis — `isColliding` should be `true` for a piece at the floor. If the fix below doesn't resolve the "never locks at rest" behavior, add a debug log to track `isColliding` frame-by-frame:

```typescript
// In syncActivePieceFromPhysics, temporarily add:
if (this.state.activeGoop?.definition.type.includes('_I')) {
    console.log(`I-PIECE: isColliding=${physicsIsColliding}, gridY=${physicsGridY}, lockStart=${this.lockStartTime}, resets=${this.lockResetCount}`);
}
```

## The Fix

**File:** `hooks/useSoftBodyPhysics.ts`, function `getActivePieceState()` (line 478)

The fix needs to account for the piece's minimum cell Y offset. The function needs access to the active piece's cell definitions to compute this.

### Option A: Compute from blob gridCells vs game piece cells

The blob's `gridCells` are absolute visual positions. The game engine's `activeGoop.cells` are relative offsets. The difference between `minVisualY` and the expected piece.y is exactly the minimum cell Y offset.

The correct formula: `gridY = minVisualY + BUFFER_HEIGHT - minCellYOffset`

For T_I (minCellYOffset = -1): `gridY = minVisualY + BUFFER_HEIGHT - (-1) = minVisualY + BUFFER_HEIGHT + 1`

### Implementation

The function currently doesn't have access to the piece definition's cell offsets. Two approaches:

**Approach 1 (Simplest):** Pass the active piece's cells into the function or store them on the blob.

Since blobs already store `gridCells` (absolute visual positions), we could also store the original cell offsets. Add a field to SoftBlob:

```typescript
// In types.ts, SoftBlob interface:
cellOffsets?: Vec2[];  // Original piece cell offsets (for Y correction)
```

Set it when creating the blob (in GameBoard.tsx blob creation):
```typescript
// After creating the blob, store the offsets
const newBlob = softBodyPhysics.createBlob(visualCells, color, blobId, false, tankRotation);
// Need to also pass cell offsets somehow
```

**Approach 2 (Minimal change):** Compute minCellYOffset from the difference between gridCells and their expected positions. Since we know `visualCell.y = pieceY + cell.y - BUFFER_HEIGHT`, and we know the cells move together, the minimum relative offset within the gridCells equals the minimum cell Y offset pattern.

Actually, simplest: just compute from the gridCells themselves. The minimum Y offset of the ORIGINAL cells equals:
```
minCellYOffset = min(gridCell.y) - min(gridCell.y)  // that's 0, useless
```

No — we need the original piece definition cells. The cleanest approach:

**Approach 3 (Recommended — store minCellY on blob):**

When creating the falling blob in GameBoard.tsx (~line 316), compute and store the minimum cell Y offset:

```typescript
// In GameBoard.tsx, blob creation effect:
const minCellY = Math.min(...activeGoop.cells.map(c => c.y));
```

Then store it on the blob. Add to SoftBlob type:
```typescript
minCellYOffset: number;  // Minimum Y offset from piece definition (for getActivePieceState correction)
```

Set in createBlobFromCells or after creation. Then in getActivePieceState:
```typescript
const gridY = minY + BUFFER_HEIGHT - (activeBlob.minCellYOffset ?? 0);
```

### Files to Modify

| File | Change |
|------|--------|
| `core/softBody/types.ts` | Add `minCellYOffset: number` to SoftBlob interface |
| `core/softBody/blobFactory.ts` | Initialize `minCellYOffset: 0` in createBlobFromCells |
| `components/GameBoard.tsx` | Set `blob.minCellYOffset` after creating active piece blob (~line 324) |
| `hooks/useSoftBodyPhysics.ts` | Fix gridY calculation in getActivePieceState (~line 493) |

### Verification

After fix:
1. Drop T_I (4-cell straight) vertically onto empty floor — should lock after 500ms without input
2. Drop P_I (5-cell straight) vertically — same test
3. Rotate I-piece near floor — should still allow some rotations but not infinite
4. All other pieces should behave identically (minCellYOffset = 0, no change)
5. Run `npm run test:run` — all 210 tests should pass

### If Timer Still Doesn't Fire At Rest

Add the debug log above. Check if `isColliding` stays true. If it flickers, there's a second bug in physics collision detection or the React render cycle that needs separate investigation.
