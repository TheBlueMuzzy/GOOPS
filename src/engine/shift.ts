// One shift of Goops. Pure — time only moves through tick(ms), randomness only through the seeded rng.
// The screen sends actions in, reads `state`, and takes events out.
// LIVE TUNING: `config` (and options.breakdowns) are read at the moment each number is used, never copied — so the
// game can hand in its live tuning import and the Dev Kit's sliders change the next tick. Fixed when the shift
// starts (by design, like the rank): the tank's size, the colours in play and the crack quota.
// The loop (GDD §4): pressure rises → cracks come faster → open cracks drain tank integrity → at 0 the tank
// ruptures → pressure drains to 0 while you zap what you can → the shift ends (won if the crack quota was met).
import type { AbilityState, Group, RejectReason, ShiftAction, ShiftEngine, ShiftEvent, ShiftState, ShiftStatus, WallKickMode } from './types'
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
import { crackEveryMs, firstPoppableRow, popLine, spawnCrack, updatePlugs } from './cracks'
import { popPoints, popRefundMs } from './score'
import { type Modifiers, clampModifiers } from './upgrades'
import { ABILITY_EFFECTS, type AbilitySpec, type ActiveEffects } from './abilities'
import { type BreakdownConfig, Machines } from './machines'
import { SNAPSHOT_KIND, SNAPSHOT_VERSION, type ShiftSnapshot } from './snapshot'
import { type PieceChoice, type TrainingCommand, type TrainingRules, TRAINING_START, pieceFromChoice } from './training'

export interface ShiftOptions {
  seed: number
  rank: number
  startGrid?: ArrayLike<number> // a set-up tank (Color per cell, y * width + x) instead of the rank's junk — for tests and level setups
  wallKick?: WallKickMode // default 'rotateVat'; can be changed later with setWallKick
  // F22 upgrades (both optional; leave them out and the shift plays exactly as without upgrades):
  modifiers?: Partial<Modifiers> // from resolveUpgrades(); clamped to safe ranges here
  abilities?: AbilitySpec[] // equipped active abilities, from resolveUpgrades()
  // F23 breakdowns: content/tuning/breakdowns.json. Leave it out and every machine stays locked (never breaks).
  breakdowns?: BreakdownConfig
  // F30 lessons: a TRAINING shift (training.ts) — empty tank, no piece until the lesson brings one, everything held
  // still and off except what these rules (or later train({ type: 'rules' }) commands) turn on.
  training?: Partial<TrainingRules>
}

const MAX_STEP_MS = 16 // long ticks are cut into small steps so nothing skips a row

export function createShift(config: ShiftConfig, options: ShiftOptions): ShiftEngine {
  return new Shift(config, options)
}

class Shift implements ShiftEngine {
  readonly state: ShiftState
  private readonly config: ShiftConfig
  private readonly rng: Rng
  private colorCount: number
  private readonly options: ShiftOptions
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
  private rejectReason: RejectReason | undefined // why the current action was refused (set by pop; F26)
  private playedMs = 0 // time since the shift started (picks the piece-size zone)
  private wallKick: WallKickMode
  private readonly mods: Modifiers // upgrade modifiers; all 1 (no change) without upgrades
  private readonly abilitySpecs = new Map<string, AbilitySpec>()
  private readonly abilities: AbilityState[] // the same arrays/objects as state.abilities / state.effects
  private readonly effects: ActiveEffects = {}
  private readonly machines: Machines // the three machines (F23); their states are state.machines
  private readonly primed = new Map<number, string>() // broken laser: primed group id → its cells when primed
  private training: TrainingRules | null // F30: a lesson's training shift (null = a normal shift)
  private queue: PieceChoice[] = [] // F30: pieces a lesson chose to come next, after nextDef

