# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — v1.2 complete, ready for bug fix work

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.2 shipped — bug fixes and testing before next milestone

## Current Position

Phase: 20 (Expanding Cracks Overhaul)
Plan: 1 of 1 in current phase
Status: Phase complete
Last activity: 2026-01-24 — Completed 20-01-PLAN.md

Progress: █████████████████████ 53/53 plans

## What's Done

### v1.2 Progression System (Shipped 2026-01-24)

Full ranks 0-39 progression with 4 bands, 20 upgrades, and 3 new colors.

Key features:
- 20 upgrades across passive/active/feature types
- Active ability system with per-ability charge times
- Lights malfunction rework (player-controlled brightness)
- Expanding cracks mechanic
- 3 new colors: Orange@10, Purple@20, White@30

See [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full details.

### v1.1 Architecture Refactor (Shipped 2026-01-21)

All 6 phases (8-13) complete. See [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

## Accumulated Context

### Balance Summary (Current v1.2.0)

| Complication | Trigger | Player Mitigation |
|--------------|---------|-------------------|
| Laser | Capacitor drains on pop | +10% refill on piece lock |
| Controls | Heat builds on rotate | Heat dissipates when idle |
| Lights | Brightness dims when not soft dropping | Soft drop to recharge |

All three complications have player-driven triggers AND mitigations.

### Active Abilities (v1.2.0)

| Active | Charge Time | Level 1 | Level 2 | Level 3 |
|--------|-------------|---------|---------|---------|
| Cooldown Booster | 20s | +25% cooldown | +35% | +50% |
| Goop Dump | 15s | 1 wave (18 pcs) | 2 waves | 3 waves |
| Goop Colorizer | 25s | 6 match | 7 match | 8 match |
| Crack Down | 30s | 3 cracks low | 5 cracks | 7 cracks |

## Known Issues (Post v1.2)

**Fixed:**
- Gravity pieces now interact with cracks (v1.1.27)
- Non-matching color pieces no longer destroy cracks (they persist under goop)

**Researched (see INVESTIGATIONS.md):**
- Tetris movement feel — IMPLEMENTED (v1.1.29-33)
- Pressure not rising bug — debug logging added, waiting for next occurrence

### Tetris Movement Feel — COMPLETE

| Feature | Version | Status |
|---------|---------|--------|
| Move reset lock delay | v1.1.29 | ✓ Done |
| 10-reset limit | v1.1.30 | ✓ Done |
| Upward kicks (y:-2) | v1.1.31 | ✓ Done |
| Slide into gaps while falling | v1.1.32 | ✓ Done |
| Snap to grid when sliding into tight gaps | v1.1.33 | ✓ Done |

## Session Continuity

Last session: 2026-01-24
**Version:** 1.1.39
Stopped at: Debugging crack expansion - not working

### This Session Summary (2026-01-24)

**Phase 20: Expanding Cracks Overhaul (CODE COMPLETE, BUG FOUND)**
- Completed 20-01-PLAN.md (full crack system rewrite)
- CrackCell data structure with parentIds/childIds graph
- Per-cell random 3-5s growth timers
- 8-direction spread (orthogonal + diagonal)
- Spread formula: 10% base + pressureRatio
- Leaf cell 50% penalty for clustering
- Same-color crack merging
- Visual connection lines between cells
- 150 tests passing (17 new)

### BUG: Cracks not expanding

**Symptom:** At rank 39, basic cracks spawn but NO expansion occurs. No lines connecting crack cells.

**Expected:** Cracks should spread to adjacent cells every 3-5s with connection lines drawn between parent/child cells.

**Files to investigate:**
- `core/GameEngine.ts` - `tickCrackGrowth()` method
- `core/GoalManager.ts` - `trySpawnCrack()` and crack helpers
- `components/GameBoard.tsx` - connection line rendering

**Likely causes:**
1. `tickCrackGrowth()` not being called or early-returning
2. `crackCells` array not populated (still using old `goalMarks`)
3. Spread logic failing silently
4. Connection lines not rendering (wrong layer or missing data)

**Debug approach:** Add console.log in `tickCrackGrowth()` to verify it runs and check crackCells state.

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
