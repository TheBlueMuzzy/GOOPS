// The shift's rules, one at a time.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import type { ShiftAction, ShiftEngine } from '../../src/engine'
import { dropPiece, idx, ofType, oneShapeConfig, realConfig, tank, tickUntil } from './helpers'

const SQUARE = [[0, 0], [0, 1], [1, 0], [1, 1]]

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

describe('falling and soft drop (no hard drop)', () => {
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

  it('the piece lands on its ghost', () => {
    const config = oneShapeConfig(SQUARE)
    const shift = createShift(config, { seed: 1, rank: 0, startGrid: tank(['2'], 1) })
    const ghost = shift.state.ghost
    expect(Math.max(...ghost.map(([, y]) => y))).toBe(22)
    dropPiece(shift, config)
    for (const [x, y] of ghost) expect(shift.state.grid[idx(x, y)]).toBe(1)
  })

  it('there is no hard drop: the action does nothing and the config has no hard-drop score', () => {
    const shift = createShift(oneShapeConfig(SQUARE), { seed: 1, rank: 0 })
    const before = shift.state.piece!.cells
    shift.act({ type: 'hardDrop' } as unknown as ShiftAction)
    expect(shift.state.piece!.cells).toEqual(before)
    expect(ofType(shift.takeEvents(), 'lock')).toHaveLength(0)
    expect('hardDropPerRow' in realConfig().score).toBe(false)
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

})

describe('wall kick modes', () => {
  // An upright bar at column 0 next to a wall in column 29 (the left neighbour across the seam):
  // turning it flat is blocked, so it needs a sideways kick.
  const blockedTurn = (wallKick?: 'rotateVat' | 'shuntPiece') => {
    const grid = new Uint8Array(30 * 24)
    for (let y = 0; y < 24; y++) grid[idx(29, y)] = 2
    const shift = createShift(oneShapeConfig([[0, -1], [0, 0], [0, 1], [0, 2]]), { seed: 1, rank: 0, startGrid: grid, wallKick })
    shift.tick(1)
    shift.takeEvents()
    shift.act({ type: 'rotate', dir: 1 })
    return { shift, events: shift.takeEvents() }
  }

  it('shuntPiece (v1): the piece slides over in the tank; the tank does not turn', () => {
    const { shift, events } = blockedTurn('shuntPiece')
    expect(ofType(events, 'rotate')).toHaveLength(1)
    expect(ofType(events, 'move')).toHaveLength(1)
    expect(ofType(events, 'spin')).toHaveLength(0)
    expect(shift.state.spin).toBe(0)
    for (const [x, y] of shift.state.piece!.cells) if (y >= 0) expect(shift.state.grid[idx(x, y)]).toBe(0)
  })

  it('rotateVat (default): the tank turns by the kick instead, and the piece lands in the same tank cells', () => {
    const shunt = blockedTurn('shuntPiece')
    const kick = ofType(shunt.events, 'move')[0].dx
    const { shift, events } = blockedTurn() // default mode
    expect(ofType(events, 'rotate')).toHaveLength(1)
    expect(ofType(events, 'move')).toHaveLength(0)
    expect(ofType(events, 'spin')).toEqual([{ type: 'spin', dx: kick }]) // same event as a player spin
    expect(shift.state.spin).toBe((kick + 30) % 30)
    expect(shift.state.piece!.cells).toEqual(shunt.shift.state.piece!.cells)
    // The piece is still on the centre line, so the next player spin moves it through the tank like any centred piece.
    shift.act({ type: 'spin', dir: 1 })
    expect(shift.state.piece!.cells.map(([x]) => x)).toEqual(shunt.shift.state.piece!.cells.map(([x]) => (x + 1) % 30))
  })

  it('can be switched mid-shift with setWallKick', () => {
    const grid = new Uint8Array(30 * 24)
    for (let y = 0; y < 24; y++) grid[idx(29, y)] = 2
    const shift = createShift(oneShapeConfig([[0, -1], [0, 0], [0, 1], [0, 2]]), { seed: 1, rank: 0, startGrid: grid })
    shift.tick(1)
    shift.setWallKick('shuntPiece')
    shift.takeEvents()
    shift.act({ type: 'rotate', dir: 1 })
    expect(ofType(shift.takeEvents(), 'move')).toHaveLength(1)
    expect(shift.state.spin).toBe(0)
  })
})

// F59: swap trades the falling piece with the NEXT one (there is no held piece any more)
describe('swap (hold)', () => {
  // the piece's shape as offsets from its first cell (where it is doesn't matter, only its shape; columns wrap round
  // the 30-column tank, so column 29 is one left of column 0)
  const shapeOf = (cells: [number, number][]) => cells.map(([x, y]) => [((x - cells[0][0] + 45) % 30) - 15, y - cells[0][1]])

  it('no held piece: a shift starts with only the falling piece and the next one', () => {
    const shift = createShift(realConfig(), { seed: 7, rank: 3 })
    expect('held' in shift.state).toBe(false)
    expect('heldCells' in shift.state).toBe(false)
    expect(shift.state.next).not.toBeNull()
  })

  it('the next piece comes in where the falling one was, and the falling one becomes the next', () => {
    const shift = createShift(realConfig(), { seed: 7, rank: 3 })
    shift.tick(400) // let it fall a little first: the swapped-in piece keeps its place
    const s = shift.state
    const before = { cells: s.piece!.cells, colors: s.piece!.colors, next: s.next!, nextCells: s.nextCells!, rotation: s.piece!.rotation }
    const lowest = (cells: [number, number][]) => Math.max(...cells.map(([, y]) => y))
    shift.takeEvents()
    shift.act({ type: 'hold' })
    expect(ofType(shift.takeEvents(), 'hold')).toHaveLength(1)
    expect(shapeOf(s.piece!.cells)).toEqual(shapeOf(before.nextCells))
    expect(s.piece!.colors).toEqual(before.next)
    expect(Math.abs(lowest(s.piece!.cells) - lowest(before.cells))).toBeLessThanOrEqual(3) // same spot (about its origin)
    expect(s.next).toEqual(before.colors) // the falling piece is the next one now (its base shape, unturned)
    expect(before.rotation).toBe(0)
    expect(shapeOf(s.nextCells!)).toEqual(shapeOf(before.cells))
  })

  it('swapping again trades them back', () => {
    const shift = createShift(realConfig(), { seed: 11, rank: 3 })
    const s = shift.state
    const first = { colors: s.piece!.colors, shape: shapeOf(s.piece!.cells), next: s.next }
    shift.act({ type: 'hold' })
    shift.act({ type: 'hold' })
    expect(s.piece!.colors).toEqual(first.colors)
    expect(shapeOf(s.piece!.cells)).toEqual(first.shape)
    expect(s.next).toEqual(first.next)
  })

  it('no room where the falling piece is: refused, nothing changes', () => {
    // a lesson's chosen pieces: a one-column piece falling, a two-column one next
    const shift = createShift(realConfig(), { seed: 1, rank: 6, training: {} })
    shift.train({ type: 'queue', pieces: [{ shape: 'T_I', color: 1 }, { shape: 'T_O', color: 2 }] })
    shift.train({ type: 'spawn' })
    const s = shift.state
    // goop on both sides of the falling column, all the way down: the two-wide piece has no room there
    // (straight into the grid: train('goop') would let it fall)
    const col = s.piece!.cells[0][0]
    for (let y = 0; y < s.height; y++) for (const x of [col - 1, col + 1]) s.grid[y * s.width + ((x + s.width) % s.width)] = 3
    const before = { cells: s.piece!.cells, next: s.next }
    shift.takeEvents()
    shift.act({ type: 'hold' })
    expect(shift.takeEvents()).toEqual([{ type: 'reject', action: 'hold' }])
    expect(s.piece!.cells).toEqual(before.cells)
    expect(s.next).toEqual(before.next)
  })

  it('before it unlocks (swap: false) it does nothing at all — no swap, no "nope"', () => {
    const shift = createShift(realConfig(), { seed: 7, rank: 0, swap: false })
    const s = shift.state
    const before = { cells: s.piece!.cells, next: s.next }
    expect(shift.allows('hold')).toBe(false)
    expect(shift.allows('spin')).toBe(true)
    shift.takeEvents()
    shift.act({ type: 'hold' })
    expect(shift.takeEvents()).toEqual([])
    expect(s.piece!.cells).toEqual(before.cells)
    expect(s.next).toEqual(before.next)
  })

  it('a snapshot keeps swap off', () => {
    const shift = createShift(realConfig(), { seed: 7, rank: 0, swap: false })
    expect(shift.snapshot().options.swap).toBe(false)
  })

  it("a lesson's chosen pieces still all come, in order, after a swap", () => {
    const config = realConfig()
    const shift = createShift(config, { seed: 1, rank: 6, training: {} })
    shift.train({ type: 'queue', pieces: [{ shape: 'T_I', color: 1 }, { shape: 'T_O', color: 2 }, { shape: 'T_L', color: 3 }] })
    shift.train({ type: 'spawn' }) // 1 falling, 2 next
    shift.act({ type: 'hold' }) // 2 falling, 1 next
    expect(shift.state.piece!.colors[0]).toBe(2)
    expect(shift.state.next![0]).toBe(1)
    dropPiece(shift, config) // 1 comes in, 3 is next
    expect(shift.state.piece!.colors[0]).toBe(1)
    expect(shift.state.next![0]).toBe(3)
  })
})

describe('fill and pop', () => {
  it('a group above the line AND still filling is refused as "above the line" (waiting alone can not fix it)', () => {
    const rows = ['1', ...Array(13).fill('2')]
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(rows, 5) })
    shift.takeEvents()
    shift.act({ type: 'pop', x: 5, y: 10 }) // top group, not full yet, far above the line
    expect(shift.takeEvents()).toEqual([{ type: 'reject', action: 'pop', reason: 'aboveLine', cell: idx(5, 10) }])
  })

  // the goo jiggles where it was poked (Muzzy 2026-10-18): the refused zap says which cell, wrapped round the tank
  it('a refused zap on goop names the poked cell (x wrapped round the tank)', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11'], 5) })
    shift.takeEvents()
    shift.act({ type: 'pop', x: 6 + shift.state.width, y: 23 })
    expect(ofType(shift.takeEvents(), 'reject')).toEqual([{ type: 'reject', action: 'pop', reason: 'filling', cell: idx(6, 23) }])
  })

  it('other refusals carry no reason (a turn into goop, an empty cell)', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0 })
    shift.takeEvents()
    shift.act({ type: 'pop', x: 5, y: 20 }) // nothing there
    expect(shift.takeEvents()).toEqual([{ type: 'reject', action: 'pop' }])
  })

  it('a group fills (375 ms per cell) before it can pop', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11'], 5) })
    shift.act({ type: 'pop', x: 5, y: 23 })
    expect(ofType(shift.takeEvents(), 'reject')).toEqual([{ type: 'reject', action: 'pop', reason: 'filling', cell: idx(5, 23) }]) // F26: says why
    shift.tick(700)
    expect([...shift.state.groups.values()][0].ready).toBe(false)
    shift.tick(60)
    expect(ofType(shift.takeEvents(), 'ready')).toHaveLength(1)
    shift.act({ type: 'pop', x: 5, y: 23 })
    expect(ofType(shift.takeEvents(), 'pop')[0].cells).toEqual([idx(5, 23), idx(6, 23)])
    expect(shift.state.grid[idx(5, 23)]).toBe(0)
  })

  // F67: the zap's laser point — the exact tap rides on the pop event (x wrapped), or the tapped cell's centre without one
  it('the pop event carries where the zap hit (at): the exact tap, else the tapped cell centre', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11.......11'], 3) })
    shift.tick(2000)
    shift.takeEvents()
    shift.act({ type: 'pop', x: 3, y: 23, at: { x: 3.27 + shift.state.width, y: 23.8 } })
    expect(ofType(shift.takeEvents(), 'pop')[0].at).toEqual({ x: expect.closeTo(3.27, 9), y: 23.8 })
    shift.act({ type: 'pop', x: 12, y: 23 }) // a bot / test: no tap point
    expect(ofType(shift.takeEvents(), 'pop')[0].at).toEqual({ x: 12.5, y: 23.5 })
  })

  it('only goop at or below the pressure line can pop', () => {
    // Colour 1 on top of a colour-2 column: its top row (10) is far above the line at the start.
    const rows = ['1', ...Array(13).fill('2')]
    const config = oneShapeConfig([[0, 0]])
    config.integrity.drainPerCrackPerSec = 0 // no rupture while we wait for the line
    const shift = createShift(config, { seed: 1, rank: 0, startGrid: tank(rows, 5) })
    shift.tick(1000)
    const top = shift.state.groups.get(shift.state.groupOf[idx(5, 10)])!
    expect(top.fill).toBe(1)
    expect(top.ready).toBe(false)
    shift.act({ type: 'pop', x: 5, y: 10 })
    const events = shift.takeEvents()
    expect(ofType(events, 'pop')).toHaveLength(0)
    expect(ofType(events, 'reject')).toEqual([{ type: 'reject', action: 'pop', reason: 'aboveLine', cell: idx(5, 10) }]) // F26: says why
    // The line rises with pressure: row 10 is reached at 65% (23 - 0.65 × 20 = 10).
    shift.tick(75000 * 0.65)
    expect(shift.state.pressureRow).toBeLessThanOrEqual(10)
    shift.act({ type: 'pop', x: 5, y: 10 })
    expect(ofType(shift.takeEvents(), 'pop')).toHaveLength(1)
  })

  it('popping vents pressure (v1 refund: 0.1 s of rise per cell) and scores like v1', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11.......11'], 3) })
    shift.tick(2000)
    const pressureBefore = shift.state.pressure
    shift.act({ type: 'pop', x: 3, y: 23 }) // on screen: (10 + 1×10) × 1.1 combo = 22 per cell
    expect(shift.state.pressure).toBeCloseTo(pressureBefore - 200 / 75000, 10)
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

describe('plugging and sealing', () => {
  it('matching goop plugs a crack; popping it seals the crack and vents 0.1 s + 3 s of rise', () => {
    // One colour, so the crack, the pieces and the goop all match. A colour-2 floor two rows deep.
    const floor = '2'.repeat(30)
    const config = oneShapeConfig([[0, 0]])
    config.pressure.riseMsToFull = 75000 // the vent maths below uses exactly these
    config.pop.refundMsPerCell = 100
    config.cracks.sealRefundMs = 3000
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([floor, floor]) })
    tickUntil(shift, () => shift.state.cracks.length > 0)
    const crack = shift.state.cracks[0]
    expect(crack.y).toBe(21) // right on the floor (the only empty row at/below the line)
    while (shift.state.spin !== crack.x) shift.act({ type: 'spin', dir: 1 })
    shift.takeEvents()
    expect(ofType(dropPiece(shift, config), 'plug')).toEqual([{ type: 'plug', crackId: crack.id, plugged: true }])
    expect(shift.state.cracks[0].plugged).toBe(true)

    tickUntil(shift, () => shift.state.groups.get(shift.state.groupOf[idx(crack.x, 21)])!.ready)
    const before = shift.state.pressure
    shift.act({ type: 'pop', x: crack.x, y: 21 })
    const pop = ofType(shift.takeEvents(), 'pop')[0]
    expect(pop.sealed).toEqual([crack.id])
    expect(shift.state.cracksSealed).toBe(1)
    expect(shift.state.cracks).toHaveLength(0)
    expect(shift.state.pressure).toBeCloseTo(before - (100 + 3000) / 75000, 10)
  })
})

