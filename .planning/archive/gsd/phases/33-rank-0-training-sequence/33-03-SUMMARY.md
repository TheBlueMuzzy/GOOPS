---
phase: 33-rank-0-training-sequence
plan: 03
subsystem: tutorial
tags: [intercom, journal, training, narrative, content]

# Dependency graph
requires:
  - phase: 33-01
    provides: TrainingStepId type and TRAINING_SEQUENCE data
  - phase: 33-02
    provides: useTrainingFlow hook that reads training messages
  - phase: 31-02
    provides: IntercomMessage type and garble renderer
  - phase: 32-01
    provides: JournalPage data structure and accordion UI
provides:
  - TRAINING_MESSAGES record (17 intercom messages keyed by TrainingStepId)
  - Substantive journal page content for training phases
affects: [33-04, 34, 35]

# Tech tracking
tech-stack:
  added: []
  patterns: [TRAINING_MESSAGES Record<TrainingStepId, IntercomMessage> lookup pattern]

key-files:
  created: []
  modified: [data/tutorialSteps.ts, data/journalEntries.ts, TEXT_MANIFEST.md]

key-decisions:
  - "TRAINING_MESSAGES as separate Record export alongside existing TUTORIAL_STEPS array — keeps Phase 31 tutorial system intact"

patterns-established:
  - "Training content lookup: Record<TrainingStepId, IntercomMessage> pattern for step-to-message mapping"

issues-created: []

# Metrics
duration: 4min
completed: 2026-02-08
---

# Phase 33 Plan 03: Intercom Scripts & Journal Content Summary

**17 corporate-trainer intercom messages with garble-friendly keywords, plus 6 journal pages updated with practical training reference content**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-08T15:51:31Z
- **Completed:** 2026-02-08T15:55:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- TRAINING_MESSAGES record with all 17 intercom messages exported from tutorialSteps.ts
- Each message has keywords (mechanic terms for garble renderer) and fullText (bored corporate trainer voice)
- Journal pages BASICS through SCORING updated with practical content reflecting actual training experience
- 3 new journal sections added (YOUR OBJECTIVE, MERGING, SHIFTS), 4 existing sections updated
- TEXT_MANIFEST.md synced with all new/changed strings

## Task Commits

Each task was committed atomically:

1. **Task 1: Write intercom messages for all 17 training steps** - `0c70bb6` (feat)
2. **Task 2: Update journal entries with training-relevant content** - `219b491` (feat)

## Files Created/Modified
- `data/tutorialSteps.ts` - Added TRAINING_MESSAGES record with 17 IntercomMessage entries keyed by TrainingStepId
- `data/journalEntries.ts` - Updated 4 existing sections, added 3 new sections across 6 journal pages
- `TEXT_MANIFEST.md` - Added training intercom messages section and journal content changes section

## Decisions Made
- Created TRAINING_MESSAGES as a separate Record<TrainingStepId, IntercomMessage> export alongside existing TUTORIAL_STEPS array, keeping Phase 31 tutorial infrastructure completely untouched

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- All 17 training steps now have intercom content ready for the garble renderer
- Journal pages have substantive reference content that unlocks as player progresses through training
- Ready for 33-04 (Training HUD, highlight system & verification) which wires the visual presentation layer

---
*Phase: 33-rank-0-training-sequence*
*Completed: 2026-02-08*
