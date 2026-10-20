// F30: a lesson's training shift — chosen pieces, placed goop and cracks, pressure held or set, rules switched on.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import { restoreShift } from '../../src/engine/snapshot'
import breakdowns from '../../content/tuning/breakdowns.json'
import { dropPiece, idx, ofType, realConfig, tickUntil } from './helpers'

const training = (rules = {}, seed = 1) => {
  const config = realConfig()
  return { config, shift: createShift(config, { seed, rank: 6, breakdowns, training: rules }) }
}

describe('a training shift', () => {
  it('starts empty: no goop, no piece', () => {
    const { shift } = training()
    const s = shift.state
    expect(s.grid.every((c) => c === 0)).toBe(true)
    expect(s.piece).toBeNull()
  })

  it('holds still: no pressure, no cracks, no integrity loss, no breakdowns over a long wait', () => {
    const { shift } = training()
    shift.train({ type: 'crack', x: 0, y: 23, color: 1 }) // an open crack that would drain a normal tank
    shift.tick(120_000)
    const s = shift.state
    expect(s.pressure).toBe(0)
    expect(s.cracks).toHaveLength(1)
    expect(s.integrity).toBe(1)
    expect(Object.values(s.machines!).every((m) => !m.broken && m.health === 1)).toBe(true)
  })

  it('a normal shift (no training option) is unchanged: junk on the floor and a piece falling', () => {
    const shift = createShift(realConfig(), { seed: 1, rank: 6 })
    expect(shift.state.piece).not.toBeNull()
    expect(shift.state.grid.some((c) => c !== 0)).toBe(true)
    expect(shift.train({ type: 'pressure', value: 0.5 })).toBe(false)
  })
})

describe('chosen pieces', () => {
  it('queued pieces come in order, then random ones again', () => {
    const { shift, config } = training()
    expect(shift.train({ type: 'queue', pieces: [{ shape: 'T_I', color: 2 }, { shape: 'T_O', color: 3 }] })).toBe(true)
    expect(shift.state.next).toEqual([2, 2, 2, 2]) // the preview shows the first chosen piece straight away
    expect(shift.train({ type: 'spawn' })).toBe(true)
    expect(shift.state.piece!.colors).toEqual([2, 2, 2, 2])
    const xs = new Set(shift.state.piece!.cells.map(([x]) => x))
    expect(xs.size).toBe(1) // T_I stands upright: one column
    dropPiece(shift, config) // autoSpawn is on: the next chosen piece follows
    expect(shift.state.piece!.colors).toEqual([3, 3, 3, 3])
  })

  it('a typo in a shape name refuses the whole queue', () => {
    const { shift } = training()
    const before = shift.state.next
    expect(shift.train({ type: 'queue', pieces: [{ shape: 'T_I', color: 1 }, { shape: 'NOPE', color: 1 }] })).toBe(false)
    expect(shift.state.next).toEqual(before)
  })

  it('with autoSpawn off the next piece waits for the lesson', () => {
    const { shift, config } = training({ autoSpawn: false })
    shift.train({ type: 'queue', pieces: [{ shape: 'T_O', color: 1 }, { shape: 'T_O', color: 2 }] })
    shift.train({ type: 'spawn' })
    expect(shift.train({ type: 'spawn' })).toBe(false) // one is already falling
    dropPiece(shift, config)
    expect(shift.state.piece).toBeNull()
    expect(shift.train({ type: 'spawn' })).toBe(true)
    expect(shift.state.piece!.colors[0]).toBe(2)
  })

  it('falling off: the piece hangs where it is', () => {
    const { shift } = training({ falling: false })
    shift.train({ type: 'spawn' })
    const cells = JSON.stringify(shift.state.piece!.cells)
    shift.tick(10_000)
    expect(JSON.stringify(shift.state.piece!.cells)).toBe(cells)
  })
})

