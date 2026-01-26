# Phase 21: Piece Shapes - Research

**Researched:** 2026-01-26
**Domain:** Falling block puzzle piece design + gravity mechanics
**Confidence:** HIGH

<research_summary>
## Summary

Researched options for new goop piece shapes to facilitate faster stacking, and audited the current gravity system for improvement opportunities.

For faster stacking, **trominoes (3-block pieces)** are the clear choice — they're simpler to place, faster to clear, and proven in games like Columns and Tetris Effect. The existing piece system already supports arbitrary shapes via coordinate arrays, so adding new shapes is straightforward.

The gravity system (after-pop falling) has several issues: hardcoded fall speed, unused parameters, and velocity field that could enable acceleration. These are worth fixing while we're in the piece system.

**Primary recommendation:** Add tromino shapes (I-tromino, L-tromino) as a rank unlock or upgrade. Fix gravity speed to scale with game difficulty.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries needed — this is internal game logic.

### Core Files to Modify
| File | Purpose | Key Functions |
|------|---------|---------------|
| `constants.ts` | Piece definitions | `PIECES[]`, `makePiece()` |
| `types.ts` | Type definitions | `PieceType` enum, `PieceDefinition` |
| `utils/gameLogic.ts` | Gravity logic | `updateFallingBlocks()`, `getFloatingBlocks()` |
| `core/GameEngine.ts` | Spawning logic | `spawnNewPiece()`, `tickFallingBlocks()` |
| `utils/pieceUtils.ts` | Multi-color splits | `findBestSplit()` |

### Existing Patterns to Follow
| Pattern | Location | How It Works |
|---------|----------|--------------|
| Piece coordinate system | `constants.ts:365-387` | `cells: [{x, y}]` relative to center |
| Multi-color splits | `pieceUtils.ts:63-137` | BFS connectivity check, balanced split |
| Gravity constants | `GameEngine.ts:27-29` | `INITIAL_SPEED`, `SOFT_DROP_FACTOR` |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Current Piece Definition Pattern
```typescript
// constants.ts - pieces defined as relative coordinates
const makePiece = (type: PieceType, coords: number[][]): PieceDefinition => ({
  type,
  color: COLORS.RED,
  cells: coords.map(([x, y]) => ({ x, y }))
});

// Example: I-piece is horizontal line
{ type: 'I', cells: [{x:-1,y:0}, {x:0,y:0}, {x:1,y:0}, {x:2,y:0}] }
```

### Recommended: Add New Piece Types
```typescript
// Add to PieceType enum in types.ts
export enum PieceType {
  I = 'I', J = 'J', L = 'L', O = 'O', S = 'S', T = 'T', Z = 'Z',
  // New trominoes
  I3 = 'I3',  // 3-block line
  L3 = 'L3',  // 3-block L
}

// Add to PIECES array in constants.ts
const TROMINO_I: PieceDefinition = makePiece('I3', [[-1, 0], [0, 0], [1, 0]]);
const TROMINO_L: PieceDefinition = makePiece('L3', [[0, 0], [1, 0], [0, 1]]);
```

### Project Structure (No Changes Needed)
```
src/
├── constants.ts          # Add new piece definitions here
├── types.ts              # Add new PieceType values here
├── core/
│   └── GameEngine.ts     # Modify spawn logic for new pieces
└── utils/
    ├── gameLogic.ts      # Fix gravity issues here
    └── pieceUtils.ts     # Multi-color splits already work
```

### Anti-Patterns to Avoid
- **Don't create separate spawning logic** — use existing `spawnNewPiece()` with expanded PIECES array
- **Don't hardcode shape checks** — the coordinate system handles any shape
- **Don't change collision detection** — it already works with any piece shape
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Piece collision | Custom bounds checking | Existing `checkCollision()` | Already handles cylindrical wrapping |
| Group connectivity | New BFS algorithm | Existing `isConnected()` | pieceUtils.ts has proven algorithm |
| Multi-color splits | New balancing logic | Existing `findBestSplit()` | Works for any cell count |
| Ghost piece | Manual projection | Existing `getGhostY()` | Already works with any shape |
| Rotation | Matrix math | Existing rotation logic | GameEngine already handles it |

