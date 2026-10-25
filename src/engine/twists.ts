// F39 RANK TWISTS (GDD rank twists, v1's numbers): the goop holds hands (20), wakes up (30), then helps you (40).
//   - 20: two-colour pieces — a share of pieces split into two even halves, each half joined up (4-connected), in two
//     different colours. They lock as two clumps. (v1 utils/pieceUtils.ts findBestSplit)
//   - 30: growing cracks — each uncovered crack cell rolls every few seconds to grow into a cell next to it. A grown
//     crack is ONE crack (one colour) over many cells (Muzzy 2026-10-25): plugged only while EVERY cell is covered by
//     its colour (or wild), and sealing it counts its cell count toward the quota. Goop covering a cell stops that
//     cell growing. (v1 PRD "Expanding Cracks")
//   - 40: wild goop — a share of pieces are WILD (types.ts): plugs any crack colour; a normal piece locking next to a
//     wild clump turns the whole clump its colour (shift.ts lockPiece).
// Numbers: content/tuning/twists.json, read at the moment each is used (live). Randomness only through the shift's
// seeded rng, and only from each twist's rank — so shifts below rank 20 roll exactly the numbers they did before.
import { type Color, type Crack, type ShiftEvent, type ShiftState, WILD } from './types'
import type { Rng } from './rng'
import { wrapX } from './tank'

// The shape of content/tuning/twists.json
export interface TwistsConfig {
  split: { fromRank: number; chance: number }
  grow: {
    fromRank: number
    everyMsMin: number
    everyMsMax: number
    baseChance: number
    pressureWeight: number
    leafMult: number
    hopFalloff: number
    minFalloff: number
    diagonals: boolean
  }
  wild: { fromRank: number; chance: number }
}

const num = (v: unknown, fallback: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : fallback)
const share = (v: unknown) => Math.min(1, num(v, 0))

/** Is this twist on at this rank? (no twists file handed in = no twists, as before F39) */
export const splitOn = (t: TwistsConfig | undefined, rank: number) => !!t && rank >= num(t.split?.fromRank, Infinity)
export const growOn = (t: TwistsConfig | undefined, rank: number) => !!t && rank >= num(t.grow?.fromRank, Infinity)
export const wildOn = (t: TwistsConfig | undefined, rank: number) => !!t && rank >= num(t.wild?.fromRank, Infinity)
export const splitChance = (t: TwistsConfig) => share(t.split.chance)
export const wildChance = (t: TwistsConfig) => share(t.wild.chance)

// ---------------------------------------------------------------- two-colour pieces (rank 20)

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

// ---------------------------------------------------------------- cracks over many cells (rank 30)

/** Every cell of a crack, root first. */
export function crackCells(c: Crack): [number, number][] {
  return c.cells ?? [[c.x, c.y]]
}

/** How many cells a crack covers (1 until it grows). */
export const crackSize = (c: Crack) => c.cells?.length ?? 1

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

// The growth roll's delay: everyMsMin … everyMsMax (× slowMult: Slow Cracks / crackEveryMult stretches it)
function rollDelay(rng: Rng, t: TwistsConfig, slowMult: number): number {
  const lo = num(t.grow.everyMsMin, 5000, 1)
  const hi = Math.max(lo, num(t.grow.everyMsMax, 10000, 1))
  return (lo + rng.next() * (hi - lo)) * Math.max(0.1, slowMult)
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

/** Step crack growth by dt ms (rules time). `lineRow` = the highest row a crack may be in (the pressure line);
 *  `slowMult` > 1 slows growth (the Slow Cracks upgrade, crackEveryMult). Pushes a 'crackGrow' event per new cell. */
export function growCracks(s: ShiftState, rng: Rng, t: TwistsConfig, dt: number, lineRow: number, slowMult: number, events: ShiftEvent[]): void {
  const g = t.grow
  const diag = g.diagonals !== false
  const dirs = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const top = Math.max(s.bufferRows, lineRow)
  let taken: Set<number> | null = null
  for (const c of s.cracks) {
    // a crack starts its growth clock the first time growing is on for it
    const cells: [number, number][] = (c.cells ??= [[c.x, c.y]])
    if (!c.parent || c.parent.length !== cells.length) c.parent = cells.map((_, k) => (k === 0 ? -1 : 0))
    if (!c.growMs || c.growMs.length !== cells.length) c.growMs = cells.map(() => rollDelay(rng, t, slowMult))
    const parent: number[] = c.parent, growMs: number[] = c.growMs
    const count = cells.length // (cells grown this step don't roll until their own clock runs out)
    for (let k = 0; k < count; k++) {
      const x: number = cells[k][0], y: number = cells[k][1]
      if (s.grid[y * s.width + x] !== 0) continue // covered: this cell doesn't grow (its clock waits)
      growMs[k] -= dt
      if (growMs[k] > 0) continue
      growMs[k] = rollDelay(rng, t, slowMult)
      const leaf = !parent.includes(k)
      let hops = 0
      for (let p = parent[k]; p >= 0 && hops < 1000; p = parent[p]) hops++
      const chance = (num(g.baseChance, 0.1) + s.pressure * num(g.pressureWeight, 1)) * (leaf ? share(g.leafMult) : 1)
        * Math.max(share(g.minFalloff), 1 - num(g.hopFalloff, 0.25) * hops)
      if (!rng.chance(Math.min(1, chance))) continue
      taken ??= takenCells(s)
      const free: number[] = []
      for (const [dx, dy] of dirs) {
        const row = y + dy
        if (row < top || row >= s.height) continue
        const i = row * s.width + wrapX(x + dx, s.width)
        if (s.grid[i] === 0 && !taken.has(i)) free.push(i)
      }
      if (free.length === 0) continue
      const at = rng.pick(free)
      const nx = at % s.width, ny = Math.floor(at / s.width)
      cells.push([nx, ny])
      parent.push(k)
      growMs.push(rollDelay(rng, t, slowMult))
      taken.add(at)
      events.push({ type: 'crackGrow', crackId: c.id, x: nx, y: ny })
    }
  }
}
