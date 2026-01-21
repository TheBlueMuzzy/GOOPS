# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — milestone complete

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-21)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.0 MVP complete — planning next milestone

## Current Position

Phase: 7 of 7 (System Upgrades) - COMPLETE
Milestone: v1.0 MVP - SHIPPED
Status: Planning next milestone
Last activity: 2026-01-21 — v1.0 milestone archived

Progress: █████████████████████████ 22/22 plans complete (100%)

## What's Done

### v1.0 MVP (Shipped 2026-01-21)

All 7 phases complete. See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

**Key accomplishments:**
- Three interactive minigame puzzles (Laser, Lights, Controls)
- Complication system with rank-gated unlocks (LASER@1, LIGHTS@2, CONTROLS@3)
- HUD meters with cooldown timers
- Progression system with XP curve and floor
- System upgrades with max-level bonuses
- 65 tests with pre-commit hooks

## Approved Complication Specifications

| Complication | Trigger | Effect | Rank |
|--------------|---------|--------|------|
| LASER | Capacitor drains to 0 (4 per unit popped) | Two-tap mechanic (prime then pop) | 1+ |
| LIGHTS | 50% on piece lock when pressure gap >= 3-5 rows | 10% brightness + grayscale over 1.5s | 2+ |
| CONTROLS | Heat meter reaches 100 (+5 per rotation) | 2 inputs per move, half hold speed | 3+ |

## Performance Metrics

**Velocity:**
- Total plans completed: 22 (across 7 phases)
- Total tests: 65 (29 progression, 6 coordinates, 30 game logic)
- Timeline: 3 days (Jan 18-21, 2026)

## Accumulated Context

### Decisions

All key decisions documented in PROJECT.md Key Decisions table.

### Key Technical Discovery

**SVG Coordinate Conversion with preserveAspectRatio="xMidYMid slice"**

Simple viewBox math doesn't work. Must use:
```tsx
const refPoint = document.getElementById('coord-reference'); // Outside rotating groups!
const ctm = refPoint.getScreenCTM();
const svgPoint = screenPoint.matrixTransform(ctm.inverse());
```

**CSS Filter for Selective Dimming**

Apply filter to game content only, keeping alerts exempt:
```tsx
<svg className={lightsDimmed ? 'lights-dimmed' : ''}>
// .lights-dimmed { animation: lightsDimIn 1.5s ease-out forwards; }
// @keyframes lightsDimIn { to { filter: brightness(0.1) grayscale(1); } }
```

### Deferred Issues

None — all UAT issues resolved.

## Session Continuity

Last session: 2026-01-21
Stopped at: v1.0 milestone archived
Resume with: `/gsd:discuss-milestone` or `/gsd:new-milestone`
Next action: Plan Band 1 features (ranks 10-19): Starting junk, new colors

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