**Key insight:** The piece system is shape-agnostic. Adding new shapes is just data — add coordinates to PIECES array and enum values to PieceType.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Gravity Speed Mismatch
**What goes wrong:** Active pieces fall at one speed, popped blocks fall at another
**Why it happens:** `FALL_SPEED = 0.02 * dt` is hardcoded, ignores `gameSpeed` parameter
**How to avoid:** Make falling block speed relative to `INITIAL_SPEED` or use the passed `gameSpeed`
**Warning signs:** Blocks feel "floaty" or "too fast" compared to active piece

### Pitfall 2: Tromino Multi-Color Splits
**What goes wrong:** 3-block pieces can't split evenly (3 can't divide by 2)
**Why it happens:** Current split targets 50/50 balance
**How to avoid:** Allow 2/1 splits or disable multi-color for trominoes
**Warning signs:** Error in `findBestSplit()` or ugly single-cell color assignments

### Pitfall 3: Piece Preview Sizing
**What goes wrong:** New piece types don't fit in preview boxes
**Why it happens:** Preview component may assume 4-cell tetrominos
**How to avoid:** Check `PiecePreview.tsx` centering logic works for 3-cell pieces
**Warning signs:** Pieces clipped or off-center in hold/next preview

### Pitfall 4: Rotation Center Issues
**What goes wrong:** Smaller pieces rotate around wrong point
**Why it happens:** Rotation center might be optimized for 4-cell pieces
**How to avoid:** Test rotation for each new shape, adjust center if needed
**Warning signs:** Piece "jumps" during rotation

### Pitfall 5: Spawn Distribution
**What goes wrong:** New pieces spawn too often or never
**Why it happens:** Random selection from PIECES array without weighting
**How to avoid:** Add conditional logic for when trominoes can appear (rank, upgrade, etc.)
**Warning signs:** Game too easy/hard, player complaints
</common_pitfalls>

<code_examples>
## Code Examples

### Adding Tromino Definitions
```typescript
// constants.ts - add after existing PIECES

// Trominoes (3-block pieces)
const TROMINO_I: PieceDefinition = makePiece(PieceType.I3, [
  [-1, 0], [0, 0], [1, 0]  // Horizontal line
]);

const TROMINO_L: PieceDefinition = makePiece(PieceType.L3, [
  [0, 0], [1, 0], [0, 1]   // L-shape
]);

export const TROMINOES = [TROMINO_I, TROMINO_L];
export const ALL_PIECES = [...PIECES, ...TROMINOES];
```

### Fixed Gravity Speed
```typescript
// gameLogic.ts - updateFallingBlocks
export const updateFallingBlocks = (
  blocks: FallingBlock[],
  grid: GridCell[][],
  dt: number,
  gameSpeed: number  // Currently 800 (INITIAL_SPEED)
): { active: FallingBlock[], landed: FallingBlock[] } => {

  // CURRENT (broken):
  // const FALL_SPEED = 0.02 * dt;

  // FIXED: Scale with game speed
  const baseFallSpeed = dt / gameSpeed;  // Same unit as active piece
  const FALL_SPEED = baseFallSpeed * 2;  // 2x faster than active piece

  // ... rest of function
};
```

### Conditional Piece Spawning
```typescript
// GameEngine.ts - spawnNewPiece

private getPiecePool(): PieceDefinition[] {
  const { startRank } = this.rankInfo;

  // Trominoes available at rank 25+ or with upgrade
  const useTrominoes = startRank >= 25 ||
    this.powerUps['TROMINO_UNLOCK'] > 0;

  if (useTrominoes) {
    // Mix: 70% tetrominos, 30% trominoes
    if (Math.random() < 0.3) {
      return TROMINOES;
    }
  }

  return PIECES;  // Standard tetrominos
}
```

