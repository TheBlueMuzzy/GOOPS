---
phase: 23-code-rename
plan: 05
subsystem: persistence, progression
tags: [refactor, naming, savedata, storage]

# Dependency graph
requires:
  - phase: 23-04
    provides: TankSystem and action command naming
provides:
  - Glossary-compliant progression terminology
  - Updated SaveData interface (v2)
  - sessionXP/operatorXP/scraps variable names
affects: [ui-display, save-system, testing]

# Tech tracking
tech-stack:
  added: []
  patterns: [save-versioning-for-breaking-changes]

key-files:
  created: []
  modified:
    - types.ts
    - utils/storage.ts
    - core/GameEngine.ts
    - constants.ts
    - App.tsx
    - utils/progression.ts

key-decisions:
  - "Storage key v1 -> v2: intentional save reset accepted"
  - "score -> sessionXP (per-game), totalScore -> operatorXP (lifetime)"

patterns-established:
  - "Save versioning: increment storage key for breaking SaveData changes"

issues-created: []

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 23 Plan 05: Progression Variables & Persistence Summary

**Renamed all scoring/progression variables to glossary terms, updated SaveData interface with v2 storage key triggering intentional save reset**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T12:00:00Z
- **Completed:** 2026-01-27T12:08:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- SaveData interface updated: rank -> operatorRank, totalScore -> operatorXP, powerUpPoints -> scraps
- Storage key changed from v1 to v2 (intentional save reset - old saves ignored)
- Scoring variables renamed: score -> sessionXP, combo -> popStreak, timeLeft -> sessionTime
- Timing constants renamed: INITIAL_TIME_MS -> SESSION_DURATION, INITIAL_SPEED -> ACTIVE_GOOP_SPEED

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SaveData interface and storage key** - `a8d6b20` (refactor)
2. **Task 2: Rename scoring variables throughout codebase** - `e37b1b9` (refactor)
3. **Task 3: Rename timing constants** - `24b78b0` (refactor)

**Plan metadata:** (pending)

## Files Created/Modified

- `types.ts` - SaveData interface, GameState (sessionXP, popStreak, sessionTime)
- `utils/storage.ts` - STORAGE_KEY v2, defaultSaveData with new property names
- `core/GameEngine.ts` - sessionXP, popStreak, sessionTime throughout (62 changes)
- `constants.ts` - SESSION_DURATION, ACTIVE_GOOP_SPEED
- `App.tsx` - operatorRank, operatorXP, scraps state management
- `utils/progression.ts` - operatorXP calculations
- `components/ConsoleView.tsx` - Display updates for new names
- `components/UpgradePanel.tsx` - scraps display
- `components/EndGameScreen.tsx` - sessionXP display
- `Game.tsx` - Props renamed
- `core/commands/actions.ts` - popStreak in pop commands
- `core/events/GameEvents.ts` - PopPayload.popStreak
- `hooks/useAudioSubscription.ts` - popStreak for audio

## Decisions Made

1. **Storage key v2** - Incrementing from v1 to v2 triggers clean save reset. Players start fresh. This was accepted as part of the naming standardization effort.
2. **Variable naming alignment** - sessionXP for per-game score, operatorXP for lifetime total, scraps for upgrade currency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

- Progression system fully renamed to glossary terms
- Ready for 23-06: UI component naming (ScreenManager, GameConsole, etc.)

---
*Phase: 23-code-rename*
*Completed: 2026-01-27*

**IMPORTANT NOTE:** This plan triggered a SAVE RESET. Players with existing saves will start fresh due to storage key change from gooptris_save_v1 to gooptris_save_v2.
