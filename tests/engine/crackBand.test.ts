// F27 balance changes (Muzzy, 2026-10-18): the crack band, the seal refund, the lower drain, and the crack timer retry.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import type { ShiftConfig, ShiftEngine, ShiftEvent } from '../../src/engine'
import { crackBandTop, goopTopRow, spawnCrack } from '../../src/engine/cracks'
import { createRng } from '../../src/engine/rng'
import { dropPiece, idx, ofType, oneShapeConfig, realConfig, tank, tickUntil } from './helpers'

const FLOOR = '2'.repeat(30)
const H = 24 // tank height: a row counted from the floor up = H - 1 - y

// One-cell colour-1 pieces hanging at the top; integrity drain as given (0 = never ruptures); band as given.
function calmConfig(band: string, drain = 0): ShiftConfig {
  const config = oneShapeConfig([[0, 0]])
  config.integrity.drainPerCrackPerSec = drain
  config.cracks.band = band
  return config
}

function run(shift: ShiftEngine, ms: number): ShiftEvent[] {
  const events: ShiftEvent[] = []
  for (let t = 0; t < ms && shift.state.status === 'playing'; t += 10) {
    shift.tick(10)
    events.push(...shift.takeEvents())
  }
  return events
}

// A tank with one column (x = 5) of goop from the floor up to row `topRow` (counted from the floor, floor = 0).
function oneColumn(topRow: number): Uint8Array {
  const grid = new Uint8Array(30 * H)
  for (let row = 0; row <= topRow; row++) grid[idx(5, H - 1 - row)] = 2
  return grid
}

// 300 cracks from 300 seeds on the same tank, with the pop line at row 16 from the floor (pressure 0.8 → y 7).
// Returns where each one went, as { x, row } with rows counted from the floor.
function crackSpots(band: string, grid: Uint8Array): { x: number; row: number }[] {
  const config = calmConfig(band)
  const shift = createShift(config, { seed: 1, rank: 0, startGrid: grid })
  shift.state.pressure = 0.8 // pop line = 23 − 0.8 × 20 = y 7 = row 16
  const out: { x: number; row: number }[] = []
  for (let seed = 1; seed <= 300; seed++) {
    const crack = spawnCrack(shift.state, createRng(seed), config, 1, seed)!
    expect(shift.state.grid[idx(crack.x, crack.y)]).toBe(0) // still only empty cells
    out.push({ x: crack.x, row: H - 1 - crack.y })
  }
  return out
}
const highest = (spots: { row: number }[]) => Math.max(...spots.map((s) => s.row))

describe('the crack band maths (rows counted from the floor up)', () => {
  it("Muzzy's example: top goop 12, line 16 → cracks up to row 14", () => {
    expect(crackBandTop(12, 16)).toBe(14)
  })

  it('rounds down: top goop 12, line 17 → 14 (14.5 rounded down)', () => {
    expect(crackBandTop(12, 17)).toBe(14)
  })

  it('goop at or above the line → the line itself (the old rule)', () => {
    expect(crackBandTop(16, 16)).toBe(16)
    expect(crackBandTop(19, 16)).toBe(16)
  })

  it('an empty tank counts the floor (0) as the top goop: line 16 → row 8', () => {
    expect(crackBandTop(0, 16)).toBe(8)
  })

  it('the top goop is the highest goop anywhere in the tank, or in one column if asked; empty → the floor', () => {
    const grid = tank([FLOOR])
    grid[idx(20, H - 1 - 12)] = 3 // a lone cell at row 12 in column 20
    const shift = createShift(calmConfig('halfway'), { seed: 1, rank: 0, startGrid: grid })
    expect(goopTopRow(shift.state)).toBe(12)
    expect(goopTopRow(shift.state, 20)).toBe(12)
    expect(goopTopRow(shift.state, 4)).toBe(0) // floor goop only
    const empty = createShift(calmConfig('halfway'), { seed: 1, rank: 0 })
    expect(goopTopRow(empty.state)).toBe(0)
    expect(goopTopRow(empty.state, 4)).toBe(0)
  })
})

