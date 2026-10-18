// F27 balance bots: simple, readable players that only use a human's actions (spin, rotate, fast drop, hold, zap a cell).
// They are measuring tools, not opponents. Each one is the same brain with different settings (bots.json):
//   Casual  — places pieces low and flat near where it is looking, zaps ready groups it can see. Ignores cracks.
//   Focused — also steers pieces of a crack's colour onto it, turns the tank to zap a group that would seal one.
//   Sharp   — Focused, plus it waits for big groups, vents pressure on purpose and keeps the stack low.
// A bot sees what a player sees: it can only zap cells inside the 12 visible columns. It knows where every crack is
// (the game shows arrows for off-screen ones). It never goes to the console, so broken machines stay broken.
import type { ShiftAction, ShiftState } from '../../src/engine'
import { rotateCells, rotationCenter } from '../../src/engine/pieces'
import { columnOffset, isOnScreen, wrapX } from '../../src/engine/tank'
import { popLine } from '../../src/engine/cracks'

export interface Weights {
  height: number // average landing height (rows from the floor) — lower is better
  maxHeight: number // highest landing cell
  holes: number // empty cells left under the piece
  sameColour: number // touching goop of the same colour (groups grow)
  otherColour: number // touching goop of another colour
  crackMatch: number // a cell lands on an open crack of its own colour (plugs it)
  crackCover: number // a cell lands on an open crack of another colour (blocks it)
  underCrack: number // per cell landing below an open crack in its column (builds up toward a crack hanging in the air)
  abovePopLine: number // per cell landing above the pop line (can't be zapped yet)
  distance: number // per column the tank has to turn
}

export interface BotSkill {
  label: string
  acts: boolean
  apm?: number
  reactionMs?: number
  reach?: number
  zap?: boolean
  minZapSize?: number
  steerCracks?: boolean
  detourToSeal?: boolean
  useHold?: boolean
  ventAt?: number | null
  keepLowRows?: number | null
  weights?: Weights
}

type Cell = [number, number]

const LOOK_EVERY_MS = 100

interface Plan {
  pieceId: number
  hold: boolean
  rotations: number
  rotationsDone: number
  targetSpin: number | null
  badSpins: Set<number>
}

export class Bot {
  readonly skill: BotSkill
  private readonly actionMs: number
  private nextActionAt = 0 // discrete actions (rotate, hold, zap, fast drop) wait for this
  private nextSpinAt = 0 // a held spin repeats at spinRepeatMs
  private pieceId = 0
  private pieceSeenAt = 0
  private plan: Plan | null = null
  private dropping = false
  private readonly readySince = new Map<number, number>() // group id → when it was first seen ready
  private spinFails = 0
  private nextLookAt = 0 // scanning the tank for something to zap happens every LOOK_EVERY_MS, not every frame
  private heldThisPiece = false // one swap per new piece, so it never swaps back and forth

  constructor(skill: BotSkill) {
    this.skill = skill
    this.actionMs = skill.apm ? 60000 / skill.apm : Infinity
  }

  // The game told us a new piece arrived (spawn) — the bot needs its reaction time to notice it.
  newPiece(now: number, fromHold: boolean): void {
    this.pieceId++
    if (!fromHold) {
      this.pieceSeenAt = now
      this.heldThisPiece = false
    }
    this.dropping = false
    this.spinFails = 0
  }

  // One decision. `spinRepeatMs` = how fast a held spin repeats right now (slower while the controls are broken).
  decide(s: ShiftState, now: number, spinRepeatMs: number): ShiftAction | null {
    const k = this.skill
    if (!k.acts) return null
    this.noticeReady(s, now)

    // 1. Zap something worth zapping that is on screen.
    if (k.zap && now >= this.nextActionAt && now >= this.nextLookAt) {
      const target = this.pickZap(s, now)
      if (target) {
        this.nextActionAt = now + this.actionMs
        return { type: 'pop', x: target[0], y: target[1] }
      }
    }

    // 2. Focused / Sharp: a group that would seal a crack is ready off screen → turn the tank to look at it.
    if (k.detourToSeal && s.phase === 'playing' && now >= this.nextSpinAt && now >= this.nextLookAt) {
      const dir = this.detourDirection(s, now)
      if (dir) {
        this.nextSpinAt = now + spinRepeatMs
        return { type: 'spin', dir }
      }
    }

    if (now >= this.nextLookAt) this.nextLookAt = now + LOOK_EVERY_MS // nothing to zap or chase: look again soon

    // 3. Place the falling piece.
    const p = s.piece
    if (!p || now < this.pieceSeenAt + (k.reactionMs ?? 0)) return null
    if (!this.plan || this.plan.pieceId !== this.pieceId) this.plan = this.makePlan(s)
    const plan = this.plan

    if (plan.hold && now >= this.nextActionAt) {
      plan.hold = false
      this.heldThisPiece = true
      this.nextActionAt = now + this.actionMs
      return { type: 'hold' } // the engine sends 'hold'; the runner calls newPiece(fromHold) and we plan again
    }
    if (plan.rotationsDone < plan.rotations) {
      if (now < this.nextActionAt) return null
      plan.rotationsDone++
      this.nextActionAt = now + this.actionMs
      return { type: 'rotate', dir: 1 }
    }
    // Turn the tank toward the best column for the piece as it is now (the exact shape after the turns).
    if (now < this.nextSpinAt) return null
    const best = this.bestSpin(s, shapeOf(s), p.colors[0], plan)
    this.nextSpinAt = now + spinRepeatMs
    if (best !== null && best !== s.spin) {
      return { type: 'spin', dir: columnOffset(best, s.spin, s.width) > 0 ? 1 : -1 }
    }
    if (!this.dropping && now >= this.nextActionAt) {
      this.dropping = true
      this.nextActionAt = now + this.actionMs
      return { type: 'softDrop', on: true }
    }
    return null
  }

