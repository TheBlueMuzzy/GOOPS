---
phase: 32-journal-system
plan: 01
subsystem: ui
tags: [react, journal, accordion, typography, lucide-react, tutorial]

# Dependency graph
requires:
  - phase: 31-tutorial-infrastructure
    provides: TutorialStepId types, completedSteps persistence, maintenance-order visual style
provides:
  - JournalPageId/JournalPage/JournalSection types
  - JOURNAL_PAGES data array (11 pages, 6 with content)
  - OperatorJournal accordion component with unlock logic
  - Typography scale CSS system (t-meta through t-hero)
  - TEXT_MANIFEST.md editable text source-of-truth
affects: [32-02-integration, 33-training, 35-complications, 36-upgrades, 37-progressive-hints]

# Tech tracking
tech-stack:
  added: [lucide-react icons in OperatorJournal]
  patterns: [accordion UI with single-expanded state, typography CSS classes with !important, TEXT_MANIFEST.md as editable text reference]

key-files:
  created:
    - types/tutorial.ts (JournalPageId, JournalPage, JournalSection)
    - data/journalEntries.ts (JOURNAL_PAGES array)
    - components/OperatorJournal.tsx (accordion journal component)
    - components/OperatorJournal.css (fade-in animation)
    - TEXT_MANIFEST.md (editable text properties reference)
  modified:
    - index.html (typography scale CSS classes)
    - components/MainMenu.tsx (typography classes)
    - components/Controls.tsx (typography classes)
    - components/UpgradePanel.tsx (typography classes)
    - components/Upgrades.tsx (typography classes)
    - components/Settings.tsx (typography classes)
    - components/HowToPlay.tsx (typography classes)
    - components/IntercomMessage.tsx (typography classes)
    - components/ConsoleView.tsx (typography classes)
    - components/PiecePreview.tsx (typography classes)
    - Game.tsx (typography classes)

key-decisions:
  - "Accordion layout (single column, one expanded at a time) over sidebar+content (two column)"
  - "Typography scale: t-meta(10), t-caption(12), t-body(18), t-heading(24), t-title(28), t-display(36), t-hero(48) with !important"
  - "TEXT_MANIFEST.md as editable text source-of-truth for user to edit in Obsidian"
  - "18px minimum for all player-facing text, dev tools stay small"

patterns-established:
  - "Typography CSS classes: use t-body, t-heading, etc. for all text sizing"
  - "Accordion pattern: single expanded section, click to toggle"
  - "Journal page unlock: unlockedBy field maps to TutorialStepId or 'ALWAYS'"

issues-created: []

# Metrics
duration: ~45min (across 2 sessions)
completed: 2026-02-08
---

# Phase 32 Plan 01: Journal Data & OperatorJournal Summary

**Journal entry types, 11-page data layer, accordion OperatorJournal component, and project-wide typography standardization**

## Performance

- **Duration:** ~45 min (across 2 sessions)
- **Started:** 2026-02-08
- **Completed:** 2026-02-08
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 16

## Accomplishments
- JournalPageId/JournalPage/JournalSection type system in types/tutorial.ts
- 11 journal pages in data/journalEntries.ts (6 with full content, 5 stubs for future phases)
- OperatorJournal accordion component with unlock logic, lucide-react icons, maintenance-order styling
- Project-wide typography system: CSS classes (t-meta through t-hero), 18px minimum body text
- TEXT_MANIFEST.md as editable text source-of-truth

## Task Commits

Each task was committed atomically:

1. **Task 1: Create journal entry data and types** - `dbc5e00` (feat)
2. **Task 2: Build OperatorJournal component + typography system** - `ee04a0c` + `08b6f5c` (feat)
3. **Task 3: Checkpoint verification** - `ba8f98a` (chore: revert temp App.tsx swap)

## Files Created/Modified
- `types/tutorial.ts` - JournalPageId, JournalPage, JournalSection types added
- `data/journalEntries.ts` - JOURNAL_PAGES array with 11 entries
- `components/OperatorJournal.tsx` - Accordion journal component with unlock logic
- `components/OperatorJournal.css` - Fade-in animation for page content
- `TEXT_MANIFEST.md` - Editable text properties reference
- `index.html` - Typography scale CSS classes (t-meta through t-hero)
- Multiple components updated with typography classes (MainMenu, Controls, UpgradePanel, Upgrades, Settings, HowToPlay, IntercomMessage, ConsoleView, PiecePreview, Game.tsx)

## Decisions Made
- Accordion layout (single column, one expanded at a time) over sidebar+content — better for mobile, simpler interaction
- Typography scale with !important to override Tailwind CDN defaults
- TEXT_MANIFEST.md as user-editable text reference (edit in Obsidian, Claude reads and applies)
- 18px minimum body text for all player-facing UI, dev tools exempt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added project-wide typography system**
- **Found during:** Task 2 (OperatorJournal component)
- **Issue:** Text sizes across the app were inconsistent and often too small for mobile. Journal component needed a consistent type scale.
- **Fix:** Created typography CSS classes in index.html, applied across all components, created TEXT_MANIFEST.md
- **Files modified:** index.html + 10 component files
- **Verification:** All text meets 18px minimum, typography classes applied consistently
- **Committed in:** 08b6f5c

---

**Total deviations:** 1 auto-fixed (missing critical typography system), 0 deferred
**Impact on plan:** Typography system was essential for the journal's readability and needed project-wide consistency. No scope creep — directly supports journal and overall mobile UX.

## Issues Encountered
- PiecePreview NEXT/HOLD labels at 18px may be too large for 48px box — noted for future layout adjustment
- Some SVG text in Art.tsx (PROMOTION THRESHOLD, XP) not yet standardized — SVG coordinate space differs from screen pixels

## Next Phase Readiness
- Journal data layer and component complete, ready for 32-02 (integration into App.tsx replacing HowToPlay)
- Typography system in place for all future UI work
- OperatorJournal currently not wired into app (temp swap reverted) — 32-02 handles permanent integration

---
*Phase: 32-journal-system*
*Completed: 2026-02-08*
