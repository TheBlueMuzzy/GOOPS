# Bug Investigations

Reference file for investigated bugs that were either fixed, couldn't reproduce, or are low priority.

---

## Tetris Movement Feel Research (2026-01-24)

**Status:** IMPLEMENTED (v1.1.29-33)

| Feature | Version | Notes |
|---------|---------|-------|
| Move reset lock delay | v1.1.29 | Rotation/movement resets 500ms timer |
| 10-reset limit | v1.1.30 | Prevents infinite stalling |
| Upward kicks (y:-2) | v1.1.31 | Allows tucking under overhangs |
| Slide into gaps | v1.1.32 | Check collision at rounded Y |
| Snap to grid | v1.1.33 | Snap when sliding into tight gaps |

### Research Question
Why does Tetris feel more responsive for "last-moment sliding" and "moving pieces sideways into gaps"?

### Key Finding
**The two mechanics ARE fundamentally linked.** They work together through the Tetris Guideline's lock delay and wall kick systems:

1. **Lock Delay with Move Reset** gives you TIME to make adjustments after landing
2. **Wall Kicks (SRS)** let you use ROTATION to move sideways into gaps
3. Combined: land a piece → rotate to kick it into position → lock when ready

---

### 1. Lock Delay System

#### What It Is
The delay between a piece touching the ground/stack and it permanently locking in place. During this window, players can still move and rotate.

#### Tetris Guideline Standard
- **Lock delay**: 0.5 seconds (30 frames at 60fps)
- **Reset type**: Move Reset — any successful move OR rotation resets the timer
- **Reset limit**: 15 resets maximum (prevents infinite stalling)
- **Manual lock**: Hard drop or soft drop into floor bypasses delay

#### Reset Types Across Games
| Type | Behavior | Games |
|------|----------|-------|
| **Entry Reset** | Fixed delay per piece, timer pauses while falling | Puyo series |
| **Step Reset** | Resets when piece moves DOWN a row | TGM series (Sega) |
| **Move Reset** | Resets on ANY successful move or rotation | Tetris Guideline |
| **Infinity** | Move reset with NO limit (infinite spin) | Early Guideline (pre-2007) |

#### Why Move Reset Matters
Without move reset, once the piece lands you have exactly 0.5 seconds regardless of what you do. With move reset, each adjustment buys more time. This creates the feeling of:
- Landing a piece
- Frantically adjusting it
- It locks when you STOP adjusting

---

### 2. Wall Kicks / Super Rotation System (SRS)

#### What It Is
When a piece can't rotate normally (would collide), the game tests offset positions to "kick" the piece into a valid spot.

#### How SRS Works
1. Player presses rotate
2. Test basic rotation position → if clear, done
3. If blocked, test 4 more offset positions in sequence
4. First valid position wins
5. If ALL 5 fail, rotation is rejected

#### SRS Kick Tables (J, L, S, T, Z pieces)

| Rotation | Test 1 | Test 2 | Test 3 | Test 4 | Test 5 |
|----------|--------|--------|--------|--------|--------|
| 0→R | (0,0) | (-1,0) | (-1,+1) | (0,-2) | (-1,-2) |
| R→0 | (0,0) | (+1,0) | (+1,-1) | (0,+2) | (+1,+2) |
| R→2 | (0,0) | (+1,0) | (+1,-1) | (0,+2) | (+1,+2) |
| 2→R | (0,0) | (-1,0) | (-1,+1) | (0,-2) | (-1,-2) |
| 2→L | (0,0) | (+1,0) | (+1,+1) | (0,-2) | (+1,-2) |
| L→2 | (0,0) | (-1,0) | (-1,-1) | (0,+2) | (-1,+2) |
| L→0 | (0,0) | (-1,0) | (-1,-1) | (0,+2) | (-1,+2) |
| 0→L | (0,0) | (+1,0) | (+1,+1) | (0,-2) | (+1,-2) |

**Convention**: (x, y) where +x = right, +y = up

#### Why Wall Kicks Enable "Sideways Into Gaps"
Kicks aren't just for walls — they work against ANY collision:
- Piece against wall → kicks away from wall
- Piece against stack → can kick UP, SIDEWAYS, or DOWN
- **Piece near a gap → can kick INTO the gap via rotation**

This is how skilled players "tuck" pieces under overhangs using rotation instead of horizontal movement.

---

### 3. Current Goops Implementation

#### Lock Delay
```typescript
// GameEngine.ts:27
const LOCK_DELAY_MS = 500;

// GameEngine.ts:1006-1020
if (checkCollision(grid, nextPiece, boardOffset)) {
    if (this.lockStartTime === null) {
        this.lockStartTime = Date.now();
    }
    if (lockedTime > effectiveLockDelay) {
        this.lockActivePiece();
    }
} else {
    this.lockStartTime = null;  // Only resets when piece moves DOWN
}
```

**Issue**: No move reset. Timer only resets when piece falls into empty space, not on rotation/movement.

#### Wall Kicks
```typescript
// actions.ts:80
const kicks = [
    {x:0, y:0}, {x:1, y:0}, {x:-1, y:0},
    {x:0, y:-1}, {x:1, y:-1}, {x:-1, y:-1},
    {x:2, y:0}, {x:-2, y:0}
];
```

