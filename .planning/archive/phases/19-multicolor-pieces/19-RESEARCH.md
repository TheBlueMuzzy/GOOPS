# Phase 19: Multi-Color Pieces - Research

**Researched:** 2026-01-24
**Domain:** Piece generation, color assignment, graph partitioning
**Confidence:** HIGH

<research_summary>
## Summary

Researched the existing piece generation/spawning system and algorithms for splitting a shape into two contiguous color groups.

**Current system:** Pieces are defined in `constants.ts` as arrays of relative coordinates. `GameEngine.spawnNewPiece()` creates pieces with a single color from the rank-based palette. The `PieceDefinition` type has a single `color` property - this needs to change to support per-cell colors.

**Split algorithm:** For small polyominoes (2-8 cells), we can enumerate all valid bipartitions using BFS/DFS. The algorithm models the piece as a grid graph (4-connected adjacency), finds all ways to split into two connected subgraphs, and picks the most balanced (closest to 50/50). This is O(2^n) but with n=2-8 and early pruning, it's fast enough (max 256 iterations).

**Primary recommendation:** Add `cellColors?: string[]` to `PieceDefinition` for per-cell color override. Implement a `splitPieceIntoTwoColors()` function that finds the most balanced contiguous partition. Apply at spawn time when roll succeeds (25% chance, rank 20+).

</research_summary>

<standard_stack>
## Standard Stack

### Core (Already in Codebase)
| Component | Location | Purpose | Relevance |
|-----------|----------|---------|-----------|
| `PieceDefinition` | `types.ts:17-21` | Shape + color definition | Needs `cellColors` array |
| `PIECES` array | `constants.ts:370-385` | Tetromino definitions | Source of shapes to split |
| `spawnNewPiece()` | `GameEngine.ts:530-614` | Piece generation flow | Where multi-color logic hooks in |
| `spawnPiece()` | `utils/gameLogic.ts:27-45` | Creates ActivePiece | Color assignment happens here |
| `PiecePreview` | `components/PiecePreview.tsx` | Renders next piece | Needs per-cell color support |

### New Components Needed
| Component | Purpose | Location (Proposed) |
|-----------|---------|---------------------|
| `splitPiece()` | Find balanced contiguous partition | `utils/pieceUtils.ts` |
| `isConnected()` | Check if cell set forms connected region | `utils/pieceUtils.ts` |
| `getAdjacentCells()` | Return neighbors in 4-connectivity | `utils/pieceUtils.ts` |

### No External Libraries Needed
This is pure algorithmic work on small graphs (2-8 nodes). Standard TypeScript array manipulation suffices.

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Current Piece Flow
```
PIECES array (constants.ts)
    ↓
randomPiece() selection
    ↓
spawnPiece() assigns single color from palette
    ↓
GameEngine.spawnNewPiece() positions piece
    ↓
PiecePreview renders with definition.color
```

### New Multi-Color Flow
```
PIECES array (constants.ts)
    ↓
randomPiece() selection
    ↓
shouldSplitPiece() → 25% chance at rank 20+
    ↓
If split: splitPiece(definition, color1, color2)
    - Find most balanced contiguous partition
    - Assign cellColors array
    ↓
spawnPiece() uses cellColors if present
    ↓
GameEngine.spawnNewPiece() positions piece
    ↓
PiecePreview renders per-cell colors
```

### Pattern 1: Per-Cell Color Array
**What:** Add optional `cellColors` to PieceDefinition
**Why:** Preserves backward compatibility - single-color pieces don't need the array
**Example:**
```typescript
interface PieceDefinition {
  type: PieceType;
  cells: Coordinate[];
  color: string;           // Default/fallback color
  cellColors?: string[];   // Per-cell colors (parallel to cells array)
}
```

