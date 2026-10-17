// The shift's rules, one at a time.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import type { ShiftEngine } from '../../src/engine'
import { idx, ofType, oneShapeConfig, realConfig, tank } from './helpers'

const SQUARE = [[0, 0], [0, 1], [1, 0], [1, 1]]

// Tick in small steps until `done` or the time runs out.
function tickUntil(shift: ShiftEngine, done: () => boolean, maxMs = 60000, stepMs = 10): void {
  for (let t = 0; t < maxMs && !done(); t += stepMs) shift.tick(stepMs)
}

const lowestRow = (shift: ShiftEngine) => Math.max(...shift.state.piece!.cells.map(([, y]) => y))

describe('spawn and spin', () => {
  it('the piece spawns at the top, in the tank column under the centre (spin)', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0 })
    expect(shift.state.piece!.cells).toEqual([[0, 0]])
    expect(ofType(shift.takeEvents(), 'spawn')).toHaveLength(1)
  })

  it('spinning turns the tank, so the piece moves through tank columns (v1 sign: +1 = ArrowLeft)', () => {
    const shift = createShift(oneShapeConfig(SQUARE), { seed: 1, rank: 0 })
    shift.takeEvents()
    shift.act({ type: 'spin', dir: 1 })
    expect(shift.state.spin).toBe(1)
    expect(shift.state.piece!.cells.map(([x]) => x).sort()).toEqual([1, 1, 2, 2])
    shift.act({ type: 'spin', dir: -1 })
    shift.act({ type: 'spin', dir: -1 })
    expect(shift.state.spin).toBe(29)
    expect(shift.state.piece!.cells.map(([x]) => x).sort((a, b) => a - b)).toEqual([0, 0, 29, 29])
    expect(ofType(shift.takeEvents(), 'spin').map((e) => e.dx)).toEqual([1, -1, -1])
  })

  it('a spin into goop is refused', () => {
    // A wall of colour 2 in column 2, rows 0..23.
    const grid = new Uint8Array(30 * 24)
    for (let y = 0; y < 24; y++) grid[idx(2, y)] = 2
    const shift = createShift(oneShapeConfig(SQUARE), { seed: 1, rank: 0, startGrid: grid })
    shift.act({ type: 'spin', dir: 1 }) // square now on columns 1-2 → blocked
    expect(shift.state.spin).toBe(0)
    expect(ofType(shift.takeEvents(), 'reject')).toHaveLength(1)
  })
})

describe('falling, soft drop, hard drop', () => {
  it('falls one row per 780 ms, 8x faster with soft drop', () => {
    const config = realConfig()
    const slow = createShift(oneShapeConfig([[0, 0]], { msPerRow: config.fall.msPerRow }), { seed: 1, rank: 0 })
    slow.tick(780 * 3 + 5)
    expect(lowestRow(slow)).toBe(3)
    const fast = createShift(oneShapeConfig([[0, 0]], { msPerRow: config.fall.msPerRow }), { seed: 1, rank: 0 })
    fast.act({ type: 'softDrop', on: true })
    fast.tick(780 * 2 + 5)
    expect(lowestRow(fast)).toBeGreaterThanOrEqual(15) // 97.5 ms per row → ~16 rows in 1.56 s
  })

  it('hard drop lands on the ghost at once', () => {
    const shift = createShift(oneShapeConfig(SQUARE), { seed: 1, rank: 0, startGrid: tank(['2'], 1) })
    const ghost = shift.state.ghost
    expect(Math.max(...ghost.map(([, y]) => y))).toBe(22)
    shift.act({ type: 'hardDrop' })
    for (const [x, y] of ghost) expect(shift.state.grid[idx(x, y)]).toBe(1)
    expect(ofType(shift.takeEvents(), 'drop')[0].rows).toBe(21)
  })
})

describe('lock delay (500 ms, move-reset, 10-reset cap)', () => {
  const landed = () => {
    const shift = createShift(oneShapeConfig(SQUARE, { msPerRow: 20 }), { seed: 1, rank: 0 })
    tickUntil(shift, () => lowestRow(shift) === 23)
    shift.takeEvents()
    return shift
  }

  it('locks a little after 500 ms resting, not before', () => {
    const shift = landed()
    shift.tick(450)
    expect(ofType(shift.takeEvents(), 'lock')).toHaveLength(0)
    shift.tick(100)
    expect(ofType(shift.takeEvents(), 'lock')).toHaveLength(1)
  })

  it('each spin while resting restarts the timer — but only 10 times', () => {
    const shift = landed()
    for (let i = 0; i < 10; i++) {
      shift.tick(400)
      shift.act({ type: 'spin', dir: i % 2 === 0 ? 1 : -1 })
      expect(ofType(shift.takeEvents(), 'lock')).toHaveLength(0)
    }
    shift.tick(20) // 10 resets used up: locks on the next resting step
    expect(ofType(shift.takeEvents(), 'lock')).toHaveLength(1)
  })

  it('soft drop shortens the lock delay to 50 ms', () => {
    const shift = landed()
    shift.act({ type: 'softDrop', on: true })
    shift.tick(80)
    expect(ofType(shift.takeEvents(), 'lock')).toHaveLength(1)
  })
})

