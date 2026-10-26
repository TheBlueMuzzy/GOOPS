// F43 (Sprint 20): the ranks 10–38 passives in the engine — Junk Uniformer, Crack Matcher, Sealing Bonus, Tougher Tank,
// Slow Cracks (design/upgrades-map.md). Goop Swap is the input layer's (tests/input/controls.test.ts), Quick Fix the
// console's (tests/repairs.test.ts). The two chances must take NO extra random rolls when they're off, so a shift
// without them plays exactly as before with the same seed.
import { describe, expect, it } from 'vitest'
import upgradesJson from '../../content/tuning/upgrades.json'
import { createShift, resolveUpgrades } from '../../src/engine'
import type { Modifiers, ShiftConfig, ShiftEngine, UpgradeBook } from '../../src/engine'
import { lowestOpenCrack } from '../../src/engine/cracks'
import { mainColor, withMainColor, type PieceDef } from '../../src/engine/pieces'
import { WILD, type Crack } from '../../src/engine/types'
import { dropPiece, oneShapeConfig, realConfig, sealACrack, straightLineCracks, tickUntil } from './helpers'

const book = upgradesJson as UpgradeBook
const mods = (id: string, level: number) => resolveUpgrades(book, { [id]: level }).modifiers

// ---------------------------------------------------------------- Junk Uniformer

// the junk on the floor at the start: every non-empty cell of the bottom row, left to right
function junkOf(seed: number, rank: number, modifiers?: Partial<Modifiers>) {
  const shift = createShift(realConfig(), { seed, rank, modifiers })
  const s = shift.state
  const row = [...s.grid.slice((s.height - 1) * s.width, s.height * s.width)]
  return { shift, junk: row.filter((c) => c !== 0), rng: shift.snapshot().rng, next: s.next }
}

describe('Junk Uniformer (rank 10, junkSameColorChance)', () => {
  it('off (0, or not owned): the same junk AND the same random numbers after it — the shift plays as before', () => {
    for (const seed of [1, 2, 3, 99]) {
      const plain = junkOf(seed, 9)
      const zero = junkOf(seed, 9, { junkSameColorChance: 0 })
      expect(zero.junk).toEqual(plain.junk)
      expect(zero.rng).toBe(plain.rng)
      expect(zero.next).toEqual(plain.next)
      expect(plain.junk).toHaveLength(11) // (rank 9: 11 junk cells)
    }
  })

  it('chance 1: every junk cell is the first one’s colour', () => {
    for (const seed of [1, 2, 3]) {
      const { junk } = junkOf(seed, 12, { junkSameColorChance: 1 })
      expect(junk.length).toBeGreaterThan(1)
      expect(new Set(junk).size).toBe(1)
    }
  })

  it('max level (0.4): far more of the junk shares one colour than by luck', () => {
    // (the share of the junk in its most common colour — the first cell placed is a random column, so "the first"
    // can't be read off the row; its colour is almost always the most common one with the upgrade)
    const share = (modifiers?: Partial<Modifiers>) => {
      let most = 0, total = 0
      for (let seed = 1; seed <= 300; seed++) {
        const { junk } = junkOf(seed, 12, modifiers)
        const counts = new Map<number, number>()
        for (const c of junk) counts.set(c, (counts.get(c) ?? 0) + 1)
        most += Math.max(...counts.values())
        total += junk.length
      }
      return most / total
    }
    const without = share(), max = share(mods('junkUniformer', 4))
    // 11 cells, 5 colours: by luck the biggest colour has ~1/3 of them; with 0.4 a cell copying the first, over half
    expect(without).toBeLessThan(0.42)
    expect(max).toBeGreaterThan(0.5)
    expect(max - without).toBeGreaterThan(0.15)
  })
})

// ---------------------------------------------------------------- Crack Matcher

// a shift where cracks come often and never wear the tank (so it keeps going), at a rank with 5 colours
function crackyShift(seed: number, modifiers?: Partial<Modifiers>, config: ShiftConfig = straightLineCracks(realConfig(), 1500, 800)) {
  config.integrity.drainPerCrackPerSec = 0
  return { shift: createShift(config, { seed, rank: 12, modifiers }), config }
}
const nextColors = (shift: ShiftEngine) => [...new Set(shift.state.next ?? [])]