  // A spin the engine refused (blocked by goop): after a couple, give up on that column.
  spinRejected(s: ShiftState): void {
    if (++this.spinFails >= 2 && this.plan && this.plan.targetSpin !== null) {
      this.plan.badSpins.add(this.plan.targetSpin)
      this.plan.targetSpin = null
      this.spinFails = 0
    }
    void s
  }

  rotateRejected(): void {
    if (this.plan) this.plan.rotations = this.plan.rotationsDone
  }

  // ---------------------------------------------------------------- zapping

  private noticeReady(s: ShiftState, now: number): void {
    for (const id of this.readySince.keys()) if (!s.groups.get(id)?.ready) this.readySince.delete(id)
    for (const g of s.groups.values()) if (g.ready && !this.readySince.has(g.id)) this.readySince.set(g.id, now)
  }

  private pickZap(s: ShiftState, now: number): Cell | null {
    const k = this.skill
    const reaction = k.reactionMs ?? 0
    const stack = stackHeight(s)
    let best: { cell: Cell; score: number } | null = null
    for (const g of s.groups.values()) {
      if (!g.ready || now < (this.readySince.get(g.id) ?? now) + reaction) continue
      const visible = g.cells.find((i) => isOnScreen(i % s.width, s.spin, s.width, s.visibleWidth))
      if (visible === undefined) continue
      const seals = sealsOf(s, g.cells)
      const primed = s.primed?.includes(g.id) ?? false
      let want = primed || seals > 0 || s.phase === 'rupture' || g.cells.length >= (k.minZapSize ?? 1)
      if (!want && k.ventAt != null && s.pressure >= k.ventAt) want = true
      if (!want && k.keepLowRows != null && stack >= k.keepLowRows) want = true
      if (!want) continue
      const top = Math.floor(g.cells[0] / s.width)
      const score = (primed ? 1000 : 0) + seals * 100 + g.cells.length + (s.height - top) * 0.5
      if (!best || score > best.score) best = { cell: [visible % s.width, Math.floor(visible / s.width)], score }
    }
    return best ? best.cell : null
  }

  private detourDirection(s: ShiftState, now: number): 1 | -1 | 0 {
    const reaction = this.skill.reactionMs ?? 0
    // Not while the piece is about to land: placing it matters more.
    if (s.piece && s.ghost.length && Math.min(...s.ghost.map((c) => c[1])) - Math.min(...s.piece.cells.map((c) => c[1])) < 4) return 0
    let bestOffset: number | null = null
    for (const g of s.groups.values()) {
      if (!g.ready || now < (this.readySince.get(g.id) ?? now) + reaction) continue
      if (sealsOf(s, g.cells) === 0) continue
      if (g.cells.some((i) => isOnScreen(i % s.width, s.spin, s.width, s.visibleWidth))) return 0 // one is already on screen: zap it
      for (const i of g.cells) {
        const d = columnOffset(i % s.width, s.spin, s.width)
        if (bestOffset === null || Math.abs(d) < Math.abs(bestOffset)) bestOffset = d
      }
    }
    if (bestOffset === null) return 0
    return bestOffset > 0 ? 1 : -1
  }

  // ---------------------------------------------------------------- placing

  private makePlan(s: ShiftState): Plan {
    const k = this.skill
    const plan: Plan = { pieceId: this.pieceId, hold: false, rotations: 0, rotationsDone: 0, targetSpin: null, badSpins: new Set() }
    const current = this.bestRotation(s, shapeOf(s), s.piece!.colors[0])
    plan.rotations = current.rotations
    if (k.useHold && !this.heldThisPiece && s.held && s.heldCells) {
      // the held piece would appear where this one is: its shape offsets around the same spot
      const heldShape = s.heldCells.map(([x, y]) => [x, y + topRow(s)] as Cell)
      const held = this.bestRotation(s, heldShape, s.held[0])
      if (held.score > current.score + 3) {
        plan.hold = true
        plan.rotations = 0 // re-planned once the held piece is in
      }
    }
    return plan
  }