describe('rotation', () => {
  it('four turns bring the piece back', () => {
    const shift = createShift(oneShapeConfig([[0, 0], [0, 1], [0, 2], [1, 0]]), { seed: 1, rank: 0 })
    shift.tick(1)
    const before = shift.state.piece!.cells
    for (let i = 0; i < 4; i++) shift.act({ type: 'rotate', dir: 1 })
    expect(shift.state.piece!.cells).toEqual(before)
    expect(shift.state.piece!.rotation).toBe(0)
  })

  it('kicks sideways when the turn is blocked (and that moves the piece in the tank)', () => {
    // An upright bar at column 0 next to a wall in column 29 (the left neighbour across the seam).
    const grid = new Uint8Array(30 * 24)
    for (let y = 0; y < 24; y++) grid[idx(29, y)] = 2
    const shift = createShift(oneShapeConfig([[0, -1], [0, 0], [0, 1], [0, 2]]), { seed: 1, rank: 0, startGrid: grid })
    shift.tick(1)
    shift.takeEvents()
    shift.act({ type: 'rotate', dir: 1 })
    const events = shift.takeEvents()
    expect(ofType(events, 'rotate')).toHaveLength(1)
    expect(ofType(events, 'move')).toHaveLength(1)
    for (const [x, y] of shift.state.piece!.cells) if (y >= 0) expect(shift.state.grid[idx(x, y)]).toBe(0)
  })
})

describe('hold', () => {
  it('starts with a held piece and swaps it in place', () => {
    const shift = createShift(realConfig(), { seed: 7, rank: 1 })
    const heldCells = shift.state.heldCells!
    expect(heldCells.length).toBe(4)
    shift.act({ type: 'hold' })
    expect(ofType(shift.takeEvents(), 'hold')).toHaveLength(1)
    const origin = shift.state.piece!.cells[0]
    const rel = shift.state.piece!.cells.map(([x, y]) => [x - origin[0], y - origin[1]])
    const expected = heldCells.map(([x, y]) => [x - heldCells[0][0], y - heldCells[0][1]])
    expect(rel).toEqual(expected)
  })
})

describe('fill and pop', () => {
  it('a group fills (375 ms per cell) before it can pop', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11'], 5) })
    shift.act({ type: 'pop', x: 5, y: 23 })
    expect(ofType(shift.takeEvents(), 'reject')).toHaveLength(1)
    shift.tick(700)
    expect([...shift.state.groups.values()][0].ready).toBe(false)
    shift.tick(60)
    expect(ofType(shift.takeEvents(), 'ready')).toHaveLength(1)
    shift.act({ type: 'pop', x: 5, y: 23 })
    expect(ofType(shift.takeEvents(), 'pop')[0].cells).toEqual([idx(5, 23), idx(6, 23)])
    expect(shift.state.grid[idx(5, 23)]).toBe(0)
  })

  it('only goop at or below the pressure line can pop', () => {
    // Colour 1 on top of a colour-2 column: its top row (10) is far above the line at the start.
    const rows = ['1', ...Array(13).fill('2')]
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(rows, 5) })
    shift.tick(1000)
    const top = shift.state.groups.get(shift.state.groupOf[idx(5, 10)])!
    expect(top.fill).toBe(1)
    expect(top.ready).toBe(false)
    shift.act({ type: 'pop', x: 5, y: 10 })
    expect(ofType(shift.takeEvents(), 'pop')).toHaveLength(0)
    // The line rises with pressure: row 10 is reached at 65% (23 - 0.65 × 20 = 10).
    shift.tick(75000 * 0.65)
    expect(shift.state.pressureRow).toBeLessThanOrEqual(10)
    shift.act({ type: 'pop', x: 5, y: 10 })
    expect(ofType(shift.takeEvents(), 'pop')).toHaveLength(1)
  })

  it('popping gives time back (0.1 s per cell) and scores like v1', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11.......11'], 3) })
    shift.tick(2000)
    const timeBefore = shift.state.timeLeftMs
    const pressureBefore = shift.state.pressure
    shift.act({ type: 'pop', x: 3, y: 23 }) // on screen: (10 + 1×10) × 1.1 combo = 22 per cell
    expect(shift.state.timeLeftMs).toBe(timeBefore + 200)
    expect(shift.state.pressure).toBeLessThan(pressureBefore)
    expect(shift.state.score).toBe(44)
    shift.act({ type: 'pop', x: 12, y: 23 }) // columns 12-13 are off screen (+50) and it's the 2nd pop (×1.2)
    expect(shift.state.score).toBe(44 + Math.floor(2 * (10 + 10 + 50) * 1.2))
  })

  it('goop left hanging after a pop falls (sticky gravity) and starts filling again', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['2', '1'], 5) })
    shift.tick(1000)
    shift.act({ type: 'pop', x: 5, y: 23 })
    const falls = ofType(shift.takeEvents(), 'fall')
    expect(falls[0].moves).toEqual([[idx(5, 22), idx(5, 23)]])
    expect(shift.state.grid[idx(5, 23)]).toBe(2)
    expect(shift.state.groups.get(shift.state.groupOf[idx(5, 23)])!.fill).toBe(0)
  })
})

