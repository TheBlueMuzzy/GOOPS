# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — ready for v1.2 feature branch

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.2 progression system — ranks 0-39 with new upgrades and mechanics

## Current Position

Phase: 16 of 18 (Junk Band)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-23 — Completed 16-02-PLAN.md

Progress: ████░░░░░░ 26%

## v1.1 Architecture Refactor

**Goal:** Fix memory leaks, split large files, centralize state management, expand test coverage.

**Phases:**
- ✅ Phase 8: Quick Wins & Memory Fixes (2026-01-21)
- ✅ Phase 9: Art.tsx Decomposition (2026-01-21)
- ✅ Phase 10: GameBoard.tsx Decomposition (2026-01-21)
- ✅ Phase 11: GameEngine Refactor (2026-01-21)
- ✅ Phase 12: State Management & Events (2026-01-21)
- ✅ Phase 13: Testing & Documentation (2026-01-21)

**Constraints:**
- All 110 tests must pass throughout (81 at Phase 12 + 29 new in Phase 13)
- No gameplay changes
- Each phase independently deployable

**Success Criteria:**
- ✅ No files over 400 lines
- ✅ All hard-coded values in constants.ts
- ✅ GameEngine.tick() under 50 lines (22 lines achieved)
- ✅ Event-based communication replaces prop drilling

## What's Done

### v1.1 Architecture Refactor (Shipped 2026-01-21)

All 6 phases (8-13) complete. See [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

**Key accomplishments:**
- Art.tsx: 1,478 → 581 lines (61% reduction)
- GameBoard.tsx: 1,031 → 604 lines (41% reduction)
- GameEngine.tick(): 159 → 22 lines (86% reduction)
- Tests: 65 → 110 (69% increase)
- Event-based input, 6 callback props removed

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

## Audit Findings (from discuss-milestone)

**Critical Issues:**
- ~~Art.tsx: 1,478 lines~~ ✅ Fixed in Phase 9 (581 lines)
- ~~GameBoard.tsx: 1,052 lines~~ ✅ Fixed in Phase 10 (604 lines, 41% reduction)
- ~~rotationTimestamps memory leak~~ ✅ Fixed in Phase 8 (circular buffer)

**High Priority:**
- ~~GameEngine.tick() is 167 lines~~ ✅ Fixed in Phase 11 (22 lines)
- ~~Hard-coded values scattered~~ ✅ Fixed in Phase 8 (complicationConfig.ts)
- ~~State fragmented across 6 locations~~ ✅ Documented in Phase 12 (GameStateManager interface)
- ~~Prop drilling (10+ callbacks to GameBoard)~~ ✅ Fixed in Phase 12 (6 callbacks removed)

See `.planning/SYSTEM-INVENTORY.md` for complete system list.

## Accumulated Context

### Decisions

All key decisions documented in PROJECT.md Key Decisions table.

### Key Technical Discovery

**SVG Coordinate Conversion with preserveAspectRatio="xMidYMid slice"**

Simple viewBox math doesn't work. Must use:
```tsx
const refPoint = document.getElementById('coord-reference');
const ctm = refPoint.getScreenCTM();
const svgPoint = screenPoint.matrixTransform(ctm.inverse());
```

### Deferred Issues

None — all UAT issues resolved.

## Session Continuity

Last session: 2026-01-24
Stopped at: 16-03-PLAN.md in progress - debugging active ability charging UI
Resume file: None
Phase 16 Status: In progress — executing plan 3 of 3

### This Session Summary

**What was done:**
1. Started executing 16-03-PLAN.md (GOOP_DUMP + SEALING_BONUS)
2. Implemented GOOP_DUMP active ability effect (commit `23d0dd5`)
3. Implemented SEALING_BONUS passive effect (commit `e274f6a`)
4. Fixed active ability charging bugs:
   - equippedActives sync was async (useEffect), now syncs during render
   - activeCharges wasn't being initialized properly
   - SVG progress circle wasn't rendering (fixed strokeDasharray approach)

**Commits this session:**
- `23d0dd5` feat(16-03): implement GOOP_DUMP active ability effect
- `e274f6a` feat(16-03): implement SEALING_BONUS passive effect
- `9c81462` fix(16-03): active ability charging and UI progress display

### Current Issue Being Debugged

Active ability UI progress circle - need to verify:
1. Visual progress fills smoothly as it charges
2. Clicking on button when not ready should not pass through to rotate piece
3. Should shake when clicked if not ready

**Version:** 1.1.6 - dev server on port 5176

### Debug Console Logs Added (remove after fix)
- GameEngine.ts:716 - logs every 5% charge increase
- GameBoard.tsx:510 - logs charge value on render (every 10%)

### Bugs/Blockers

User reported: clicking on ability circle passes through and rotates falling piece

### Next Steps

1. Verify charging UI works visually (v1.1.6)
2. Fix click passthrough on ability button
3. Add shake feedback when clicking non-ready button
4. Complete human verification checkpoint
5. Create 16-03-SUMMARY.md and finish phase 16

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