describe('where cracks form, per band setting', () => {
  it("'halfway': one tall column (top 12, line 16) caps cracks at row 14 in EVERY column", () => {
    const spots = crackSpots('halfway', oneColumn(12))
    expect(highest(spots)).toBe(14)
    expect(spots.some((s) => s.x !== 5 && s.row === 14)).toBe(true) // the column doesn't matter
  })

  it("'halfway': an empty tank → up to row 8 (halfway from the floor to line 16)", () => {
    expect(highest(crackSpots('halfway', new Uint8Array(30 * H)))).toBe(8)
  })

  it("'halfway': goop above the line → anywhere up to the line, as before", () => {
    const spots = crackSpots('halfway', oneColumn(18))
    expect(highest(spots)).toBe(16)
  })

  it("'halfwayPerColumn': each column uses its own goop — the tall column up to 14, empty columns up to 8", () => {
    const spots = crackSpots('halfwayPerColumn', oneColumn(12))
    const tall = spots.filter((s) => s.x === 5)
    const others = spots.filter((s) => s.x !== 5)
    expect(others.length).toBeGreaterThan(0)
    expect(highest(others)).toBe(8)
    for (const s of tall) expect([13, 14]).toContain(s.row) // only the 2 empty cells above its goop, up to 14
  })

  it("'none' (and anything unknown): anywhere up to the pop line (row 16)", () => {
    expect(highest(crackSpots('none', oneColumn(12)))).toBe(16)
    expect(highest(crackSpots('bogus', oneColumn(12)))).toBe(16)
  })

  it('the band is read live: switching it mid-shift changes the next crack', () => {
    const config = calmConfig('none')
    const shift = createShift(config, { seed: 1, rank: 0 })
    shift.state.pressure = 0.8
    const before = Array.from({ length: 100 }, (_, i) => spawnCrack(shift.state, createRng(i + 1), config, 1, i)!)
    config.cracks.band = 'halfway'
    const after = Array.from({ length: 100 }, (_, i) => spawnCrack(shift.state, createRng(i + 1), config, 1, i)!)
    expect(Math.max(...before.map((c) => H - 1 - c.y))).toBeGreaterThan(8)
    expect(Math.max(...after.map((c) => H - 1 - c.y))).toBe(8)
  })
})

describe('crack timer', () => {
  it('when there is nowhere for a crack, it tries again next step (not a whole interval later)', () => {
    // A floor two rows deep: no free cell until the pop line reaches y 21, at 10% pressure = 7.5 s.
    // The timer runs out at 5 s with nowhere to go. Before the fix the next try was ~4.6 s later (about 9.6 s).
    const shift = createShift(calmConfig('none'), { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    expect(ofType(run(shift, 7400), 'crack')).toHaveLength(0)
    const next = ofType(run(shift, 300), 'crack')
    expect(next).toHaveLength(1)
    expect(next[0].crack.y).toBe(21)
  })

  it('after a crack forms the timer starts again from 0', () => {
    const shift = createShift(calmConfig('none'), { seed: 2, rank: 0 })
    const first = ofType(run(shift, 5100), 'crack')
    expect(first).toHaveLength(1)
    expect(ofType(run(shift, 3000), 'crack')).toHaveLength(0) // the next one is ~4.7 s after the first
  })
})

describe('integrity: lower drain and the seal refund', () => {
  it('the tuning file: drain 0.002 a crack a second, refund 0.03 a seal, band halfway', () => {
    const config = realConfig()
    expect(config.integrity.drainPerCrackPerSec).toBe(0.002)
    expect(config.integrity.sealRefund).toBe(0.03)
    expect(config.cracks.band).toBe('halfway')
  })

  it('with the real drain, one open crack wears 0.2% a second', () => {
    const config = oneShapeConfig([[0, 0]]) // real drain, not overridden
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    tickUntil(shift, () => shift.state.cracks.length === 1)
    const before = shift.state.integrity
    shift.tick(1000)
    expect(shift.state.integrity).toBeCloseTo(before - 0.002, 6)
  })

  // Plug the first crack that sits on goop and wait until it can be zapped. Returns the crack.
  function plugged(shift: ShiftEngine, config: ShiftConfig) {
    const s = shift.state
    const onGoop = () => s.cracks.find((c) => c.y === s.height - 1 || s.grid[(c.y + 1) * s.width + c.x] !== 0)
    tickUntil(shift, () => !!onGoop())
    const crack = onGoop()!
    while (s.spin !== crack.x) shift.act({ type: 'spin', dir: 1 })
    dropPiece(shift, config)
    tickUntil(shift, () => !!s.groups.get(s.groupOf[idx(crack.x, crack.y)])?.ready)
    shift.takeEvents()
    return crack
  }

  it('sealing a crack gives 3% integrity back', () => {
    const config = calmConfig('halfway', 0.002)
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    const crack = plugged(shift, config)
    shift.state.integrity = 0.5
    shift.act({ type: 'pop', x: crack.x, y: crack.y })
    expect(ofType(shift.takeEvents(), 'pop')[0].sealed).toEqual([crack.id])
    expect(shift.state.integrity).toBeCloseTo(0.53, 9)
  })

  it('never past 100%', () => {
    const config = calmConfig('halfway', 0.002)
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    const crack = plugged(shift, config)
    expect(shift.state.integrity).toBeGreaterThan(0.98) // only a few crack-seconds lost
    shift.act({ type: 'pop', x: crack.x, y: crack.y })
    expect(shift.state.integrity).toBe(1)
  })

  it('no refund during a rupture (the seal still counts)', () => {
    const config = calmConfig('halfway', 0.002)
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    const crack = plugged(shift, config)
    config.integrity.drainPerCrackPerSec = 1000 // the plugged crack is still open: the tank breaks next tick
    shift.tick(20)
    expect(shift.state.phase).toBe('rupture')
    expect(shift.state.integrity).toBe(0)
    shift.act({ type: 'pop', x: crack.x, y: crack.y })
    expect(ofType(shift.takeEvents(), 'pop')[0].sealed).toEqual([crack.id])
    expect(shift.state.cracksSealed).toBe(1)
    expect(shift.state.integrity).toBe(0)
  })
})
