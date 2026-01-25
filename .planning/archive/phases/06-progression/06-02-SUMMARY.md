# Plan 06-02 Summary: Milestone Infrastructure

**Status:** Complete
**Date:** 2026-01-20

## What Changed

### SaveData Type (types.ts)
Added `milestonesReached: number[]` field to track which milestone ranks (10, 20, 30... 100) have been achieved.

### Milestone Detection Helpers (utils/progression.ts)
Three new functions:
- `getMilestoneRanks()` - returns [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
- `getNextMilestone(currentRank)` - returns next milestone or null at max
- `getMilestonesInRange(fromRank, toRank)` - returns milestones crossed between ranks

### Event System (core/events/GameEvents.ts)
- Added `MILESTONE_REACHED` event type for future UI celebrations
- Added `MilestonePayload` interface with `milestones: number[]`

### App.tsx handleRunComplete
Updated to detect milestone crossings and:
1. Filter out already-reached milestones (safety for dev rank jumps)
2. Track milestones in `milestonesReached` array
3. Emit `MILESTONE_REACHED` event for future UI use

Note: No bonus points awarded for milestones - exactly 1 point per rank gained.

### Storage (utils/storage.ts)
Default `milestonesReached: []` added to `getDefaultSaveData()`.

## Files Modified
- `types.ts` - Added milestonesReached field
- `utils/progression.ts` - Added 3 milestone helper functions
- `core/events/GameEvents.ts` - Added event type and payload
- `App.tsx` - Milestone detection in handleRunComplete
- `utils/storage.ts` - Default empty array
- `tests/progression.test.ts` - 14 new milestone tests

## Verification
- [x] All 64 tests pass
- [x] getMilestoneRanks() returns correct array
- [x] getNextMilestone() handles edge cases (0, at milestone, past max)
- [x] getMilestonesInRange() returns correct milestones

## Notes
Chose to put milestone tracking in App.tsx's handleRunComplete rather than GameEngine because:
- App.tsx already handles persistence (SaveData, localStorage)
- GameEngine doesn't persist data, it's ephemeral per run
- Follows existing patterns for rank-up point awards
