# Roadmap: Goops Complications & Progression

## Overview

Build the complication system, balance it for fair progression, add visual feedback via HUD meters, and implement the upgrade system that lets players tune difficulty over time.

## Domain Expertise

None

## Milestones

- ✅ [v1.0 MVP](milestones/v1.0-ROADMAP.md) — Phases 1-7 (shipped 2026-01-21)
- ✅ [v1.1 Architecture Refactor](milestones/v1.1-ROADMAP.md) — Phases 8-13 (shipped 2026-01-21)
- 🚧 **v1.2 Progression System** — Phases 14-18 (in progress)

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-7) — SHIPPED 2026-01-21</summary>

- [x] Phase 1: Dial Rotation (1/1 plans) — completed 2026-01-18
- [x] Phase 2: Minigame Logic (3/3 plans) — completed 2026-01-18
- [x] Phase 3: Complications (3/3 plans) — completed 2026-01-19
- [x] Phase 4: Minigame-Complication Integration (4/4 plans) — completed 2026-01-19
- [x] Phase 5: HUD & Balance (4/4 plans) — completed 2026-01-20
- [x] Phase 6: Progression System (2/2 plans) — completed 2026-01-20
- [x] Phase 7: System Upgrades (4/4 plans) — completed 2026-01-20

**Total:** 7 phases, 22 plans, 65 tests

See [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.1 Architecture Refactor (Phases 8-13) — SHIPPED 2026-01-21</summary>

- [x] Phase 8: Quick Wins & Memory Fixes (1/1 plans) — completed 2026-01-21
- [x] Phase 9: Art.tsx Decomposition (3/3 plans) — completed 2026-01-21
- [x] Phase 10: GameBoard.tsx Decomposition (3/3 plans) — completed 2026-01-21
- [x] Phase 11: GameEngine Refactor (2/2 plans) — completed 2026-01-21
- [x] Phase 12: State Management & Events (2/2 plans) — completed 2026-01-21
- [x] Phase 13: Testing & Documentation (2/2 plans) — completed 2026-01-21

**Total:** 6 phases, 13 plans, 110 tests

**Key accomplishments:**
- Art.tsx: 1,478 → 581 lines (61% reduction)
- GameBoard.tsx: 1,031 → 604 lines (41% reduction)
- GameEngine.tick(): 159 → 22 lines (86% reduction)
- Tests: 65 → 110 (69% increase)

See [v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

</details>

---

### 🚧 v1.2 Progression System (In Progress)

**Milestone Goal:** Implement ranks 0-39 progression with 4 bands, 17 upgrades, and 3 new colors

#### Phase 14: Data Architecture

**Goal**: Redesign upgrade system data structures, implement progression table, configure level effects
**Depends on**: Previous milestone complete
**Research**: Unlikely (internal restructuring)
**Plans**: 2 plans

Plans:
- [x] 14-01: Upgrade system overhaul (types, 20 upgrades with level effects) — completed 2026-01-23
- [x] 14-02: Complication & color config (unlock ranks, color schedule) — completed 2026-01-24

#### Phase 15: Onboarding Band

**Goal**: Implement ranks 0-9 upgrades — Circuit Stabilizer, Auto-Popper, Capacitor Efficiency, Cooldown Booster, Gear Lubrication, Focus Mode, Dense Goop, Pressure Control
**Depends on**: Phase 14
**Research**: Unlikely (extending existing upgrade patterns)
**Plans**: 4 plans

Plans:
- [x] 15-01: Upgrade ID migration (LASER→CAPACITOR_EFFICIENCY, etc.) + UpgradePanel update — completed 2026-01-24
- [ ] 15-02: Complication upgrade effects (Circuit Stabilizer, Capacitor Efficiency, Gear Lubrication)
- [ ] 15-03: Game mechanics (Pressure Control, Focus Mode, Dense Goop)
- [ ] 15-04: Auto-Popper + Cooldown Booster active

#### Phase 16: Junk Band

**Goal**: Implement Junk Goop complication, starting junk mechanic, Orange color, Junk Uniformer, Goop Swap, Goop Dump, Sealing Bonus
**Depends on**: Phase 15
**Research**: Unlikely (new complication follows established patterns)
**Plans**: TBD

Plans:
- [ ] 16-01: TBD

#### Phase 17: Mixer Band

**Goal**: Implement Goop Mix complication (multi-color pieces), Purple color, Active Expansion Slot, Goop Hold Viewer, Goop Colorizer, Goop Window
**Depends on**: Phase 16
**Research**: Unlikely (follows established patterns)
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

#### Phase 18: Cracked Band

**Goal**: Implement Expanding Cracks complication, White color, Slow Cracks, Crack Matcher, Crack Down, 2nd Active Expansion Slot
**Depends on**: Phase 17
**Research**: Unlikely (follows established patterns)
**Plans**: TBD

Plans:
- [ ] 18-01: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dial Rotation | v1.0 | 1/1 | Complete | 2026-01-18 |
| 2. Minigame Logic | v1.0 | 3/3 | Complete | 2026-01-18 |
| 3. Complications | v1.0 | 3/3 | Complete | 2026-01-19 |
| 4. Minigame-Complication Integration | v1.0 | 4/4 | Complete | 2026-01-19 |
| 5. HUD & Balance | v1.0 | 4/4 | Complete | 2026-01-20 |
| 6. Progression System | v1.0 | 2/2 | Complete | 2026-01-20 |
| 7. System Upgrades | v1.0 | 4/4 | Complete | 2026-01-20 |
| 8. Quick Wins & Memory Fixes | v1.1 | 1/1 | Complete | 2026-01-21 |
| 9. Art.tsx Decomposition | v1.1 | 3/3 | Complete | 2026-01-21 |
| 10. GameBoard.tsx Decomposition | v1.1 | 3/3 | Complete | 2026-01-21 |
| 11. GameEngine Refactor | v1.1 | 2/2 | Complete | 2026-01-21 |
| 12. State Management & Events | v1.1 | 2/2 | Complete | 2026-01-21 |
| 13. Testing & Documentation | v1.1 | 2/2 | Complete | 2026-01-21 |
| 14. Data Architecture | v1.2 | 2/2 | Complete | 2026-01-24 |
| 15. Onboarding Band | v1.2 | 1/4 | In progress | - |
| 16. Junk Band | v1.2 | 0/? | Not started | - |
| 17. Mixer Band | v1.2 | 0/? | Not started | - |
| 18. Cracked Band | v1.2 | 0/? | Not started | - |
