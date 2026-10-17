// Shared test helpers: configs and hand-made tanks.
import shiftJson from '../../content/tuning/shift.json'
import type { ShiftConfig } from '../../src/engine/config'
import type { ShiftEvent } from '../../src/engine/types'

export function realConfig(): ShiftConfig {
  return structuredClone(shiftJson) as ShiftConfig
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
