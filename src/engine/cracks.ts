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

// One new crack where it can be sealed right now: an empty cell (no goop, no crack) at or below the pop line.
// Returns null if there is nowhere to put it (or, with onePerColour, every colour already has an open crack).
export function spawnCrack(state: ShiftState, rng: Rng, config: ShiftConfig, colorCount: number, id: number): Crack | null {
  const colors: Color[] = []
  for (let c = 1; c <= colorCount; c++) {
    if (config.cracks.onePerColour && state.cracks.some((k) => k.color === c)) continue
    colors.push(c)
  }
  if (colors.length === 0) return null

  const cracked = new Set(state.cracks.map((c) => c.y * state.width + c.x))
  const spots: number[] = []
  for (let y = firstPoppableRow(state); y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const i = y * state.width + x
      if (state.grid[i] === 0 && !cracked.has(i)) spots.push(i)
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
