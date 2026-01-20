# Goops

## What This Is

A puzzle-action game where players operate as tank maintenance technicians clearing colored goop from a cylindrical pressure tank. Built with React/TypeScript/Vite. Mobile-optimized with touch controls.

## Core Value

The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.

## Requirements

### Validated

- ✓ Core gameplay loop (piece falling, rotation, collision, clearing)
- ✓ Cylindrical grid wrapping
- ✓ Scoring system with bonuses (height, off-screen, adjacency, speed)
- ✓ Goal/objective system (crack marks to fill)
- ✓ Rank progression (XP, levels, color unlocks)
- ✓ Mobile performance optimization (40fps, simplified rendering)
- ✓ Console/Periscope phase UI
- ✓ Unit test infrastructure (64 tests, pre-commit hooks)
- ✓ Dial spins when dragged (Reset Controls dial) — snaps to 4 corners
- ✓ Reset Laser puzzle logic (4 sliders match indicator lights)
- ✓ Reset Lights puzzle logic (sequence memory: slider → watch → repeat → slider)
- ✓ Reset Controls puzzle logic (dial alignment: 4 corners in sequence)
- ✓ Complications — triggers and effects (LASER, LIGHTS, CONTROLS)
- ✓ Minigame-Complication integration — puzzles resolve complications
- ✓ HUD meters (laser capacitor, controls heat)
- ✓ Complication cooldowns (rank-scaled)
- ✓ XP curve retuned (linear delta) + XP floor
- ✓ Milestone infrastructure (ranks 10, 20, 30...)

### Active

- Phase 7: System Upgrades (per-complication upgrade tracks)

### Out of Scope (v1)

- Control state persistence (save/load between sessions)
- Multi-color pieces — Band 2 feature (rank 20+)
- Starting junk — Band 1 feature (rank 10+)
- Growing cracks — Band 3 feature (rank 30+)

## Context

**Current state:** Phases 1-6 complete. Phase 7 (System Upgrades) in progress.

**Complication System (Complete):**
| Type | Trigger | Effect | Unlock |
|------|---------|--------|--------|
| LASER | Capacitor drains to 0 | Two-tap mechanic | Rank 1 |
| LIGHTS | 50% on piece lock (pressure gap) | 10% brightness + grayscale | Rank 2 |
| CONTROLS | Heat meter reaches 100 | 2 inputs per move, half hold speed | Rank 3 |

**System Upgrades (In Progress):**
| Upgrade | Effect per Level | Max Bonus |
|---------|------------------|-----------|
| LASER (Capacitor Efficiency) | -5% drain rate | No center targets |
| LIGHTS (Circuit Stabilizer) | -6% trigger chance | 3-button sequence |
| CONTROLS (Heat Sink) | +10% dissipation | 3 alignments |

**Key files:**
- `constants.ts` — SYSTEM_UPGRADE_CONFIG definitions
- `components/Art.tsx` — Minigame state machines, puzzle logic
- `core/GameEngine.ts` — Complication triggers, HUD meters
- `Game.tsx` — CONTROLS double-input effect

**User preferences:**
- Not a professional engineer, prefers readable code over abstractions
- Targeted minimal changes, don't refactor beyond what's asked
- Run tests after every change

## Rank Band System

Progression is organized into bands of 10 ranks. See PRD.md for full details.

| Band | Ranks | Mechanic | Status |
|------|-------|----------|--------|
| Tutorial | 0-9 | Complications | Implemented |
| Band 1 | 10-19 | Starting Junk | Planned |
| Band 2 | 20-29 | Multi-color Pieces | Planned |
| Band 3 | 30-39 | Growing Cracks | Concept |
| Band 4+ | 40-99 | TBD | Future |

**Pattern:** First 5 ranks (X0-X4) introduce/ramp mechanic, last 5 (X5-X9) consolidation.

**Focus now:** Ranks 0-20 (Tutorial + Band 1)

## Constraints

- **Mobile-first**: Controls must work well on touch devices
- **Existing patterns**: Follow the slider implementation pattern for consistency
- **Test requirement**: Run `npm run test:run` after changes, fix failures immediately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Sliders use local state in Art.tsx | Simple, self-contained, no game logic coupling | ✓ Good |
| LIGHTS effect via CSS filter on SVG | Alert stays visible, cleaner than overlay | ✓ Good |
| CONTROLS tracks timestamps not counter | Speed-based trigger (20 in 3s) needs timing data | ✓ Good |
| LIGHTS trigger on piece lock | Situational trigger based on pressure gap, not counter | ✓ Good |
| Rank Band System (10 ranks each) | Predictable progression, 5 ramp + 5 consolidate | ✓ Good |
| System-specific upgrades only | Direct mitigation of complication difficulty | ✓ Good |

---
*Last updated: 2026-01-20 — Phase 7 in progress, Band System defined*
