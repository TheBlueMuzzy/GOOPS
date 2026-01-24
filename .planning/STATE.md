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
Plan: 3 of 3 in current phase
Status: In progress — balance tuning complete, lights rework pending
Last activity: 2026-01-24

Progress: ████░░░░░░ 26%

## What's Done

### v1.1 Architecture Refactor (Shipped 2026-01-21)

All 6 phases (8-13) complete. See [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

## Accumulated Context

### Key Technical Discovery

**SVG Coordinate Conversion with preserveAspectRatio="xMidYMid slice"**

Simple viewBox math doesn't work. Must use:
```tsx
const refPoint = document.getElementById('coord-reference');
const ctm = refPoint.getScreenCTM();
const svgPoint = screenPoint.matrixTransform(ctm.inverse());
```

### Deferred Issues

**Lights Malfunction Rework Needed:**
- Circuit Stabilizer math broken: 20% base - 30% max upgrade = negative (never triggers)
- Needs player-driven trigger and mitigation like Laser and Controls have
- Current: random chance on piece lock
- Desired: meter-based or action-based like the other two

## Session Continuity

Last session: 2026-01-24
Stopped at: Balance tuning complete, lights rework next
Resume file: None
Phase 16 Status: In progress

### This Session Summary

**What was done:**
1. Fixed active ability UI click passthrough (onPointerDown + stopPropagation)
2. Added shake animation using existing shake-anim class
3. Changed fill visual to bottom-to-top like goops
4. Increased crack seal charge: 10% → 25%
5. Reduced lights malfunction: 50% → 20%
6. Sped up lights minigame: 50% faster pattern, near-instant button popup
7. Added laser capacitor refill: +10% on piece lock (disabled during active LASER)
8. Added Code Reuse Guideline to CLAUDE.md
9. Added version note: patch versions can go past 9 (1.1.9 → 1.1.10)
10. Updated PRD with new balance values

**Version:** 1.1.13

### Balance Summary (Current)

| Complication | Trigger | Player Mitigation |
|--------------|---------|-------------------|
| Laser | Capacitor drains on pop | +10% refill on piece lock |
| Controls | Heat builds on rotate | Heat dissipates when idle |
| Lights | 20% chance on piece lock | None (needs rework) |

### Next Steps

1. Rework Lights malfunction:
   - Add player-driven trigger (what action increases risk?)
   - Add player-driven mitigation (what action decreases risk?)
   - Fix Circuit Stabilizer upgrade math
2. Continue with remaining Phase 16-18 implementations
3. Full playtest of progression Rank 0 → 39

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
