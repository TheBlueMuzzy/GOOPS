---
title: Game Terminology Glossary
type: reference
tags: [naming, terminology, standards]
updated: 2026-01-27
---

# Goops Official Glossary

This document establishes the authoritative terminology for Goops. Use these terms consistently in code, documentation, and discussions.

---

## Core Game Objects

### Piece

**Definition:** The active falling polyomino shape controlled by the player.

**Details:**
- Comes in three size categories: Tetra (4 cells), Penta (5 cells), Hexa (6 cells)
- Has a defined shape, position, rotation, and color(s)
- Becomes "goop" once it locks onto the grid

**In Code:** `ActivePiece`, `PieceDefinition`, `PieceType`, `nextPiece`, `activePiece`

**Correct Usage:**
- "The piece is falling toward row 10"
- "Spawn a new Penta piece"
- "The piece locked at position (5, 12)"

**Incorrect Usage:**
- "The goop is falling" (goop is settled, not falling)
- "Spawn a new block" (block is what fills a cell)

---

### Goop

**Definition:** The settled substance on the grid. What pieces become after locking.

**Details:**
- Consists of one or more connected blocks of the same color
- Forms groups that can be popped
- Used primarily in player-facing text, UI labels, and comments
- The visual "stuff" filling the tank

**In Code:** Referred to as `blocks` in data structures (see Block). Use "goop" in comments, UI text, and user-facing strings.

**Correct Usage:**
- "Goop fills the bottom half of the tank"
- "Pop the green goop to clear the crack"
- "Dense Goop upgrade makes goop fall faster"

**Incorrect Usage:**
- "The goop is rotating" (pieces rotate, goop is stationary)

---

### Cell

**Definition:** A single 1x1 grid square. A position on the tank.

**Details:**
- The grid is made of cells arranged in rows and columns
- Each cell can be empty or contain a block
- Cells have coordinates (x, y)

**In Code:** `GridCell`, `CrackCell`, `cells` (in piece definitions)

**Correct Usage:**
- "The grid has 30x19 cells"
- "This cell at (5, 10) is empty"
- "The piece occupies 5 cells"

**Incorrect Usage:**
- "This unit is at position..." (use "cell" instead)

---

### Block

**Definition:** The content of a cell. A cell can contain a block or be empty.

**Details:**
- A block has properties: color, groupId, timestamp, etc.
- Blocks belong to groups of the same color
- When a piece locks, its cells become blocks on the grid

**In Code:** `BlockData`, `FallingBlock`, `block` (content of GridCell)

**Correct Usage:**
- "The block at (3, 5) is red"
- "This group contains 6 blocks"
- "Falling blocks settle into their final positions"

**Incorrect Usage:**
- "The block is falling" (use "piece" for the active falling shape)

---

### Group

**Definition:** Contiguous connected blocks of the same color.

**Details:**
- Groups form automatically when same-color blocks touch
- Groups pop (disappear) when tapped twice
- Group size affects scoring bonuses

**In Code:** `groupId`, `groupSize`, `groupMinY`, `groupMaxY`

**Correct Usage:**
- "This green group has 8 blocks"
- "Tapping the group primes it; tapping again pops it"
- "Groups adjacent to sealed cracks glow"

---

## Grid & Positioning

### Grid

**Definition:** The 2D array of cells that makes up the tank interior.

**Details:**
- Dimensions: TOTAL_WIDTH (30) x TOTAL_HEIGHT (19)
- Visible area: VISIBLE_WIDTH (12) x VISIBLE_HEIGHT (16)
- Cylindrical wrapping: x coordinates wrap around

**In Code:** `grid: GridCell[][]` (indexed as `grid[y][x]`)

---

### Viewport

**Definition:** The visible portion of the cylindrical grid.

**Details:**
- Shows 12 columns of the 30-column grid
- Board rotates left/right to shift the viewport
- `boardOffset` tracks the current view position

---

### Pressure Line

**Definition:** The rising danger threshold from the bottom of the tank.

**Details:**
- Rises as time elapses
- Determines which piece sizes spawn (Tetra -> Penta -> Hexa)
- Game ends when pressure reaches 100%