  private bestRotation(s: ShiftState, shape: Cell[], colour: number): { rotations: number; score: number } {
    let best = { rotations: 0, score: -Infinity }
    let cells = shape
    const center = rotationCenter(shape)
    for (let r = 0; r < 4; r++) {
      const spin = this.bestSpin(s, cells, colour, null)
      if (spin !== null) {
        const score = this.scoreAt(s, cells, colour, columnOffset(spin, s.spin, s.width))
        if (score > best.score) best = { rotations: r, score }
      }
      cells = rotateCells(cells, 1, center)
    }
    return best
  }

  // The best tank column (spin) for this shape, within reach. Keeps the current target unless another is clearly better.
  private bestSpin(s: ShiftState, shape: Cell[], colour: number, plan: Plan | null): number | null {
    const reach = this.skill.reach ?? 6
    let bestD: number | null = null
    let bestScore = -Infinity
    for (let d = -reach; d <= reach; d++) {
      const spin = wrapX(s.spin + d, s.width)
      if (plan?.badSpins.has(spin)) continue
      const score = this.scoreAt(s, shape, colour, d)
      if (score > bestScore) {
        bestScore = score
        bestD = d
      }
    }
    if (bestD === null) return null
    const best = wrapX(s.spin + bestD, s.width)
    if (plan) {
      if (plan.targetSpin !== null && plan.targetSpin !== best) {
        const keep = this.scoreAt(s, shape, colour, columnOffset(plan.targetSpin, s.spin, s.width))
        if (keep >= bestScore - 1) return plan.targetSpin
      }
      plan.targetSpin = best
    }
    return best
  }

  // How good it is to drop `shape` (relative to the screen centre column) after turning the tank d columns.
  private scoreAt(s: ShiftState, shape: Cell[], colour: number, d: number): number {
    const k = this.skill
    const w = k.weights!
    const cells = landed(s, shape, d)
    if (!cells) return -Infinity
    const own = new Set(cells.map(([x, y]) => y * s.width + x))
    const line = popLine(s)
    let sumH = 0, maxH = 0, holes = 0, same = 0, other = 0, match = 0, cover = 0, under = 0, above = 0
    for (const [x, y] of cells) {
      const h = s.height - y
      sumH += h
      if (h > maxH) maxH = h
      if (y < line) above++
      const below = (y + 1) * s.width + x
      if (y + 1 < s.height && !own.has(below) && s.grid[below] === 0) holes++
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as Cell[]) {
        if (ny < 0 || ny >= s.height) continue
        const n = ny * s.width + wrapX(nx, s.width)
        if (own.has(n) || s.grid[n] === 0) continue
        if (s.grid[n] === colour) same++
        else other++
      }
      if (k.steerCracks) {
        for (const c of s.cracks) {
          if (c.plugged) continue
          if (c.x === x && c.y === y) {
            if (c.color === colour) match++
            else cover++
          } else if (c.x === x && c.y < y && s.grid[c.y * s.width + c.x] === 0 && !own.has(c.y * s.width + c.x)) under++
        }
      }
    }
    return (
      -w.height * (sumH / cells.length) - w.maxHeight * maxH - w.holes * holes + w.sameColour * same - w.otherColour * other +
      w.crackMatch * match - w.crackCover * cover + w.underCrack * under - w.abovePopLine * above - w.distance * Math.abs(d)
    )
  }
}

// ---------------------------------------------------------------- helpers (shared with the runner)

// The falling piece's cells relative to the screen centre column: [columns from the centre, tank row].
function shapeOf(s: ShiftState): Cell[] {
  return s.piece!.cells.map(([x, y]) => [columnOffset(x, s.spin, s.width), y] as Cell)
}

function topRow(s: ShiftState): number {
  return Math.min(...s.piece!.cells.map((c) => c[1]))
}

// Where the shape ends up if the tank turns d columns and it falls straight down (null = it can't go there).
function landed(s: ShiftState, shape: Cell[], d: number): Cell[] | null {
  const at = (dy: number) => shape.map(([x, y]) => [wrapX(s.spin + d + x, s.width), y + dy] as Cell)
  const blocked = (cells: Cell[]) => cells.some(([x, y]) => y >= s.height || (y >= 0 && s.grid[y * s.width + x] !== 0))
  if (blocked(at(0))) return null
  let dy = 0
  while (!blocked(at(dy + 1))) dy++
  return at(dy)
}

// How many open cracks popping these cells would seal (plugged cracks under the group).
export function sealsOf(s: ShiftState, cells: number[]): number {
  let n = 0
  for (const c of s.cracks) if (c.plugged && cells.includes(c.y * s.width + c.x)) n++
  return n
}

// The tallest column of goop, in rows from the floor.
export function stackHeight(s: ShiftState): number {
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) if (s.grid[y * s.width + x] !== 0) return s.height - y
  }
  return 0
}