describe('cracks', () => {
  // One colour, so the crack, the pieces and the goop all match. A colour-2 floor two rows deep.
  const setup = () => {
    const floor = '2'.repeat(30)
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 4, rank: 0, startGrid: tank([floor, floor]) })
    tickUntil(shift, () => shift.state.cracks.length > 0, 6000)
    return shift
  }

  it('a crack appears every 5 s on the pressure row, one per colour', () => {
    const shift = setup()
    expect(shift.state.cracks).toHaveLength(1)
    const crack = shift.state.cracks[0]
    expect(crack.y).toBe(21) // 23 - 5 s/75 s × 20 = 21.67 → row 21
    expect(crack.color).toBe(1)
    shift.tick(6000)
    expect(shift.state.cracks).toHaveLength(1) // no free colour left
  })

  it('matching goop plugs a crack; popping it seals the crack and gives 3 s back', () => {
    const shift = setup()
    const crack = shift.state.cracks[0]
    while (shift.state.spin !== crack.x) shift.act({ type: 'spin', dir: 1 })
    shift.takeEvents()
    shift.act({ type: 'hardDrop' })
    expect(ofType(shift.takeEvents(), 'plug')).toEqual([{ type: 'plug', crackId: crack.id, plugged: true }])
    expect(shift.state.cracks[0].plugged).toBe(true)

    // Wait for the line to reach row 21 (pressure 10% = 7.5 s), then pop.
    tickUntil(shift, () => shift.state.groups.get(shift.state.groupOf[idx(crack.x, 21)])!.ready)
    const before = shift.state.timeLeftMs
    shift.act({ type: 'pop', x: crack.x, y: 21 })
    const pop = ofType(shift.takeEvents(), 'pop')[0]
    expect(pop.sealed).toEqual([crack.id])
    expect(shift.state.cracksSealed).toBe(1)
    expect(shift.state.timeLeftMs).toBe(before + 100 + 3000)
  })

  it('reaching the goal does not end the shift; it ends at 100% pressure as a win (with a win burst)', () => {
    const shift = setup()
    expect(shift.state.cracksNeeded).toBe(1)
    const crack = shift.state.cracks[0]
    while (shift.state.spin !== crack.x) shift.act({ type: 'spin', dir: 1 })
    shift.act({ type: 'hardDrop' })
    tickUntil(shift, () => shift.state.groups.get(shift.state.groupOf[idx(crack.x, 21)])!.ready)
    shift.takeEvents()
    shift.act({ type: 'pop', x: crack.x, y: 21 })
    expect(shift.state.status).toBe('playing')
    expect(ofType(shift.takeEvents(), 'crack').length).toBeGreaterThan(0) // the burst, above the line
    for (const c of shift.state.cracks) expect(c.y).toBeLessThan(21)
    tickUntil(shift, () => shift.state.status !== 'playing', 200000, 100)
    expect(shift.state.status).toBe('won')
    expect(shift.state.pressure).toBe(1)
  })
})

describe('shift end', () => {
  it('ends lost at 100% pressure without enough seals, minus 50 per leftover cell', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['1'], 5) })
    shift.tick(75000)
    expect(shift.state.status).toBe('lost')
    expect(shift.state.leftoverPenalty).toBe(50)
    expect(ofType(shift.takeEvents(), 'end')).toEqual([{ type: 'end', status: 'lost' }])
    shift.act({ type: 'spin', dir: 1 }) // nothing happens after the end
    expect(shift.state.spin).toBe(0)
  })

  it('ends at once when a new piece cannot spawn (tank full to the top)', () => {
    const grid = new Uint8Array(30 * 24)
    for (let y = 0; y < 24; y++) grid[idx(0, y)] = 2
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: grid })
    expect(shift.state.status).toBe('lost')
    expect(shift.state.piece).toBe(null)
  })
})
