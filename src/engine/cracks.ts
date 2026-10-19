// The pressure line and cracks: where they appear, how often, and plugging.
import type { Color, Crack, ShiftEvent, ShiftState } from './types'
import type { ShiftConfig } from './config'
import type { Rng } from './rng'

// v1's pop line: goop whose TOP row is at or below this (fractional) row can pop.
// Pressure 0 → the floor row; pressure 1 → the top visible row.
export function popLine(state: ShiftState): number {
  const visibleRows = state.height - state.bufferRows
  return state.height - 1 - state.pressure * (visibleRows - 1)
}

// The highest whole row that can pop right now (the pop line rounded DOWN the tank).
// The tiny epsilon stops float noise turning an exact row into the next one down.
export function firstPoppableRow(state: ShiftState): number {
  return Math.ceil(popLine(state) - 1e-9)
}

// Time between cracks: everyMsAtEmpty at 0% pressure, straight down to everyMsAtFull at 100%.
export function crackEveryMs(config: ShiftConfig, pressure: number): number {
  const { everyMsAtEmpty, everyMsAtFull } = config.cracks
  return everyMsAtEmpty + (everyMsAtFull - everyMsAtEmpty) * pressure
}

// ---------------------------------------------------------------- the crack band (Muzzy, F27, 2026-10-18)
// In this block rows are counted FROM THE FLOOR UP (the floor row = 0), the way Muzzy describes them.
// The engine's grid counts y from the top down, so: row from the floor = height - 1 - y.

// The highest goop cell, as a row from the floor. Leave out `x` for the whole tank (all columns), or give a column.
// No goop at all → 0 (the floor).
export function goopTopRow(state: ShiftState, x?: number): number {
  for (let y = 0; y < state.height; y++) {
    if (x === undefined) {
      for (let col = 0; col < state.width; col++) if (state.grid[y * state.width + col] !== 0) return state.height - 1 - y
    } else if (state.grid[y * state.width + x] !== 0) return state.height - 1 - y
  }
  return 0
}

// Muzzy's rule: cracks may form from the floor up to row X, halfway between the top of the goop and the pop line,
// rounded down. His example: goop top 12, line 16 → 16 − 12 = 4, 4 / 2 = 2, 12 + 2 = 14.
// Goop at or above the line → X = the line (the old rule).
export function crackBandTop(goopTop: number, lineRow: number): number {
  if (goopTop >= lineRow) return lineRow
  return goopTop + Math.floor((lineRow - goopTop) / 2)
}

// For each column: the highest grid y (top-down) a crack may form at, using config.cracks.band (read live).
function firstCrackRows(state: ShiftState, config: ShiftConfig): number[] {
  const lineY = firstPoppableRow(state)
  const lineRow = state.height - 1 - lineY
  const band = config.cracks.band
  const tankTop = band === 'halfway' ? crackBandTop(goopTopRow(state), lineRow) : lineRow
  const rows: number[] = []
  for (let x = 0; x < state.width; x++) {
    const top = band === 'halfwayPerColumn' ? crackBandTop(goopTopRow(state, x), lineRow) : tankTop
    rows.push(state.height - 1 - top)
  }
  return rows
}

// One new crack where it can be sealed right now: an empty cell (no goop, no crack) at or below the pop line —
// and, with a crack band on, no higher than the band (see above).
// `lowRows` (the low-cracks ability, F22): only in the bottom lowRows rows instead, pop line or not (v1 Crack Down).
// Returns null if there is nowhere to put it (or, with onePerColour, every colour already has an open crack).
export function spawnCrack(state: ShiftState, rng: Rng, config: ShiftConfig, colorCount: number, id: number, lowRows?: number): Crack | null {
  const colors: Color[] = []
  for (let c = 1; c <= colorCount; c++) {
    if (config.cracks.onePerColour && state.cracks.some((k) => k.color === c)) continue
    colors.push(c)
  }
  if (colors.length === 0) return null

  const cracked = new Set(state.cracks.map((c) => c.y * state.width + c.x))
  const spots: number[] = []
  const lowTop = lowRows ? Math.max(state.bufferRows, state.height - lowRows) : 0
  const firstRow = lowRows ? Array<number>(state.width).fill(lowTop) : firstCrackRows(state, config)
  // Spots are listed row by row, top to bottom (the same order as before the band, so 'none' picks the same cells).
  for (let y = Math.min(...firstRow); y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = y * state.width + x
      if (y >= firstRow[x] && state.grid[i] === 0 && !cracked.has(i)) spots.push(i)
    }
  }
  if (spots.length === 0) return null

  const color = rng.pick(colors)
  const spot = rng.pick(spots)
  return { id, x: spot % state.width, y: Math.floor(spot / state.width), color, plugged: false }
}

// A crack is plugged while goop of its own colour sits on it. Wrong-colour goop just covers it.
export function updatePlugs(state: ShiftState, events: ShiftEvent[]): void {
  for (const crack of state.cracks) {
    const plugged = state.grid[crack.y * state.width + crack.x] === crack.color
    if (plugged !== crack.plugged) {
      crack.plugged = plugged
      events.push({ type: 'plug', crackId: crack.id, plugged })
    }
  }
}