describe('placed goop and cracks, pressure, rules', () => {
  it('a crack goes where the lesson puts it; goop of its colour plugs it', () => {
    const { shift } = training()
    expect(shift.train({ type: 'crack', x: 3, y: 23, color: 2 })).toBe(true)
    const crack = shift.state.cracks[0]
    expect([crack.x, crack.y, crack.color, crack.plugged]).toEqual([3, 23, 2, false])
    expect(ofType(shift.takeEvents(), 'crack')).toHaveLength(1)
    shift.train({ type: 'goop', cells: [[3, 23, 2]] })
    expect(shift.state.cracks[0].plugged).toBe(true)
    expect(shift.train({ type: 'crack', x: 3, y: 23, color: 1 })).toBe(false) // on goop: refused
  })

  it('placed goop is full at once and falls if placed in mid-air', () => {
    const { shift } = training()
    shift.train({ type: 'goop', cells: [[5, 10, 1], [6, 10, 1]] })
    const s = shift.state
    expect(s.grid[idx(5, 23)]).toBe(1)
    expect(s.grid[idx(6, 23)]).toBe(1)
    const g = s.groups.get(s.groupOf[idx(5, 23)])!
    expect(g.fill).toBe(1)
    expect(g.ready).toBe(true) // on the floor, so at the pressure line even at 0 pressure
  })

  it('pressure can be set, and rises only as fast as the rule says', () => {
    const { shift, config } = training()
    shift.train({ type: 'pressure', value: 0.4 })
    expect(shift.state.pressure).toBeCloseTo(0.4)
    shift.train({ type: 'rules', rules: { pressureRise: 2 } })
    shift.tick(config.pressure.riseMsToFull / 10)
    expect(shift.state.pressure).toBeCloseTo(0.6, 2)
  })

  it('cracks form on their own only when the rule turns them on', () => {
    const { shift } = training()
    shift.tick(60_000)
    expect(shift.state.cracks).toHaveLength(0)
    shift.train({ type: 'rules', rules: { cracks: true } })
    tickUntil(shift, () => shift.state.cracks.length > 0, 60_000)
    expect(shift.state.cracks.length).toBeGreaterThan(0)
  })

  it('allow: only the listed controls work, silently', () => {
    const { shift } = training({ allow: ['rotate'] })
    shift.train({ type: 'queue', pieces: [{ shape: 'T_L', color: 1 }] })
    shift.train({ type: 'spawn' })
    shift.takeEvents()
    shift.act({ type: 'spin', dir: 1 })
    expect(shift.state.spin).toBe(0)
    expect(shift.takeEvents()).toEqual([]) // no "nope"
    shift.act({ type: 'rotate', dir: 1 })
    expect(ofType(shift.takeEvents(), 'rotate')).toHaveLength(1)
    shift.train({ type: 'rules', rules: { allow: null } })
    shift.act({ type: 'spin', dir: 1 })
    expect(shift.state.spin).toBe(1)
  })

  it('clear empties the tank and the falling piece', () => {
    const { shift } = training()
    shift.train({ type: 'goop', cells: [[1, 23, 1]] })
    shift.train({ type: 'crack', x: 2, y: 23, color: 1 })
    shift.train({ type: 'spawn' })
    shift.train({ type: 'clear' })
    const s = shift.state
    expect(s.grid.every((c) => c === 0) && s.groups.size === 0 && s.cracks.length === 0 && s.piece === null).toBe(true)
  })

  it('pressure stops at its cap', () => {
    const { shift, config } = training({ pressureRise: 1, pressureCap: 0.9 })
    shift.tick(config.pressure.riseMsToFull * 2)
    expect(shift.state.pressure).toBeCloseTo(0.9)
  })

  it('integrity drains to its floor, and without rupture allowed the tank holds', () => {
    const { shift, config } = training({ integrity: true, integrityFloor: 0.2 })
    config.integrity.drainPerCrackPerSec = 0.01 // (fast, so the test is short)
    shift.train({ type: 'crack', x: 0, y: 23, color: 1 })
    shift.tick(600_000)
    expect(shift.state.integrity).toBeCloseTo(0.2)
    expect(shift.state.phase).toBe('playing')
  })

  it('the overflow rail clears the top instead of a rupture', () => {
    const { shift } = training({ autoSpawn: false })
    const s = shift.state
    const column: [number, number, number][] = []
    for (let y = 0; y < s.height; y++) column.push([0, y, 1 + (y % 2)]) // a full column, spawn rows too
    shift.train({ type: 'goop', cells: column })
    expect(shift.train({ type: 'spawn' })).toBe(true)
    expect(s.phase).toBe('playing')
    expect(s.grid[idx(0, 6)]).toBe(0) // the top rows were cleared
    expect(s.grid[idx(0, 7)]).not.toBe(0) // and only those
  })

  it('zap filter: only the allowed colour pops', () => {
    const { shift } = training({ zapColors: [2] })
    shift.train({ type: 'goop', cells: [[0, 23, 1], [2, 23, 2]] })
    shift.act({ type: 'pop', x: 0, y: 23 })
    expect(shift.state.grid[idx(0, 23)]).toBe(1)
    shift.act({ type: 'pop', x: 2, y: 23 })
    expect(shift.state.grid[idx(2, 23)]).toBe(0)
  })

  it('a chosen piece can come in turned; random pieces stay 4 cells however long it runs', () => {
    const { shift, config } = training()
    shift.train({ type: 'queue', pieces: [{ shape: 'T_I', color: 1, turns: 1 }] })
    shift.train({ type: 'spawn' })
    expect(new Set(shift.state.piece!.cells.map(([, y]) => y)).size).toBe(1) // lying flat: one row
    shift.tick(200_000) // past every size zone of a normal shift
    for (let i = 0; i < 5; i++) dropPiece(shift, config)
    expect(shift.state.piece!.cells).toHaveLength(4)
  })

  it('a crack can be removed, and none can be placed on a sealed spot', () => {
    const { shift } = training()
    shift.train({ type: 'crack', x: 4, y: 23, color: 1 })
    expect(shift.train({ type: 'removeCrack', x: 4, y: 23 })).toBe(true)
    expect(shift.state.cracks).toHaveLength(0)
    shift.state.sealedCracks!.push({ id: 99, x: 5, y: 23 })
    expect(shift.train({ type: 'crack', x: 5, y: 23, color: 1 })).toBe(false)
  })

  it('the same commands with the same seed give the same shift (still pure + seeded)', () => {
    const run = () => {
      const { shift } = training({ cracks: true, pressureRise: 1 }, 42)
      shift.train({ type: 'queue', pieces: [{ shape: 'T_S', color: 4 }] })
      shift.train({ type: 'spawn' })
      shift.tick(30_000)
      return JSON.stringify([Array.from(shift.state.grid), shift.state.cracks, shift.state.pressure])
    }
    expect(run()).toBe(run())
  })

  it('a snapshot of a training shift restores as a training shift', () => {
    const { shift, config } = training({ autoSpawn: false })
    shift.train({ type: 'queue', pieces: [{ shape: 'T_O', color: 1 }, { shape: 'T_I', color: 2 }] })
    const copy = restoreShift(config, shift.snapshot(), breakdowns)
    copy.tick(60_000)
    expect(copy.state.pressure).toBe(0) // still held
    expect(copy.train({ type: 'spawn' })).toBe(true)
    expect(copy.state.piece!.colors[0]).toBe(1)
  })
})

