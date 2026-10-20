// Where the tank sits on screen, and how tank cells map to screen pixels and back.
// The view's centre column is the camera; the 12 visible columns are offsets -5..+6 from it.
import type { GooView } from '../goo/types'
import { screenColumn } from '../goo/types'

export interface TankLayout {
  cellPx: number
  left: number // CSS px of the visible tank's left edge
  topY: number // CSS px of the visible tank's top edge (row bufferRows)
  centreX: number // CSS px of the centre column's centre
  widthPx: number
  heightPx: number
}

// The piece falls down screen column 5 of 0–11 (v1), so the visible columns are spin−5 … spin+6.
export const pieceScreenColumn = (visibleWidth: number) => Math.ceil(visibleWidth / 2) - 1

export interface LayoutInput {
  screenW: number
  screenH: number
  visibleWidth: number // 12
  visibleRows: number // 21
  reserveTop: number // px kept free for the HUD
  reserveBottom: number
  gutter: number // px each side
}

export function layoutTank(i: LayoutInput): TankLayout {
  const availW = i.screenW - i.gutter * 2
  const availH = i.screenH - i.reserveTop - i.reserveBottom
  const cellPx = Math.max(8, Math.floor(Math.min(availW / i.visibleWidth, availH / i.visibleRows)))
  const widthPx = cellPx * i.visibleWidth
  const heightPx = cellPx * i.visibleRows
  const left = Math.round((i.screenW - widthPx) / 2)
  const topY = Math.round(i.reserveTop + (availH - heightPx) / 2)
  return { cellPx, left, topY, centreX: left + (pieceScreenColumn(i.visibleWidth) + 0.5) * cellPx, widthPx, heightPx }
}

// The visible tank's rectangle on screen (CSS px): the 12 columns × the visible rows, from the view.
export function tankRect(view: GooView, visibleWidth: number, visibleRows: number) {
  const left = view.centreX - (pieceScreenColumn(visibleWidth) + 0.5) * view.cellPx
  return { left, top: view.topY, width: visibleWidth * view.cellPx, height: visibleRows * view.cellPx }
}

// Centre of tank cell (x, y) on screen for a fractional camera.
export function cellToScreen(x: number, y: number, view: GooView, width: number, bufferRows: number): [number, number] {
  return [view.centreX + screenColumn(x, view.camera, width) * view.cellPx, view.topY + (y - bufferRows + 0.5) * view.cellPx]
}

// The tank cell under a screen point (x wraps; y may be outside the tank — the caller checks).
export function screenToCell(px: number, py: number, view: GooView, width: number, bufferRows: number): [number, number] {
  const col = Math.round(view.camera + (px - view.centreX) / view.cellPx)
  const x = ((col % width) + width) % width
  const y = Math.floor((py - view.topY) / view.cellPx) + bufferRows
  return [x, y]
}

// The tank cell under a click — only inside the visible tank (F58, 2026-10-19: a click just beside the tank wrapped
// round to a column on the hidden back and zapped goop the player couldn't see). Outside → null.
export function screenToVisibleCell(px: number, py: number, view: GooView, width: number, bufferRows: number,
  visibleWidth: number, visibleRows: number): [number, number] | null {
  const r = tankRect(view, visibleWidth, visibleRows)
  if (px < r.left || px >= r.left + r.width || py < r.top || py >= r.top + r.height) return null
  return screenToCell(px, py, view, width, bufferRows)
}

// The camera glides toward the engine's spin, taking the short way round the cylinder.
export function stepCamera(camera: number, spin: number, width: number, dtSec: number, speed: number): number {
  let d = spin - camera
  d = ((d % width) + width) % width
  if (d > width / 2) d -= width
  if (Math.abs(d) < 0.001) return spin
  const next = camera + d * Math.min(1, dtSec * speed)
  return ((next % width) + width) % width
}
