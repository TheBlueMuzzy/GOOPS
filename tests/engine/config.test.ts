// Ported from v1 tests/gameLogic.test.ts (getPaletteForRank) + the cracks-needed formula and junk.
import { describe, expect, it } from 'vitest'
import { cracksNeededFor, junkCount, paletteSize } from '../../src/engine/config'
import { createShift } from '../../src/engine'
import { realConfig } from './helpers'
import gooColors from '../../content/tuning/goo-colors.json'

const config = realConfig()

describe('colours by rank (v1)', () => {
  it('4 colours at ranks 0-9, purple at 10, still 5 at 20, white at 30, black at 50', () => {
    expect(paletteSize(config, 0)).toBe(4)
    expect(paletteSize(config, 9)).toBe(4)
    expect(paletteSize(config, 10)).toBe(5)
    expect(paletteSize(config, 20)).toBe(5)
    expect(paletteSize(config, 30)).toBe(6)
    expect(paletteSize(config, 50)).toBe(7)
    expect(config.colors.slice(0, 7)).toEqual(['red', 'blue', 'green', 'yellow', 'purple', 'white', 'black'])
  })
  it('F40 (Muzzy 2026-10-24): white joins at 30 as a normal colour — not at 29, and it has its own colour', () => {
    expect(config.colors[paletteSize(config, 29) - 1]).toBe('purple')
    expect(config.colors[paletteSize(config, 30) - 1]).toBe('white')
    expect(gooColors.white).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('cracks needed = colours + rank (v1)', () => {
  it('matches the formula', () => {
    expect(cracksNeededFor(config, 0)).toBe(4)
    expect(cracksNeededFor(config, 12)).toBe(17)
    expect(createShift(config, { seed: 3, rank: 5 }).state.cracksNeeded).toBe(9)
  })
})

describe('starting junk (v1)', () => {
  it('0 below rank 3, then 5 / 8 / 11 single cells on the floor', () => {
    expect([0, 2, 3, 6, 9, 40].map((r) => junkCount(config, r))).toEqual([0, 0, 5, 8, 11, 11])
    const s = createShift(config, { seed: 3, rank: 6 }).state
    const filled = [...s.grid.keys()].filter((i) => s.grid[i] !== 0)
    expect(filled).toHaveLength(8)
    expect(filled.every((i) => i >= (s.height - 1) * s.width)).toBe(true)
  })
})