**Comparison to SRS**:
| Aspect | Goops | SRS |
|--------|-------|-----|
| Kick variety | Same for all rotations | Different per rotation state |
| Upward kicks | None | +1, +2 y-offset kicks |
| Purpose | Basic wall avoidance | Enables tucking under overhangs |

#### Movement
Goops uses **board rotation** instead of piece movement. The cylindrical tank rotates around a stationary piece. This is fundamentally different from Tetris's horizontal piece movement.

---

### 4. Gap Analysis: What Would Improve Feel

#### A. Move Reset Lock Delay (HIGH IMPACT, LOW RISK)
Add reset on successful rotation or board movement:

```typescript
// In RotatePieceCommand.execute(), after successful kick:
engine.lockStartTime = null;
engine.lockResetCount = (engine.lockResetCount || 0) + 1;
if (engine.lockResetCount > 15) {
    // Force lock after 15 resets
}

// In MoveBoardCommand.execute(), after successful move:
engine.lockStartTime = null;
engine.lockResetCount = (engine.lockResetCount || 0) + 1;
```

This alone would significantly improve the "last-moment adjustment" feel.

#### B. Upward Kicks (MEDIUM IMPACT, MEDIUM RISK)
Add +y kick tests to allow pieces to "climb" into gaps above:
```typescript
const kicks = [
    {x:0, y:0}, {x:-1, y:0}, {x:-1, y:+1}, {x:0, y:-2}, {x:-1, y:-2}
];
```

**Risk**: May allow unintended placement in cylindrical coordinate system.

#### C. Rotation-State-Dependent Kicks (MEDIUM IMPACT, HIGH COMPLEXITY)
Track rotation state and use different kick tables per transition.

**Recommendation**: Skip for now. The simpler approach (A + B) may be sufficient.

---

### 5. Implementation Risks

**Previous attempts "broke pretty badly"** — likely due to:

1. **Cylindrical wrapping**: X coordinates wrap 0-29. Kick calculations must use `normalizeX()`.

2. **Decoupled movement**: Board moves, piece's screenX is fixed. The gridX/screenX/boardOffset relationship must stay consistent after kicks.

3. **Lock delay interactions**: Without the 15-reset cap, infinite-spin is possible.

---

### 6. Recommended Implementation Order

**Phase 1: Move Reset Lock Delay (Safest)**
1. Add `lockResetCount: number` to GameEngine
2. Reset `lockStartTime` and increment counter on successful rotation
3. Reset `lockStartTime` and increment counter on successful board move
4. Force lock after 15 resets OR if piece moves down (current behavior)
5. Reset counter on piece spawn

**Phase 2: Enhanced Kicks (After Phase 1 Stable)**
1. Add upward kick tests (+1 y-offset)
2. Test thoroughly with cylindrical wrapping
3. Consider full SRS only if needed

---

### Sources

- [Lock delay - TetrisWiki](https://tetris.wiki/Lock_delay)
- [Super Rotation System - TetrisWiki](https://tetris.wiki/Super_Rotation_System)
- [Wall kick - TetrisWiki](https://tetris.wiki/Wall_kick)
- [DAS - TetrisWiki](https://tetris.wiki/DAS)
- [Infinity - TetrisWiki](https://tetris.wiki/Infinity)
- [Tetris Guideline - TetrisWiki](https://tetris.wiki/Tetris_Guideline)

---

## Pressure Not Rising Bug

**Status:** FIXED v1.1.42 (2026-01-25)

**Symptom:** Pressure doesn't start rising for the first ~30-40 seconds after starting a run at high rank.

### How Pressure Works

- `pressureRatio = 1 - (timeLeft / maxTime)`
- `tickTimer()` decrements `timeLeft` every frame in `GameEngine.tick()`
- Guard condition: `if (!this.isSessionActive || this.state.gameOver || this.state.isPaused) return`

### ROOT CAUSE FOUND

**Game.tsx hardcoded `maxTime={60000}` to GameBoard and Controls**, but `engine.maxTime` can be up to 100000ms with PRESSURE_CONTROL upgrade (+5s per level, max 8 levels = +40s).

**The math:**
```
With PRESSURE_CONTROL at level 8:
- engine.maxTime = 100000 (60s + 40s bonus)
- timeLeft starts at 100000

GameBoard calculated:
- pressureRatio = Math.max(0, 1 - (timeLeft / maxTime))
- pressureRatio = Math.max(0, 1 - (100000 / 60000))  // Wrong maxTime!
- pressureRatio = Math.max(0, -0.67) = 0
```

**Result:** First 40 seconds showed 0% pressure because `timeLeft > 60000`.

**Fix:** Changed `maxTime={60000}` to `maxTime={engine.maxTime}` in both GameBoard and Controls props.

### Previous Investigation (Incorrect)

Previous theories (mobile throttling, race conditions) were incorrect. The bug only appeared with PRESSURE_CONTROL upgrade because that's when engine.maxTime exceeded the hardcoded 60000.

---
