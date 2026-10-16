# Plan 06-01 Summary: XP Floor & Curve Retuning

**Status:** Complete
**Date:** 2026-01-20

## What Changed

### New XP Curve (utils/progression.ts)
Replaced exponential formula with linear delta formula:
- Old: `5000 * (rank-1)^1.8` (too steep for tutorial)
- New: `(rank - 1) * (1000 + 250 * rank)`

XP requirements now:
| Rank | Total XP | XP to Next |
|------|----------|------------|
| 2    | 1,500    | 2,000      |
| 5    | 9,000    | 3,500      |
| 10   | 31,500   | 6,000      |
| 20   | 114,000  | 11,000     |
| 100  | 2,574,000| -          |

Added `getXpToNextRank(rank)` helper function.

### XP Floor (core/GameEngine.ts)
In `finalizeGame()`, after penalty is applied:
```typescript
const xpFloor = 100 * startingRank;
this.state.score = Math.max(xpFloor, this.state.score);
```

At rank 10, minimum XP gain is 1,000. Prevents zero-gain runs at higher ranks.

### Progression Tests (tests/progression.test.ts)
14 new tests covering:
- `getScoreForRank()` at key ranks
- `getXpToNextRank()` increments
- `calculateRankDetails()` edge cases

## Files Modified
- `utils/progression.ts` - New curve formula + helper function
- `core/GameEngine.ts` - XP floor in finalizeGame()
- `tests/progression.test.ts` - New test file (14 tests)

## Verification
- [x] All 50 tests pass
- [x] getScoreForRank(2) = 1,500
- [x] getScoreForRank(5) = 9,000
- [x] getScoreForRank(10) = 31,500
- [x] getScoreForRank(100) = 2,574,000
- [x] XP floor applies at game over
