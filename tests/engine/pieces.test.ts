// Ported from v1 tests/gameLogic.test.ts (getRotatedCells, checkCollision, getGhostY) + every shape at the seam.
import { describe, expect, it } from 'vitest'
import { type Cell, collides, landingRow, mirror, placeCells, rotateCells, rotationCenter } from '../../src/engine/pieces'
import { shapeSet } from '../../src/engine/config'
import { createShift } from '../../src/engine'
import { dropPiece, oneShapeConfig, realConfig, tank } from './helpers'

const W = 30
const H = 24

describe('rotateCells', () => {
  const origin: Cell = [0, 0]
  it('rotates origin-centred cells clockwise and counter-clockwise', () => {
    expect(rotateCells([[1, 0]], 1, origin)).toEqual([[0, 1]])
    expect(rotateCells([[1, 0]], -1, origin)).toEqual([[0, -1]])
  })

  it('four turns come back exactly, around a fixed off-centre point (corrupted T_I_C)', () => {
    const cells: Cell[] = [[0, 2], [0, 3], [1, 0], [1, 1]]
    const center = rotationCenter(cells)
    let turned = cells
    for (let i = 0; i < 4; i++) turned = rotateCells(turned, 1, center)
    expect(turned.map(([x, y]) => [x + 0, y + 0])).toEqual(cells)
  })

  it('I-bar turns around its fixed centre, not the origin', () => {
    const bar: Cell[] = [[0, -1], [0, 0], [0, 1], [0, 2]]
    const center = rotationCenter(bar) // (0, round(0.5)) = (0, 1)
    expect(center).toEqual([0, 1])
    const flat = rotateCells(bar, 1, center)
    expect(flat.every(([, y]) => y === 1)).toBe(true)
  })
})

describe('mirror', () => {
  it('flips shapes that change, leaves symmetric ones', () => {
    expect(mirror([[0, 0], [1, 0], [0, 1]])).toEqual([[0, 0], [-1, 0], [0, 1]])
    const plus: Cell[] = [[-1, 0], [0, 0], [1, 0], [0, 1]]
    expect(mirror(plus)).toBe(plus)
  })
})

describe('collides', () => {
  const empty = new Uint8Array(W * H)
  it('is free in empty space, blocked by the floor', () => {
    expect(collides(empty, [[5, 5]], W, H)).toBe(false)
    expect(collides(empty, [[5, H]], W, H)).toBe(true)
  })
  it('is blocked by goop, and rows above the tank never collide', () => {
    const grid = tank(['1'], 5)
    expect(collides(grid, [[5, H - 1]], W, H)).toBe(true)
    expect(collides(grid, [[5, -2]], W, H)).toBe(false)
  })
  it('wraps around the cylinder', () => {
    const grid = tank(['1'], 0)
    expect(collides(grid, placeCells([[1, 0]], 29, H - 1, W), W, H)).toBe(true)
  })
})

describe('landingRow (ghost)', () => {
  it('lands on goop below, or on the floor', () => {
    const grid = tank(['1', '1'], 5)
    expect(landingRow(grid, [[0, 0]], 5, 0, W, H)).toBe(H - 3)
    expect(landingRow(grid, [[0, 0]], 6, 0, W, H)).toBe(H - 1)
  })
})

describe('every v1 shape, every rotation, across the seam', () => {
  const config = realConfig()
  const shapes = config.pieces.zones.flatMap((zone) => {
    const set = shapeSet(config, zone)
    return [...set.normal, ...set.corrupted]
  })

  it('has the 54 v1 shapes with 4, 5 or 6 cells', () => {
    expect(shapes).toHaveLength(54)
    for (const s of shapes) expect([4, 5, 6]).toContain(s.cells.length)
  })

  for (const shape of shapes) {
    it(`${shape.name} lands inside the tank at column 29 in all 4 rotations`, () => {
      for (let turns = 0; turns < 4; turns++) {
        const config = oneShapeConfig(shape.cells, { noRotate: shape.noRotate })
        const shift = createShift(config, { seed: 1, rank: 0 })
        shift.act({ type: 'spin', dir: -1 }) // piece origin on column 29, so its cells straddle the 29 → 0 seam
        for (let t = 0; t < turns; t++) shift.act({ type: 'rotate', dir: 1 })
        dropPiece(shift, config)
        const s = shift.state
        let count = 0
        for (const c of s.grid) if (c !== 0) count++
        // Every cell of the piece made it into the tank (it spawned high enough, nothing lost).
        expect(count).toBe(shape.cells.length)
        // And the next piece is not overlapping anything.
        for (const [x, y] of s.piece!.cells) if (y >= 0) expect(s.grid[y * W + x]).toBe(0)
      }
    })
  }
})