---

## Player Actions

### Fast Drop

**Definition:** Player-triggered acceleration when holding down.

**Details:**
- Makes the piece fall faster (8x normal speed)
- Recharges the lights brightness meter
- Replaces legacy term "soft drop"

**In Code:** `SOFT_DROP_FACTOR` (legacy name, to be renamed in Phase 23), `isSoftDropping`

**Correct Usage:**
- "Fast drop to reach the bottom quickly"
- "Use fast drop to recharge lights"

**Incorrect Usage:**
- "Soft drop the piece" (legacy term, avoid)
- "Hard drop" (not implemented in this game)

---

### Rotate

**Definition:** Turning the piece 90 degrees clockwise or counter-clockwise.

**Details:**
- Builds heat (controls complication)
- 4 rotation states: 0, 90, 180, 270 degrees

---

### Lock

**Definition:** When a falling piece stops and its cells become blocks on the grid.

**Details:**
- Happens when piece can't fall further
- Triggers group recalculation
- Piece transitions from FALLING to LOCKED state

---

### Pop

**Definition:** Removing a group of same-color blocks from the grid.

**Details:**
- Requires two taps: first primes, second pops
- Awards score and time bonuses
- Drains laser capacitor

---

### Seal

**Definition:** Covering a crack with matching-color goop to remove it.

**Details:**
- Core gameplay objective
- Requires goop color to match crack color (or wild goop)
- Awards bonus time and reduces cooldowns

---

## Game Systems

### Crack

**Definition:** Damage on the tank wall that must be sealed.

**Details:**
- Spawns near the pressure line
- Grows over time if not covered by goop
- Has a color that must be matched to seal
- Tree structure: cracks can branch

**In Code:** `CrackCell`, `crackCells`, `crack-` prefixed functions

---

### Complication

**Definition:** A difficulty mechanic that adds challenge.

**Types:**
- **LASER:** Capacitor drains when popping goop; empty triggers malfunction
- **LIGHTS:** Brightness dims when not fast dropping; dark triggers malfunction
- **CONTROLS:** Heat builds on rotation; overheated triggers malfunction

**In Code:** `ComplicationType`, `Complication`, `complications`

---

### Upgrade

**Definition:** A player progression reward that modifies gameplay.

**Types:**
- **Passive:** Always active once purchased (e.g., Circuit Stabilizer)
- **Active:** Must be equipped and charged to use (e.g., Goop Dump)
- **Feature:** Unlocks new UI or mechanics (e.g., Goop Window)

**In Code:** `UPGRADES`, `UpgradeConfig`, `UpgradeType`

---

### Rank

**Definition:** Player's progression level (0-50).

**Details:**
- Earned by accumulating score across runs
- Unlocks new upgrades, colors, and complications
- XP curve: `3500 + (rank * 250)` per rank

---

### Wild

**Definition:** A special piece/goop that matches any crack color.

**Details:**
- Spawns at rank 40+ (15% chance)
- Rainbow wave visual effect
- Spreads wild property to adjacent same-color goop

**In Code:** `isWild` property on pieces and blocks

---

## Terminology Mapping

| Official Term | Replaces | Context |
|---------------|----------|---------|
| Cell | Unit | Grid positions |
| Block | (n/a) | Content of cells |
| Fast Drop | Soft Drop | Player action |
| Piece | (n/a) | Active falling shape |
| Goop | (n/a) | Settled substance (user-facing) |
| Group | (n/a) | Connected same-color blocks |

---

## Code Variable Naming Guide

| Concept | Variable Names | Examples |
|---------|---------------|----------|
| Falling shape | `piece`, `activePiece`, `nextPiece` | `const piece = state.activePiece` |
| Grid content | `block`, `blocks`, `grid` | `grid[y][x]` returns `BlockData` |
| Position | `cell`, `x`, `y`, `coordinate` | `cells: Coordinate[]` |
| Connected blocks | `group`, `groupId`, `groupSize` | `block.groupId` |
| Player action | `fastDrop` (not softDrop) | `isFastDropping` |

---

*Last updated: 2026-01-27*
*Phase: 22-audit-glossary*
