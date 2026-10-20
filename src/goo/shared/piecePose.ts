// The falling piece's visual pose (from L4 Jelly, used by BOTH renderers): the drawn piece lags the grid piece on
// springs. Rotate = it lags 90° behind and springs over with a little overshoot; move = it lags sideways; the row
// steps are a smooth glide using piece.fall (no per-row lurch).
// The piece is placed with state.spin (not the animated camera) so it stays put on screen while the tank slides under it.
import type { Piece } from '../../engine/types'
import { wrapNear } from './tank'

export interface PieceShape {
  ux: number[] // unwrapped column per cell (cell spans ux .. ux+1 in edge units)
  uy: number[]
  cx: number // centre of the cells (edge units: a single cell at column 3 has cx = 3.5)
  cy: number
}

export function pieceShape(p: Piece, width: number): PieceShape {
  const x0 = p.cells[0][0]
  const ux = p.cells.map(([x]) => x0 + wrapNear(x - x0, width))
  const uy = p.cells.map(([, y]) => y)
  const n = Math.max(1, ux.length)
  return { ux, uy, cx: ux.reduce((s, v) => s + v, 0) / n + 0.5, cy: uy.reduce((s, v) => s + v, 0) / n + 0.5 }
}

// Which quarter turn takes shape A to shape B (about their centres)? +1 / -1 (angle +-90°, y down), 0 = neither
export function quarterTurn(a: PieceShape, b: PieceShape): 1 | -1 | 0 {
  if (a.ux.length !== b.ux.length) return 0
  const key = (x: number, y: number) => `${Math.round(x * 2)},${Math.round(y * 2)}`
  if (sameCells(a, b)) return 0 // just moved
  const target = new Set(b.ux.map((x, i) => key(x + 0.5 - b.cx, b.uy[i] + 0.5 - b.cy)))
  for (const s of [1, -1] as const) {
    let ok = true
    for (let i = 0; i < a.ux.length && ok; i++) {
      const dx = a.ux[i] + 0.5 - a.cx
      const dy = a.uy[i] + 0.5 - a.cy
      ok = target.has(key(-s * dy, s * dx)) // rotate by s * 90°: (x, y) -> (-y, x) for +90° with y down
    }
    if (ok) return s
  }
  return 0
}

// Same cells relative to their centre (the piece only moved)
function sameCells(a: PieceShape, b: PieceShape): boolean {
  const key = (x: number, y: number) => `${Math.round(x * 2)},${Math.round(y * 2)}`
  const k = new Set(b.ux.map((x, i) => key(x + 0.5 - b.cx, b.uy[i] + 0.5 - b.cy)))
  return a.ux.every((x, i) => k.has(key(x + 0.5 - a.cx, a.uy[i] + 0.5 - a.cy)))
}

export class PiecePose {
  // spring offsets (cells / radians) of the drawn piece from where the grid says it is
  x = 0
  vx = 0
  y = 0
  vy = 0
  a = 0
  va = 0
  glide = 0
  shape: PieceShape | null = null
  color = 0
  private shapeSpin = 0 // state.spin when `shape` was taken (the piece is placed relative to the spin)

  spawn(p: Piece, width: number, spin: number, lift: number): void {
    this.x = this.vx = this.vy = this.a = this.va = 0
    this.y = lift
    this.shape = pieceShape(p, width)
    this.shapeSpin = spin
    this.color = p.colors[0] ?? 0
    this.glide = Math.max(0, Math.min(1, p.fall))
  }

  // The grid piece turned or moved this frame (rotate, move, wall kick). Returns the turn found (0 = just moved).
  reshape(p: Piece, width: number, spin: number, dirHint: number): 1 | -1 | 0 {
    const before = this.shape
    const after = pieceShape(p, width)
    if (!before) {
      this.shape = after
      this.shapeSpin = spin
      return 0
    }
    let turn = quarterTurn(before, after)
    // a rotate that leaves the same cells (the square) still turns visibly, like the sketch
    if (!turn && dirHint && before.ux.length === after.ux.length) turn = dirHint > 0 ? 1 : -1
    if (turn) this.a -= (turn * Math.PI) / 2
    // keep the drawn centre where it was on screen; the spring carries it over
    this.x -= wrapNear(after.cx - spin - (before.cx - this.shapeSpin), width)
    this.y -= after.cy - before.cy
    this.shape = after
    this.shapeSpin = spin
    return turn
  }

  // Hard drop: the drawn piece stays up there for now (the lock that follows turns it into a falling goo)
  drop(rows: number): void {
    this.y -= rows
  }

  // Was the piece swapped for a different one without a spawn (hold)? Different colour or a different shape.
  swapped(p: Piece, width: number): boolean {
    if (!this.shape) return true
    if ((p.colors[0] ?? 0) !== this.color) return true
    const s = pieceShape(p, width)
    return s.ux.length !== this.shape.ux.length || (!sameCells(s, this.shape) && quarterTurn(this.shape, s) === 0)
  }

  // Every frame, before the springs: track row steps, spins and piece.fall. The drawn y = row + glide + spring, so a
  // normal step (row +1, glide 1 -> 0) is seamless; any other jump (e.g. slipping down a row while spinning) is handed
  // to the spring so the goo never lurches.
  follow(p: Piece, width: number, spin: number): void {
    const s = pieceShape(p, width)
    const glide = Math.max(0, Math.min(1, p.fall))
    if (this.shape) {
      const jump = s.cy + glide - (this.shape.cy + this.glide)
      if (Math.abs(jump) > 0.2) this.y -= jump
    }
    this.shape = s
    this.shapeSpin = spin
    this.glide = glide
  }

  // One small physics step (L4's critically damped pose springs; the angle overshoots a little)
  integrate(h: number): void {
    const K = 260
    const crit = 2 * Math.sqrt(K)
    this.vx += (-this.x * K - this.vx * crit) * h
    this.x += this.vx * h
    this.vy += (-this.y * K * 0.6 - this.vy * crit * 0.8) * h
    this.y += this.vy * h
    this.va += (-this.a * K * 0.7 - this.va * 9) * h
    this.a += this.va * h
  }

  // The drawn centre in view space (x = cells from the view centre column, y = rows)
  viewCentre(spin: number, width: number): [number, number] {
    const s = this.shape!
    return [wrapNear(s.cx - 0.5 - spin, width) + this.x, s.cy + this.glide + this.y]
  }

  // Where a point of the piece is drawn, in view space. (rx, ry) = the point relative to the piece's centre
  // (shape.cx, shape.cy), so row steps and spins never move it - only the glide and the springs do.
  viewRel(rx: number, ry: number, spin: number, width: number): [number, number] {
    const [vx, vy] = this.viewCentre(spin, width)
    const ca = Math.cos(this.a)
    const sa = Math.sin(this.a)
    return [vx + ca * rx - sa * ry, vy + sa * rx + ca * ry]
  }
}
