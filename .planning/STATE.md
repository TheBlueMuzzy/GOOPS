---
title: Project State
type: session
tags: [active, continuity, status]
updated: 2026-01-25
---

# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — v1.2 complete, ready for bug fix work

## Next Steps

**Ready to start:** v1.3 milestone (GoopPieceRework - different piece shapes)
**No bugs or blockers.**

Options:
1. `/gsd:new-milestone` — Define phases for v1.3
2. Test current build at https://thebluemuzzy.github.io/GOOPS/
3. Something else — just tell Claude what you want

---

## Project Reference

See: [[PROJECT]] (updated 2026-01-24)

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

See [[v1.2-ROADMAP]] for full details.

### v1.1 Architecture Refactor (Shipped 2026-01-21)

All 6 phases (8-13) complete. See [[v1.1-ROADMAP]] for full details.

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [[v1.0-ROADMAP]] for full details.

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

## Known Issues

**Bugs:**
- None currently tracked

**Tech Debt:**
- `GameEngine.ts` at 1197 lines (reduced from 1374 via CrackManager extraction)
- Console.log placeholders in `ConsoleView.tsx:253-255` — minor cleanup when convenient

## Session Continuity

Last session: 2026-01-25
**Version:** 1.1.13
**Branch:** master

### This Session Summary (2026-01-25)

**CrackManager extraction & process improvements**

1. **Extracted CrackManager from GameEngine** (tech debt cleanup)
   - New file: `core/CrackManager.ts` (~190 lines)
   - GameEngine reduced from 1374 → 1197 lines
   - Key lesson: pass ALL dynamic values to methods fresh each call — storing references in constructor causes stale data bugs after `startRun()` creates new state object

2. **Reduced crack growth interval** from 7-12s to 5-10s

3. **Command updates** (CLAUDE.md)
   - `<test>` now shows manual testing steps for current changes
   - `<runtests>` runs automated tests (renamed from old `<test>`)
   - `<flow>` shows full SOP diagram with branching paths

4. **Clarified build number process** (CLAUDE.md)
   - Build number only increments on server restart, not HMR or refresh
   - Claude must restart server and report new build # for user verification

**Previous Session (same day)**

- Added Core Rules checklists (CLAUDE.md)
- Added PostToolUse auto-test hook
- Added context compaction preservation rules
- Researched power user Claude Code techniques

**Earlier Session (same day)**

- SessionStart hook implemented
- Added `<research>` and `<askme>` commands
- Consolidated Known Issues tracking

**Previous Session (SOP & Workflow Overhaul)**

1. **Distance penalty increased to 25%** (v1.1.46)
   - `core/GameEngine.ts:1198` — changed from 0.15 to 0.25
   - Cracks now limited to ~3 cells instead of ~4-6

2. **Ghost piece visibility improved** (v1.1.46-48)
   - Added transparent color fill (20% opacity) behind dashed outline
   - Fixed: `getContourPath` creates disconnected lines (unfillable), switched to `<rect>`
   - Outline opacity increased to 75%
   - Helps distinguish orange vs red, and split-color pieces

3. **O piece rotation fixed for split-colors** (v1.1.49-50)
   - Previously skipped rotation entirely (optimization for single-color)
   - v1.1.49: Enabled rotation but piece jumped (rotated around 0,0)
   - v1.1.50: Fixed — rotates `cellColors` array instead of cell positions
   - Shape stays in place, colors rotate visually around center

4. **XP curve flattened** (v1.1.51)
   - Old: `(rank+2) * (1750 + 250*rank)` — ~7M to rank 40
   - New: `3500 + (rank * 250)` per rank — ~336K to rank 40
   - Much more achievable progression

**Future ideas captured:**
- `SlowMode` concept in [[PROJECT]] (pressure from goop volume, crack-based leveling)
- `GoopPieceRework` branch created for next milestone (different goop shapes)

**Next session:** Start GoopPieceRework milestone — different piece shapes to facilitate faster stacking

**All deployed to:** https://thebluemuzzy.github.io/GOOPS/

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<runtests>`, `<save>`, `<deploy>`, `<research>`, `<askme>`, `<flow>`

## Related

- [[HOME]] - Navigation hub
- [[PROJECT]] - Full project definition
- [[ROADMAP]] - All milestones
