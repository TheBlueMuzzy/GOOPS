---
title: Shipped Milestones
type: reference
tags: [milestones, history, shipped]
updated: 2026-01-27
---

# Project Milestones: Goops

## v1.4 Naming Standardization (Shipped: 2026-01-27)

**Delivered:** Official terminology glossary and systematic codebase rename — 50+ variables, types, and functions standardized across 62 files.

**Phases completed:** 22-24 (9 plans total)

**Key accomplishments:**

- Created official GLOSSARY.md with 9 core term categories and usage examples
- Renamed core types: PieceType → GoopShape, activePiece → activeGoop
- Standardized tank terminology: GridCell → TankCell, boardOffset → tankRotation
- Unified progression naming: score → sessionXP, rank → operatorRank, powerUpPoints → scraps
- Updated complication system: ComplicationType → TankSystem
- Aligned all UI text with official terminology (HowToPlay, Upgrades, constants)

**Stats:**

- 62 files modified
- 13,294 lines of TypeScript
- 3 phases, 9 plans, 43 commits
- 2 days (Jan 26-27, 2026)

**Git range:** `0a52484` → `29b1cb1`

**What's next:** Next milestone planning (title unlock system, tutorial, or new features)

---

## v1.3 Shape Changes (Shipped: 2026-01-26)

**Delivered:** Progressive piece sizes (Tetra → Penta → Hexa) with 54 new polyomino shapes, corruption variants, and mirroring support.

**Phases completed:** 21 (3 plans total)

**Key accomplishments:**

- Extended game to 75 seconds with 3 time zones (25s each)
- 54 new polyomino pieces: 10 Tetra + 22 Penta + 22 Hexa
- Zone-based spawning: bigger pieces as game progresses
- 15% corruption chance (non-contiguous variants)
- 50% mirror chance for asymmetric pieces
- Snappier fast drop (8x factor vs 6x)

**Stats:**

- 8 files modified
- 587 lines of TypeScript added
- 1 phase, 3 plans, 10 tasks
- 1 day (2026-01-26)

**Git range:** `feat(21-01)` → `docs(21-03)`

**What's next:** Title unlock system or tutorial system

---

## v1.2 Progression System (Shipped: 2026-01-24)

**Delivered:** Full ranks 0-39 progression with 4 bands, 20 upgrades, active ability system, 3 new colors, multi-color pieces, and expanding cracks overhaul.

**Phases completed:** 14-20 (18 plans total)

**Key accomplishments:**

- Upgrade system overhaul: 20 upgrades with passive/active/feature types across 4 bands
- Active ability system: equip, charge (1%/sec + 10%/crack), activate with per-ability cooldowns
- 8 Onboarding Band upgrades (ranks 2-9): Circuit Stabilizer, Auto-Popper, Capacitor Efficiency, Cooldown Booster, Gear Lubrication, Focus Mode, Dense Goop, Pressure Control
- 4 Junk Band features (ranks 10-19): JUNK_UNIFORMER, GOOP_SWAP, GOOP_DUMP, SEALING_BONUS
- 4 Mixer Band features (ranks 20-29): 2nd active slot, hold/next piece previews, GOOP_COLORIZER
- 4 Cracked Band features (ranks 30-39): Expanding cracks, SLOW_CRACKS, CRACK_MATCHER, CRACK_DOWN
- Lights malfunction rework: player-controlled brightness (soft drop to charge)
- Color progression: Orange@10, Purple@20, White@30
- Multi-color pieces (Phase 19): pieces can have different colors per cell
- Expanding cracks overhaul (Phase 20): connected structures with organic growth

**Stats:**

- 60+ files modified
- 150 tests across 7 test files
- 7 phases (14-20), 18 plans
- 3 days (Jan 23-25, 2026)

**Git range:** `feat(14-01)` → `docs(18-02)`

**What's next:** GoopPieceRework milestone (different piece shapes)

---

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
