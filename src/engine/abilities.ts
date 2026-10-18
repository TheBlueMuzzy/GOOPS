// Active abilities (F22): charge up during the shift, fire with act({ type: 'ability', id }).
// Each ability names an EFFECT. An effect's fire function starts it and says whether it could;
// a lasting effect keeps its state in ShiftState.effects, and the engine reads it at the exact spot it changes.
import type { ShiftPhase } from './types'

// One equipped ability, as resolveUpgrades() works it out from upgrades.json.
export interface AbilitySpec {
  id: string // the upgrade id
  effect: string // a key of ABILITY_EFFECTS
  chargePerSecond: number // charge gained per second while the shift is playing (1 = full)
  chargePerSeal: number // charge gained per crack sealed
  params: Record<string, number> // the effect's numbers at the owned level
}

// Effects that last after firing. One entry per kind; firing again restarts it.
export interface ActiveEffects {
  lowCracks?: { id: string; left: number; rows: number } // the next `left` cracks form in the bottom `rows` rows
}

// Start an effect. Returns false if it can't do anything right now (the charge is then kept).
type FireEffect = (shift: { phase: ShiftPhase; effects: ActiveEffects }, params: Record<string, number>, id: string) => boolean

export const ABILITY_EFFECTS: Record<string, FireEffect> = {
  // Next N cracks form low in the tank (v1 Crack Down: bottom 4 rows). No new cracks during a rupture, so not then.
  lowCracks: (shift, params, id) => {
    if (shift.phase !== 'playing') return false
    const left = Math.floor(params.cracks)
    const rows = Math.floor(params.rows)
    if (!(left >= 1 && rows >= 1)) return false // numbers missing from upgrades.json: nothing to do
    shift.effects.lowCracks = { id, left, rows }
    return true
  },
}
