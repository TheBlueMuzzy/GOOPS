// F39 RANK TWISTS (GDD rank twists, v1's numbers): the goop holds hands (twoColourPieces), wakes up (cracksGrow), then helps you (wildGoop).
//   - twoColourPieces: two-colour pieces — a share of pieces split into two even halves, each half joined up (4-connected), in two
//     different colours. They lock as two clumps. (v1 utils/pieceUtils.ts findBestSplit)
//   - cracksGrow: growing cracks — when a new crack would form, an X% chance it grows an old crack by one cell instead,
//     from one of its uncovered cells (F83, Muzzy 2026-11-02; until F83 each uncovered cell rolled on a timer). A grown
//     crack is ONE crack (one colour) over many cells (Muzzy 2026-10-25): plugged only while EVERY cell is covered by
//     its colour (or wild), and sealing it counts its cell count toward the quota. Goop covering a cell stops that
//     cell growing. (v1 PRD "Expanding Cracks")
//   - wildGoop: wild goop — a share of pieces are WILD (types.ts): plugs any crack colour; a normal piece locking next to a
//     wild clump turns the whole clump its colour (shift.ts lockPiece).
// Numbers: content/tuning/twists.json, read at the moment each is used (live). Randomness only through the shift's
// seeded rng, and only from each twist's rank — so shifts before twoColourPieces roll exactly the numbers they did before.
import { type Color, type Crack, type ShiftEvent, type ShiftState, WILD } from './types'
import type { Rng } from './rng'
import { wrapX } from './tank'
import { rankOf } from '../progress/ladder'

// The shape of content/tuning/twists.json (F78: the rank each twist starts at is a ladder beat — content/tuning/ladder.json
// twoColourPieces / cracksGrow / wildGoop — read live)
export interface TwistsConfig {
  split: { chance: number }
  grow: {
    extendChance: number // F83: the chance a new crack grows an old one instead (0..1)
    diagonals: boolean
  }
  wild: { chance: number }
}

const num = (v: unknown, fallback: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback)
const share = (v: unknown) => Math.min(1, num(v, 0))

/** Is this twist on at this rank? (no twists file handed in = no twists, as before F39; the rank: the ladder's beat) */
export const splitOn = (t: TwistsConfig | undefined, rank: number) => !!t && rank >= rankOf('twoColourPieces')
export const growOn = (t: TwistsConfig | undefined, rank: number) => !!t && rank >= rankOf('cracksGrow')
export const wildOn = (t: TwistsConfig | undefined, rank: number) => !!t && rank >= rankOf('wildGoop')
export const splitChance = (t: TwistsConfig) => share(t.split.chance)
export const wildChance = (t: TwistsConfig) => share(t.wild.chance)

// ---------------------------------------------------------------- two-colour pieces (twoColourPieces)

type XY = [number, number] | number[]

/** Are these cells one joined-up piece (touching up / down / left / right)? One cell or none: yes. */
export function isConnected(cells: XY[]): boolean {
  if (cells.length <= 1) return true
  const key = (x: number, y: number) => `${x},${y}`
  const all = new Set(cells.map(([x, y]) => key(x, y)))
  const seen = new Set<string>([key(cells[0][0], cells[0][1])])
  const todo = [cells[0]]
  while (todo.length) {
    const [x, y] = todo.pop()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = key(x + dx, y + dy)
      if (all.has(k) && !seen.has(k)) { seen.add(k); todo.push([x + dx, y + dy]) }
    }
  }
  return seen.size === all.size
}

/** v1's most even split: which cells go in half A (true) — both halves joined up, sizes as close as they can be.
 *  Tries every way to split (a piece has at most 6 cells: 62 ways). null = it can't be split (fewer than 2 cells). */
export function bestSplit(cells: XY[]): boolean[] | null {
  const n = cells.length
  if (n < 2) return null
  let best: boolean[] | null = null
  let bestGap = Infinity
  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    const inA = cells.map((_, i) => (mask & (1 << i)) !== 0)
    const gap = Math.abs(inA.filter(Boolean).length * 2 - n)
    if (gap >= bestGap) continue
    if (!isConnected(cells.filter((_, i) => inA[i])) || !isConnected(cells.filter((_, i) => !inA[i]))) continue
    best = inA
    bestGap = gap
    if (gap <= n % 2) break // as even as it gets
  }
  return best
}

// ---------------------------------------------------------------- cracks over many cells (cracksGrow)

/** Every cell of a crack, root first. */
export function crackCells(c: Crack): [number, number][] {
  return c.cells ?? [[c.x, c.y]]
}

