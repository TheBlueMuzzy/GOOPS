// Piece shapes: picking one, mirroring, rotating, and testing where it fits.
import { type Color, WILD } from './types'
import type { ShiftConfig } from './config'
import { type TwistsConfig, bestSplit, splitChance, splitOn, wildChance, wildOn } from './twists'
import { shapeSet } from './config'
import type { Rng } from './rng'
import { wrapX } from './tank'

export type Cell = [x: number, y: number]

// A piece before it is placed: its base shape and colour (what "next" holds).
export interface PieceDef {
  name: string
  cells: Cell[]
  color: Color // WILD for a wild piece (F39); a two-colour piece's first colour
  corrupted: boolean
  noRotate: boolean
  colors?: Color[] // F39 two-colour pieces: one per cell, in `cells` order (rotating and mirroring keep the order); unset = all `color`
}

// The falling piece. It lives in SCREEN columns: column `offset` from the centre (0 = straight down the
// middle). Its tank column is spin + offset, so turning the tank moves it through the tank.
export interface FallingPiece {
  def: PieceDef
  cells: Cell[] // current rotation, relative to the piece origin
  center: Cell // fixed rotation point (rounded middle of the base shape, as v1)
  rotation: number // 0..3
  offset: number // screen columns from the centre; only wall kicks change it
  y: number // origin row
  fall: number // 0..1 progress towards the next row (for smooth drawing only — rules use `y`)
}

// v1 mirrors only shapes that change when flipped (flip = negate x).
export function mirror(cells: Cell[]): Cell[] {
  const symmetric = cells.every(([x, y]) => cells.some(([ox, oy]) => ox === -x && oy === y))
  return symmetric ? cells : cells.map(([x, y]) => [0 - x, y] as Cell) // 0 - x so column 0 stays 0, not -0
}

// Pick a random piece from a size zone ('tetra' | 'penta' | 'hexa'), as v1 does.
// F39 rank twists (twists.ts), in v1's order: corrupt first (a corrupt piece is never wild or two-colour), then wild
// (from its rank), then two-colour (from its rank, if not wild). Their rolls come AFTER the old ones and only from each
// twist's rank, so pieces below rank 20 come out exactly as before. Leave `twists` out = no twists.
export function randomPiece(rng: Rng, config: ShiftConfig, zone: string, colorCount: number, twists?: { config: TwistsConfig; rank: number }): PieceDef {
  const corrupted = rng.chance(config.pieces.corruptChance)
  const set = shapeSet(config, zone)
  const shape = rng.pick(corrupted ? set.corrupted : set.normal)
  let cells = shape.cells.map(([x, y]) => [x, y] as Cell)
  if (rng.chance(config.pieces.mirrorChance)) cells = mirror(cells)
  const def: PieceDef = { name: shape.name, cells, color: 1 + rng.int(colorCount), corrupted, noRotate: !!shape.noRotate }
  const t = twists?.config
  if (!t || corrupted) return def
  if (wildOn(t, twists.rank) && rng.chance(wildChance(t))) {
    def.color = WILD
    return def
  }
  if (splitOn(t, twists.rank) && colorCount >= 2 && rng.chance(splitChance(t))) {
    const inA = bestSplit(cells)
    if (inA) {
      const other: Color = 1 + ((def.color - 1 + 1 + rng.int(colorCount - 1)) % colorCount) // any colour but the first
      def.colors = inA.map((a) => (a ? def.color : other))
    }
  }
  return def
}

/** The colour of a piece's k-th cell (two-colour pieces have one per cell; the rest are all def.color). */
export const cellColor = (def: PieceDef, k: number): Color => def.colors?.[k] ?? def.color

/**
 * F42: the piece's MAIN colour — what Goop Dump and Goop Colorizer copy. One colour: that colour. A two-colour piece:
 * the colour most of its cells have (a tie: its first colour, def.color). A wild piece has none (null): wild is never
 * copied, so those abilities never make wild goop.
 */
export function mainColor(def: PieceDef): Color | null {
  if (def.color === WILD) return null
  if (!def.colors) return def.color
  const first = def.colors.filter((c) => c === def.color).length
  const other = def.colors.find((c) => c !== def.color)
  return other !== undefined && def.colors.length - first > first ? other : def.color
}

/** F42 Goop Colorizer: the same piece (shape, corruption) all in one colour — a copy; the original is left alone. */
export function recolored(def: PieceDef, color: Color): PieceDef {
  const out: PieceDef = { ...def, cells: def.cells.map(([x, y]) => [x, y] as Cell), color }
  delete out.colors
  return out
}

export function rotationCenter(cells: Cell[]): Cell {
  const sx = cells.reduce((sum, c) => sum + c[0], 0)
  const sy = cells.reduce((sum, c) => sum + c[1], 0)
  // (+ 0: Math.round(-0.25) is -0, which a saved snapshot (JSON) turns into 0 — keep it a plain 0 from the start)
  return [Math.round(sx / cells.length) + 0, Math.round(sy / cells.length) + 0]
}

// Quarter turn around a fixed point. dir 1 = clockwise (on screen, y down).
export function rotateCells(cells: Cell[], dir: 1 | -1, center: Cell): Cell[] {
  const [cx, cy] = center
  return cells.map(([x, y]) => {
    const dx = x - cx
    const dy = y - cy
    return (dir === 1 ? [-dy + cx, dx + cy] : [dy + cx, -dx + cy]) as Cell
  })
}

export function newFallingPiece(def: PieceDef, offset: number, y: number): FallingPiece {
  return { def, cells: def.cells.map(([x, y]) => [x, y] as Cell), center: rotationCenter(def.cells), rotation: 0, offset, y, fall: 0 }
}

// Absolute tank cells for the piece at a given origin. Rows above 0 are allowed (spawn overhang).
export function placeCells(cells: Cell[], originX: number, originY: number, width: number): Cell[] {
  return cells.map(([x, y]) => [wrapX(originX + x, width), originY + y] as Cell)
}

// Blocked by the floor or by goop. Cells above the tank never collide (v1).
export function collides(grid: Uint8Array, cells: Cell[], width: number, height: number): boolean {
  for (const [x, y] of cells) {
    if (y >= height) return true
    if (y >= 0 && grid[y * width + x] !== 0) return true
  }
  return false
}

// How far the piece could drop from row y before it lands.
export function landingRow(grid: Uint8Array, cells: Cell[], originX: number, y: number, width: number, height: number): number {
  let row = y
  while (!collides(grid, placeCells(cells, originX, row + 1, width), width, height)) row++
  return row
}
