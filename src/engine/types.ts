// The shift engine's public contract. The engine owns the rules; screens and goo only READ this.
// Coordinates are TANK space: x = column around the cylinder (0..width-1, wraps), y = row (0 = top, grows downward).
// Rows 0..bufferRows-1 are the hidden spawn buffer above the visible tank.

import type { ActiveEffects } from './abilities'

export type Color = number // 0 = empty; 1.. = index into content/tuning/shift.json "colors"

export interface Piece {
  cells: [number, number][] // absolute tank cells (x already wrapped into 0..width-1)
  colors: Color[] // one per cell (multi-colour pieces later; today all the same)
  rotation: number // 0..3
  fall: number // 0..1: how far through the current row step the piece is (for smooth drawing)
}

export interface Group {
  id: number
  color: Color
  cells: number[] // grid indexes (y * width + x)
  fill: number // 0..1 — goop "fills" after it lands; 1 = full
  ready: boolean // full AND poppable (at or below the pressure line)
}

export interface Crack {
  id: number
  x: number
  y: number
  color: Color
  plugged: boolean // matching goop covers it (pop that goop to seal)
  drain?: number // × the integrity drain while open (the hill's high cracks drain less, unseen); unset = 1
}

// Where a crack was sealed (F36, Muzzy 2026-10-18: "no crack can ever form on a sealed spot again"). The tank view
// draws a mended scar there; id = the sealed crack's, so the scar keeps the crack's shape.
export interface SealedSpot {
  id: number
  x: number
  y: number
}

export type ShiftStatus = 'playing' | 'won' | 'lost'

// 'playing' = the normal shift. 'rupture' = the tank broke: pressure drains to 0, pieces still come, no new cracks.
export type ShiftPhase = 'playing' | 'rupture'

// What happens when a turn is blocked and a sideways kick is needed:
// 'rotateVat' = the TANK turns under the piece (the piece stays on the centre line);
// 'shuntPiece' = the piece slides over in the tank (v1).
export type WallKickMode = 'rotateVat' | 'shuntPiece'

export interface ShiftState {
  width: number // 30 columns around
  height: number // 24 rows incl. buffer
  bufferRows: number // 3 hidden rows on top
  visibleWidth: number // 12 columns on screen
  grid: Uint8Array // Color per cell, index y * width + x
  groupOf: Int32Array // group id per cell, -1 = empty
  groups: Map<number, Group>
  spin: number // tank rotation: the tank column at the centre of the view (integer, 0..width-1)
  piece: Piece | null
  ghost: [number, number][] // where the piece would land
  next: Color[] | null // preview of the next piece's colours (shape preview later)
  held: Color[] | null
  nextCells?: [number, number][] | null // the next piece's shape: [x, y] offsets, same order as `next` (added by F13)
  heldCells?: [number, number][] | null // the held piece's shape (added by F13)
  pressure: number // 0..1: rises over time, zaps and seals vent it; drains to 0 during a rupture
  pressureRow: number // y of the pressure line (goop at or below it can pop)
  integrity: number // 0..1 tank integrity: open cracks drain it, each seal gives integrity.sealRefund back; 0 = rupture
  phase: ShiftPhase
  ruptureReason: 'integrity' | 'overflow' | null // why the tank broke (null until it does)
  cracks: Crack[]
  sealedCracks?: SealedSpot[] // every spot sealed this shift: no new crack forms there (F36); the engine always sets it
  cracksSealed: number
  cracksNeeded: number
  quotaMet: boolean // cracksSealed has reached cracksNeeded (seals after this are bonus)
  score: number
  status: ShiftStatus
  rank: number
  leftoverPenalty?: number // points taken off at the end for goop left in the tank (v1: 50 per cell) (added by F13)
  abilities?: AbilityState[] // equipped active abilities; the engine always sets it (empty when none) (added by F22)
  effects?: ActiveEffects // abilities' effects still running; the engine always sets it (empty when none) (added by F22)
  machines?: Record<MachineId, MachineState> // the three machines (F23); the engine always sets it
  primed?: number[] // group ids primed by a first zap while the laser is broken (F23); a second zap pops them
}

// The console's three machines (F23, GDD §5 Breakdowns). Contract shared by the engine (F23) and the console (F24).
export type MachineId = 'laser' | 'visor' | 'controls'
export interface MachineState {
  id: MachineId
  unlocked: boolean // from its unlock rank (visor 2, laser 4, controls 6); locked machines never break
  health: number // 0..1, 1 = fine. Laser = capacitor charge, visor = signal, controls = 1 − heat
  broken: boolean // reached its threshold; stays broken until repaired at the console
  cooldownMs: number // after a repair it can't break again until this runs out (0 = can break)
  brokenMs: number // how long it has been broken (rules time; stands still at the console) — the visor glitch builds up over it
}

