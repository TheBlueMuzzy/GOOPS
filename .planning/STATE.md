# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- `refactor-v1.1` — v1.1 Architecture Refactor (COMPLETE, ready to merge)

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-21)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.1 Architecture Refactor — solidify codebase before new features

## Current Position

Phase: 13 of 13 (Testing & Documentation) — COMPLETE
Plan: 2/2 complete
Status: **v1.1 MILESTONE COMPLETE** — Ready to merge to master
Last activity: 2026-01-21 — Completed Plan 13-02 (Documentation Updates)

Progress: ███████████████████████████████████ 13/13 plans (100%)

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

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

### Phase 12: State Management & Events (2026-01-21)

- Plan 12-01: Added 6 input event types, removed 6 callback props from GameBoard
- Plan 12-02: Created GameStateManager interface, documented architecture, fixed R key swap

**Key changes:**
- Input events via EventBus (INPUT_ROTATE, INPUT_DRAG, INPUT_SWAP, etc.)
- GameStateManager interface documents state access contract
- R key swap now matches touch behavior (hold-to-swap with timer)
- Version synced to 1.1.1 across all displays

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

Last session: 2026-01-21
Stopped at: Completed Plan 13-02 (Documentation Updates) — v1.1 milestone complete

### Current Task State

**Completed this session:**
- Plan 13-01: Test Coverage Expansion (29 tests added: 81 → 110)
- Plan 13-02: Documentation Updates (TESTING.md, ARCHITECTURE.md, STRUCTURE.md)
- v1.1 Architecture Refactor milestone: 100% complete

### Uncommitted Changes

None — all changes committed.

### Bugs/Blockers

None

### Decisions Made

1. **Skip clientToSvg DOM tests**: Would require browser environment, focus on pure functions
2. **Test type shapes via runtime**: Verify interface contracts through object creation
3. **Keep original doc dates**: Add update note rather than changing analysis dates

### Next Steps

1. **Merge to master**: Run `<merge>` to merge `refactor-v1.1` branch to master
2. v1.1 milestone complete — ready for v1.2 planning or new features

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
