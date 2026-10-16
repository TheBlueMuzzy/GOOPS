---
phase: 22-audit-glossary
plan: 01
subsystem: documentation
tags: [naming, terminology, glossary, audit, standards]

# Dependency graph
requires:
  - phase: 21-piece-shapes
    provides: completed codebase ready for standardization
provides:
  - Official terminology glossary (GLOSSARY.md)
  - Actionable rename checklist for Phase 23 (AUDIT.md)
affects: [23-code-rename, 24-docs-update]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Official term definitions with usage examples"
    - "Audit document format with prioritized checklist"

key-files:
  created:
    - .planning/GLOSSARY.md
    - .planning/phases/22-audit-glossary/AUDIT.md
  modified: []

key-decisions:
  - "piece = falling polyomino, goop = settled substance (user-facing)"
  - "cell = grid position, block = cell content"
  - "fast drop replaces soft drop terminology"
  - "BlockData interface is correctly named, no change needed"

patterns-established:
  - "Use 'block' in code variables for settled content"
  - "Use 'goop' in UI text and user-facing comments"
  - "Use 'cell' for grid positions, never 'unit'"

issues-created: []

# Metrics
duration: 4min
completed: 2026-01-27
---

# Phase 22 Plan 01: Audit & Glossary Summary

**Official game terminology glossary with 9 core terms defined, plus rename audit identifying 38 code changes across 10 files for Phase 23**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-27T02:12:13Z
- **Completed:** 2026-01-27T02:15:44Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments

- Created comprehensive GLOSSARY.md defining all official game terms
- Documented correct usage patterns with examples for each term
- Built prioritized rename checklist for Phase 23 execution
- Identified ~38 code changes across 10 files (softDrop + totalUnits renames)
- Confirmed BlockData interface and piece/goop usage patterns are already correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Create official GLOSSARY.md** - `0a52484` (docs)
2. **Task 2: Create rename audit document** - `87e8054` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/GLOSSARY.md` - Official terminology definitions (315 lines)
  - Core Game Objects: piece, goop, cell, block, group
  - Player Actions: fast drop, rotate, lock, pop, seal
  - Game Systems: crack, complication, upgrade, rank, wild
  - Code variable naming guide

- `.planning/phases/22-audit-glossary/AUDIT.md` - Rename checklist (183 lines)
  - Priority 1: softDrop -> fastDrop (~30 changes, 7 files)
  - Priority 2: totalUnits -> totalBlocks (8 changes, 3 files)
  - Priority 3: Documentation updates
  - Execution order and verification commands

## Decisions Made

1. **Terminology mapping established:**
   - "Piece" = active falling polyomino (code: `ActivePiece`, `PieceDefinition`)
   - "Goop" = settled substance (use in UI text, comments)
   - "Cell" = grid position (replaces "unit")
   - "Block" = cell content (code: `BlockData`)
   - "Fast Drop" = player acceleration (replaces "soft drop")

2. **No changes needed for:**
   - `BlockData` interface (correctly named per glossary)
   - `piece`/`goop` variable naming (already follows correct pattern)

3. **Rename priorities:**
   - Priority 1 (softDrop): Higher impact, touches event system
   - Priority 2 (totalUnits): Smaller scope, localized changes
   - Priority 3 (docs): After code is stable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Step

Ready for Phase 23: Code Rename

Run `/gsd:plan-phase 23` to create execution plan using AUDIT.md as input.

---
*Phase: 22-audit-glossary*
*Completed: 2026-01-27*
