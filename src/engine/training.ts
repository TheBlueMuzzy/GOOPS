// TRAINING (F30, the lesson runner): a staged shift where a lesson decides what happens, step by step.
// A training shift starts with an empty tank, nothing in the hold and NO falling piece; pressure holds still, no cracks
// form on their own, open cracks don't wear the tank down and the machines never break — until a lesson step turns
// one of those back on (rules). The lesson also picks the next pieces (queue), brings one in (spawn), places goop and
// cracks where it wants them, and sets the pressure. Still pure and seeded: the same commands give the same shift.
import type { ShiftConfig } from './config'
import { shapeSet } from './config'
import type { Cell, PieceDef } from './pieces'
import type { Color, ShiftAction } from './types'

// What a lesson can switch on and off while a training shift runs.
export interface TrainingRules {
  pressureRise: number // × the normal pressure rise: 0 = held still, 1 = normal, 2.5 = fast
  cracks: boolean // new cracks form on their own (as in a normal shift)
  integrity: boolean // open cracks wear the tank's integrity down (off = it can't rupture from cracks)
  breakdowns: boolean // the machines wear down and break
  falling: boolean // the piece falls on its own (off = it hangs where it is until this is on again)
  autoSpawn: boolean // a new piece comes when one lands (off = only when the lesson says 'spawn')
  allow: ShiftAction['type'][] | null // the player actions that work right now; null = all of them
}

// Everything held still and off; pieces fall and follow each other; every control works.
export const TRAINING_START: TrainingRules = {
  pressureRise: 0,
  cracks: false,
  integrity: false,
  breakdowns: false,
  falling: true,
  autoSpawn: true,
  allow: null,
}

// A chosen piece: a shape by its name in content/tuning/shift.json (e.g. "T_I"), and its colour (1 = the first colour).
export interface PieceChoice {
  shape: string
  color: Color
  zone?: string // which size set the shape is in: 'tetra' (default), 'penta', 'hexa'
}

// What a lesson can tell the engine (engine.train). Cells are TANK cells: x = column round the tank, y = row from the top.
export type TrainingCommand =
  | { type: 'rules'; rules: Partial<TrainingRules> } // change some of the rules (the rest stay as they are)
  | { type: 'queue'; pieces: PieceChoice[] } // these pieces come next, in this order (then random ones again)
  | { type: 'spawn' } // bring in the next piece now (refused while one is falling)
  | { type: 'crack'; x: number; y: number; color: Color } // a crack at this cell (refused on goop or another crack)
  | { type: 'goop'; cells: [x: number, y: number, color: Color][] } // put goop here (as if it had landed long ago)
  | { type: 'pressure'; value: number } // set the pressure (0..1)
  | { type: 'clear' } // empty the tank: goop, cracks, sealed spots and the falling piece (to start a step again)

// The piece a choice names, or null when the shape isn't in that size set (a typo in a lesson file).
export function pieceFromChoice(config: ShiftConfig, choice: PieceChoice): PieceDef | null {
  const set = shapeSet(config, choice.zone ?? 'tetra')
  const shape = set?.normal.find((s) => s.name === choice.shape) ?? set?.corrupted.find((s) => s.name === choice.shape)
  if (!shape || !Number.isInteger(choice.color) || choice.color < 1 || choice.color > config.colors.length) return null
  const corrupted = !set.normal.includes(shape)
  return { name: shape.name, cells: shape.cells.map(([x, y]) => [x, y] as Cell), color: choice.color, corrupted, noRotate: !!shape.noRotate }
}
