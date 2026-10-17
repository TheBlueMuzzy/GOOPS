// One shift of Goops: the rules, v1 as shipped. Pure — time only moves through tick(ms), randomness only
// through the seeded rng. The screen sends actions in, reads `state`, and takes events out.
import type { Group, ShiftAction, ShiftEngine, ShiftEvent, ShiftState, ShiftStatus } from './types'
import type { ShiftConfig } from './config'
import { cracksNeededFor, junkCount, paletteSize } from './config'
import { createRng, type Rng } from './rng'
import { wrapX } from './tank'
import {
  type Cell,
  type FallingPiece,
  type PieceDef,
  collides,
  landingRow,
  newFallingPiece,
  placeCells,
  randomPiece,
  rotateCells,
} from './pieces'
import { type GroupBook, dropLoose, regroup } from './groups'
import { burstCracks, popLine, spawnCrack, updatePlugs } from './cracks'
import { popPoints, popRefundMs } from './score'

export interface ShiftOptions {
  seed: number
  rank: number
  startGrid?: ArrayLike<number> // a set-up tank (Color per cell, y * width + x) instead of the rank's junk — for tests and level setups
}

const MAX_STEP_MS = 16 // long ticks are cut into small steps so nothing skips a row

export function createShift(config: ShiftConfig, options: ShiftOptions): ShiftEngine {
  return new Shift(config, options)
}

class Shift implements ShiftEngine {
  readonly state: ShiftState
  private readonly config: ShiftConfig
  private readonly rng: Rng
  private readonly colorCount: number
  private events: ShiftEvent[] = []
  private book: GroupBook = { fillMs: new Map(), nextId: 1 }
  private nextCrackId = 1

  private piece: FallingPiece | null = null
  private nextDef: PieceDef
  private heldDef: PieceDef | null
  private softDrop = false
  private lockMs: number | null = null // time spent resting on something; null = still falling
  private lockResets = 0 // spins/rotations that restarted the lock timer for this piece
  private crackTimerMs = 0
  private popStreak = 0 // pops since the last piece landed

  constructor(config: ShiftConfig, options: ShiftOptions) {
    this.config = config
    this.rng = createRng(options.seed)
    const { width, height, bufferRows, visibleWidth } = config.tank
    this.colorCount = paletteSize(config, options.rank)
    this.state = {
      width,
      height,
      bufferRows,
      visibleWidth,
      grid: new Uint8Array(width * height),
      groupOf: new Int32Array(width * height).fill(-1),
      groups: new Map(),
      spin: 0,
      piece: null,
      ghost: [],
      next: null,
      held: null,
      nextCells: null,
      heldCells: null,
      pressure: 0,
      pressureRow: height - 1,
      timeLeftMs: config.shiftMs,
      cracks: [],
      cracksSealed: 0,
      cracksNeeded: cracksNeededFor(config, options.rank),
      score: 0,
      status: 'playing',
      rank: options.rank,
    }

    if (options.startGrid) {
      this.state.grid.set(options.startGrid)
      regroup(this.state, this.book)
    } else this.placeJunk(junkCount(config, options.rank))
    // v1 starts every shift with a piece already in the hold.
    this.heldDef = this.randomDef()
    this.nextDef = this.randomDef()
    this.spawnNext()
    this.refreshView()
  }

  takeEvents(): ShiftEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  tick(ms: number): void {
    let left = ms
    while (left > 0 && this.state.status === 'playing') {
      const dt = Math.min(left, MAX_STEP_MS)
      left -= dt
      this.step(dt)
    }
    this.refreshView()
  }

  act(action: ShiftAction): void {
    if (this.state.status !== 'playing') return
    let ok = true
    switch (action.type) {
      case 'spin':
        ok = this.spin(action.dir)
        break
      case 'rotate':
        ok = this.rotate(action.dir)
        break
      case 'softDrop':
        this.softDrop = action.on
        break
      case 'hardDrop':
        ok = this.hardDrop()
        break
      case 'hold':
        ok = this.hold()
        break
      case 'pop':
        ok = this.pop(action.x, action.y)
        break
    }
    if (!ok) this.events.push({ type: 'reject', action: action.type })
    this.refreshView()
  }

  // ---------------------------------------------------------------- time

