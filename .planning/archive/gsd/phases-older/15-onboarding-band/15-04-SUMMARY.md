# Summary: Auto-Popper + Cooldown Booster Active

## What Changed

### AUTO_POPPER End-Game Mechanic
In `core/GameEngine.ts:finalizeGame()`, added probabilistic auto-pop logic that runs before end-game penalty calculation. Each remaining goop unit has a chance to auto-pop based on upgrade level:
- Base decay: 20% (keeps 80% penalty)
- Per level: -4% decay
- Level 4: Only 4% decay (keeps 96% penalty-free)

### COOLDOWN_BOOSTER Effect Function
In `core/ComplicationManager.ts`, added `extendAllCooldowns(state, extensionPercent)` that extends all active complication cooldowns by the specified percentage (25% per activation).

### Active Ability System
Full implementation of the active ability infrastructure:

**UI Components:**
- `components/UpgradePanel.tsx`: Added "Active Abilities" section with equip checkbox
- `components/ActiveAbilityCircle.tsx`: New component showing charge progress circles

**Charging System:**
- Passive: 1% per second (100 seconds to full charge)
- Crack-goop seal: +10% jump per sealed crack-goop
- Visual: Grey circle fills with color, glows when ready

**Activation:**
- Tap circle when fully charged (100%)
- Triggers `ActivateAbilityCommand` which calls upgrade-specific effect
- COOLDOWN_BOOSTER: Extends all complication cooldowns by 25%

**Data Flow:**
- `App.tsx`: Manages `equippedActives` state via `handleToggleEquip`
- `Game.tsx`: Passes equipped actives to engine and components
- `GameEngine.ts`: Tracks `activeCharges` and processes charging/activation

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| e2ffe74 | feat | Implement AUTO_POPPER end-game mechanic |
| bb0b3e2 | feat | Add COOLDOWN_BOOSTER effect function |
| 07b0255 | feat | Add active ability equip UI |
| 39de2f3 | feat | Implement active ability UI and charging system |

## Decision Made

**Checkpoint: Active Ability UI** → Selected `minimal-ui`

User specified requirements:
1. Equip checkbox in UpgradePanel next to active ability upgrades
2. Circular icons on right side of screen (under controls meter)
3. Grey when charging with fill progress, full color + glow when ready
4. Fill jumps 10% when sealing crack-goop, otherwise 1%/second passive

## Phase 15 Complete

All 8 Onboarding Band upgrades implemented:

| Upgrade | Type | Effect |
|---------|------|--------|
| Circuit Stabilizer | passive | -7.5%/level trigger chance |
| Auto-Popper | passive | -4%/level end-game decay |
| Capacitor Efficiency | passive | -6.25%/level drain |
| Gear Lubrication | passive | +12.5%/level heat dissipation |
| Focus Mode | passive | -10%/level time speed |
| Dense Goop | passive | +12.5%/level fall speed |
| Pressure Control | passive | +5s/level (8 levels) |
| Cooldown Booster | active | +25% cooldown extension |

## Deviations

None — plan executed as designed with user's UI preferences applied.

## Issues Found

None.
