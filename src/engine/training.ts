// TRAINING (F30, the lesson runner): a staged shift where a lesson decides what happens, step by step.
// A training shift starts with an empty tank, nothing in the hold and NO falling piece; pressure holds still, no cracks
// form on their own, open cracks don't wear the tank down and the machines never break — until a lesson step turns
// one of those back on (rules). The lesson also picks the next pieces (queue), brings one in (spawn), places goop and
// cracks where it wants them, and sets the pressure. Still pure and seeded: the same commands give the same shift.
import type { ShiftConfig } from './config'
import { shapeSet } from './config'
import { type Cell, type PieceDef, rotateCells, rotationCenter } from './pieces'
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
  zone: string | null // random pieces stay this size ('tetra' = 4 cells); null = they grow with play time as normal
  pressureCap: number // pressure never rises past this (0..1; 0.9 = stops at 90%)
  integrityFloor: number // integrity never drains below this (0..1; 0.2 = 20%)
  rupture: boolean // may the tank rupture at all (integrity at 0, or a piece with no room)?
  overflowRail: boolean // a piece with no room: clear the goop at the top instead of a rupture
  ruptureDrainSpeed: number // × how fast pressure drains during a rupture (0.5 = half as fast, so it lasts twice as long)
  zapColors: Color[] | null // only goop of these colours can be zapped; null = any
}

// Everything held still and off, and the tank can't break; pieces stay 4 cells, fall and follow each other; every
// control works.
export const TRAINING_START: TrainingRules = {
  pressureRise: 0,
  cracks: false,
  integrity: false,
  breakdowns: false,
  falling: true,
  autoSpawn: true,
  allow: null,
  zone: 'tetra',
  pressureCap: 1,
  integrityFloor: 0,
  rupture: false,
  overflowRail: true,
  ruptureDrainSpeed: 1,
  zapColors: null,
}

// How many rows at the top the overflow rail clears (the hidden spawn rows + this many visible ones).
export const OVERFLOW_RAIL_ROWS = 4

// A chosen piece: a shape by its name in content/tuning/shift.json (e.g. "T_I"), its colour (1 = the first colour) and
// which way up it comes in (quarter turns clockwise).
export interface PieceChoice {
  shape: string
  color: Color
  zone?: string // which size set the shape is in: 'tetra' (default), 'penta', 'hexa'
  turns?: number // 0..3 quarter turns clockwise (default 0)
}

// What a lesson can tell the engine (engine.train). Cells are TANK cells: x = column round the tank, y = row from the top.
export type TrainingCommand =
  | { type: 'rules'; rules: Partial<TrainingRules> } // change some of the rules (the rest stay as they are)
  | { type: 'queue'; pieces: PieceChoice[] } // these pieces come next, in this order (then random ones again)
  | { type: 'spawn' } // bring in the next piece now (refused while one is falling)
  | { type: 'crack'; x: number; y: number; color: Color } // a crack at this cell (refused on goop, a crack or a sealed spot)
  | { type: 'removeCrack'; x: number; y: number } // take away the crack at this cell (not sealed — just gone)
  | { type: 'goop'; cells: [x: number, y: number, color: Color][] } // put goop here (as if it had landed long ago)
  | { type: 'pressure'; value: number } // set the pressure (0..1)
  | { type: 'clear' } // empty the tank: goop, cracks, sealed spots and the falling piece (to start a step again)

// The piece a choice names, or null when the shape isn't in that size set (a typo in a lesson file).
export function pieceFromChoice(config: ShiftConfig, choice: PieceChoice): PieceDef | null {
  const set = shapeSet(config, choice.zone ?? 'tetra')
  const shape = set?.normal.find((s) => s.name === choice.shape) ?? set?.corrupted.find((s) => s.name === choice.shape)
  if (!shape || !Number.isInteger(choice.color) || choice.color < 1 || choice.color > config.colors.length) return null
  const corrupted = !set.normal.includes(shape)
  let cells = shape.cells.map(([x, y]) => [x, y] as Cell)
  // which way up: turned like the player would turn it (round its own middle), squares stay as they are
  const turns = ((Math.round(choice.turns ?? 0) % 4) + 4) % 4
  if (!shape.noRotate) for (let t = 0; t < turns; t++) cells = rotateCells(cells, 1, rotationCenter(shape.cells as Cell[]))
  return { name: shape.name, cells, color: choice.color, corrupted, noRotate: !!shape.noRotate }
}