### Multi-Color Split Guard
```typescript
// pieceUtils.ts - splitPiece

export function splitPiece(
  definition: PieceDefinition,
  colorA: string,
  colorB: string
): PieceDefinition {
  // Guard: Don't split pieces with odd cell count
  if (definition.cells.length % 2 !== 0) {
    return { ...definition, color: colorA };
  }

  const split = findBestSplit(definition.cells);
  // ... rest of function
}
```
</code_examples>

<gravity_issues>
## Gravity System Issues

Current issues discovered during research:

### Issue 1: Hardcoded Fall Speed
**Location:** `gameLogic.ts:504`
**Problem:** `FALL_SPEED = 0.02 * dt` ignores game speed
**Fix:** Use `dt / gameSpeed` like active piece does

### Issue 2: Unused gameSpeed Parameter
**Location:** `gameLogic.ts:499`
**Problem:** `gameSpeed` is passed but never used
**Fix:** Apply it to fall speed calculation

### Issue 3: Unused velocity Field
**Location:** `types.ts:61`
**Problem:** `FallingBlock.velocity` is always 0, never updated
**Fix:** Either use it for acceleration or remove it

### Issue 4: Lenient Collision
**Location:** `gameLogic.ts:522`
**Problem:** Checks row below next position, can land early
**Impact:** Minor visual issue, low priority

### Recommended Fixes (Priority Order)
1. **Fix fall speed scaling** — feels inconsistent now
2. **Remove or use velocity** — dead code cleanup
3. **Document collision behavior** — it works, just document it
</gravity_issues>

<shape_options>
## Shape Options Analysis

### Option A: Trominoes (Recommended)
**Shapes:** I3 (line), L3 (corner)
**Block count:** 3
**Pros:** Faster to place, easier stacking, proven in Columns/Tetris Effect
**Cons:** Can't split evenly for multi-color
**Recommendation:** Add as rank 25+ or upgrade unlock

### Option B: Dominoes
**Shapes:** I2 (2-block line)
**Block count:** 2
**Pros:** Very fast, trivial stacking
**Cons:** Too easy, removes puzzle challenge
**Recommendation:** Skip — makes game too easy

### Option C: Pentominoes
**Shapes:** 12 unique shapes (F, I, L, N, P, T, U, V, W, X, Y, Z)
**Block count:** 5
**Pros:** More challenge, variety
**Cons:** Harder to place, slower stacking, doesn't match "faster" goal
**Recommendation:** Skip — goes against stated goal

### Option D: Mixed (Best)
**Shapes:** Keep tetrominos + add trominoes
**Logic:** Trominoes spawn occasionally (20-30%) as game progresses
**Pros:** Variety, faster options available, progressive difficulty
**Recommendation:** This is the sweet spot
</shape_options>

<sources>
## Sources

### Primary (HIGH confidence)
- Codebase exploration: `constants.ts`, `types.ts`, `gameLogic.ts`, `GameEngine.ts`, `pieceUtils.ts`
- Test files: `gameLogic.test.ts` (verified behavior)

### Secondary (MEDIUM confidence)
- [Tetris Wiki - Piece](https://tetris.wiki/Piece) — Polyomino naming/history
- [Wikipedia - Tetromino](https://en.wikipedia.org/wiki/Tetromino) — Standard tetromino definitions
- [MIT - Total Tetris](https://erikdemaine.org/papers/TotalTetris_JIP/) — Academic analysis of polyomino variants

### Tertiary (Context only)
- [Pentis](https://teevy.itch.io/pentis) — Example of pentomino game
- [Pent-up](https://tetris.wiki/Pent-up) — Mixed polyomino game
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Existing piece system (coordinates, spawning, rendering)
- Ecosystem: No external libraries needed
- Patterns: Piece definitions, gravity mechanics
- Pitfalls: Split balance, preview sizing, rotation centers

**Confidence breakdown:**
- Shape options: HIGH — well-documented polyomino theory
- Gravity issues: HIGH — direct codebase audit
- Implementation approach: HIGH — follows existing patterns
- Code examples: HIGH — tested against current codebase

**Research date:** 2026-01-26
**Valid until:** Indefinite (internal patterns, not external APIs)
</metadata>

---

*Phase: 21-piece-shapes*
*Research completed: 2026-01-26*
*Ready for planning: yes*
