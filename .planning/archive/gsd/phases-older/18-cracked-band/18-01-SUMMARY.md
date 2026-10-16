---
phase: 18-cracked-band
plan: 01
type: summary
status: complete
subsystem: gameplay
tags: [expanding-cracks, slow-cracks, rank-30, passive-upgrade]

requires:
  - phase: 17-mixer-band
    provides: Complete Mixer Band implementation
provides:
  - Expanding cracks mechanic (rank 30+)
  - SLOW_CRACKS passive upgrade integration
affects: [phase-18-02, phase-18-03, phase-18-04]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - types.ts
    - core/GameEngine.ts
    - components/Art.tsx

key-decisions:
  - "Growth timer per crack, not global - each crack tracks its own 5s timer"
  - "Adjacent spawn: new cracks appear in adjacent empty cells"
  - "Color uniqueness: prioritize colors without existing goal marks"

issues-created: []

duration: 5min
completed: 2026-01-24
---

# 18-01 Summary: Expanding Cracks and SLOW_CRACKS

**Expanding Cracks mechanic - cracks grow over time based on pressure ratio, mitigated by SLOW_CRACKS passive upgrade**

## Performance
- **Duration:** ~5 minutes
- **Tasks Completed:** 2/2
- **Files Modified:** 3

## Accomplishments
- Added `crackGrowthTimers` to GameState for per-crack growth tracking
- Implemented `tickCrackGrowth()` method in GameEngine
- Growth check runs every 5 seconds per existing crack
- Growth chance = pressureRatio (0-100% based on time elapsed)
- SLOW_CRACKS reduces growth chance by 5% per level (max 4 levels = -20%)
- Only active at rank 30+ (Cracked Band)
- Cap at 8 active cracks prevents runaway growth
- No growth during CONSOLE or COMPLICATION_MINIGAME phases

## Task Commits

| Task | Commit Hash | Message |
|------|-------------|---------|
| Task 1 | fa5456c | feat(18-01): add expanding cracks state tracking and growth mechanic |
| Task 2 | a588eeb | feat(18-01): implement SLOW_CRACKS passive effect and bump version |

## Files Modified
- `types.ts` - Added crackGrowthTimers to GameState interface
- `core/GameEngine.ts` - Added tickCrackGrowth() method, state initialization, growth logic with SLOW_CRACKS
- `components/Art.tsx` - Version bump to 1.1.25

## Decisions Made
1. **Per-crack timers**: Each crack has its own growth timer stored in `crackGrowthTimers[goalId]` rather than a global timer
2. **Adjacent spawning**: New cracks spawn in empty adjacent cells (up/down/left/right, wrapping horizontally)
3. **Color selection**: Prioritizes colors that don't have existing goal marks, falls back to random if all colors taken

## Deviations from Plan
None. Both tasks implemented as specified. Task 2 (SLOW_CRACKS) was naturally integrated into Task 1's tickCrackGrowth() method.

## Issues Encountered
None.

## Next Phase Readiness
- All 112 tests passing
- Version 1.1.25 ready for manual testing
- Ready for Phase 18-02 (CRACK_MATCHER passive)

**Manual testing checklist:**
- Set rank to 30+ using dev tool
- Play a run and let time pass (pressure builds)
- Observe cracks spawning normally via goal system
- After 5+ seconds, existing cracks should have a chance to spawn adjacent cracks
- Higher pressure (less time remaining) = higher growth chance
- With SLOW_CRACKS upgraded, growth should be slower (at level 4, no growth until 20%+ pressure)
- Verify no more than 8 cracks appear at once
