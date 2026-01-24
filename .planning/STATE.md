# Project State

## Branch Workflow (SOP)

**Standard procedure:** All new work happens on feature branches, not master.
- `master` = stable, tested code only
- Feature branches = work in progress
- Merge to master only after human verification passes

**Active feature branches:**
- None — ready for Phase 16/17 work

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.
**Current focus:** v1.2 progression system — ranks 0-39 with new upgrades and mechanics

## Current Position

Phase: 18 of 18 (Cracked Band)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-01-24 - Completed 18-02-PLAN.md (CRACK_MATCHER + CRACK_DOWN)

Progress: ████████████████████ 44/44 plans (v1.2 Milestone COMPLETE!)

## What's Done

### Lights Malfunction Rework (Completed 2026-01-24)

Replaced random trigger with player-controlled brightness system:
- **Soft dropping** (S key or drag down) charges the lights
- **Not soft dropping** starts grace period, then dims, then triggers malfunction
- CIRCUIT_STABILIZER now extends grace period (+0.75s per level, max 8s at level 4)

Timing:
- Grace period: 5s base
- Dim duration: 5s (100% → 10%)
- Recovery: ~0.25s at 400%/sec
- Overflare: 110% peak for visual feedback

Also removed crack color pool UI from top of screen (freeing space for hold/next piece).

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

### Balance Summary (Current v1.1.24)

| Complication | Trigger | Player Mitigation |
|--------------|---------|-------------------|
| Laser | Capacitor drains on pop | +10% refill on piece lock |
| Controls | Heat builds on rotate | Heat dissipates when idle |
| Lights | Brightness dims when not soft dropping | Soft drop to recharge |

All three complications have player-driven triggers AND mitigations.

### Active Abilities (v1.1.24)

| Active | Charge Time | Level 1 | Level 2 | Level 3 |
|--------|-------------|---------|---------|---------|
| Cooldown Booster | 20s | +25% cooldown | +35% | +50% |
| Goop Dump | 15s | 1 wave (18 pcs) | 2 waves | 3 waves |
| Goop Colorizer | 25s | 6 match | 7 match | 8 match |
| Crack Down | 30s | 3 cracks low | 5 cracks | 7 cracks |

## Session Continuity

Last session: 2026-01-24
**Version:** 1.1.26

### This Session Summary (2026-01-24 Late Night)

**What was done:**

1. **GOOP_DUMP Rework** (v1.1.21)
   - Pieces now rain from TOP instead of spawning in-place
   - Ghost appearance (30% opacity, dashed outline) until landing
   - Pieces move WITH board rotation (absolute grid X)
   - Staggered spawn for rain effect (80ms between pieces)
   - Added DumpPiece interface, dumpPieces/dumpQueue to GameState
   - New tickDumpPieces() method in GameEngine

2. **All Actives Now Have 3 Levels** (v1.1.22)
   | Ability | Level 1 | Level 2 | Level 3 |
   |---------|---------|---------|---------|
   | COOLDOWN_BOOSTER | +25% | +35% | +50% |
   | GOOP_DUMP | 1 wave | 2 waves | 3 waves |
   | GOOP_COLORIZER | 6 match | 7 match | 8 match |
   | CRACK_DOWN | 3 cracks | 5 cracks | 7 cracks |

3. **Per-Ability Charge Times** (v1.1.23)
   - Cooldown Booster: 20s
   - Goop Dump: 15s
   - Goop Colorizer: 25s
   - Crack Down: 30s

4. **GOOP_DUMP now uses 60% coverage** (18 pieces per wave)

5. **GOOP_COLORIZER Implemented** (v1.1.24)
   - Locks next N pieces to current falling piece's color
   - Level scaling: 6/7/8 pieces for level 1/2/3
   - NextPiece preview shows colorized color

### Remaining Tasks

**Bugs to Investigate:**
1. **Pressure not rising bug** - Sometimes pressure doesn't start rising for a long time.
2. **Falling pieces don't interact with cracks** - After clears, gravity-falling pieces don't consume/destroy cracks.

**RESEARCH REQUIRED - Tetris Movement Feel:**
3. **Lock delay / last-moment sliding** - Research how Tetris achieves this feel.
4. **Sideways movement into gaps** - Research Tetris collision logic for moving into gaps.

⚠️ **WARNING for tasks 3-4:** Previous attempts "broke pretty badly". Approach with caution.

## Quick Commands

User shortcuts in CLAUDE.md: `<commands>`, `<npm>`, `<test>`, `<commit>`, `<merge>`, `<status>`, `<handoff>`
