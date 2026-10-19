// Shared test helpers: configs and hand-made tanks.
import { expect } from 'vitest'
import shiftJson from '../../content/tuning/shift.json'
import type { ShiftConfig } from '../../src/engine/config'
import type { ShiftEngine, ShiftEvent } from '../../src/engine/types'

export function realConfig(): ShiftConfig {
  return structuredClone(shiftJson) as ShiftConfig
}

// Mechanic tests set the crack timing they need instead of leaning on the live tuning file:
// v1's straight line, everyMsAtEmpty at 0% pressure down to everyMsAtFull at 100% (no `curve`).
export function straightLineCracks(config: ShiftConfig, atEmpty = 5000, atFull = 1000): ShiftConfig {
  config.cracks.everyMsAtEmpty = atEmpty
  config.cracks.everyMsAtFull = atFull
  delete config.cracks.curve
  return config
}

// Every piece is this one shape, colour 1, never corrupted or mirrored. Pieces fall very slowly
// unless msPerRow is given, so they stay out of the way at the top.
export function oneShapeConfig(cells: number[][], options: { msPerRow?: number; noRotate?: boolean } = {}): ShiftConfig {
  const config = realConfig()
  const shape = { name: 'TEST', cells, noRotate: options.noRotate }
  config.pieces.zones = ['only']
  config.pieces.only = { normal: [shape], corrupted: [shape] }
  config.pieces.corruptChance = 0
  config.pieces.mirrorChance = 0
  config.colorsByRank = [{ rank: 0, count: 1 }]
  config.fall.msPerRow = options.msPerRow ?? 1e9
  return config
}

// Build a 30×24 grid from text rows that sit at the BOTTOM of the tank, starting at column `left`.
// '.' = empty, '1'..'7' = colour.
export function tank(rows: string[], left = 0, width = 30, height = 24): Uint8Array {
  const grid = new Uint8Array(width * height)
  rows.forEach((row, r) => {
    const y = height - rows.length + r
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '.') grid[y * width + ((left + c) % width)] = Number(row[c])
    }
  })
  return grid
}

export function ofType<T extends ShiftEvent['type']>(events: ShiftEvent[], type: T): Extract<ShiftEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<ShiftEvent, { type: T }>[]
}

export const idx = (x: number, y: number, width = 30) => y * width + x

// Drop the falling piece straight down and let it lock (Goops has no hard drop, so tests fast-forward a fall).
// The engine reads its config every step, so for the drop we briefly make the fall near-instant, then restore it.
// Returns the events from the drop (incl. the lock and the next spawn).
export function dropPiece(shift: ShiftEngine, config: ShiftConfig): ShiftEvent[] {
  const msPerRow = config.fall.msPerRow
  config.fall.msPerRow = 1
  shift.act({ type: 'softDrop', on: true })
  const events: ShiftEvent[] = []
  for (let t = 0; t < 5000 && !events.some((e) => e.type === 'lock'); t++) {
    shift.tick(1)
    events.push(...shift.takeEvents())
  }
  config.fall.msPerRow = msPerRow
  return events
}

// Tick in small steps until `done` or the time runs out.
export function tickUntil(shift: ShiftEngine, done: () => boolean, maxMs = 60000, stepMs = 10): void {
  for (let t = 0; t < maxMs && !done(); t += stepMs) shift.tick(stepMs)
}

// Wait for a crack sitting right on top of goop (so a dropped piece lands on it), plug it, wait, pop it.
export function sealACrack(shift: ShiftEngine, config: ShiftConfig): ShiftEvent[] {
  const s = shift.state
  const onGoop = () => s.cracks.find((c) => c.y === s.height - 1 || s.grid[(c.y + 1) * s.width + c.x] !== 0)
  tickUntil(shift, () => !!onGoop())
  const crack = onGoop()!
  while (s.spin !== crack.x) shift.act({ type: 'spin', dir: 1 })
  const events = [...shift.takeEvents(), ...dropPiece(shift, config)]
  expect(s.cracks.find((c) => c.id === crack.id)!.plugged).toBe(true)
  tickUntil(shift, () => !!s.groups.get(s.groupOf[idx(crack.x, crack.y)])?.ready)
  shift.act({ type: 'pop', x: crack.x, y: crack.y })
  events.push(...shift.takeEvents())
  expect(ofType(events, 'pop').at(-1)!.sealed).toEqual([crack.id])
  return events
}
