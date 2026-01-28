---
title: Project Definition
type: reference
tags: [requirements, context, decisions]
updated: 2026-01-27
---

# Goops

## What This Is

A puzzle-action game where players operate as tank maintenance technicians clearing colored goop from a cylindrical pressure tank. Features complication systems with player-controlled triggers, HUD meters for real-time feedback, a 40-rank progression system with 20 upgrades, and 54 polyomino piece shapes that grow larger as games progress. Built with React/TypeScript/Vite. Mobile-optimized with touch controls.

## Core Value

The game feels satisfying to play on mobile - responsive controls, smooth animations, no input lag.

## Requirements

### Validated

**v1.0 MVP:**
- ✓ Core gameplay loop (piece falling, rotation, collision, clearing)
- ✓ Cylindrical grid wrapping
- ✓ Scoring system with bonuses (height, off-screen, adjacency, speed)
- ✓ Goal/objective system (crack marks to fill)
- ✓ Rank progression (XP, levels, color unlocks)
- ✓ Mobile performance optimization (40fps, simplified rendering)
- ✓ Console/Periscope phase UI
- ✓ 65 tests, pre-commit hooks
- ✓ Complications (LASER, LIGHTS, CONTROLS) with minigame resolution
- ✓ HUD meters (laser capacitor, controls heat)
- ✓ Complication cooldowns (rank-scaled)

**v1.1 Architecture:**
- ✓ No files over 400 lines
- ✓ GameEngine.tick() under 50 lines (22 achieved)
- ✓ Event-based input communication
- ✓ Test coverage 112 tests

**v1.2 Progression System:**
- ✓ Upgrade system overhaul (20 upgrades with level effects)
- ✓ 8 Onboarding Band upgrades (ranks 2-9)
- ✓ 4 Junk Band upgrades (ranks 10-19)
- ✓ 4 Mixer Band upgrades (ranks 20-29)
- ✓ 4 Cracked Band upgrades (ranks 30-39)
- ✓ Active ability system (equip, charge, activate)
- ✓ Per-ability charge times (15-30s range)
- ✓ 3 new colors: Orange@10, Purple@20, White@30
- ✓ Lights malfunction rework (player-controlled brightness)
- ✓ Expanding cracks mechanic
- ✓ Hold and next piece previews

**v1.3 Shape Changes:**
- ✓ Extended game to 75 seconds (3 zones of 25s each)
- ✓ 54 new polyomino pieces (10 Tetra + 22 Penta + 22 Hexa)
- ✓ Zone-based piece spawning (bigger pieces as game progresses)
- ✓ Corruption system (15% non-contiguous variants)
- ✓ Mirror system (50% flip for asymmetric pieces)
- ✓ Snappier fast drop (8x factor)

**v1.4 Naming Standardization:**
- ✓ Official terminology glossary (GLOSSARY.md)
- ✓ Core type renames (GoopShape, GoopTemplate, TankCell)
- ✓ Tank system terminology (tankRotation, tankPressure)
- ✓ Progression naming (sessionXP, operatorRank, scraps)
- ✓ UI text alignment (all user-facing text matches glossary)

### Active

**Research:**


**Recently Fixed (v1.1.27):**
- [x] Gravity pieces now interact with cracks
- [x] Non-matching pieces no longer destroy cracks (persist under goop)
- [x] Tetris movement feel (lock delay, sideways into gaps)

### Out of Scope (v1.2)

- Sound design — future milestone
- Save state persistence — future milestone
- Ranks 40+ content — future milestone

## Context

**Current state:** v1.4 shipped. 24 phases, 65 plans complete. ~13,300 lines TypeScript. Version 1.1.13.

**Shipped in v1.4:**
- Official terminology glossary with 9 core categories
- 50+ variable/type/function renames across 62 files
- Core types: PieceType → GoopShape, activePiece → activeGoop
- Grid system: GridCell → TankCell, boardOffset → tankRotation
- Progression: score → sessionXP, rank → operatorRank, powerUpPoints → scraps
- All UI text aligned with official terminology

**Complication System:**
| Type | Trigger | Player Mitigation | Unlock |
|------|---------|-------------------|--------|
| LASER | Capacitor drains to 0 | +10% refill on piece lock | Rank 4 |
| LIGHTS | Brightness dims when not soft dropping | Soft drop to recharge | Rank 2 |
| CONTROLS | Heat meter reaches 100 | Heat dissipates when idle | Rank 6 |

**Active Abilities (4 total):**
| Active | Charge Time | Level 1 | Level 2 | Level 3 |
|--------|-------------|---------|---------|---------|
| Cooldown Booster | 20s | +25% cooldown | +35% | +50% |
| Goop Dump | 15s | 1 wave (18 pcs) | 2 waves | 3 waves |
| Goop Colorizer | 25s | 6 match | 7 match | 8 match |
| Crack Down | 30s | 3 cracks low | 5 cracks | 7 cracks |

