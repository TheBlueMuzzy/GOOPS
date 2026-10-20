import { describe, expect, it } from 'vitest'
import { cellToScreen, groupFillLines, inWindow, tankWindow, unwrapAround, unwrapCells, wrapNear, wrapTurns } from '../../src/goo/shared/tank'
import type { Group } from '../../src/engine/types'

const W = 30

describe('wrapNear', () => {
  it('wraps an offset into [-15, 15)', () => {
    expect(wrapNear(0, W)).toBe(0)
    expect(wrapNear(29, W)).toBe(-1)
    expect(wrapNear(-16, W)).toBe(14)
    expect(wrapNear(15, W)).toBe(-15)
  })
})

describe('cellToScreen', () => {
  const view = { cellPx: 10, centreX: 100, topY: 50, camera: 0, width: 400, height: 400, dpr: 1 }
  const state = { width: W, bufferRows: 3 }
  it('puts the camera column centre at centreX and row bufferRows just under topY', () => {
    expect(cellToScreen(0, 3, view, state)).toEqual([100, 55])
  })
  it('wraps: column 29 sits just left of column 0', () => {
    expect(cellToScreen(29, 3, view, state)).toEqual([90, 55])
  })
  it('follows a fractional camera', () => {
    expect(cellToScreen(1, 0, { ...view, camera: 0.5 }, state)).toEqual([105, 25])
  })
})

describe('tank window', () => {
  it('shows offsets -5..+6 for 12 visible columns', () => {
    expect(tankWindow(12)).toEqual([-5.5, 6.5])
    expect(inWindow(-5, 12, 0)).toBe(true)
    expect(inWindow(6, 12, 0)).toBe(true)
    expect(inWindow(-6, 12, 0)).toBe(false)
    expect(inWindow(7, 12, 0)).toBe(false)
    expect(inWindow(-8, 12, 3)).toBe(true)
  })
})

describe('unwrapCells (a body across the wrap seam stays in one piece)', () => {
  it('unwraps a row of cells over the seam into consecutive columns', () => {
    const cells = [5 * W + 28, 5 * W + 29, 5 * W + 0, 5 * W + 1]
    const u = unwrapCells(cells, W)
    expect(u.ring).toBe(false)
    expect(u.ux).toEqual([28, 29, 30, 31])
    expect(u.uy).toEqual([5, 5, 5, 5])
  })
  it('starting on the other side of the seam gives the same shape', () => {
    const u = unwrapCells([5 * W + 0, 5 * W + 29, 6 * W + 29], W)
    expect(u.ux).toEqual([0, -1, -1])
    expect(u.uy).toEqual([5, 5, 6])
  })
  it('spots a ring all the way round the tank', () => {
    const ring = Array.from({ length: W }, (_, x) => 7 * W + x)
    expect(unwrapCells(ring, W).ring).toBe(true)
  })
  it('cuts a ring on the far side from the camera', () => {
    const ring = Array.from({ length: W }, (_, x) => 7 * W + x)
    const u = unwrapAround(ring, W, 3)
    expect(Math.min(...u.ux)).toBe(3 - 15)
    expect(Math.max(...u.ux)).toBe(3 + 14)
  })
})

describe('wrapTurns (the whole body moves to the copy nearest the camera)', () => {
  it('is 0 when the body is already near', () => {
    expect(wrapTurns(29.5, 0, W)).toBe(-1)
    expect(wrapTurns(3, 1, W)).toBe(0)
  })
  it('moves a body unwrapped past the seam back near the camera', () => {
    // centre column 30.5 (columns 30, 31 = tank 0, 1) seen from camera 0: shift by -1 turn
    expect(wrapTurns(30.5, 0, W)).toBe(-1)
    expect(30.5 - 0 + wrapTurns(30.5, 0, W) * W).toBeCloseTo(0.5)
  })
})

describe('groupFillLines', () => {
  const g = (id: number, cells: number[], fill: number, ready = false): Group => ({ id, color: 1, cells, fill, ready })
  it('rises from the bottom row up', () => {
    const groups = new Map([[1, g(1, [10 * W, 11 * W, 12 * W], 0)], [2, g(2, [10 * W, 11 * W], 0.5)], [3, g(3, [4 * W], 1, true)]])
    const f = groupFillLines({ groups, width: W })
    expect(f.get(1)!.line).toBe(13) // empty: level at the bottom edge
    expect(f.get(2)!.line).toBe(11) // half of rows 10..11
    expect(f.get(3)!.line).toBe(4) // full: level at the top edge
    expect(f.get(3)!.ready).toBe(true)
  })
})