describe('Crack Matcher (rank 32, crackColorBias)', () => {
  it('chance 1: every new next piece comes in the lowest open crack’s colour (the next window shows it)', () => {
    const { shift, config } = crackyShift(4, { crackColorBias: 1 })
    const s = shift.state
    tickUntil(shift, () => !!lowestOpenCrack(s.cracks))
    let checked = 0
    for (let i = 0; i < 12 && s.status === 'playing'; i++) {
      const crack = lowestOpenCrack(s.cracks)
      dropPiece(shift, config) // (the next piece is made as the next one comes in, after this one locks)
      if (!crack) continue
      const target = lowestOpenCrack(s.cracks) // (what it was when the new next piece was made)
      if (!target) continue
      expect(nextColors(shift), `drop ${i}`).toEqual([target.color])
      checked++
    }
    expect(checked).toBeGreaterThan(5)
  })

  it('max level is chance 1 (0.25 a level, v1); a half chance matches about 0.5 + 0.5 × 1/5 of new pieces', () => {
    expect(mods('crackMatcher', 4).crackColorBias).toBe(1)
    const share = (bias: number) => {
      let match = 0, total = 0
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const { shift, config } = crackyShift(seed, { crackColorBias: bias })
        const s = shift.state
        tickUntil(shift, () => !!lowestOpenCrack(s.cracks))
        for (let i = 0; i < 25 && s.status === 'playing'; i++) {
          dropPiece(shift, config)
          const target = lowestOpenCrack(s.cracks)
          if (!target) continue
          total++
          if (nextColors(shift).length === 1 && nextColors(shift)[0] === target.color) match++
        }
      }
      return match / total
    }
    expect(share(0)).toBeLessThan(0.35)
    expect(share(0.5)).toBeGreaterThan(0.45)
    expect(share(0.5)).toBeLessThan(0.78)
  }, 30000)

  it('off, or on with no open crack: no extra rolls — the same pieces and the same random numbers as without it', () => {
    // (off: covered for whole shifts by upgrades.test.ts "no upgrades = the shift plays exactly as before")
    const calm = straightLineCracks(realConfig(), 1e9, 1e9) // (no crack ever forms)
    const plain = crackyShift(7, undefined, structuredClone(calm))
    const on = crackyShift(7, { crackColorBias: 1 }, structuredClone(calm))
    for (let i = 0; i < 8; i++) {
      dropPiece(plain.shift, plain.config)
      dropPiece(on.shift, on.config)
      expect(on.shift.state.next).toEqual(plain.shift.state.next)
    }
    expect(on.shift.snapshot().rng).toBe(plain.shift.snapshot().rng)
  })

  it('lowestOpenCrack: the lowest one not yet plugged (a grown crack by its lowest cell); same height → the older one', () => {
    const crack = (id: number, y: number, plugged = false, cells?: [number, number][]): Crack => ({ id, x: 0, y, color: id, plugged, ...(cells ? { cells } : {}) })
    expect(lowestOpenCrack([])).toBeNull()
    expect(lowestOpenCrack([crack(1, 10), crack(2, 20), crack(3, 15)])!.id).toBe(2)
    expect(lowestOpenCrack([crack(1, 10), crack(2, 20, true)])!.id).toBe(1)
    expect(lowestOpenCrack([crack(1, 20), crack(2, 20)])!.id).toBe(1)
    expect(lowestOpenCrack([crack(1, 18), crack(2, 10, false, [[0, 10], [0, 11], [1, 19]])])!.id).toBe(2)
  })

  it('withMainColor: a one-colour piece all of it; a two-colour piece only its main colour; a wild piece stays wild', () => {
    const cells: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]]
    const one: PieceDef = { name: 'I', cells, color: 2, corrupted: false, noRotate: false }
    expect(withMainColor(one, 5)).toMatchObject({ color: 5 })
    expect(withMainColor(one, 5).colors).toBeUndefined()
    expect(one.color).toBe(2) // (a copy)
    const two: PieceDef = { ...one, colors: [2, 2, 2, 4] } // main = 2
    expect(withMainColor(two, 5)).toMatchObject({ color: 5, colors: [5, 5, 5, 4] })
    const mostlyOther: PieceDef = { ...one, colors: [2, 4, 4, 4] } // main = 4 (the first colour stays 2)
    expect(withMainColor(mostlyOther, 5)).toMatchObject({ color: 2, colors: [2, 5, 5, 5] })
    expect(mainColor(withMainColor(mostlyOther, 5))).toBe(5)
    const intoOther = withMainColor(two, 4) // the other colour already: one colour now
    expect(intoOther.color).toBe(4)
    expect(intoOther.colors).toBeUndefined()
    const wild: PieceDef = { ...one, color: WILD }
    expect(withMainColor(wild, 5)).toBe(wild)
  })
})