### Pattern 2: Graph-Based Contiguity Check
**What:** Model piece cells as graph nodes, check connectivity via BFS
**Why:** Works for any polyomino shape, not just tetrominoes
**Example:**
```typescript
function isConnected(cells: Coordinate[]): boolean {
  if (cells.length === 0) return true;
  if (cells.length === 1) return true;

  const visited = new Set<string>();
  const queue = [cells[0]];
  const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));

  while (queue.length > 0) {
    const cell = queue.shift()!;
    const key = `${cell.x},${cell.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    // Check 4-connected neighbors
    for (const [dx, dy] of [[0,1], [0,-1], [1,0], [-1,0]]) {
      const neighborKey = `${cell.x + dx},${cell.y + dy}`;
      if (cellSet.has(neighborKey) && !visited.has(neighborKey)) {
        queue.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
  }

  return visited.size === cells.length;
}
```

### Pattern 3: Enumerate Valid Partitions
**What:** Generate all 2^n subsets, filter to valid bipartitions
**Why:** For n=2-8, this is fast enough (max 256 iterations)
**Example:**
```typescript
function findBestSplit(cells: Coordinate[]): [Coordinate[], Coordinate[]] | null {
  const n = cells.length;
  let bestSplit: [Coordinate[], Coordinate[]] | null = null;
  let bestBalance = Infinity; // Lower is better (|size1 - size2|)

  // Try all non-trivial subsets (1 to n-1 cells in group A)
  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    const groupA: Coordinate[] = [];
    const groupB: Coordinate[] = [];

    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        groupA.push(cells[i]);
      } else {
        groupB.push(cells[i]);
      }
    }

    // Both groups must be connected
    if (!isConnected(groupA) || !isConnected(groupB)) continue;

    const balance = Math.abs(groupA.length - groupB.length);
    if (balance < bestBalance) {
      bestBalance = balance;
      bestSplit = [groupA, groupB];
      if (balance === 0) break; // Perfect 50/50, stop early
    }
  }

  return bestSplit;
}
```

### Anti-Patterns to Avoid
- **Hardcoding splits per piece type:** Works for 7 tetrominoes but breaks for future non-tetris shapes
- **Random cell coloring:** Creates non-contiguous groups, looks messy
- **Modifying PIECES array directly:** Keep base definitions clean, apply colors at spawn

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Adjacency check | Manual coordinate comparison | Set-based lookup with `${x},${y}` keys | O(1) vs O(n) per neighbor check |
| Connected component | DFS with mutation | BFS with visited set | Cleaner, no stack overflow risk |
| Shape rendering | SVG path manipulation | Existing cell-by-cell rect rendering | Already works in PiecePreview |

**Key insight:** The algorithm is simple enough to implement directly. No external libraries needed for graph operations on 2-8 node graphs.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Rotation Changes Cell Positions
**What goes wrong:** Split calculated on base rotation, but rotated cells have different coordinates
**Why it happens:** `cells` array in ActivePiece changes with rotation
**How to avoid:** Calculate split on base `definition.cells`, store `cellColors` parallel to base cells. Rotation permutes both arrays identically.
**Warning signs:** Multi-color pieces look wrong after rotation

### Pitfall 2: Preview Shows Different Colors Than Spawned Piece
**What goes wrong:** Next piece preview doesn't match actual spawned piece
**Why it happens:** Split calculated twice (once for preview, once for spawn) with different random colors
**How to avoid:** Calculate split ONCE when generating `nextPiece`, store in definition. Use stored colors on spawn.
**Warning signs:** Preview shows red/blue, spawned piece is green/yellow

### Pitfall 3: GOOP_COLORIZER Conflicts With Multi-Color
**What goes wrong:** Colorizer tries to override piece color, but piece has two colors
**Why it happens:** Colorizer expects single `color` property
**How to avoid:** Colorizer overrides ALL cells (sets cellColors to uniform array) OR skips multi-color pieces
**Warning signs:** Colorizer makes piece look broken

### Pitfall 4: Stored Piece Loses Multi-Color Info
**What goes wrong:** Swapping stores piece, retrieved piece is single color
**Why it happens:** `storedPiece` is `PieceDefinition | null`, may not preserve `cellColors`
**How to avoid:** Ensure `cellColors` survives storage/retrieval. Type already supports it if we add the field.
**Warning signs:** Swap causes color loss

### Pitfall 5: Lock Animation Uses Wrong Colors
**What goes wrong:** When piece locks, goop cells get wrong colors
**Why it happens:** Lock logic reads `activePiece.definition.color` for all cells
**How to avoid:** Lock logic should read `cellColors[i]` if present, fall back to `color`
**Warning signs:** Locked goop is all one color when falling piece was two

</common_pitfalls>

<code_examples>
## Code Examples

### Complete Split Function
```typescript
// utils/pieceUtils.ts

interface Coordinate {
  x: number;
  y: number;
}

function coordKey(c: Coordinate): string {
  return `${c.x},${c.y}`;
}

function isConnected(cells: Coordinate[]): boolean {
  if (cells.length <= 1) return true;

  const cellSet = new Set(cells.map(coordKey));
  const visited = new Set<string>();
  const queue = [cells[0]];

  while (queue.length > 0) {
    const cell = queue.shift()!;
    const key = coordKey(cell);
    if (visited.has(key)) continue;
    visited.add(key);

    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const neighbor = { x: cell.x + dx, y: cell.y + dy };
      const neighborKey = coordKey(neighbor);
      if (cellSet.has(neighborKey) && !visited.has(neighborKey)) {
        queue.push(neighbor);
      }
    }
  }

  return visited.size === cells.length;
}

/**
 * Find the most balanced split of cells into two contiguous groups.
 * Returns [groupA indices, groupB indices] or null if no valid split exists.
 */
