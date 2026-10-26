// Active abilities (F22): charge up during the shift, fire with act({ type: 'ability', id }).
// Each ability names an EFFECT. An effect's fire function starts it and says whether it could;
// a lasting effect keeps its state in ShiftState.effects, and the engine reads it at the exact spot it changes.
import type { Color, MachineId, MachineState, ShiftPhase } from './types'

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
  // F42 Goop Dump: single cells of `color` rain in, one every cellMs; `cellsLeft` more in this wave, then waveMs of quiet
  // before the next (`wavesLeft` counts this one). waitMs = time until the next cell (the engine counts it down).
  dump?: { id: string; color: Color; wavesLeft: number; cellsLeft: number; cellsPerWave: number; cellMs: number; waveMs: number; waitMs: number }
  // F42 Goop Colorizer: the next `left` pieces to come into the next window take `color`
  colorize?: { id: string; color: Color; left: number }
}

// Start an effect. Returns false if it can't do anything right now (the charge is then kept).
// It gets the parts of the shift an effect may change (F34: the machines too — the engine's own state objects, so an
// effect changes them in place; still pure: no time, no randomness, only the numbers it's given).
export interface FireTarget {
  phase: ShiftPhase
  // F42: the falling piece's colour (a two-colour piece: its main colour — pieces.ts mainColor); null = no falling
  // piece, or a wild one (it has no colour of its own to copy)
  pieceColor: Color | null
  effects: ActiveEffects
  machines: Record<MachineId, MachineState>
}
type FireEffect = (shift: FireTarget, params: Record<string, number>, id: string) => boolean

export const ABILITY_EFFECTS: Record<string, FireEffect> = {
  // F34 Cooldown Booster (v1): every machine whose calm time is running (the cooldown after a repair, when it can't
  // break) gets boost × what's left of it on top — +25 / 35 / 50 %. Nothing running (or a rupture: the machines are
  // frozen then) → refused, and the charge is kept for when it helps.
  boostCooldowns: (shift, params) => {
    if (shift.phase !== 'playing') return false
    const boost = Number(params.boost)
    if (!(Number.isFinite(boost) && boost > 0)) return false // a number missing from upgrades.json: nothing to do
    const running = Object.values(shift.machines).filter((m) => m.unlocked && m.cooldownMs > 0)
    if (!running.length) return false
    for (const m of running) m.cooldownMs += m.cooldownMs * boost
    return true
  },
  // Next N cracks form low in the tank (v1 Crack Down: bottom 4 rows). No new cracks during a rupture, so not then.
  lowCracks: (shift, params, id) => {
    if (shift.phase !== 'playing') return false
    const left = Math.floor(params.cracks)
    const rows = Math.floor(params.rows)
    if (!(left >= 1 && rows >= 1)) return false // numbers missing from upgrades.json: nothing to do
    shift.effects.lowCracks = { id, left, rows }
    return true
  },
  // F42 Goop Dump (v1): waves of single cells in the falling piece's colour rain into random columns (the engine drops
  // them on the rules clock, seeded — shift.ts stepDump). Refused with no colour to copy, during a rupture (the goop
  // would only block the next piece), or while the last dump is still raining (the charge waits for it).
  goopDump: (shift, params, id) => {
    if (shift.phase !== 'playing' || shift.pieceColor === null || shift.effects.dump) return false
    const waves = Math.floor(params.waves)
    const cellsPerWave = Math.floor(params.cellsPerWave)
    const cellMs = Number(params.cellMs)
    const waveMs = Number(params.waveMs)
    // numbers missing from upgrades.json: nothing to do
    if (!(waves >= 1 && cellsPerWave >= 1 && cellMs >= 0 && waveMs >= 0)) return false
    shift.effects.dump = { id, color: shift.pieceColor, wavesLeft: waves, cellsLeft: cellsPerWave, cellsPerWave, cellMs, waveMs, waitMs: 0 }
    return true
  },
  // F42 Goop Colorizer (v1): the next N pieces take the falling piece's colour, starting with the one already in the
  // next window (the engine recolours it at once, so the window shows it — shift.ts colorizeNext). Firing again starts
  // the count again in the new colour. Refused with no falling piece (or a wild one): no colour to copy.
  colorize: (shift, params, id) => {
    if (shift.pieceColor === null) return false
    const left = Math.floor(params.pieces)
    if (!(left >= 1)) return false // a number missing from upgrades.json: nothing to do
    shift.effects.colorize = { id, color: shift.pieceColor, left }
    return true
  },
}
