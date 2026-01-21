# Goops

## What This Is

A puzzle-action game where players operate as tank maintenance technicians clearing colored goop from a cylindrical pressure tank. Features complication systems that challenge players, HUD meters for real-time feedback, and an upgrade system to tune difficulty. Built with React/TypeScript/Vite. Mobile-optimized with touch controls.

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
- ✓ Unit test infrastructure (65 tests, pre-commit hooks)
- ✓ Dial spins when dragged (Reset Controls dial) — v1.0
- ✓ Reset Laser puzzle logic (4 sliders match indicator lights) — v1.0
- ✓ Reset Lights puzzle logic (sequence memory) — v1.0
- ✓ Reset Controls puzzle logic (dial alignment: 4 corners) — v1.0
- ✓ Complications — triggers and effects (LASER, LIGHTS, CONTROLS) — v1.0
- ✓ Minigame-Complication integration — puzzles resolve complications — v1.0
- ✓ HUD meters (laser capacitor, controls heat) — v1.0
- ✓ Complication cooldowns (rank-scaled) — v1.0
- ✓ XP curve retuned + XP floor — v1.0
- ✓ Milestone infrastructure (ranks 10, 20, 30...) — v1.0
- ✓ System upgrades (3 tracks with max-level bonuses) — v1.0
- ✓ No files over 400 lines — v1.1
- ✓ Centralized configuration (complicationConfig.ts) — v1.1
- ✓ GameEngine.tick() under 50 lines (22 achieved) — v1.1
- ✓ Event-based input communication — v1.1
- ✓ Test coverage 110+ tests — v1.1

### Active

(None — planning next milestone)

### Out of Scope (v1)

- Control state persistence (save/load between sessions)
- Multi-color pieces — Band 2 feature (rank 20+)
- Starting junk — Band 1 feature (rank 10+)
- Growing cracks — Band 3 feature (rank 30+)

## Context

**Current state:** v1.1 Architecture Refactor shipped. 13 phases, 35 plans complete.

**Shipped in v1.1:**
- Memory leak fixes (rotationTimestamps circular buffer)
- Art.tsx decomposed: 1,478 → 581 lines with minigame hooks
- GameBoard.tsx decomposed: 1,031 → 604 lines with input handlers
- GameEngine.tick() refactored: 159 → 22 lines with managers
- Event-based input communication (6 callback props removed)
- Test coverage: 110 tests (was 65)

**Complication System:**
| Type | Trigger | Effect | Unlock |
|------|---------|--------|--------|
| LASER | Capacitor drains to 0 | Two-tap mechanic | Rank 1 |
| LIGHTS | 50% on piece lock (pressure gap) | 10% brightness + grayscale | Rank 2 |
| CONTROLS | Heat meter reaches 100 | 2 inputs per move, half hold speed | Rank 3 |

**System Upgrades:**
| Upgrade | Effect per Level | Max Bonus |
|---------|------------------|-----------|
| LASER | -5% drain rate | No center targets |
| LIGHTS | -6% trigger chance | 3-button sequence |
| CONTROLS | +10% dissipation | 3 alignments |

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
| Tutorial | 0-9 | Complications | v1.0 Complete |
| Band 1 | 10-19 | Starting Junk | Planned |
| Band 2 | 20-29 | Multi-color Pieces | Planned |
| Band 3 | 30-39 | Growing Cracks | Concept |
| Band 4+ | 40-99 | TBD | Future |

**Pattern:** First 5 ranks (X0-X4) introduce/ramp mechanic, last 5 (X5-X9) consolidation.

**Focus next:** Ranks 10-20 (Band 1)

## Constraints

- **Mobile-first**: Controls must work well on touch devices
- **Existing patterns**: Follow the slider implementation pattern for consistency
- **Test requirement**: Run `npm run test:run` after changes, fix failures immediately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Sliders use local state in Art.tsx | Simple, self-contained, no game logic coupling | ✓ Good |
| LIGHTS effect via CSS filter on SVG | Alert stays visible, cleaner than overlay | ✓ Good |
| CONTROLS tracks heat meter not counter | Continuous feedback, clearer than input counting | ✓ Good |
| LIGHTS trigger on piece lock | Situational trigger based on pressure gap | ✓ Good |
| Rank Band System (10 ranks each) | Predictable progression, 5 ramp + 5 consolidate | ✓ Good |
| System-specific upgrades only | Direct mitigation of complication difficulty | ✓ Good |
| All rank checks use starting rank | Prevents mid-run unlocks, consistent behavior | ✓ Good |
| Max-level simplifies puzzles | Fewer steps (3 vs 4), not different mechanics | ✓ Good |
| SVG coordinate conversion via getScreenCTM | Handles preserveAspectRatio="xMidYMid slice" | ✓ Good |
| Managers operate on passed state, don't own it | Clean separation, testable | ✓ Good |
| GameStateManager is documentation-first interface | Captures existing API without enforcing changes | ✓ Good |
| Event-based input replaces callback props | Reduces prop drilling, cleaner component boundaries | ✓ Good |
| CSS media queries for desktop-only effects | Simpler than JS conditionals | ✓ Good |

---
*Last updated: 2026-01-21 after v1.1 milestone*