**Key files:**
- `constants.ts` — UPGRADES configuration (20 upgrades)
- `core/GameEngine.ts` — Complication triggers, HUD meters, active abilities
- `components/ActiveAbilityCircle.tsx` — Charge/activate UI
- `components/UpgradePanel.tsx` — Purchase + equip UI

**User preferences:**
- Not a professional engineer, prefers readable code over abstractions
- Targeted minimal changes, don't refactor beyond what's asked
- Run tests after every change

## Rank Band System

Progression is organized into bands of 10 ranks. See `.planning/PRD.md` for full details.

| Band | Ranks | Mechanic | New Color | Upgrades | Status |
|------|-------|----------|-----------|----------|--------|
| Onboarding | 0-9 | Complications | - | 8 | ✓ v1.2 |
| Junk | 10-19 | Starting Junk | Orange | 4 | ✓ v1.2 |
| Mixer | 20-29 | Multi-color Pieces | Purple | 4 | ✓ v1.2 |
| Cracked | 30-39 | Expanding Cracks | White | 4 | ✓ v1.2 |
| Future | 40-99 | TBD | TBD | TBD | Future |

**Upgrade types:** passive (always-on), active (equip + charge), feature (unlock only)

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
| LIGHTS trigger on brightness dim | Player-controlled, replaces random trigger | ✓ v1.2 |
| Rank Band System (10 ranks each) | Predictable progression, upgrades throughout band | ✓ Good |
| All rank checks use starting rank | Prevents mid-run unlocks, consistent behavior | ✓ Good |
| Max-level simplifies puzzles | Fewer steps (3 vs 4), not different mechanics | ✓ Good |
| SVG coordinate conversion via getScreenCTM | Handles preserveAspectRatio="xMidYMid slice" | ✓ Good |
| Managers operate on passed state, don't own it | Clean separation, testable | ✓ Good |
| Event-based input replaces callback props | Reduces prop drilling, cleaner component boundaries | ✓ Good |
| Active ability charging: 1%/sec + 10% per crack | Rewards crack-goop sealing, ~100s passive full | ✓ v1.2 |
| Per-ability charge times | Differentiates abilities by power level | ✓ v1.2 |
| Equip checkbox in UpgradePanel | Simple UI, no extra screen needed | ✓ v1.2 |
| Active circles under controls meter | Right side of screen, stacked vertically | ✓ v1.2 |
| AUTO_POPPER probabilistic auto-pop | Reduces end-game penalty naturally | ✓ v1.2 |
| Focus Mode slows time at console | Gives breathing room during complications | ✓ v1.2 |
| Dense Goop increases fall speed | Optional difficulty increase, respecable | ✓ v1.2 |
| CRACK_MATCHER applies to next piece | Provides preview benefit | ✓ v1.2 |
| CRACK_DOWN restricts Y to bottom 4 rows | Most strategic placement for catching cracks | ✓ v1.2 |
| 75-second game with 3 zones | 25s per piece size tier for balanced progression | ✓ v1.3 |
| Zone-based piece spawning | Bigger pieces (Penta/Hexa) help reach higher cracks | ✓ v1.3 |
| Keep original tetromino values | Backwards compatibility with existing save data | ✓ v1.3 |
| Use maxTime for zone calculation | Supports PRESSURE_CONTROL upgrade scaling | ✓ v1.3 |
| 15% corruption, 50% mirror | Adds variety without overwhelming players | ✓ v1.3 |

---

## Future Version Ideas

### SlowMode Concept

**Core idea:** Eliminate XP/points, make progression purely crack-based.

**Changes:**
1. **Level = Cracks Sealed** — No XP curve, just seal X cracks to advance
   - Current formula: `goalsTarget = palette.length + rank` (4 → 46 over 40 ranks)
   - Could cap at rank 50 with ~50 cracks to seal at max

2. **Pressure from Goop, Not Time** — Pressure rises based on how full the tank is
   - More thematic (goop = pressure)
   - Changes the entire pacing model
   - Player controls pressure by clearing goop, not racing clock

3. **Popping = Incidental** — Points become secondary/cosmetic
   - Sealing cracks is the only thing that matters for progression
   - Goop-popping might give small bonuses or nothing

**Why this is appealing:**
- Much more thematic (you're a tank technician managing pressure)
- Flatter progression curve (no exponential XP grind)
- Clearer objective each run (seal N cracks)

**Why this is risky:**
- Major rework of upgrade system (many upgrades reference time/pressure)
- Changes fundamental game feel
- Needs extensive playtesting

**Status:** Captured for future exploration. Create branch `SlowMode` when ready to prototype.

---

## Related

- [[HOME]] - Navigation hub
- [[STATE]] - Current position and session info
- [[ROADMAP]] - All milestones and phases
- [[DESIGN_VISION]] - Design philosophy

---
*Last updated: 2026-01-27 after v1.4 milestone*