  private step(dt: number): void {
    const s = this.state
    s.timeLeftMs -= dt
    if (s.timeLeftMs <= 0) {
      s.timeLeftMs = 0
      this.updatePressure()
      this.end()
      return
    }
    this.updatePressure()

    // A new crack every few seconds until the goal is met (v1).
    if (s.cracksSealed < s.cracksNeeded) {
      this.crackTimerMs += dt
      if (this.crackTimerMs > this.config.cracks.spawnEveryMs) {
        this.crackTimerMs = 0
        const crack = spawnCrack(s, this.rng, this.colorCount, this.config.cracks.spawnTries, this.nextCrackId)
        if (crack) {
          this.nextCrackId++
          s.cracks.push(crack)
          this.events.push({ type: 'crack', crack: { ...crack } })
        }
      }
    }

    this.settle() // goop that was resting on the falling piece drops once the piece moves away
    this.fallPiece(dt)
    this.fillGroups(dt)
  }

  private updatePressure(): void {
    const s = this.state
    s.pressure = 1 - s.timeLeftMs / this.config.shiftMs
    s.pressureRow = Math.ceil(popLine(s) - 1e-9)
  }

  private fallPiece(dt: number): void {
    const p = this.piece
    if (!p) return
    const lock = this.config.lock
    if (this.grounded()) {
      p.fall = 0
      this.lockMs = this.lockMs === null ? 0 : this.lockMs + dt
      const delay = this.softDrop ? lock.softDropDelayMs : lock.delayMs
      if (this.lockMs > delay || this.lockResets >= lock.maxResets) this.lockPiece()
      return
    }
    this.lockMs = null
    const msPerRow = this.config.fall.msPerRow / (this.softDrop ? this.config.fall.softDropFactor : 1)
    p.fall += dt / msPerRow
    while (p.fall >= 1 && !this.grounded()) {
      p.y++
      p.fall -= 1
      this.events.push({ type: 'step' })
    }
    if (this.grounded()) p.fall = 0
  }

  // Groups fill up over time (375 ms per cell); full + at/below the pressure line = ready to pop.
  private fillGroups(dt: number): void {
    for (const g of this.state.groups.values()) {
      const ms = (this.book.fillMs.get(g.id) ?? 0) + dt
      this.book.fillMs.set(g.id, ms)
      g.fill = Math.min(1, ms / (g.cells.length * this.config.fill.msPerCell))
    }
    this.updateReady()
  }

  private updateReady(): void {
    for (const g of this.state.groups.values()) {
      const ready = this.canPop(g)
      if (ready && !g.ready) this.events.push({ type: 'ready', groupId: g.id })
      g.ready = ready
    }
  }

  private canPop(g: Group): boolean {
    const topRow = Math.floor(g.cells[0] / this.state.width) // cells are sorted, so the first is the highest
    return g.fill >= 1 && topRow >= popLine(this.state)
  }

  // ---------------------------------------------------------------- actions

  // Turn the tank one column. dir +1 = v1's SpinTankCommand(+1) (ArrowLeft / drag left).
  private spin(dir: 1 | -1): boolean {
    const s = this.state
    const newSpin = wrapX(s.spin + dir, s.width)
    const p = this.piece
    if (p) {
      const x = newSpin + p.offset
      if (this.blockedAt(p.cells, x, p.y)) {
        // v1 tests sideways moves at the NEAREST row, so a piece more than half way down a row can slip in below.
        if (p.fall >= 0.5 && !this.blockedAt(p.cells, x, p.y + 1)) {
          p.y++
          p.fall = 0
        } else return false
      }
    }
    s.spin = newSpin
    this.events.push({ type: 'spin', dx: dir })
    this.moveReset()
    return true
  }

  private rotate(dir: 1 | -1): boolean {
    const p = this.piece
    if (!p) return false
    if (p.def.noRotate) {
      // v1: squares just count the turn (no lock reset).
      p.rotation = (p.rotation + dir + 4) % 4
      this.events.push({ type: 'rotate', dir })
      return true
    }
    const turned = rotateCells(p.cells, dir, p.center)
    for (const [kx, ky] of this.config.pieces.kicks) {
      if (this.blockedAt(turned, this.state.spin + p.offset + kx, p.y + ky)) continue
      p.cells = turned
      p.rotation = (p.rotation + dir + 4) % 4
      p.offset += kx // v1: a sideways kick moves the piece off the centre line for the rest of its fall
      p.y += ky
      this.events.push({ type: 'rotate', dir })
      if (kx !== 0) this.events.push({ type: 'move', dx: kx })
      this.moveReset()
      return true
    }
    return false
  }