  constructor(config: ShiftConfig, options: ShiftOptions) {
    this.config = config
    this.options = options
    this.training = options.training ? { ...TRAINING_START, ...options.training } : null
    this.rng = createRng(options.seed)
    const { width, height, bufferRows, visibleWidth } = config.tank
    this.colorCount = paletteSize(config, options.rank)
    this.wallKick = options.wallKick ?? 'rotateVat'
    this.mods = clampModifiers(options.modifiers)
    for (const a of options.abilities ?? []) {
      if (this.abilitySpecs.has(a.id)) continue // equipped twice: once is enough
      const rate = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0) // no negative or broken charge rates
      this.abilitySpecs.set(a.id, { ...a, chargePerSecond: rate(a.chargePerSecond), chargePerSeal: rate(a.chargePerSeal) })
    }
    this.abilities = [...this.abilitySpecs.values()].map((a) => ({ id: a.id, effect: a.effect, charge: 0, ready: false }))
    this.machines = new Machines(options.breakdowns, options.rank, this.mods, (e) => this.events.push(e))
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
      integrity: 1,
      phase: 'playing',
      ruptureReason: null,
      cracks: [],
      sealedCracks: [],
      cracksSealed: 0,
      cracksNeeded: cracksNeededFor(config, options.rank),
      quotaMet: false,
      score: 0,
      status: 'playing',
      rank: options.rank,
      abilities: this.abilities,
      effects: this.effects,
      machines: this.machines.state,
      primed: [],
    }

    if (options.startGrid) {
      this.state.grid.set(options.startGrid)
      regroup(this.state, this.book)
    } else if (!this.training) this.placeJunk(junkCount(config, options.rank))
    if (this.training) {
      // a lesson's shift: nothing in the hold, and no piece until the lesson brings one in (train({ type: 'spawn' }))
      this.heldDef = null
      this.nextDef = this.randomDef()
    } else {
      // v1 starts every shift with a piece already in the hold.
      this.heldDef = this.randomDef()
      this.nextDef = this.randomDef()
      this.spawnNext()
    }
    this.refreshView()
  }

  takeEvents(): ShiftEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  setWallKick(mode: WallKickMode): void {
    this.wallKick = mode
  }

  // ---------------------------------------------------------------- snapshots (the Dev Kit; snapshot.ts)

  snapshot(): ShiftSnapshot {
    const s = this.state
    const o = this.options
    return structuredClone({
      kind: SNAPSHOT_KIND,
      version: SNAPSHOT_VERSION,
      options: { seed: o.seed, rank: o.rank, wallKick: this.wallKick, modifiers: { ...this.mods }, abilities: o.abilities ?? [],
        ...(this.training ? { training: { ...this.training } } : {}) },
      width: s.width,
      height: s.height,
      rng: this.rng.save(),
      state: {
        grid: Array.from(s.grid), spin: s.spin, pressure: s.pressure, integrity: s.integrity, phase: s.phase,
        ruptureReason: s.ruptureReason, cracks: s.cracks, sealedCracks: s.sealedCracks ?? [], cracksSealed: s.cracksSealed, cracksNeeded: s.cracksNeeded,
        quotaMet: s.quotaMet, score: s.score, status: s.status, leftoverPenalty: s.leftoverPenalty ?? null,
        groups: [...s.groups.values()], abilities: this.abilities, effects: this.effects,
      },
      inner: {
        fillMs: [...this.book.fillMs], nextGroupId: this.book.nextId, nextCrackId: this.nextCrackId, colorCount: this.colorCount,
        piece: this.piece, nextDef: this.nextDef, heldDef: this.heldDef, softDrop: this.softDrop, lockMs: this.lockMs,
        lockResets: this.lockResets, crackTimerMs: this.crackTimerMs, popStreak: this.popStreak, playedMs: this.playedMs,
        primed: [...this.primed], machines: this.machines.save(),
        ...(this.training ? { training: { rules: this.training, queue: this.queue } } : {}),
      },
    })
  }

  restore(snapshot: ShiftSnapshot): void {
    const s = this.state
    if (snapshot.width !== s.width || snapshot.height !== s.height) {
      throw new Error(`This snapshot's tank is ${snapshot.width}×${snapshot.height}; the game's is ${s.width}×${s.height} now.`)
    }
    const x = structuredClone(snapshot) // nothing shared with the saved copy
    const st = x.state
    this.rng.load(x.rng)
    s.grid = Uint8Array.from(st.grid)
    s.groupOf = new Int32Array(s.width * s.height).fill(-1)
    s.groups = new Map(st.groups.map((g) => [g.id, g]))
    for (const g of st.groups) for (const i of g.cells) s.groupOf[i] = g.id
    Object.assign(s, {
      spin: st.spin, integrity: st.integrity, phase: st.phase, ruptureReason: st.ruptureReason, cracks: st.cracks,
      cracksSealed: st.cracksSealed, cracksNeeded: st.cracksNeeded, quotaMet: st.quotaMet, score: st.score,
      status: st.status, rank: x.options.rank,
      sealedCracks: st.sealedCracks ?? [], // (snapshots from before F36 have none)
    })
    if (st.leftoverPenalty === null) delete s.leftoverPenalty
    else s.leftoverPenalty = st.leftoverPenalty
    this.setPressure(st.pressure)
    this.abilities.splice(0, this.abilities.length, ...st.abilities)
    for (const k of Object.keys(this.effects)) delete this.effects[k as keyof ActiveEffects]
    Object.assign(this.effects, st.effects)
    const inner = x.inner
    this.book = { fillMs: new Map(inner.fillMs), nextId: inner.nextGroupId }
    this.nextCrackId = inner.nextCrackId
    this.colorCount = inner.colorCount
    this.piece = inner.piece
    this.nextDef = inner.nextDef
    this.heldDef = inner.heldDef
    this.softDrop = inner.softDrop
    this.lockMs = inner.lockMs
    this.lockResets = inner.lockResets
    this.crackTimerMs = inner.crackTimerMs
    this.popStreak = inner.popStreak
    this.playedMs = inner.playedMs
    this.wallKick = x.options.wallKick
    this.primed.clear()
    for (const [id, cells] of inner.primed) this.primed.set(id, cells)
    s.primed = [...this.primed.keys()]
    this.machines.load(inner.machines)
    // a lesson's training shift (F30): its rules and chosen pieces as they were
    this.training = inner.training ? inner.training.rules : null
    this.queue = inner.training ? inner.training.queue : []
    this.events = []
    this.refreshView()
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
    // a lesson step that only allows some controls: the others do nothing (no "nope" — the lesson says what to do)
    // (going to the console is never blocked: the game sends it on its own when the console slides over the tank)
    const allow = this.training?.allow
    if (allow && action.type !== 'console' && !allow.includes(action.type)) return
    let ok = true
    this.rejectReason = undefined
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
      case 'hold':
        ok = this.hold()
        break
      case 'pop':
        ok = this.pop(action.x, action.y)
        break
      case 'ability':
        ok = this.fireAbility(action.id)
        break
      case 'repair':
        ok = this.machines.repair(action.machine)
        if (ok && action.machine === 'laser') this.clearPrimed()
        break
      case 'console':
        this.machines.atConsole = action.on
        break
    }
    if (!ok && this.rejectReason && action.type === 'pop') {
      // a refused zap on goop: say why, and which cell was poked (the goo jiggles there — Muzzy 2026-10-18)
      this.events.push({ type: 'reject', action: action.type, reason: this.rejectReason, cell: action.y * this.state.width + wrapX(action.x, this.state.width) })
    } else if (!ok) this.events.push(this.rejectReason ? { type: 'reject', action: action.type, reason: this.rejectReason } : { type: 'reject', action: action.type })
    this.refreshView()
  }

  // ---------------------------------------------------------------- time

  private step(dt: number): void {
    const s = this.state
    this.playedMs += dt
    if (s.phase === 'playing') {
      // (a lesson's training shift: each of these only while its rule is on — training.ts)
      const t = this.training
      this.setPressure(s.pressure + (dt * (t ? t.pressureRise : 1)) / this.riseMsToFull())
      if (!t || t.cracks) this.growCracks(dt)
      this.chargeAbilities(dt / 1000, 0) // before the drain: a rupture this step stops charging at once
      if (!t || t.integrity) this.drainIntegrity(dt)
      if (s.phase === 'playing' && this.breakdownsOn()) this.machines.tick(dt, this.softDrop) // a rupture freezes the meters
    } else {
      // Rupture: pressure drains at a steady rate (the pop line sinks with it); at 0 the shift is over.
      this.setPressure(s.pressure - dt / (this.config.rupture.drainMs * this.mods.ruptureDrainTimeMult))
      if (s.pressure <= 0) {
        this.end()
        return
      }
      // After an overflow there's no piece: a new one comes as soon as zapping makes room at the top.
      if (!this.piece) this.trySpawn()
    }
    this.settle() // goop that was resting on the falling piece drops once the piece moves away
    if (!this.training || this.training.falling) this.fallPiece(dt)
    this.fillGroups(dt)
  }

  // Do the machines wear down? Always in a normal shift; in a lesson's training shift only when a step turns it on.
  private breakdownsOn(): boolean {
    return !this.training || this.training.breakdowns
  }

  // How long pressure takes to rise 0 → 100% (tuning × upgrades). Vents are "ms of rise", so they use it too.
  private riseMsToFull(): number {
    return this.config.pressure.riseMsToFull * this.mods.pressureRiseTimeMult
  }

  private setPressure(value: number): void {
    const s = this.state
    s.pressure = Math.max(0, Math.min(1, value))
    s.pressureRow = firstPoppableRow(s)
  }

  // A new crack every so often — sooner the higher the pressure. Cracks keep coming after the quota is met.
  private growCracks(dt: number): void {
    const s = this.state
    this.crackTimerMs += dt
    if (this.crackTimerMs < crackEveryMs(this.config, s.pressure) * this.mods.crackEveryMult) return
    // The low-cracks ability: this crack goes in the bottom rows (if there's no room there, a normal crack instead).
    const low = this.effects.lowCracks
    let crack = low ? spawnCrack(s, this.rng, this.config, this.colorCount, this.nextCrackId, low.rows) : null
    const wasLow = !!crack
    crack ??= spawnCrack(s, this.rng, this.config, this.colorCount, this.nextCrackId)
    // Nowhere for it right now: keep the timer, so it tries again next step (not a whole interval later).
    if (!crack) return
    this.crackTimerMs = 0
    this.nextCrackId++
    s.cracks.push(crack)
    this.events.push({ type: 'crack', crack: { ...crack } })
    if (low && wasLow && --low.left <= 0) {
      delete this.effects.lowCracks
      this.events.push({ type: 'abilityEnd', id: low.id })
    }
  }

  // Every open (unsealed) crack wears the tank down a little each second. Sealing one gives a little back (pop).
  private drainIntegrity(dt: number): void {
    const s = this.state
    const open = s.cracks.reduce((sum, c) => sum + (c.drain ?? 1), 0) // a high hill crack counts for less (cracks.ts)
    const drain = open * this.config.integrity.drainPerCrackPerSec * this.mods.integrityDrainMult * (dt / 1000)
    s.integrity = Math.max(0, s.integrity - drain)
    if (s.integrity <= 0) this.rupture('integrity')
  }

  private rupture(reason: 'integrity' | 'overflow'): void {
    const s = this.state
    if (s.phase === 'rupture') return
    s.phase = 'rupture'
    s.ruptureReason = reason
    this.events.push({ type: 'rupture', reason })
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
    const msPerRow = this.config.fall.msPerRow / this.mods.fallSpeedMult / (this.softDrop ? this.config.fall.softDropFactor : 1)
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
    if (s.phase === 'playing' && this.breakdownsOn()) this.machines.spun()
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
    const s = this.state
    const turned = rotateCells(p.cells, dir, p.center)
    for (const [kx, ky] of this.config.pieces.kicks) {
      if (this.blockedAt(turned, s.spin + p.offset + kx, p.y + ky)) continue
      p.cells = turned
      p.rotation = (p.rotation + dir + 4) % 4
      p.y += ky
      this.events.push({ type: 'rotate', dir })
      if (kx !== 0) {
        // Both modes put the piece in the same tank cells (origin = spin + offset + kx); they differ in what moves.
        if (this.wallKick === 'rotateVat') {
          s.spin = wrapX(s.spin + kx, s.width) // the tank turns; the piece stays on the centre line of the screen
          this.events.push({ type: 'spin', dx: kx })
        } else {
          p.offset += kx // v1: the piece leaves the centre line for the rest of its fall
          this.events.push({ type: 'move', dx: kx })
        }
      }
      this.moveReset()
      return true
    }
    return false
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
    if (!g) return false
    if (!this.canPop(g)) {
      // say why (F26): the line is the reason that waiting won't fix, so it wins when both are true
      const topRow = Math.floor(g.cells[0] / s.width)
      this.rejectReason = topRow < popLine(s) ? 'aboveLine' : 'filling'
      return false
    }

    // Broken laser: the first zap only primes the group (no score, no seal); a second zap pops it.
    if (this.machines.isBroken('laser') && !this.primed.has(g.id)) {
      this.primed.set(g.id, g.cells.join(','))
      s.primed = [...this.primed.keys()]
      this.events.push({ type: 'prime', groupId: g.id })
      return true
    }

    // Score (worked out before the goop leaves the grid, as v1).
    const combo = this.popStreak + 1
    s.score += popPoints(s, this.config, g.cells, combo)
    this.popStreak = combo

    // Seal every plugged crack under this group.
    const cellSet = new Set(g.cells)
    const sealedNow = s.cracks.filter((c) => c.plugged && cellSet.has(c.y * s.width + c.x))
    const sealed = sealedNow.map((c) => c.id)
    s.cracks = s.cracks.filter((c) => !sealed.includes(c.id))
    // the spot is mended for good: no crack forms there again (F36, cracks.ts spawnCrack)
    for (const c of sealedNow) (s.sealedCracks ??= []).push({ id: c.id, x: c.x, y: c.y })
    s.cracksSealed += sealed.length

    // Zapping vents pressure, sealing vents more (v1's time refunds, turned into pressure: ms of rise).
    // Not during a rupture: there pressure drains on its own, and venting would only shorten the time to zap.
    if (s.phase === 'playing') {
      const ventMs = popRefundMs(this.config, g.cells.length) + sealed.length * this.config.cracks.sealRefundMs * this.mods.sealVentMult
      this.setPressure(s.pressure - ventMs / this.riseMsToFull())
      // Each seal patches the tank a little (integrity.sealRefund, F27), never past full. Not during a rupture.
      s.integrity = Math.min(1, s.integrity + sealed.length * this.config.integrity.sealRefund)
      this.chargeAbilities(0, sealed.length)
    }

    for (const i of g.cells) {
      s.grid[i] = 0
      s.groupOf[i] = -1
    }
    s.groups.delete(g.id)
    this.book.fillMs.delete(g.id)
    this.events.push({ type: 'pop', cells: g.cells, color: g.color, sealed })
    if (s.phase === 'playing' && this.breakdownsOn()) this.machines.zapped(g.cells.length)

    this.settle()
    if (!s.quotaMet && s.cracksSealed >= s.cracksNeeded) {
      s.quotaMet = true // play goes on: every seal from here is bonus
      this.events.push({ type: 'quotaMet' })
    }
    this.updateReady()
    return true
  }

  // ---------------------------------------------------------------- abilities (F22)

  // Add charge from play time and seals. Only while the shift is playing — not during a rupture.
  private chargeAbilities(seconds: number, seals: number): void {
    for (const a of this.abilities) {
      if (a.ready) continue
      const spec = this.abilitySpecs.get(a.id)!
      a.charge = Math.min(1, a.charge + seconds * spec.chargePerSecond + seals * spec.chargePerSeal)
      if (a.charge >= 1 - 1e-9) {
        a.charge = 1
        a.ready = true
        this.events.push({ type: 'abilityReady', id: a.id })
      }
    }
  }

  // Fire a ready ability: its effect starts and the charge goes back to 0. Not ready, unknown, or the effect
  // can't do anything right now → rejected, and the charge is kept.
  private fireAbility(id: string): boolean {
    const a = this.abilities.find((x) => x.id === id)
    if (!a || !a.ready) return false
    const fire = ABILITY_EFFECTS[a.effect]
    if (!fire || !fire({ phase: this.state.phase, effects: this.effects }, this.abilitySpecs.get(id)!.params, id)) return false
    a.charge = 0
    a.ready = false
    this.events.push({ type: 'ability', id })
    return true
  }

  // ---------------------------------------------------------------- pieces

  private randomDef(): PieceDef {
    const zones = this.config.pieces.zones
    const zone = Math.min(zones.length - 1, Math.floor(this.playedMs / this.config.pieces.zoneEveryMs))
    return randomPiece(this.rng, this.config, zones[zone], this.colorCount)
  }

  // The piece after the one coming in: a lesson's chosen piece first (F30), otherwise a random one.
  private takeNextDef(): PieceDef {
    const choice = this.queue.shift()
    return (choice && pieceFromChoice(this.config, choice)) || this.randomDef()
  }

  // ---------------------------------------------------------------- training (F30 lessons; training.ts)

  // A lesson's command. false = refused (not a training shift, or the command can't happen) — nothing changed then.
  train(cmd: TrainingCommand): boolean {
    const s = this.state
    if (!this.training || s.status !== 'playing') return false
    const inTank = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && y >= 0 && y < s.height
    const goodColor = (c: number) => Number.isInteger(c) && c >= 1 && c <= this.config.colors.length
    switch (cmd.type) {
      case 'rules':
        Object.assign(this.training, cmd.rules)
        break
      case 'queue': {
        // every piece must be a real shape, or none are queued (a typo in a lesson file shouldn't half-work)
        if (!cmd.pieces.every((p) => pieceFromChoice(this.config, p))) return false
        this.queue = cmd.pieces.map((p) => ({ ...p }))
        this.nextDef = this.takeNextDef() // the first chosen piece is the very next one
        break
      }
      case 'spawn':
        if (this.piece || !this.trySpawn()) return false
        break
      case 'crack': {
        const x = wrapX(cmd.x, s.width), i = cmd.y * s.width + x
        if (!inTank(cmd.x, cmd.y) || !goodColor(cmd.color) || s.grid[i] !== 0 || s.cracks.some((c) => c.x === x && c.y === cmd.y)) return false
        const crack = { id: this.nextCrackId++, x, y: cmd.y, color: cmd.color, plugged: false }
        s.cracks.push(crack)
        this.events.push({ type: 'crack', crack: { ...crack } })
        break
      }
      case 'goop': {
        if (!cmd.cells.every(([x, y, c]) => inTank(x, y) && goodColor(c) && s.grid[y * s.width + wrapX(x, s.width)] === 0)) return false
        for (const [x, y, c] of cmd.cells) s.grid[y * s.width + wrapX(x, s.width)] = c
        regroup(s, this.book)
        this.settle() // goop placed in mid-air falls, as any loose goop does
        // as if it had landed long ago: already full (so it can pop as soon as it's at or below the pressure line).
        // The groups it made or joined are the ones regroup just restarted at 0.
        for (const [id, ms] of this.book.fillMs) if (ms === 0) this.book.fillMs.set(id, Number.MAX_SAFE_INTEGER)
        this.fillGroups(0)
        break
      }
      case 'pressure':
        if (!Number.isFinite(cmd.value)) return false
        this.setPressure(cmd.value)
        this.updateReady()
        break
      case 'clear':
        s.grid.fill(0)
        s.groupOf.fill(-1)
        s.groups.clear()
        this.book.fillMs.clear()
        s.cracks = []
        s.sealedCracks = []
        this.piece = null
        this.softDrop = false
        this.clearPrimed()
        break
    }
    this.refreshView()
    return true
  }

  // The next piece after one lands. No room at the top: the tank ruptures (overflow).
  // Already rupturing: no piece until zapping makes room (step keeps trying) — the shift still ends at pressure 0.
  private spawnNext(): void {
    if (this.trySpawn()) return
    if (this.state.phase === 'playing') this.rupture('overflow')
  }

  // Bring in the next piece if there's room for it. v1: always the centre column, top row of the hidden buffer.
  private trySpawn(): boolean {
    const piece = newFallingPiece(this.nextDef, 0, 0)
    this.piece = null
    if (this.blockedAt(piece.cells, this.state.spin, 0)) return false
    this.nextDef = this.takeNextDef()
    this.lockMs = null
    this.lockResets = 0
    this.piece = piece
    this.events.push({ type: 'spawn' })
    return true
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
    if (s.phase === 'playing' && this.breakdownsOn()) this.machines.landed()
    this.softDrop = false // v1: fast drop stops when a piece lands
    if (!this.training || this.training.autoSpawn) this.spawnNext() // (a lesson may bring the next one in itself)
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
    this.prunePrimed()
  }

  // A primed group that changed (merged, fell, popped) is no longer primed.
  private prunePrimed(): void {
    if (this.primed.size === 0) return
    for (const [id, cells] of this.primed) {
      const g = this.state.groups.get(id)
      if (!g || g.cells.join(',') !== cells) this.primed.delete(id)
    }
    this.state.primed = [...this.primed.keys()]
  }

  private clearPrimed(): void {
    this.primed.clear()
    this.state.primed = []
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
    s.leftoverPenalty = Math.floor(left * this.config.score.leftoverPerCell * this.mods.leftoverPenaltyMult)
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