// ---------------------------------------------------------------- Sealing Bonus, Tougher Tank, Slow Cracks

// One-cell colour-1 pieces hanging at the top; integrity drain as given (0 = the tank never ruptures).
function calmConfig(drain = 0): ShiftConfig {
  const config = oneShapeConfig([[0, 0]])
  config.integrity.drainPerCrackPerSec = drain
  return config
}

describe('Sealing Bonus (rank 18, abilityChargePerSealMult)', () => {
  it('max level: each seal charges an active 1.6× as much (0.5 → 0.8 for the test active); time charge unchanged', () => {
    const abilities = resolveUpgrades(book, { lowCracksTest: 1 }, ['lowCracksTest']).abilities
    const afterOneSeal = (modifiers?: Partial<Modifiers>) => {
      const config = calmConfig()
      const shift = createShift(config, { seed: 2, rank: 0, abilities, modifiers })
      sealACrack(shift, config)
      return shift.state.abilities![0].charge
    }
    expect(afterOneSeal()).toBeCloseTo(0.5, 9)
    expect(afterOneSeal(mods('sealingBonus', 4))).toBeCloseTo(0.8, 9)
    // time charge: the same with or without
    const timed = [{ ...abilities[0], chargePerSecond: 0.05 }]
    const byTime = (modifiers?: Partial<Modifiers>) => {
      const shift = createShift(calmConfig(), { seed: 2, rank: 0, abilities: timed, modifiers })
      shift.tick(2000)
      return shift.state.abilities![0].charge
    }
    expect(byTime(mods('sealingBonus', 4))).toBeCloseTo(byTime(), 9)
  }, 30000)
})

describe('Tougher Tank (rank 22) and Slow Cracks (rank 30): the engine’s ready modifiers', () => {
  it('Tougher Tank level 2 (× 0.75): the same cracks, three quarters of the wear', () => {
    const config = calmConfig(0.004)
    const a = createShift(config, { seed: 5, rank: 0 })
    const b = createShift(config, { seed: 5, rank: 0, modifiers: mods('tougherTank', 2) })
    for (let t = 0; t < 20000; t += 10) { a.tick(10); b.tick(10) }
    expect(b.state.cracks).toEqual(a.state.cracks)
    expect(a.state.cracks.length).toBeGreaterThan(0)
    expect(1 - b.state.integrity).toBeCloseTo((1 - a.state.integrity) * 0.75, 9)
  })

  it('Slow Cracks max (× 1.6): the first crack comes 1.6× later', () => {
    const config = straightLineCracks(calmConfig(), 5000)
    config.pressure.riseMsToFull = 1e12 // (pressure stays ~0, so the crack interval stays 5 s)
    const first = (modifiers?: Partial<Modifiers>) => {
      const shift = createShift(config, { seed: 1, rank: 0, modifiers })
      let t = 0
      while (shift.state.cracks.length === 0 && t < 30000) { shift.tick(10); t += 10 }
      return t
    }
    expect(first()).toBeCloseTo(5000, -2)
    expect(first(mods('slowCracks', 4))).toBeCloseTo(8000, -2)
  })
})
