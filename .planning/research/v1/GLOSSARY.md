---
title: Goops Official Glossary
type: reference
tags: [naming, terminology, standards]
updated: 2026-01-26
version: 2.0
---

# Goops Official Glossary

This document establishes the authoritative terminology for Goops. Use these terms consistently in code, UI, tutorials, and discussions.

---

## Casing Conventions

| Context | Convention | Example |
|---------|------------|---------|
| Types / Interfaces / Classes | PascalCase | `ActiveGoop`, `TankCell`, `GoopBlock` |
| Constants / Enum Values | SCREAMING_SNAKE_CASE | `TANK_WIDTH`, `SPIN_TANK`, `SPAWNED` |
| Variables / Properties / Functions | camelCase | `activeGoop`, `tankRotation`, `sessionXP` |
| Actions / Events | SCREAMING_SNAKE_CASE | `ROTATE_GOOP`, `POP_GOOP`, `SEAL_CRACK` |

---

## The Operator

**Definition:** The player. The person operating the tank.

| Term | Type | Description |
|------|------|-------------|
| Operator | Concept | The player character/role |
| `operatorRank` | Variable | Progression level (0-50) |
| `operatorXP` | Variable | Lifetime experience points (sum of all sessions) |
| `scraps` | Variable | Currency for purchasing upgrades |

---

## Goop Lifecycle

```
SpawnGoop (action)
    ↓
ActiveGoop (falling, player-controlled)
    ↓ LockGoop (action)
LockedGoop (brief state, waiting for delay)
    ↓ MergeGoop (action)
GoopBlock (individual units in tankGrid)
    ↓ (automatic grouping)
GoopGroup (connected same-color GoopBlocks)
    ↓ PopGoop (action)
(removed from tank)
```

### Goop States & Types

| Term | Casing | Description |
|------|--------|-------------|
| `ActiveGoop` | Type | The falling shape being controlled by the Operator |
| `activeGoop` | Variable | Instance of the current falling goop |
| `GoopTemplate` | Type | Blueprint defining a shape's cells and default color |
| `GoopShape` | Type/Enum | Enum of shape names (T, L, I, O, S, Z, Penta variants, Hexa variants) |
| `GoopState` | Enum | State of active goop: `SPAWNED`, `FALLING`, `LOCKED` |
| `GoopGhost` | Type | The transparent preview showing where ActiveGoop will land |
| `goopGhost` | Variable | Instance of the ghost preview |
| `GoopBlock` | Type | One unit of settled goop (content of a filled TankCell) |
| `GoopGroup` | Type | Connected same-color GoopBlocks |
| `goopGroupId` | Property | Unique identifier for a group |
| `StoredGoop` | Type | Goop held for swap |
| `storedGoop` | Variable | The currently stored goop |
| `NextGoop` | Type | Preview of upcoming goop |
| `nextGoop` | Variable | The next goop that will spawn |
| `LooseGoop` | Type | GoopBlocks falling due to gravity after a pop |
| `SealingGoop` | Type | Goop that is currently sealing a crack (was `isGlowing`) |

### Goop Sizes

| Term | Description |
|------|-------------|
| `GoopSize` | Category for piece complexity: Tetra (4), Penta (5), Hexa (6) |
| `GoopSizeThreshold` | Pressure thresholds that determine which GoopSize spawns |
| Tetra | 4-cell goop shapes |
| Penta | 5-cell goop shapes |
| Hexa | 6-cell goop shapes |

---

## The Tank

**Definition:** The cylindrical pressure vessel where gameplay happens.

### Tank Structure

