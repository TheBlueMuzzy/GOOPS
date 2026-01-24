---
phase: 18-cracked-band
plan: 02
subsystem: gameplay
tags: [crack-matcher, crack-down, rank-32, rank-35, passive-upgrade, active-ability]

requires:
  - phase: 18-01-expanding-cracks
    provides: Expanding cracks mechanic and SLOW_CRACKS passive
provides:
  - CRACK_MATCHER passive (piece color bias toward lowest crack)
  - CRACK_DOWN active ability (cracks spawn in bottom rows)
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - core/GameEngine.ts
    - types.ts
    - utils/gameLogic.ts
    - core/GoalManager.ts
    - components/Art.tsx

key-decisions:
  - "CRACK_MATCHER applies to next piece generation, not current piece"
  - "Lowest crack = highest Y value (closest to bottom of tank)"
  - "CRACK_DOWN restricts Y range to bottom 4 rows (Y = 15-18)"

patterns-established: []

issues-created: []

duration: 4min
completed: 2026-01-24
---

# 18-02 Summary: CRACK_MATCHER Passive and CRACK_DOWN Active

**CRACK_MATCHER biases next piece toward lowest crack color (25% per level). CRACK_DOWN forces next N cracks to spawn in bottom 4 rows.**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-01-24T04:54:44Z
- **Completed:** 2026-01-24T04:58:40Z
- **Tasks:** 2/2
- **Files Modified:** 5

## Accomplishments

- CRACK_MATCHER passive implemented: next piece color biased toward lowest crack
- CRACK_DOWN active implemented: next 3/5/7 cracks spawn in bottom 4 rows
- State tracking added for crackDownRemaining counter
- Version bumped to 1.1.26

## Task Commits

| Task | Commit Hash | Message |
|------|-------------|---------|
| Task 1 | 43620de | feat(18-02): implement CRACK_MATCHER passive color bias |
| Task 2 | 9029ab1 | feat(18-02): implement CRACK_DOWN active ability |
| Version | 51e4d33 | chore(18-02): bump version to 1.1.26 |

## Files Modified

- `core/GameEngine.ts` - CRACK_MATCHER bias in spawnNewPiece(), CRACK_DOWN activation in activateAbility()
- `types.ts` - Added crackDownRemaining to GameState
- `utils/gameLogic.ts` - Modified spawnGoalMark() to accept crackDownActive parameter
- `core/GoalManager.ts` - Pass crackDownRemaining state, decrement on spawn
- `components/Art.tsx` - Version bump to 1.1.26

## Decisions Made

1. **CRACK_MATCHER applies to next piece**: Bias is calculated when generating the queued next piece, not the currently spawning piece. This provides a preview benefit.
2. **Lowest crack definition**: Lowest = highest Y value (closer to bottom of tank, most urgent to seal)
3. **CRACK_DOWN Y range**: Bottom 4 rows = TOTAL_HEIGHT - 4 to TOTAL_HEIGHT - 1 (rows 15-18)

## Deviations from Plan

None. Both tasks implemented as specified.

## Issues Encountered

None.

## Next Phase Readiness

- All 112 tests passing
- Version 1.1.26 ready for manual testing
- **Phase 18 COMPLETE** — All Cracked Band features implemented
- **v1.2 Milestone COMPLETE** — All 18 phases done

**Manual testing checklist:**
- Set rank to 32+ for CRACK_MATCHER testing
- Observe next piece color bias toward lowest crack
- Set rank to 35+ for CRACK_DOWN testing
- Equip and charge CRACK_DOWN ability
- Activate and observe cracks spawning in bottom rows
- Verify counter depletes correctly

---
*Phase: 18-cracked-band*
*Completed: 2026-01-24*
