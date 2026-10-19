// F36 (Muzzy, 2026-10-18): "a sealed crack … no crack can ever form on a sealed spot again".
// The engine remembers every sealed spot (state.sealedCracks, kept in snapshots) and spawnCrack skips them in every
// band mode and for the low-cracks ability.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import type { ShiftConfig } from '../../src/engine'
import { spawnCrack } from '../../src/engine/cracks'
import { createRng } from '../../src/engine/rng'
import { restoreShift } from '../../src/engine/snapshot'
import { oneShapeConfig, realConfig, sealACrack, straightLineCracks, tank } from './helpers'

const W = 30, H = 24
const FLOOR_Y = H - 1

function config(band: string): ShiftConfig {
  const c = straightLineCracks(oneShapeConfig([[0, 0]]))
  c.integrity.drainPerCrackPerSec = 0
  c.cracks.band = band
  return c
}

// An empty tank at pressure 0: the pop line is the floor, so the floor row is the only place a crack may form.
// Seal every floor cell but `free` (or all of them when free is null).
function floorOnly(band: string, free: number | null) {
  const c = config(band)
  const shift = createShift(c, { seed: 1, rank: 0, startGrid: new Uint8Array(W * H) })
  const s = shift.state
  s.sealedCracks = []
  for (let x = 0; x < W; x++) if (x !== free) s.sealedCracks.push({ id: 100 + x, x, y: FLOOR_Y })
  return { c, s }
}

describe('sealed spots never crack again', () => {
  for (const band of ['none', 'halfway', 'halfwayPerColumn', 'hill']) {
    it(`band '${band}': with every floor spot sealed but one, every crack goes there`, () => {
      const { c, s } = floorOnly(band, 17)
      for (let seed = 1; seed <= 100; seed++) {
        const crack = spawnCrack(s, createRng(seed), c, 1, seed)!
        expect([crack.x, crack.y]).toEqual([17, FLOOR_Y])
      }
    })
    it(`band '${band}': with every spot sealed, no crack at all`, () => {
      const { c, s } = floorOnly(band, null)
      expect(spawnCrack(s, createRng(3), c, 1, 1)).toBeNull()
    })
  }

  it('the top bias picker (topBias) skips them too', () => {
    const { c, s } = floorOnly('none', 4)
    c.cracks.topBias = 2
    for (let seed = 1; seed <= 50; seed++) expect(spawnCrack(s, createRng(seed), c, 1, seed)!.x).toBe(4)
  })

  it('the low-cracks ability (bottom rows) skips them too', () => {
    const { c, s } = floorOnly('hill', 9)
    for (let seed = 1; seed <= 50; seed++) {
      const crack = spawnCrack(s, createRng(seed), c, 1, seed, 1)!
      expect([crack.x, crack.y]).toEqual([9, FLOOR_Y])
    }
  })
})

describe('the engine remembers where it sealed', () => {
  it('a new shift has no sealed spots', () => {
    expect(createShift(realConfig(), { seed: 1, rank: 1 }).state.sealedCracks).toEqual([])
  })

  it('sealing a crack records its spot (and its id, so the scar keeps its shape); the crack is gone', () => {
    const c = config('hill')
    const shift = createShift(c, { seed: 4, rank: 0, startGrid: tank(['2'.repeat(30)]) })
    const s = shift.state
    sealACrack(shift, c)
    expect(s.sealedCracks).toHaveLength(1)
    const spot = s.sealedCracks![0]
    expect(s.cracks.some((k) => k.id === spot.id)).toBe(false)
    expect(s.cracksSealed).toBe(1)
    // and no later crack ever forms there (the rest of the shift)
    for (let t = 0; t < 120000 && s.status === 'playing'; t += 50) {
      shift.tick(50)
      expect(s.cracks.some((k) => k.x === spot.x && k.y === spot.y)).toBe(false)
    }
  })

  it('snapshots keep them; old snapshots without them read as none', () => {
    const c = config('hill')
    const shift = createShift(c, { seed: 4, rank: 0, startGrid: tank(['2'.repeat(30)]) })
    sealACrack(shift, c)
    const snap = shift.snapshot()
    expect(snap.state.sealedCracks).toEqual(shift.state.sealedCracks)
    expect(restoreShift(c, snap).state.sealedCracks).toEqual(shift.state.sealedCracks)
    const old = structuredClone(snap)
    delete old.state.sealedCracks
    expect(restoreShift(c, old).state.sealedCracks).toEqual([])
  })
})