| Term | Casing | Description |
|------|--------|-------------|
| Tank | Concept | The play area (player-facing term) |
| `tankGrid` | Variable | 2D data array holding all TankCells |
| `TankCell` | Type | One position in the tankGrid (can be empty or contain GoopBlock) |
| `tankCell` | Variable | Reference to a specific cell |
| `TankViewport` | Type | The visible 12-column portion of the tank |
| `tankViewport` | Variable | Current viewport state |
| `tankRotation` | Variable | Current rotation position of the cylinder (was `boardOffset`) |
| `tankColumn` | Variable | A vertical line in the tank |
| `tankRow` | Variable | A horizontal line in the tank |
| `tankPressure` | Variable | How close to losing (0-100%, derived from time) |

### Tank Dimensions (Constants)

| Constant | Value | Description |
|----------|-------|-------------|
| `TANK_WIDTH` | 30 | Full cylinder width in cells |
| `TANK_HEIGHT` | 19 | Full tank height in cells |
| `TANK_VIEWPORT_WIDTH` | 12 | Visible width in cells |
| `TANK_VIEWPORT_HEIGHT` | 16 | Visible height in cells |
| `BUFFER_HEIGHT` | 3 | Rows above visible area (spawn buffer) |

---

## Player Actions

### Movement & Control

| Action | Constant | Description |
|--------|----------|-------------|
| SpinTank | `SPIN_TANK` | Rotating the cylinder left/right |
| RotateGoop | `ROTATE_GOOP` | Turning ActiveGoop 90° clockwise/counter |
| FastDropGoop | `FAST_DROP_GOOP` | Holding down to accelerate falling |
| SwapGoop | `SWAP_GOOP` | Swapping ActiveGoop with StoredGoop |

### Goop Interactions

| Action | Constant | Description |
|--------|----------|-------------|
| SpawnGoop | `SPAWN_GOOP` | Creating a new ActiveGoop at top |
| LockGoop | `LOCK_GOOP` | When ActiveGoop stops moving (hits bottom) |
| MergeGoop | `MERGE_GOOP` | Converting LockedGoop to GoopBlocks in tankGrid |
| PopGoop | `POP_GOOP` | Removing a GoopGroup from the tank (tap action) |
| PrePopGoop | `PRE_POP_GOOP` | First tap on a group (LASER system) - was `prime` |

### Crack Interactions

| Action | Constant | Description |
|--------|----------|-------------|
| SealCrack | `SEAL_CRACK` | Covering a crack with matching-color goop |
| BranchCrack | `BRANCH_CRACK` | Crack expanding to adjacent cell |

### Removed Actions

| Old Term | Status |
|----------|--------|
| `HARD_DROP` | Removed - not used in this game |

---

## Tank Systems (Complications)

**Definition:** The three systems in the tank that can malfunction.

| Term | Casing | Description |
|------|--------|-------------|
| `TankSystem` | Type | A system that can malfunction (LASER, LIGHTS, CONTROLS) |
| `TankSystemMalfunction` | Type | When a TankSystem triggers its failure state |
| `Complication` | Type | General term for difficulty mechanics (broader category) |

### LASER System

| Term | Casing | Description |
|------|--------|-------------|
| `laserCharge` | Variable | 0-100 meter (drains on pop) - was `laserCapacitor` |
| `prePoppedGoopGroups` | Variable | Groups that have been PrePopGoop'd - was `primedGroups` |
| `LaserWarningVisual` | Type | Visual warning before malfunction |
| `LaserWarningText` | Type | Text warning before malfunction |

### LIGHTS System

| Term | Casing | Description |
|------|--------|-------------|
| `lightsBrightness` | Variable | 5-110 meter (the screen brightness IS the indicator) |
| `lightsDelay` | Variable | Time before dimming starts - was grace period |
| `LightsWarningVisual` | Type | Flicker effect before malfunction |
| `LightsWarningText` | Type | Text warning before malfunction |

### CONTROLS System

| Term | Casing | Description |
|------|--------|-------------|
| `controlsHeat` | Variable | 0-100 meter (builds on rotate) |
| `controlsHeatDecay` | Variable | Heat reduction over time - was `dissipation` |
| `ControlsWarningVisual` | Type | Visual warning before malfunction |
| `ControlsWarningText` | Type | Text warning before malfunction |