// F31 (day one, the Sprint 10 spike): what the first day's steps need that F30 didn't have.
describe('day one: fallback pieces, free crack spots, the overflow rail says so', () => {
  const O = (color: number) => ({ shape: 'T_O', color })
  const I = (color: number) => ({ shape: 'T_I', color })

  it('when the chosen pieces run out, the fallback rule\'s pieces come round and round (not random ones)', () => {
    const { shift, config } = training()
    shift.train({ type: 'queue', pieces: [I(2)], then: { pieces: [O(3), O(1)] } })
    shift.train({ type: 'spawn' })
    const colours: number[] = []
    for (let i = 0; i < 5; i++) {
      colours.push(shift.state.piece!.colors[0])
      shift.act({ type: 'spin', dir: 1 }) // (spread them out: the tank mustn't fill)
      shift.act({ type: 'spin', dir: 1 })
      dropPiece(shift, config)
    }
    expect(colours).toEqual([2, 3, 1, 3, 1])
  })

  it('buildUp: the build-up piece comes first while the column is too low to reach the cell — decided as each piece comes in', () => {
    const { shift, config } = training()
    const s = shift.state
    shift.train({ type: 'crack', x: 0, y: 19, color: 3 }) // row 4 from the floor, in an empty column
    shift.train({ type: 'queue', pieces: [], then: { pieces: [O(3)], buildUp: { x: 0, y: 19, piece: I(2) } } })
    shift.train({ type: 'spawn' })
    expect(s.piece!.colors[0]).toBe(2) // an O dropped in the empty column would land on rows 0–1: too low → a blue I
    dropPiece(shift, config) // the I stands in column 0: rows 0–3
    expect(s.piece!.colors[0]).toBe(3) // now an O reaches row 4
    dropPiece(shift, config)
    expect(s.cracks[0].plugged).toBe(true)
  })

  it('a new queue without `then` goes back to random pieces after it', () => {
    const { shift, config } = training()
    shift.train({ type: 'queue', pieces: [], then: { pieces: [O(3)] } })
    shift.train({ type: 'queue', pieces: [O(1)] })
    shift.train({ type: 'spawn' })
    dropPiece(shift, config)
    const colours = new Set<number>()
    for (let i = 0; i < 12; i++) {
      colours.add(shift.state.piece!.colors[0])
      for (let k = 0; k < 3; k++) shift.act({ type: 'spin', dir: 1 }) // (spread them out round the tank)
      dropPiece(shift, config)
    }
    expect(colours.size).toBeGreaterThan(1)
  })

  it('a fallback rule with a typo is refused whole', () => {
    const { shift } = training()
    expect(shift.train({ type: 'queue', pieces: [], then: { pieces: [{ shape: 'NOPE', color: 1 }] } })).toBe(false)
  })

  it('freeCrack: in view = from the middle out; out of view = just past the edges; never on goop', () => {
    const { shift } = training()
    const s = shift.state
    shift.train({ type: 'goop', cells: [[0, 23, 1]] }) // goop where pieces fall
    expect(shift.train({ type: 'freeCrack', where: 'inView', y: 23, color: 3 })).toBe(true)
    expect(shift.train({ type: 'freeCrack', where: 'inView', y: 23, color: 3 })).toBe(true)
    expect(s.cracks.map((c) => c.x)).toEqual([1, 29]) // one right of the middle, then one left
    expect(shift.train({ type: 'freeCrack', where: 'outOfView', y: 23, color: 3 })).toBe(true)
    expect(s.cracks[2].x).toBe(7) // the view is spin-5 .. spin+6: the first column past its right edge
    shift.act({ type: 'spin', dir: 1 }) // (rule-free: spin works) the view moves with the tank
    shift.train({ type: 'freeCrack', where: 'outOfView', y: 23, color: 3 })
    expect(s.cracks[3].x).toBe(8)
  })

  it('freeCrack is refused when the row has no free cell', () => {
    const { shift } = training()
    const row: [number, number, number][] = []
    for (let x = 0; x < 30; x++) row.push([x, 23, 1 + (x % 2)])
    shift.train({ type: 'goop', cells: row })
    expect(shift.train({ type: 'freeCrack', where: 'inView', y: 23, color: 1 })).toBe(false)
    expect(shift.state.cracks).toHaveLength(0)
  })

  it('the overflow rail tells the lesson: an overflowRail event with how many cells it cleared', () => {
    const { shift } = training({ autoSpawn: false })
    const s = shift.state
    const column: [number, number, number][] = []
    for (let y = 0; y < s.height; y++) column.push([0, y, 1 + (y % 2)])
    shift.train({ type: 'goop', cells: column })
    shift.takeEvents()
    shift.train({ type: 'spawn' })
    expect(ofType(shift.takeEvents(), 'overflowRail')[0].cells).toBe(s.bufferRows + 4)
  })

  it('a snapshot keeps the fallback rule and where it is round it', () => {
    const { shift, config } = training()
    shift.train({ type: 'queue', pieces: [], then: { pieces: [O(3), O(1)] } })
    shift.train({ type: 'spawn' }) // the first O(3) is falling: O(1) is due next
    const copy = restoreShift(config, shift.snapshot(), breakdowns)
    dropPiece(copy, config)
    expect(copy.state.piece!.colors[0]).toBe(1)
  })
})
