# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `refactor-v1.1` — v1.1 Architecture Refactor (Phase 9 complete)

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-21)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.1 Architecture Refactor — solidify codebase before new features

## Current Position

Phase: 10 of 13 (GameBoard.tsx Decomposition) - IN PROGRESS
Plan: 10-03 in progress (Tasks 1-2 done, Task 3 UAT FAILED)
Status: **UAT BLOCKED** — 3 bugs found, need fixes before approval
Last activity: 2026-01-21 — CSS extraction done, UAT found input handling bugs

Progress: ████████████░░░░░░░░░░░░░ 2.6/6 phases (43%)

## v1.1 Architecture Refactor

**Goal:** Fix memory leaks, split large files, centralize state management, expand test coverage.

**Phases:**
- ✅ Phase 8: Quick Wins & Memory Fixes (2026-01-21)
- ✅ Phase 9: Art.tsx Decomposition (2026-01-21)
- 🚧 Phase 10: GameBoard.tsx Decomposition (in progress — 2/3 plans)
- Phase 11: GameEngine Refactor
- Phase 12: State Management & Events
- Phase 13: Testing & Documentation

**Constraints:**
- All 81 tests must pass throughout (65 original + 16 new)
- No gameplay changes
- Each phase independently deployable

**Success Criteria:**
- No files over 400 lines
- All hard-coded values in constants.ts
- GameEngine.tick() under 50 lines
- Event-based communication replaces prop drilling

## What's Done

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

### Phase 9: Art.tsx Decomposition (2026-01-21)

Art.tsx reduced from 1,478 to 581 lines (61% reduction):
- Extracted 3 minigame state machine hooks
- Extracted 4 panel components for minigame rendering
- Created central types/minigames.ts

**Files created:**
- types/minigames.ts (137 lines) — central minigame types
- hooks/useLaserMinigame.ts (226 lines) — LASER state machine
- hooks/useLightsMinigame.ts (375 lines) — LIGHTS state machine
- hooks/useControlsMinigame.ts (452 lines) — CONTROLS dial state machine
- components/MiniGames/ArcadeButton.tsx (63 lines) — reusable button
- components/MiniGames/LaserPanel.tsx (90 lines) — LASER SVG
- components/MiniGames/LightsPanel.tsx (135 lines) — LIGHTS SVG
- components/MiniGames/ControlsPanel.tsx (141 lines) — CONTROLS SVG

## Audit Findings (from discuss-milestone)

**Critical Issues:**
- ~~Art.tsx: 1,478 lines~~ ✅ Fixed in Phase 9 (581 lines)
- ~~GameBoard.tsx: 1,052 lines~~ 🚧 Reduced to 654 lines (Plans 10-01, 10-02 done)
- ~~rotationTimestamps memory leak~~ ✅ Fixed in Phase 8 (circular buffer)

**High Priority:**
- GameEngine.tick() is 167 lines
- ~~Hard-coded values scattered~~ ✅ Fixed in Phase 8 (complicationConfig.ts)
- State fragmented across 6 locations
- Prop drilling (10+ callbacks to GameBoard)

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

Last session: 2026-01-21
Stopped at: Plan 10-03 Task 3 (UAT) — **3 BUGS BLOCKING APPROVAL**
Resume with: Fix the bugs below, then re-test

### UAT Bugs to Fix (Plan 10-03)

**Root Cause:** Release after hold/drag should NOT trigger tap/click. Currently it does.

**Bug 1: Shake animation not working on invalid pop**
- File: `components/GameBoard.css`
- Attempted fix: Added `transform-box: fill-box` — DID NOT WORK
- The CSS class IS being applied (shakingGroupId logic is correct in useInputHandlers.ts)
- May need to investigate SVG animation behavior more deeply
- Check: Is the shake class actually being applied? Is CSS transform working on SVG `<g>` elements?

**Bug 2: Early swap release triggers rotate**
- File: `hooks/useInputHandlers.ts` — handlePointerUp function (line ~256)
- Problem: When user starts hold-to-swap but releases early (before 1s completes), it falls through to tap logic and triggers rotate
- Current logic checks `actionConsumed` (only true if swap completed) and `isDragLocked` (only true if moved)
- Fix needed: Also check if hold was "engaged" (time > HOLD_DELAY of 250ms). If so, release should do nothing.
- Key insight: `if (dt >= HOLD_DELAY) return;` before the tap logic block

**Bug 3: Controls dial click broken after my fix**
- File: `components/MiniGames/ControlsPanel.tsx` — my fix broke clicking entirely
- Related file: `hooks/useControlsMinigame.ts` — handleDialPress function
- Problem: Same root cause as Bug 2 — release after drag fires click
- My attempted fix (tracking isDialDragging state changes in render) was wrong approach
- Better fix: Add `justFinishedDraggingRef` in the HOOK (useControlsMinigame), set it true in handleDialEnd, check it in handleDialPress, clear after 100ms
- REVERT my changes in ControlsPanel.tsx first (lines 52-63)

### Files Modified This Session (uncommitted bug fixes)

These changes have bugs and should be reviewed/reverted:
- `core/commands/actions.ts` — SwapPieceCommand (swap position fix - may be OK)
- `components/MiniGames/ControlsPanel.tsx` — broken click fix (REVERT lines 52-63)
- `components/GameBoard.css` — shake animation fix attempt (may need different approach)
- `components/Art.tsx` — version bump to 0.7.0 (OK to keep)

### Files Committed Successfully (Plan 10-03 Tasks 1-2)

- `74009bb` - refactor(10-03): extract CSS animations to separate file
- `93df3c9` - refactor(10-03): final cleanup and organization

### What Was Accomplished

1. Created `components/GameBoard.css` with all animations (glow, shake, malfunction, lights-dimmed)
2. Removed inline `<style>` tag from GameBoard.tsx
3. Used CSS media queries for desktop-only glow effects (replacing JS conditional)
4. Cleaned up unused imports in GameBoard.tsx
5. Added section comments for organization
6. GameBoard.tsx: 1,031 → 604 lines (41% reduction across Phase 10)

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
