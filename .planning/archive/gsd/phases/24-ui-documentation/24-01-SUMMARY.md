---
phase: 24-ui-documentation
plan: 01
subsystem: ui
tags: [terminology, glossary, ui-text, localization]

# Dependency graph
requires:
  - phase: 23-code-rename
    provides: All code terminology standardized to GLOSSARY.md
provides:
  - All user-facing UI text aligned with official terminology
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - components/HowToPlay.tsx
    - components/Upgrades.tsx
    - constants.ts

key-decisions:
  - "Power Points renamed to Scraps (per GLOSSARY.md)"

patterns-established: []

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 24 Plan 01: UI Text Updates Summary

**Updated all user-facing text to use official Goops terminology (goop, XP, Scraps, Rank, Upgrades)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T16:40:00Z
- **Completed:** 2026-01-27T16:42:42Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Updated HowToPlay.tsx tutorial text (Hold Piece → Held Goop, Points → XP, Power Points → Scraps)
- Updated Upgrades.tsx menu text (POWER UPS → UPGRADES, Level → Rank)
- Updated constants.ts upgrade descriptions (points → scraps, grammar fix)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update HowToPlay.tsx tutorial text** - `508bbc2` (refactor)
2. **Task 2: Update Upgrades.tsx menu text** - `0d5a894` (refactor)
3. **Task 3: Update constants.ts upgrade descriptions** - `0dc76f8` (refactor)

**Plan metadata:** `046141e` (docs: complete plan)

## Files Created/Modified

- `components/HowToPlay.tsx` - Tutorial terminology (4 strings)
- `components/Upgrades.tsx` - Menu placeholder text (3 strings)
- `constants.ts` - Upgrade descriptions (3 strings)

## Decisions Made

- **Power Points → Scraps:** The glossary specifies "Scraps" as the official term for upgrade currency. Updated accordingly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Step

Phase 24 and v1.4 Naming Standardization milestone complete. Ready for next milestone.

---
*Phase: 24-ui-documentation*
*Completed: 2026-01-27*
