// The pressure line and cracks: where they appear, plugging, the win burst.
import type { Color, Crack, ShiftEvent, ShiftState } from './types'
import type { Rng } from './rng'

// v1's pop line: goop whose TOP row is at or below this (fractional) row can pop.
// Pressure 0 → the floor row; pressure 1 → the top visible row.
export function popLine(state: ShiftState): number {
  const visibleRows = state.height - state.bufferRows
  return state.height - 1 - state.pressure * (visibleRows - 1)
}

// v1 spawns cracks on the row the pressure "water" has reached (rounded up the tank, so it can sit
// one row above the pop line while the line is between rows).
export function crackRow(state: ShiftState): number {
  const row = Math.floor(popLine(state))
  return Math.max(state.bufferRows, Math.min(state.height - 1, row))
}

function isFree(state: ShiftState, x: number, y: number, extra: Crack[] = []): boolean {
  const taken = (c: Crack) => c.x === x && c.y === y
  return state.grid[y * state.width + x] === 0 && !state.cracks.some(taken) && !extra.some(taken)
}

// One new crack on the pressure row, in a colour that has no crack yet (v1: one crack per colour).
// v1 tries 20 random columns and gives up until next time if they are all taken.
export function spawnCrack(state: ShiftState, rng: Rng, colorCount: number, tries: number, id: number): Crack | null {
  const free: Color[] = []
  for (let c = 1; c <= colorCount; c++) if (!state.cracks.some((k) => k.color === c)) free.push(c)
  if (free.length === 0) return null
  const color = rng.pick(free)
  const y = crackRow(state)
  for (let t = 0; t < tries; t++) {
    const x = rng.int(state.width)
    if (isFree(state, x, y)) return { id, x, y, color, plugged: false }
  }
  return null
}

// Win burst (v1): after the goal is met, every seal spawns one crack of every colour somewhere ABOVE the
// pressure line, so there's bonus work for the rest of the shift.
export function burstCracks(state: ShiftState, rng: Rng, colorCount: number, tries: number, nextId: () => number): Crack[] {
  const top = state.bufferRows
  const bottom = Math.max(top, crackRow(state) - 1)
  const made: Crack[] = []
  for (let color = 1; color <= colorCount; color++) {
    for (let t = 0; t < tries; t++) {
      const x = rng.int(state.width)
      const y = top + rng.int(bottom - top + 1)
      if (isFree(state, x, y, made)) {
        made.push({ id: nextId(), x, y, color, plugged: false })
        break
      }
    }
  }
  return made
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