// An equipped active ability (F22). It charges 0 → 1 during play; at 1 it's ready to fire.
export interface AbilityState {
  id: string // the upgrade id
  effect: string // what it does when fired (abilities.ts)
  charge: number // 0..1
  ready: boolean // charge is full: act({ type: 'ability', id }) fires it
}

// Everything that happens, in order, for the goo and the screens to react to.
export type ShiftEvent =
  | { type: 'spawn' }
  | { type: 'move'; dx: number } // piece moved sideways in tank space (rare: the tank spins instead)
  | { type: 'spin'; dx: number } // the tank turned by dx columns (+1 = the tank moved left under the piece)
  | { type: 'rotate'; dir: 1 | -1 }
  | { type: 'step' } // piece moved down one row
  | { type: 'drop'; rows: number } // no longer sent (hard drop was removed); kept so the renderers' handlers compile
  | { type: 'lock'; cells: number[]; color: Color } // piece became part of the grid (grid indexes)
  | { type: 'merge'; groupId: number } // a group grew by joining others
  | { type: 'ready'; groupId: number } // a group finished filling and can pop
  | { type: 'pop'; cells: number[]; color: Color; sealed: number[] } // popped cells (sealed = crack ids sealed by it)
  | { type: 'fall'; moves: [from: number, to: number][] } // unsupported goop fell (grid indexes)
  | { type: 'crack'; crack: Crack } // a new crack appeared
  | { type: 'plug'; crackId: number; plugged: boolean }
  | { type: 'quotaMet' } // the last needed crack was sealed (once per shift); play goes on
  | { type: 'rupture'; reason: 'integrity' | 'overflow' } // the tank broke: integrity hit 0, or a piece had no room
  | { type: 'end'; status: ShiftStatus }
  | { type: 'hold' } // the falling piece was swapped with the held one (added by F13)
  | { type: 'reject'; action: ShiftAction['type']; reason?: RejectReason; cell?: number } // an action couldn't happen (v1 played a "nope" sound) (added by F13); cell = the goop cell a refused zap poked (y * width + x — the goo jiggles there)
  | { type: 'abilityReady'; id: string } // an ability's charge just became full (F22)
  | { type: 'ability'; id: string } // an ability was fired (F22)
  | { type: 'abilityEnd'; id: string } // a fired ability's lasting effect ran out (F22)
  | { type: 'breakdown'; machine: MachineId } // a machine broke (F23)
  | { type: 'repaired'; machine: MachineId } // its repair was finished at the console (F23)
  | { type: 'prime'; groupId: number } // broken laser: a first zap primed this group; zap it again to pop (F23)

// Why a zap on goop was refused (F26), so the screen can say it: 'aboveLine' = the group reaches above the pressure line
// (it can't pop until pressure rises or it's lowered), 'filling' = it's below the line but hasn't finished filling.
// Only pops on goop get a reason; other rejects (an empty cell, a blocked turn…) have none.
export type RejectReason = 'aboveLine' | 'filling'

export type ShiftAction =
  | { type: 'spin'; dir: 1 | -1 } // turn the tank one column
  | { type: 'rotate'; dir: 1 | -1 }
  | { type: 'softDrop'; on: boolean } // hold to fall fast
  | { type: 'hold' } // swap with the held piece
  | { type: 'pop'; x: number; y: number } // tap a cell (tank space)
  | { type: 'ability'; id: string } // fire an equipped, ready ability (F22)
  | { type: 'repair'; machine: MachineId } // the console's repair puzzle for this machine was solved (F23/F24)
  | { type: 'console'; on: boolean } // the player went to the console mid-shift (on) / back to the tank (off): the machines' break-progress pauses

export interface ShiftEngine {
  readonly state: ShiftState
  act(action: ShiftAction): void
  tick(ms: number): void // advance time; the screen calls this every frame with the real frame time
  takeEvents(): ShiftEvent[] // events since the last call, oldest first
  setWallKick(mode: WallKickMode): void // switch how blocked turns kick (allowed mid-shift)
  // The Dev Kit's Snapshots (src/engine/snapshot.ts): this exact moment as plain JSON, and putting one back.
  // restore() needs an engine made with the snapshot's own options (restoreShift does both).
  snapshot(): import('./snapshot').ShiftSnapshot
  restore(snapshot: import('./snapshot').ShiftSnapshot): void
}
