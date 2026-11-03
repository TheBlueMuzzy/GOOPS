// Ported from v1 tests/gameLogic.test.ts (getPaletteForRank) + the cracks-needed formula and junk.
import { describe, expect, it } from 'vitest'
import { cracksNeededFor, junkCount, paletteSize } from '../../src/engine/config'
import { createShift } from '../../src/engine'
import { realConfig } from './helpers'
import { ladderFile, maxRank, rankOf } from '../../src/progress/ladder'
import gooColors from '../../content/tuning/goo-colors.json'

const config = realConfig()
// the colour and junk beats (F79: asked, never restated)
const FIFTH = rankOf('fifthColour'), SIXTH = rankOf('sixthColour'), SEVENTH = rankOf('seventhColour')

describe('colours by rank (v1)', () => {
  it('4 colours from rank 0, purple at fifthColour, still 5 just below sixthColour (white), black at seventhColour', () => {
    expect(paletteSize(config, 0)).toBe(4)
    expect(paletteSize(config, FIFTH - 1)).toBe(4)
    expect(paletteSize(config, FIFTH)).toBe(5)
    expect(paletteSize(config, SIXTH - 1)).toBe(5)
    expect(paletteSize(config, SIXTH)).toBe(6)
    expect(paletteSize(config, SEVENTH)).toBe(7)
    expect(config.colors.slice(0, 7)).toEqual(['red', 'blue', 'green', 'yellow', 'purple', 'white', 'black'])
  })
  it('F40 (Muzzy 2026-10-24): white joins at sixthColour as a normal colour — not the rank below, and it has its own colour', () => {
    expect(config.colors[paletteSize(config, SIXTH - 1) - 1]).toBe('purple')
    expect(config.colors[paletteSize(config, SIXTH) - 1]).toBe('white')
    expect(gooColors.white).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('cracks needed (the quota)', () => {
  it('matches the formula with shift.json quota', () => {
    const q = config.quota
    const add = (rank: number) => (q.addByBeat ?? []).filter((s) => rank >= rankOf(s.beat)).at(-1)?.count ?? 0
    const want = (rank: number) => Math.max(1, Math.round(q.base + q.perColour * paletteSize(config, rank) + q.perRank * rank + add(rank)))
    // (at every beat's rank, the one past it and the top)
    const ranks = [...new Set(Object.values(ladderFile.beats).flatMap((r) => [r, r + 1])), maxRank()].filter((r) => r <= maxRank())
    for (const r of ranks) expect(cracksNeededFor(config, r), `rank ${r}`).toBe(want(r))
    const shopRank = rankOf('upgradesShop')
    expect(createShift(config, { seed: 3, rank: shopRank }).state.cracksNeeded).toBe(want(shopRank))
  })
  it('follows shift.json quota (F52): base + perColour × colours + perRank × rank, rounded, at least 1', () => {
    const withQuota = (quota: typeof config.quota) => ({ ...config, quota })
    expect(cracksNeededFor(withQuota({ base: 2, perColour: 1, perRank: 0.3 }), FIFTH)).toBe(Math.round(2 + 5 + 0.3 * FIFTH)) // 2 + 5 colours + 0.3 × rank
    expect(cracksNeededFor(withQuota({ base: 0, perColour: 0, perRank: 0 }), maxRank())).toBe(1)
  })
  it('addByBeat (F52): a band of ranks asks for more or fewer, from its rank on', () => {
    const q = { base: 1, perColour: 1, perRank: 0, addByBeat: [{ beat: 'firstDay', count: 0 }, { beat: 'cracksGrow', count: -4 }, { beat: 'quotaEaseEnds', count: 2 }] }
    const at = (rank: number) => cracksNeededFor({ ...config, quota: q }, rank)
    const grow = rankOf('cracksGrow'), ends = rankOf('quotaEaseEnds'), pal = (r: number) => paletteSize(config, r)
    expect([at(grow - 1), at(grow), at(ends - 1), at(ends)]).toEqual([1 + pal(grow - 1), 1 + pal(grow) - 4, 1 + pal(ends - 1) - 4, 1 + pal(ends) + 2])
  })
})

describe('starting junk (v1)', () => {
  it('0 below junk1, then 5 / 8 / 11 single cells on the floor (junk1 / junk2 / junk3)', () => {
    const [j1, j2, j3] = [rankOf('junk1'), rankOf('junk2'), rankOf('junk3')]
    expect([0, j1 - 1, j1, j2, j3, maxRank()].map((r) => junkCount(config, r))).toEqual([0, 0, 5, 8, 11, 11])
    const s = createShift(config, { seed: 3, rank: j2 }).state
    const filled = [...s.grid.keys()].filter((i) => s.grid[i] !== 0)
    expect(filled).toHaveLength(8)
    expect(filled.every((i) => i >= (s.height - 1) * s.width)).toBe(true)
  })
})
