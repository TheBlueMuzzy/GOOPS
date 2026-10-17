// Tank-space helpers for the goo. The tank is a cylinder `width` columns around; the goo simulates in VIEW space:
// x = cells from the centre column's centre (0 = view.centreX), y = tank row (0 = top of the spawn buffer).
// Spinning moves every cell's home in view space, so the goo sloshes (TDD D03).
import type { ShiftState } from '../../engine/types'
import { screenColumn, type GooView } from '../types'

// THE placement rule (shared with the tank view): centre of tank cell (x, y) in CSS px.
// view.centreX is the centre of the column the camera points at; a cell's square spans ± cellPx / 2.
export function cellToScreen(x: number, y: number, view: GooView, state: Pick<ShiftState, 'width' | 'bufferRows'>): [number, number] {
  return [
    view.centreX + screenColumn(x, view.camera, state.width) * view.cellPx,
    view.topY + (y - state.bufferRows + 0.5) * view.cellPx,
  ]
}

// View space -> CSS px. vx/vy are view-space cells (a cell's centre is at vx = screenColumn(x), vy = y + 0.5).
export function viewOrigin(view: GooView, bufferRows: number): [number, number] {
  return [view.centreX, view.topY - bufferRows * view.cellPx]
}

// An offset in columns wrapped into [-width/2, width/2)
export function wrapNear(d: number, width: number): number {
  return screenColumn(d, 0, width)
}

// A body built in unwrapped columns (its cells' centres average `centreCol`) is drawn as the copy nearest the
// camera: view x = unwrappedColumn - camera + k * width. Returns k (a whole number) so the caller can notice a jump.
export function wrapTurns(centreCol: number, camera: number, width: number): number {
  const d = centreCol - camera
  return Math.round((wrapNear(d, width) - d) / width)
}

export interface Unwrapped {
  ux: number[] // unwrapped column per cell (same order as the input)
  uy: number[]
  ring: boolean // the group wraps all the way around the tank (no single unwrapped copy exists)
}

// Grid indexes of one connected group -> unwrapped columns, so a group sitting on the seam (29 <-> 0) stays in one
// piece. Walks the group from its first cell; a neighbour reached two ways with columns `width` apart = a ring.
export function unwrapCells(cells: number[], width: number): Unwrapped {
  const n = cells.length
  const at = new Map<number, number>()
  cells.forEach((c, i) => at.set(c, i))
  const ux: number[] = new Array(n).fill(NaN)
  const uy: number[] = cells.map((c) => Math.floor(c / width))
  let ring = false
  for (let s = 0; s < n; s++) {
    if (!Number.isNaN(ux[s])) continue // a second island (not expected for a group): unwrap it on its own
    ux[s] = cells[s] % width
    const stack = [s]
    while (stack.length) {
      const i = stack.pop()!
      const x = cells[i] % width
      const y = uy[i]
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = (x + dx + width) % width
        const j = at.get((y + dy) * width + nx)
        if (j === undefined || uy[j] !== y + dy) continue
        const want = ux[i] + dx
        if (Number.isNaN(ux[j])) {
          ux[j] = want
          stack.push(j)
        } else if (ux[j] !== want) ring = true
      }
    }
  }
  return { ux, uy, ring }
}

// Unwrap with the cut on the far side of the tank from the camera (for rings: the cut is never on screen)
export function unwrapAround(cells: number[], width: number, camera: number): Unwrapped {
  const c0 = Math.round(camera)
  return {
    ux: cells.map((c) => c0 + wrapNear((c % width) - c0, width)),
    uy: cells.map((c) => Math.floor(c / width)),
    ring: true,
  }
}

export interface FillInfo {
  line: number // tank row (y, fractional, top edge = 0) of the fill level: below it is filled
  fill: number
  ready: boolean
}

// Each group's fill level rises from its bottom row up: line = bottom - fill * height
export function groupFillLines(state: Pick<ShiftState, 'groups' | 'width'>): Map<number, FillInfo> {
  const out = new Map<number, FillInfo>()
  for (const g of state.groups.values()) {
    let y0 = Infinity
    let y1 = -Infinity
    for (const c of g.cells) {
      const y = Math.floor(c / state.width)
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    if (!g.cells.length) continue
    const fill = Math.max(0, Math.min(1, g.fill))
    out.set(g.id, { line: y1 + 1 - fill * (y1 + 1 - y0), fill, ready: g.ready })
  }
  return out
}

// The tank window on screen, in cells from view.centreX: [left edge, right edge]. v1 draws the falling piece in
// screen column 5 of 0..11, so with 12 visible columns the offsets -5 .. +6 are on screen. The ONLY place this lives.
export function tankWindow(visibleWidth: number): [number, number] {
  const right = visibleWidth / 2 + 0.5
  return [right - visibleWidth, right]
}

// Is a cell whose centre is at this column offset (from screenColumn) on screen, give or take `margin` columns?
export function inWindow(offset: number, visibleWidth: number, margin: number): boolean {
  const [l, r] = tankWindow(visibleWidth)
  return offset > l - margin && offset < r + margin
}