/** How many cells a crack covers (1 until it grows). */
export const crackSize = (c: Crack) => c.cells?.length ?? 1

/** Is there goop of any colour on this crack cell? (F49: halves its wear; the bubbles and the x-ray ask the same.) */
export const cellCovered = (s: ShiftState, x: number, y: number) => s.grid[y * s.width + x] !== 0

/** Is (x, y) one of this crack's cells? */
export function crackHas(c: Crack, x: number, y: number): boolean {
  return crackCells(c).some(([cx, cy]) => cx === x && cy === y)
}

/** Does this goop colour plug a crack of this colour? Its own colour does, and wild goop plugs any (F39). */
export const plugsCrack = (goop: Color, crack: Color) => goop !== 0 && (goop === crack || goop === WILD)

/** Is every cell of this crack plugged (its colour or wild on each)? Only then can popping seal it. */
export function crackPlugged(s: ShiftState, c: Crack): boolean {
  return crackCells(c).every(([x, y]) => plugsCrack(s.grid[y * s.width + x], c.color))
}

// ---------------------------------------------------------------- a new crack grows an old one instead (F83)
// Muzzy 2026-11-02: "when a new crack would form, there is an X% chance that instead, it extends a crack that exists
// that isn't covered yet … it can only grow from exposed/uncovered parts of the crack." The same number of crack cells
// appear as without it; the difficulty is having to cover the whole crack.

/** X: the chance a new crack grows an old one instead (grow.extendChance × `mult`, Slow Cracks' growChanceMult). */
export function extendChance(t: TwistsConfig, mult = 1): number {
  return share(num(t.grow.extendChance, 0) * Math.max(0, mult))
}

// The cells a crack can't grow into: goop, any crack's cell, a sealed spot, the white goop's cell, the hidden rows,
// and above the pressure line (cracks only ever form where you could seal them — cracks.ts spawnCrack).
function takenCells(s: ShiftState): Set<number> {
  const taken = new Set<number>()
  for (const c of s.cracks) for (const [x, y] of crackCells(c)) taken.add(y * s.width + x)
  for (const c of s.sealedCracks ?? []) taken.add(c.y * s.width + c.x)
  if (s.vet) taken.add(s.vet.y * s.width + s.vet.x)
  return taken
}

/** Grow one existing crack by ONE cell, in place of a new crack. `lineRow` = the highest row a crack may be in (the
 *  pressure line). The pick (seeded): a crack at random among those that can grow, then one of its UNCOVERED cells that
 *  has a free cell next to it (a covered cell never grows), then one of those free cells (8 round it, or 4 with
 *  grow.diagonals false). Pushes a 'crackGrow' event. false = no crack anywhere can grow (form a new crack instead). */
export function extendCrack(s: ShiftState, rng: Rng, t: TwistsConfig, lineRow: number, events: ShiftEvent[]): boolean {
  const dirs = t.grow.diagonals !== false
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const top = Math.max(s.bufferRows, lineRow)
  const taken = takenCells(s)
  // every crack that can grow, with each uncovered cell of it that can (and where to)
  const options: { crack: Crack; from: { k: number; free: number[] }[] }[] = []
  for (const c of s.cracks) {
    const from: { k: number; free: number[] }[] = []
    for (const [k, [x, y]] of crackCells(c).entries()) {
      if (s.grid[y * s.width + x] !== 0) continue // covered: this cell doesn't grow
      const free: number[] = []
      for (const [dx, dy] of dirs) {
        const row = y + dy
        if (row < top || row >= s.height) continue
        const i = row * s.width + wrapX(x + dx, s.width)
        if (s.grid[i] === 0 && !taken.has(i)) free.push(i)
      }
      if (free.length) from.push({ k, free })
    }
    if (from.length) options.push({ crack: c, from })
  }
  if (options.length === 0) return false
  const { crack, from } = rng.pick(options)
  const cell = rng.pick(from)
  const at = rng.pick(cell.free)
  const nx = at % s.width, ny = Math.floor(at / s.width)
  const cells = crackCells(crack)
  // (parent: which cell each grew from, for the seam the tank draws; a crack from before it had none → all from the root)
  crack.parent = cells.map((_, k) => crack.parent?.[k] ?? (k === 0 ? -1 : 0)).concat(cell.k)
  crack.cells = [...cells, [nx, ny]]
  events.push({ type: 'crackGrow', crackId: crack.id, x: nx, y: ny })
  return true
}
