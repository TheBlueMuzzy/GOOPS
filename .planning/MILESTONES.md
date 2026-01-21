# Project Milestones: Goops

## v1.1 Architecture Refactor (Shipped: 2026-01-21)

**Delivered:** Comprehensive codebase refactor — fixed memory leaks, decomposed large files, extracted managers, expanded test coverage.

**Phases completed:** 8-13 (13 plans total)

**Key accomplishments:**

- Fixed rotationTimestamps memory leak with circular buffer (was ~6000 allocations/session)
- Art.tsx decomposed: 1,478 → 581 lines (61% reduction) with minigame hooks and panel components
- GameBoard.tsx decomposed: 1,031 → 604 lines (41% reduction) with input handlers and renderers extracted
- GameEngine.tick() refactored: 159 → 22 lines (86% reduction) with ComplicationManager and GoalManager
- Event-based input communication replaced 6 callback props
- Test coverage expanded: 65 → 110 tests (69% increase)

**Stats:**

- ~40 TypeScript source files
- ~9,760 lines of TypeScript
- 6 phases, 13 plans
- 1 day (2026-01-21)

**Git range:** `feat(08-01)` → `docs(13-02)`

**What's next:** Band 1 features (rank 10+): Starting junk, new colors

---

## v1.0 MVP (Shipped: 2026-01-21)

**Delivered:** Core gameplay loop with complications, HUD meters, progression system, and system upgrades.

**Phases completed:** 1-7 (22 plans total)

**Key accomplishments:**

- Three interactive minigame puzzles: Reset Laser (slider alignment), Reset Lights (sequence memory), Reset Controls (dial alignment)
- Complication system with rank-gated unlocks: LASER@rank1 (capacitor drain), LIGHTS@rank2 (screen dimming), CONTROLS@rank3 (double-input)
- HUD meters with real-time feedback: Laser capacitor (drains on pop), Controls heat (builds on rotate)
- Progression system: XP curve `(rank+2) * (1750 + 250*rank)`, XP floor prevents zero-gain runs
- System upgrades with max-level bonuses (simpler minigames at max level)
- 65 comprehensive tests with pre-commit hooks

**Stats:**

- 114 files created/modified
- 7,870 lines of TypeScript
- 7 phases, 22 plans
- 3 days from start to ship (Jan 18-21, 2026)

**Git range:** `ea1fa09` (docs: map existing codebase) → `13092c8` (docs: update STATE.md)

**What's next:** Band 1 features (rank 10+): Starting junk, new colors

---