  // v1 never shipped a hard drop; this drops to the ghost and locks at once.
  private hardDrop(): boolean {
    const p = this.piece
    if (!p) return false
    const s = this.state
    const rows = landingRow(s.grid, p.cells, s.spin + p.offset, p.y, s.width, s.height) - p.y
    p.y += rows
    p.fall = 0
    s.score += rows * this.config.score.hardDropPerRow
    this.events.push({ type: 'drop', rows })
    this.lockPiece()
    return true
  }

  // Swap the falling piece with the held one. The held piece appears where the falling one was.
  private hold(): boolean {
    const p = this.piece
    if (!p) return false
    const held = this.heldDef
    if (!held) {
      this.heldDef = p.def
      this.events.push({ type: 'hold' })
      this.spawnNext()
      return true
    }
    const swapped = newFallingPiece(held, p.offset, p.y)
    if (this.blockedAt(swapped.cells, this.state.spin + swapped.offset, swapped.y)) return false
    this.heldDef = p.def
    this.piece = swapped
    this.lockMs = null
    this.lockResets = 0
    this.events.push({ type: 'hold' })
    return true
  }

  private pop(x: number, y: number): boolean {
    const s = this.state
    if (!Number.isInteger(x) || !Number.isInteger(y) || y < 0 || y >= s.height) return false
    const id = s.groupOf[y * s.width + wrapX(x, s.width)]
    const g = s.groups.get(id)
    if (!g || !this.canPop(g)) return false

    // Score (worked out before the goop leaves the grid, as v1).
    const combo = this.popStreak + 1
    s.score += popPoints(s, this.config, g.cells, combo)
    this.popStreak = combo

    // Seal every plugged crack under this group.
    const cellSet = new Set(g.cells)
    const sealed = s.cracks.filter((c) => c.plugged && cellSet.has(c.y * s.width + c.x)).map((c) => c.id)
    s.cracks = s.cracks.filter((c) => !sealed.includes(c.id))
    s.cracksSealed += sealed.length

    // Popping gives time back (pressure drops), sealing gives more.
    const refund = popRefundMs(this.config, g.cells.length) + sealed.length * this.config.cracks.sealRefundMs
    s.timeLeftMs = Math.min(this.config.shiftMs, s.timeLeftMs + refund)
    this.updatePressure()

    for (const i of g.cells) {
      s.grid[i] = 0
      s.groupOf[i] = -1
    }
    s.groups.delete(g.id)
    this.book.fillMs.delete(g.id)
    this.events.push({ type: 'pop', cells: g.cells, color: g.color, sealed })

    this.settle()
    if (sealed.length > 0 && s.cracksSealed >= s.cracksNeeded) this.afterGoalSeal()
    this.updateReady()
    return true
  }

  // v1 win burst: after the goal, each seal brings a crack of every colour above the line —
  // unless the shift is nearly over (90% pressure), then all cracks are cleared.
  private afterGoalSeal(): void {
    const s = this.state
    if (s.pressure < this.config.cracks.burstBelowPressure) {
      const burst = burstCracks(s, this.rng, this.colorCount, this.config.cracks.spawnTries, () => this.nextCrackId++)
      for (const crack of burst) {
        s.cracks.push(crack)
        this.events.push({ type: 'crack', crack: { ...crack } })
      }
      updatePlugs(s, this.events)
    } else {
      s.cracks = []
    }
  }

  // ---------------------------------------------------------------- pieces

  private randomDef(): PieceDef {
    const zones = this.config.pieces.zones
    const elapsed = this.config.shiftMs - this.state.timeLeftMs
    const zone = Math.min(zones.length - 1, Math.floor(elapsed / (this.config.shiftMs / zones.length)))
    return randomPiece(this.rng, this.config, zones[zone], this.colorCount)
  }