export function findBestSplit(cells: Coordinate[]): [number[], number[]] | null {
  const n = cells.length;
  if (n < 2) return null;

  let bestSplit: [number[], number[]] | null = null;
  let bestBalance = Infinity;

  // Try all non-trivial subsets
  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    const indicesA: number[] = [];
    const indicesB: number[] = [];

    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        indicesA.push(i);
      } else {
        indicesB.push(i);
      }
    }

    const groupA = indicesA.map(i => cells[i]);
    const groupB = indicesB.map(i => cells[i]);

    if (!isConnected(groupA) || !isConnected(groupB)) continue;

    const balance = Math.abs(indicesA.length - indicesB.length);
    if (balance < bestBalance) {
      bestBalance = balance;
      bestSplit = [indicesA, indicesB];
      if (balance === 0) break; // Perfect 50/50
    }
  }

  return bestSplit;
}

/**
 * Apply a two-color split to a piece definition.
 * Returns new definition with cellColors array.
 */
export function splitPiece(
  definition: PieceDefinition,
  colorA: string,
  colorB: string
): PieceDefinition {
  const split = findBestSplit(definition.cells);

  if (!split) {
    // No valid split, return single-color
    return { ...definition, color: colorA };
  }

  const [indicesA] = split;
  const cellColors = definition.cells.map((_, i) =>
    indicesA.includes(i) ? colorA : colorB
  );

  return {
    ...definition,
    color: colorA, // Fallback
    cellColors,
  };
}
```

### Integration Point in GameEngine
```typescript
// In spawnNewPiece(), after selecting piece and colors:

const shouldSplit = rank >= 20 && Math.random() < 0.25;

if (shouldSplit) {
  const color2 = getRandomColor(palette.filter(c => c !== color1));
  nextPiece = splitPiece(randomPiece, color1, color2);
} else {
  nextPiece = { ...randomPiece, color: color1 };
}
```

### PiecePreview Rendering Update
```typescript
// In PiecePreview.tsx render:

{definition.cells.map((cell, i) => {
  const color = definition.cellColors?.[i] ?? definition.color;
  return (
    <rect
      key={i}
      x={...}
      y={...}
      fill={color}
    />
  );
})}
```

</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Complex graph libraries for partitioning | Enumeration for small n | Always valid for n≤8 | No dependencies needed |

**New tools/patterns to consider:**
- None needed - this is a small-scale problem well-suited to brute force enumeration

**Deprecated/outdated:**
- Using graph partitioning libraries (METIS, etc.) for problems this small is overkill

</sota_updates>

<open_questions>
## Open Questions

1. **GOOP_COLORIZER behavior with multi-color pieces**
   - What we know: Colorizer currently sets uniform color for N pieces
   - What's unclear: Should it override both colors, or skip multi-color pieces?
   - Recommendation: Override both to uniform (simpler, consistent with ability purpose)

2. **Lock animation for multi-color pieces**
   - What we know: Pieces lock cell-by-cell
   - What's unclear: Does current animation support per-cell colors?
   - Recommendation: Verify during implementation, likely needs per-cell color in lock logic

3. **Existing piece rendering paths**
   - What we know: Multiple render paths (preview, falling, locked goop)
   - What's unclear: Do all paths need per-cell color support?
   - Recommendation: Audit all render paths during planning

</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Codebase exploration via Explore agent - piece generation flow documented
- `types.ts`, `constants.ts`, `GameEngine.ts`, `PiecePreview.tsx` - direct code reading

### Secondary (MEDIUM confidence)
- [Graph partition - Wikipedia](https://en.wikipedia.org/wiki/Graph_partition) - algorithm background
- [Polyomino - Wikipedia](https://en.wikipedia.org/wiki/Polyomino) - shape terminology

### Tertiary (LOW confidence - needs validation)
- None - algorithm approach is standard CS (BFS connectivity, enumeration)

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: TypeScript, existing piece system
- Ecosystem: No external libraries needed
- Patterns: Graph connectivity, enumeration, per-cell coloring
- Pitfalls: Rotation, preview/spawn sync, upgrade conflicts

**Confidence breakdown:**
- Standard stack: HIGH - direct codebase exploration
- Architecture: HIGH - straightforward extension of existing patterns
- Pitfalls: HIGH - derived from understanding existing code flows
- Code examples: HIGH - tested logic, standard algorithms

**Research date:** 2026-01-24
**Valid until:** N/A (internal codebase, not external ecosystem)

</metadata>

---

**Pre-computed Split Results (for reference):**

| Shape | Cells | Best Split | Group A (indices) | Group B (indices) |
|-------|-------|------------|-------------------|-------------------|
| I | 4 linear | 2+2 | [0,1] | [2,3] |
| J | 3+1 corner | 3+1 | [1,2,3] | [0] |
| L | 3+1 corner | 3+1 | [1,2,3] | [0] |
| O | 2x2 square | 2+2 | [0,1] | [2,3] (or [0,2]/[1,3]) |
| S | 4 zigzag | 2+2 | [0,1] | [2,3] |
| T | 3+1 center | 3+1 | [1,2,3] | [0] (or other 3+1 combos) |
| Z | 4 zigzag | 2+2 | [0,1] | [2,3] |

Note: These are based on the cell order in `constants.ts`. The algorithm will find these automatically.

---

*Phase: 19-multicolor-pieces*
*Research completed: 2026-01-24*
*Ready for planning: yes*