---

## Crack System

**Definition:** Damage on the tank wall that must be sealed.

| Term | Casing | Description |
|------|--------|-------------|
| `CrackSystem` | Type | The manager handling all cracks |
| `Crack` | Type | Individual crack entity at a position |
| `originCrackId` | Property | ID of crack this one branched from (null if root) - was `parentIds` |
| `branchCrackIds` | Property | IDs of cracks that branched from this - was `childIds` |
| `crackBranchInterval` | Property | Time between crack expansions - was `growthInterval` |
| `SealedCrack` | State | A crack that has been covered by matching goop |

### Crack + Goop Interaction

| Term | Description |
|------|-------------|
| SealCrack | Action: goop lands on crack of matching color |
| SealedCrack | State: the crack after being sealed |
| SealingGoop | State: the goop that is sealing a crack |

---

## Timing & Speed

### Speed Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `ACTIVE_GOOP_SPEED` | 780ms | Base time per block for ActiveGoop falling |
| `FAST_DROP_MULTIPLIER` | 8 | Multiplier when FastDropGoop active |
| `FAST_DROP_GOOP_SPEED` | ~97ms | Calculated: ACTIVE_GOOP_SPEED / FAST_DROP_MULTIPLIER |
| `LOOSE_GOOP_SPEED` | 0.03 | units/ms velocity for LooseGoop (physics-based) |
| `LOCKED_GOOP_DELAY` | 500ms | Time in LockedGoop state before MergeGoop |

### Session Timing

| Term | Casing | Description |
|------|--------|-------------|
| `sessionTime` | Variable | Internal time tracking (seconds) - was `timeLeft` |
| `SESSION_DURATION` | Constant | Max session time (75000ms) - was `INITIAL_TIME_MS` |
| `sessionXP` | Variable | XP earned in current session - was `score` |
| `popStreak` | Variable | Bonus multiplier for consecutive pops - was `combo` |

**Note:** Player sees `tankPressure` (percentage), not raw time. Future refactor: convert time-based bonuses to "pressure vented X%".

---

## Screens & Modals

### Architecture

```
App
├── Screens (one active at a time)
│   ├── ConsoleScreen (menu, upgrades, malfunction minigame)
│   ├── TankScreen (main gameplay)
│   ├── EndGameScreen (results)
│   ├── SettingsScreen
│   └── HowToPlayScreen
│
└── Modals (overlay on any screen)
    └── TutorialModal (contextual, progressive disclosure)
```

| Term | Casing | Description |
|------|--------|-------------|
| `ScreenType` | Enum | Which screen is active |
| `ConsoleScreen` | Value | Menu/upgrades (includes malfunction minigame when triggered) |
| `TankScreen` | Value | Main gameplay |
| `EndGameScreen` | Value | Results after session ends - was `GAME_OVER` |
| `SettingsScreen` | Value | Settings menu |
| `HowToPlayScreen` | Value | How to play information |
| `TutorialModal` | Type | Overlay for contextual tutorial tips |

### Removed

| Old Term | Status |
|----------|--------|
| `PERISCOPE` | Removed - merged into TankScreen concept |
| `COMPLICATION_MINIGAME` | Removed - part of ConsoleScreen with flag |

---

## Progression & Upgrades

| Term | Casing | Description |
|------|--------|-------------|
| `operatorRank` | Variable | Progression level 0-50 |
| `operatorXP` | Variable | Lifetime XP (sum of all sessionXP) |
| `sessionXP` | Variable | XP earned in current session |
| `scraps` | Variable | Currency for upgrades - was `powerUpPoints` |
| `Upgrade` | Type | Purchasable improvement |
| `UpgradeType` | Enum | passive, active, feature |

---

## Terminology Migration Table

Quick reference for renaming:

| Old Term | New Term | Category |
|----------|----------|----------|
| `activePiece` | `activeGoop` | Goop |
| `PieceDefinition` | `GoopTemplate` | Goop |
| `PieceType` | `GoopShape` | Goop |
| `PieceState` | `GoopState` | Goop |
| `ghost` | `goopGhost` | Goop |
| `grid` | `tankGrid` | Tank |
| `GridCell` | `TankCell` | Tank |
| `BlockData` | `GoopBlock` | Goop |
| `groupId` | `goopGroupId` | Goop |
| `storedPiece` | `storedGoop` | Goop |
| `nextPiece` | `nextGoop` | Goop |
| `FallingBlock` | `LooseGoop` | Goop |
| `isGlowing` | `isSealingGoop` | Goop |
| `MOVE_BOARD` | `SPIN_TANK` | Actions |
| `ROTATE_PIECE` | `ROTATE_GOOP` | Actions |
| `SET_FAST_DROP` | `FAST_DROP_GOOP` | Actions |
| `SWAP_PIECE` | `SWAP_GOOP` | Actions |
| `BLOCK_TAP` | `POP_GOOP` | Actions |
| `prime` | `PRE_POP_GOOP` | Actions |
| `seal` | `SEAL_CRACK` | Actions |
| `boardOffset` | `tankRotation` | Tank |
| `viewport` | `tankViewport` | Tank |
| `TOTAL_WIDTH` | `TANK_WIDTH` | Constants |
| `VISIBLE_WIDTH` | `TANK_VIEWPORT_WIDTH` | Constants |
| `TOTAL_HEIGHT` | `TANK_HEIGHT` | Constants |
| `VISIBLE_HEIGHT` | `TANK_VIEWPORT_HEIGHT` | Constants |
| `pressure` | `tankPressure` | Tank |
| `zone` | `GoopSize` | Goop |
| `ComplicationType` | `TankSystem` | Systems |
| `malfunction` | `TankSystemMalfunction` | Systems |
| `laserCapacitor` | `laserCharge` | Systems |
| `primedGroups` | `prePoppedGoopGroups` | Systems |
| `lightsGraceStart` | `lightsDelay` | Systems |
| `flicker` | `LightsWarningVisual` | Systems |
| `dissipation` | `controlsHeatDecay` | Systems |
| `rank` | `operatorRank` | Progression |
| `totalScore` | `operatorXP` | Progression |
| `powerUpPoints` | `scraps` | Progression |
| `score` | `sessionXP` | Progression |
| `combo` | `popStreak` | Progression |
| `CrackCell` | `Crack` | Cracks |
| `parentIds` | `originCrackId` | Cracks |
| `childIds` | `branchCrackIds` | Cracks |
| `growthInterval` | `crackBranchInterval` | Cracks |
| `spread` | `BranchCrack` | Cracks |
| `timeLeft` | `sessionTime` | Timing |
| `INITIAL_TIME_MS` | `SESSION_DURATION` | Timing |
| `INITIAL_SPEED` | `ACTIVE_GOOP_SPEED` | Timing |
| `SOFT_DROP_FACTOR` | `FAST_DROP_MULTIPLIER` | Timing |
| `lockDelay` | `LOCKED_GOOP_DELAY` | Timing |
| `GamePhase` | `ScreenType` | Screens |
| `CONSOLE` | `ConsoleScreen` | Screens |
| `GAME_OVER` | `EndGameScreen` | Screens |

---

## Future Work

### Noted Refactors

1. **Pressure-based bonuses**: Convert time-based bonuses ("+2 seconds") to pressure-based ("pressure vented 5%") for thematic consistency.

2. **goal/GoalMark investigation**: Verify if legacy goal system code is still functional or vestigial. Remove if dead code, rename if active.

---

*Last updated: 2026-01-26*
*Version: 2.0 (comprehensive terminology overhaul)*