  private spawnNext(): void {
    const def = this.nextDef
    this.nextDef = this.randomDef()
    // v1: always the centre column, top row of the hidden buffer.
    const piece = newFallingPiece(def, 0, 0)
    this.lockMs = null
    this.lockResets = 0
    if (this.blockedAt(piece.cells, this.state.spin, 0)) {
      this.piece = null
      this.end() // the tank is full to the top: the shift ends (v1)
      return
    }
    this.piece = piece
    this.events.push({ type: 'spawn' })
  }

  private lockPiece(): void {
    const p = this.piece
    if (!p) return
    const s = this.state
    const cells: number[] = []
    for (const [x, y] of this.pieceCells(p)) {
      if (y < 0) continue // v1: cells still above the tank are lost
      const i = y * s.width + x
      s.grid[i] = p.def.color
      cells.push(i)
    }
    this.piece = null
    this.events.push({ type: 'lock', cells, color: p.def.color })
    for (const id of regroup(s, this.book)) this.events.push({ type: 'merge', groupId: id })
    this.settle() // corrupted pieces break apart here; loose parts fall
    this.popStreak = 0
    this.softDrop = false // v1: fast drop stops when a piece lands
    this.spawnNext()
  }

  // Let every loose group fall until nothing moves, regrouping as it lands.
  private settle(): void {
    const s = this.state
    const blocked = new Set<number>()
    if (this.piece) for (const [x, y] of this.pieceCells(this.piece)) if (y >= 0) blocked.add(y * s.width + x)
    for (let pass = 0; pass < s.height; pass++) {
      const moves = dropLoose(s, blocked)
      if (moves.length === 0) break
      this.events.push({ type: 'fall', moves })
      for (const id of regroup(s, this.book)) this.events.push({ type: 'merge', groupId: id })
    }
    updatePlugs(s, this.events)
  }

  private moveReset(): void {
    if (this.lockMs !== null) {
      this.lockMs = null
      this.lockResets++
    }
  }

  private grounded(): boolean {
    const p = this.piece
    return !!p && this.blockedAt(p.cells, this.state.spin + p.offset, p.y + 1)
  }

  private blockedAt(cells: Cell[], originX: number, y: number): boolean {
    const s = this.state
    return collides(s.grid, placeCells(cells, originX, y, s.width), s.width, s.height)
  }

  private pieceCells(p: FallingPiece): Cell[] {
    return placeCells(p.cells, this.state.spin + p.offset, p.y, this.state.width)
  }

  private placeJunk(count: number): void {
    // v1: single cells on the floor, in different random columns.
    const s = this.state
    const columns = Array.from({ length: s.width }, (_, i) => i)
    for (let i = columns.length - 1; i > 0; i--) {
      const j = this.rng.int(i + 1)
      ;[columns[i], columns[j]] = [columns[j], columns[i]]
    }
    for (const x of columns.slice(0, count)) s.grid[(s.height - 1) * s.width + x] = 1 + this.rng.int(this.colorCount)
    regroup(s, this.book)
  }

  private end(): void {
    const s = this.state
    if (s.status !== 'playing') return
    let left = 0
    for (const c of s.grid) if (c !== 0) left++
    s.leftoverPenalty = left * this.config.score.leftoverPerCell
    s.score = Math.max(0, s.score - s.leftoverPenalty)
    const status: ShiftStatus = s.cracksSealed >= s.cracksNeeded ? 'won' : 'lost'
    s.status = status
    this.piece = null
    this.events.push({ type: 'end', status })
  }

  // Copy the private piece bookkeeping into the public state the screens read.
  private refreshView(): void {
    const s = this.state
    const p = this.piece
    if (p) {
      const cells = this.pieceCells(p)
      s.piece = { cells, colors: cells.map(() => p.def.color), rotation: p.rotation, fall: p.fall }
      const landY = landingRow(s.grid, p.cells, s.spin + p.offset, p.y, s.width, s.height)
      s.ghost = placeCells(p.cells, s.spin + p.offset, landY, s.width)
    } else {
      s.piece = null
      s.ghost = []
    }
    s.next = this.nextDef.cells.map(() => this.nextDef.color)
    s.nextCells = this.nextDef.cells.map(([x, y]) => [x, y])
    s.held = this.heldDef ? this.heldDef.cells.map(() => this.heldDef!.color) : null
    s.heldCells = this.heldDef ? this.heldDef.cells.map(([x, y]) => [x, y]) : null
  }
}
