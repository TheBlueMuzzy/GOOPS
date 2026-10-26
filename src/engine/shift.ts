// One shift of Goops. Pure — time only moves through tick(ms), randomness only through the seeded rng.
// The screen sends actions in, reads `state`, and takes events out.
// LIVE TUNING: `config` (and options.breakdowns) are read at the moment each number is used, never copied — so the
// game can hand in its live tuning import and the Dev Kit's sliders change the next tick. Fixed when the shift
// starts (by design, like the rank): the tank's size, the colours in play and the crack quota.
// The loop (GDD §4): pressure rises → cracks come faster → open cracks drain tank integrity → at 0 the tank
// ruptures → pressure drains to 0 while you zap what you can → the shift ends (won if the crack quota was met).
import type { AbilityState, Group, RejectReason, ShiftAction, ShiftEngine, ShiftEvent, ShiftState, ShiftStatus, TapPoint, WallKickMode } from './types'
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
  cellColor,
  mainColor,
  randomPiece,
  recolored,
  rotateCells,
} from './pieces'
import { type GroupBook, dropLoose, regroup } from './groups'
import { crackEveryMs, firstPoppableRow, popLine, spawnCrack, updatePlugs } from './cracks'
import { popPoints, popRefundMs } from './score'
import { type Modifiers, clampModifiers } from './upgrades'
import { ABILITY_EFFECTS, type AbilitySpec, type ActiveEffects } from './abilities'
import { type BreakdownConfig, Machines } from './machines'
import { SNAPSHOT_KIND, SNAPSHOT_VERSION, type ShiftSnapshot } from './snapshot'
import { type PieceChoice, type PieceFallback, type TrainingCommand, type TrainingRules, OVERFLOW_RAIL_ROWS, TRAINING_START,
  columnTooLow, freeCrackSpot, pieceFromChoice } from './training'
import { type WhiteGoopConfig, newWhiteGoop, stepWhiteGoop, whiteGoopAt, whiteGoopIn } from './whiteGoop'
import { type TwistsConfig, crackCells, crackHas, crackSize, growCracks as growCrackCells, growOn } from './twists'
import { type Color, WILD } from './types'
import { neighbours } from './tank'

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
  // F59: can the player swap the falling piece with the next one? (unlocked by rank — src/progress/progression.ts; off
  // in a lesson's training shift). Left out = on. Off: 'hold' is a control that doesn't work (allows says no).
  swap?: boolean
  // F63 the white goop: content/tuning/whiteGoop.json (read live). Leave it out and he's never in the tank.
  whiteGoop?: WhiteGoopConfig
  // F39 rank twists: content/tuning/twists.json (read live) — two-colour pieces (20), growing cracks (30), wild goop
  // (40). Leave it out (or a lesson's training shift) and there are none.
  twists?: TwistsConfig
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
  // F31: what comes when the queue runs out (null = random pieces), how far round its pieces it is, and whether the
  // next piece came from it (then it's decided again as it comes in — the stack may have changed since)
  private fallback: { rule: PieceFallback; index: number; nextFromRule: boolean } | null = null

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
      nextCells: null,
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
    // F63: from rank 31 the white goop drops in (never in a lesson's shift)
    this.state.vet = whiteGoopIn(options.whiteGoop, options.rank, !!this.training) ? newWhiteGoop(this.state, options.whiteGoop!) : null
    this.nextDef = this.randomDef()
    // (a lesson's shift: no piece until the lesson brings one in — train({ type: 'spawn' }))
    if (!this.training) this.spawnNext()
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
      options: { seed: o.seed, rank: o.rank, wallKick: this.wallKick, modifiers: { ...this.mods }, abilities: o.abilities ?? [], swap: o.swap ?? true,
        ...(this.training ? { training: { ...this.training } } : {}) },
      width: s.width,
      height: s.height,
      rng: this.rng.save(),
      state: {
        grid: Array.from(s.grid), spin: s.spin, pressure: s.pressure, integrity: s.integrity, phase: s.phase,
        ruptureReason: s.ruptureReason, cracks: s.cracks, sealedCracks: s.sealedCracks ?? [], cracksSealed: s.cracksSealed, cracksNeeded: s.cracksNeeded,
        quotaMet: s.quotaMet, score: s.score, status: s.status, leftoverPenalty: s.leftoverPenalty ?? null,
        groups: [...s.groups.values()], abilities: this.abilities, effects: this.effects, vet: s.vet ?? null,
      },
      inner: {
        fillMs: [...this.book.fillMs], nextGroupId: this.book.nextId, nextCrackId: this.nextCrackId, colorCount: this.colorCount,
        piece: this.piece, nextDef: this.nextDef, softDrop: this.softDrop, lockMs: this.lockMs,
        lockResets: this.lockResets, crackTimerMs: this.crackTimerMs, popStreak: this.popStreak, playedMs: this.playedMs,
        primed: [...this.primed], machines: this.machines.save(),
        ...(this.training ? { training: { rules: this.training, queue: this.queue, fallback: this.fallback } } : {}),
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
      vet: st.vet ?? null, // F63 the white goop (snapshots from before F63 have none)
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
    this.fallback = inner.training?.fallback ?? null // (F31; older snapshots have none)
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
    if (!this.allows(action.type)) return
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
        ok = this.pop(action.x, action.y, action.at)
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
      let pressure = s.pressure + (dt * (t ? t.pressureRise : 1)) / this.riseMsToFull()
      if (t && pressure > t.pressureCap) pressure = Math.max(s.pressure, t.pressureCap) // stops at the cap (never pulled down)
      this.setPressure(pressure)
      if (!t || t.cracks) this.growCracks(dt)
      // F39: from rank 30 open cracks spread into the cells next to them (twists.ts; never in a lesson)
      if (!t && growOn(this.options.twists, s.rank)) growCrackCells(s, this.rng, this.options.twists!, dt, s.pressureRow, this.mods.crackEveryMult, this.events)
      this.chargeAbilities(dt / 1000, 0) // before the drain: a rupture this step stops charging at once
      if (!t || t.integrity) this.drainIntegrity(dt)
      if (s.phase === 'playing' && this.breakdownsOn()) this.machines.tick(dt, this.softDrop) // a rupture freezes the meters
      if (s.phase === 'playing') this.stepDump(dt) // F42 Goop Dump's rain (a rupture has ended it)
    } else {
      // Rupture: pressure drains at a steady rate (the pop line sinks with it); at 0 the shift is over.
      const speed = this.training ? Math.max(0.01, this.training.ruptureDrainSpeed) : 1 // (a lesson may slow the drain)
      this.setPressure(s.pressure - (dt * speed) / (this.config.rupture.drainMs * this.mods.ruptureDrainTimeMult))
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
    this.stepVet(dt)
  }

  // F63 the white goop oozes, seals, rests (whiteGoop.ts). A crack he finishes is sealed like one of yours: gone, its
  // spot mended for good; whether it counts toward the quota and patches the tank is content/tuning/whiteGoop.json's.
  // No pressure vent and no score (those come from zapping).
  private stepVet(dt: number): void {
    const s = this.state
    const cfg = this.options.whiteGoop
    if (!s.vet || !cfg || s.status !== 'playing') return
    const crack = stepWhiteGoop(s, cfg, dt)
    if (!crack) return
    s.cracks = s.cracks.filter((c) => c.id !== crack.id)
    for (const [x, y] of crackCells(crack)) (s.sealedCracks ??= []).push({ id: crack.id, x, y }) // (every cell of a grown crack, F39)
    this.events.push({ type: 'vetSeal', crackId: crack.id })
    // a grown crack counts as its cell count (F39, Muzzy 2026-10-25), here as when you seal it
    const size = crackSize(crack)
    if (cfg.integrityRefund && s.phase === 'playing') s.integrity = Math.min(1, s.integrity + size * this.config.integrity.sealRefund)
    if (cfg.countsForQuota) {
      s.cracksSealed += size
      if (!s.quotaMet && s.cracksSealed >= s.cracksNeeded) {
        s.quotaMet = true
        this.events.push({ type: 'quotaMet' })
      }
    }
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
    // a high hill crack counts for less (cracks.ts); a grown crack drains per cell (F39: it gets more urgent as it grows)
    const open = s.cracks.reduce((sum, c) => sum + (c.drain ?? 1) * crackSize(c), 0)
    const drain = open * this.config.integrity.drainPerCrackPerSec * this.mods.integrityDrainMult * (dt / 1000)
    s.integrity = Math.max(this.training?.integrityFloor ?? 0, s.integrity - drain)
    if (s.integrity <= 0) this.rupture('integrity')
  }

  private rupture(reason: 'integrity' | 'overflow'): void {
    const s = this.state
    if (s.phase === 'rupture') return
    if (this.training && !this.training.rupture) return // a lesson that doesn't allow it: the tank holds
    s.phase = 'rupture'
    s.ruptureReason = reason
    this.events.push({ type: 'rupture', reason })
    // F42: a Goop Dump still raining stops here — more goop now would only block the pieces while you zap
    const dump = this.effects.dump
    if (dump) {
      delete this.effects.dump
      this.events.push({ type: 'abilityEnd', id: dump.id })
    }
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

  // Swap (F59): trade the falling piece with the NEXT one. The next piece appears where the falling one was (no room
  // there: refused, nothing changes) and the falling piece becomes the next one — so swapping again trades them back.
  // A lesson's chosen pieces (queue) still come after the next one, in order.
  private hold(): boolean {
    const p = this.piece
    if (!p) return false
    const swapped = newFallingPiece(this.nextDef, p.offset, p.y)
    if (this.blockedAt(swapped.cells, this.state.spin + swapped.offset, swapped.y)) return false
    this.nextDef = p.def
    if (this.fallback) this.fallback.nextFromRule = false // (the next one is now the piece that was falling: keep it)
    this.piece = swapped
    this.lockMs = null
    this.lockResets = 0
    this.events.push({ type: 'hold' })
    return true
  }

  private pop(x: number, y: number, tap?: TapPoint): boolean {
    const s = this.state
    if (!Number.isInteger(x) || !Number.isInteger(y) || y < 0 || y >= s.height) return false
    // F63: the laser passes through the white goop — "ow", and he stays; goop in front of him still pops (the sketch)
    const throughVet = !!s.vet && whiteGoopAt(s, tap && Number.isFinite(tap.x) && Number.isFinite(tap.y) ? tap : { x: x + 0.5, y: y + 0.5 })
    if (throughVet) this.events.push({ type: 'vetOw', at: tap ?? { x: wrapX(x, s.width) + 0.5, y: y + 0.5 } })
    const id = s.groupOf[y * s.width + wrapX(x, s.width)]
    const g = s.groups.get(id)
    if (!g) return throughVet
    const zapColors = this.training?.zapColors
    if (zapColors && !zapColors.includes(g.color)) {
      // a lesson that only lets one colour be zapped: the poked goop still jiggles + sounds like a shift poke (F68),
      // so the refusal answers the tap instead of feeling broken (the lesson's own line says which colour)
      this.rejectReason = 'lessonColour'
      return false
    }
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

    // Seal every plugged crack under this group. (F39: a grown crack is plugged only while EVERY cell of it is covered
    // by its colour (or wild) — then popping goop on any of its cells seals the whole crack.)
    const cellSet = new Set(g.cells)
    const sealedNow = s.cracks.filter((c) => c.plugged && crackCells(c).some(([cx, cy]) => cellSet.has(cy * s.width + cx)))
    const sealed = sealedNow.map((c) => c.id)
    s.cracks = s.cracks.filter((c) => !sealed.includes(c.id))
    // the spot is mended for good: no crack forms there again (F36, cracks.ts spawnCrack) — every cell of a grown one
    for (const c of sealedNow) for (const [cx, cy] of crackCells(c)) (s.sealedCracks ??= []).push({ id: c.id, x: cx, y: cy })
    // F39 (Muzzy 2026-10-25): a grown crack counts as its cell count toward the quota — and so for everything a seal
    // gives (vent, integrity, ability charge): one cell = one seal
    const seals = sealedNow.reduce((sum, c) => sum + crackSize(c), 0)
    s.cracksSealed += seals

    // Zapping vents pressure, sealing vents more (v1's time refunds, turned into pressure: ms of rise).
    // Not during a rupture: there pressure drains on its own, and venting would only shorten the time to zap.
    if (s.phase === 'playing') {
      const ventMs = popRefundMs(this.config, g.cells.length) + seals * this.config.cracks.sealRefundMs * this.mods.sealVentMult
      this.setPressure(s.pressure - ventMs / this.riseMsToFull())
      // Each seal patches the tank a little (integrity.sealRefund, F27), never past full. Not during a rupture.
      s.integrity = Math.min(1, s.integrity + seals * this.config.integrity.sealRefund)
      this.chargeAbilities(0, seals)
    }

    for (const i of g.cells) {
      s.grid[i] = 0
      s.groupOf[i] = -1
    }
    s.groups.delete(g.id)
    this.book.fillMs.delete(g.id)
    // where the zap hit (F67): the exact tap if the screen sent one, else the tapped cell's centre; x wrapped round the tank
    const at = tap && Number.isFinite(tap.x) && Number.isFinite(tap.y)
      ? { x: ((tap.x % s.width) + s.width) % s.width, y: tap.y }
      : { x: wrapX(x, s.width) + 0.5, y: y + 0.5 }
    this.events.push({ type: 'pop', cells: g.cells, color: g.color, sealed, at })
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
    const pieceColor = this.piece ? mainColor(this.piece.def) : null // (F42: what Goop Dump / Colorizer copy)
    if (!fire || !fire({ phase: this.state.phase, pieceColor, effects: this.effects, machines: this.machines.state }, this.abilitySpecs.get(id)!.params, id)) return false
    a.charge = 0
    a.ready = false
    this.events.push({ type: 'ability', id })
    if (a.effect === 'colorize') this.colorizeNext() // the piece already in the next window is the first one
    return true
  }

  // F42 Goop Colorizer: the piece that just became the NEXT one takes the colour (so the next window shows it), and
  // one fewer is left. After the last: the effect ends.
  private colorizeNext(): void {
    const c = this.effects.colorize
    if (!c) return
    this.nextDef = recolored(this.nextDef, c.color)
    c.left--
    if (c.left <= 0) {
      delete this.effects.colorize
      this.events.push({ type: 'abilityEnd', id: c.id })
    }
  }

  // F42 Goop Dump: count down to the next cell on the rules clock (tick — so both Dev Kit pauses stop it) and drop it;
  // after a wave's last cell, waveMs of quiet; after the last wave, the effect ends.
  private stepDump(dt: number): void {
    const d = this.effects.dump
    if (!d) return
    d.waitMs -= dt
    while (d.waitMs <= 0) {
      this.dropDumpCell(d.color)
      d.cellsLeft--
      if (d.cellsLeft > 0) {
        d.waitMs += d.cellMs
        continue
      }
      d.wavesLeft--
      if (d.wavesLeft <= 0) {
        delete this.effects.dump
        this.events.push({ type: 'abilityEnd', id: d.id })
        return
      }
      d.cellsLeft = d.cellsPerWave
      d.waitMs += d.waveMs
    }
  }

  // One dumped cell: into a random column (seeded) whose hidden top rows are clear — so it never rests up there and
  // blocks the next piece — and not into a column the falling piece is in. It comes in at the top (a 'dump'
  // event) and drops onto whatever is below (the 'fall' event right after). No column free: this cell is skipped.
  private dropDumpCell(color: Color): void {
    const s = this.state
    // (not into any column the falling piece is in, however low it is: the piece isn't in the grid, so the cell would
    // settle straight through it)
    const pieceCols = new Set<number>()
    if (this.piece) for (const [x] of this.pieceCells(this.piece)) pieceCols.add(x)
    const free: number[] = []
    for (let x = 0; x < s.width; x++) {
      let clear = !pieceCols.has(x)
      for (let y = 0; clear && y <= s.bufferRows; y++) if (s.grid[y * s.width + x] !== 0) clear = false
      if (clear) free.push(x)
    }
    if (free.length === 0) return
    const x = free[this.rng.int(free.length)]
    s.grid[x] = color // row 0, the very top
    this.events.push({ type: 'dump', x, color })
    for (const id of regroup(s, this.book)) this.events.push({ type: 'merge', groupId: id })
    this.settle()
  }

  // ---------------------------------------------------------------- pieces

  private randomDef(): PieceDef {
    const zones = this.config.pieces.zones
    const zone = Math.min(zones.length - 1, Math.floor(this.playedMs / this.config.pieces.zoneEveryMs))
    // (a lesson can hold the size: e.g. 'tetra' keeps every piece 4 cells however long it runs)
    // (F39 rank twists: never in a lesson's training shift)
    const twists = this.options.twists && !this.training ? { config: this.options.twists, rank: this.state.rank } : undefined
    return randomPiece(this.rng, this.config, this.training?.zone ?? zones[zone], this.colorCount, twists)
  }

  // The piece after the one coming in: a lesson's chosen piece first (F30), then the lesson's fallback rule (F31),
  // otherwise a random one.
  private takeNextDef(): PieceDef {
    const choice = this.queue.shift()
    if (this.fallback) this.fallback.nextFromRule = !choice
    if (choice) return pieceFromChoice(this.config, choice) || this.randomDef()
    return this.fallbackChoice()?.def ?? this.randomDef()
  }

  // F31: the fallback rule's piece as the tank is NOW — its next piece round, or the build-up piece first while the
  // column it builds under is still too low for that piece to reach. null = no rule.
  private fallbackChoice(): { def: PieceDef; buildUp: boolean } | null {
    const f = this.fallback
    if (!f || f.rule.pieces.length === 0) return null
    const def = pieceFromChoice(this.config, f.rule.pieces[f.index % f.rule.pieces.length])
    if (!def) return null
    const b = f.rule.buildUp
    if (b && columnTooLow(this.state, wrapX(b.x, this.state.width), b.y, def)) {
      const build = pieceFromChoice(this.config, b.piece)
      if (build) return { def: build, buildUp: true }
    }
    return { def, buildUp: false }
  }

  // ---------------------------------------------------------------- training (F30 lessons; training.ts)

  // Does this control work right now? (Always, except swap before it's unlocked (F59) and in a lesson step that only
  // allows some.)
  allows(type: ShiftAction['type']): boolean {
    if (type === 'hold' && this.options.swap === false) return false
    const allow = this.training?.allow
    return !allow || type === 'console' || allow.includes(type)
  }

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
        const then = cmd.then
        const all = [...cmd.pieces, ...(then?.pieces ?? []), ...(then?.buildUp ? [then.buildUp.piece] : [])]
        if (!all.every((p) => pieceFromChoice(this.config, p))) return false
        this.queue = cmd.pieces.map((p) => ({ ...p }))
        // (a new queue replaces the old fallback rule; none = random pieces after the queue, as before F31)
        this.fallback = then ? { rule: structuredClone(then), index: 0, nextFromRule: false } : null
        this.nextDef = this.takeNextDef() // the first chosen piece is the very next one
        break
      }
      case 'spawn':
        if (this.piece) return false
        this.spawnNext() // (no room: the overflow rail, or a rupture if the lesson allows one)
        if (!this.piece) return false
        break
      case 'crack':
      case 'freeCrack': {
        // (freeCrack, F31: the engine picks the cell — the first free one on that row in view / just out of view)
        const at = cmd.type === 'crack' ? cmd.x : freeCrackSpot(s, cmd.y, cmd.where)
        if (at === null) return false
        const x = wrapX(at, s.width), i = cmd.y * s.width + x
        const taken = (c: { x: number; y: number }) => c.x === x && c.y === cmd.y
        if (!inTank(at, cmd.y) || !goodColor(cmd.color) || s.grid[i] !== 0 || s.cracks.some((c) => crackHas(c, x, cmd.y)) || (s.sealedCracks ?? []).some(taken)) return false
        const crack = { id: this.nextCrackId++, x, y: cmd.y, color: cmd.color, plugged: false }
        s.cracks.push(crack)
        this.events.push({ type: 'crack', crack: { ...crack } })
        break
      }
      case 'removeCrack': {
        const x = wrapX(cmd.x, s.width)
        if (!s.cracks.some((c) => crackHas(c, x, cmd.y))) return false
        s.cracks = s.cracks.filter((c) => !crackHas(c, x, cmd.y))
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
    // a lesson's overflow rail (F30): clear the goop at the top and try once more, instead of a rupture
    if (this.training?.overflowRail && this.state.phase === 'playing') {
      this.clearTopRows()
      if (this.trySpawn()) return
    }
    if (this.state.phase === 'playing') this.rupture('overflow')
  }

  // The overflow rail: every goop cell in the hidden spawn rows and the top OVERFLOW_RAIL_ROWS visible rows goes.
  private clearTopRows(): void {
    const s = this.state
    const cells: number[] = []
    for (let i = 0; i < (s.bufferRows + OVERFLOW_RAIL_ROWS) * s.width; i++) if (s.grid[i]) cells.push(i)
    if (cells.length === 0) return
    for (const i of cells) s.grid[i] = 0
    regroup(s, this.book)
    this.settle()
    this.events.push({ type: 'overflowRail', cells: cells.length }) // (F31: so a lesson can say why the goop vanished)
  }

  // Bring in the next piece if there's room for it. v1: always the centre column, top row of the hidden buffer.
  private trySpawn(): boolean {
    // (F31: a piece from a lesson's fallback rule is decided again now — the last piece may have built the column up)
    const ruled = this.fallback?.nextFromRule ? this.fallbackChoice() : null
    if (ruled) this.nextDef = ruled.def
    const piece = newFallingPiece(this.nextDef, 0, 0)
    this.piece = null
    if (this.blockedAt(piece.cells, this.state.spin, 0)) return false
    if (ruled && !ruled.buildUp) this.fallback!.index++ // (a build-up piece doesn't use up the rule's turn)
    this.nextDef = this.takeNextDef()
    this.colorizeNext() // (F42: while Goop Colorizer lasts, the new next piece takes its colour)
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
    const colors: Color[] = [] // (F39: one per cell — a two-colour piece locks as two clumps)
    this.pieceCells(p).forEach(([x, y], k) => {
      if (y < 0) return // v1: cells still above the tank are lost
      const i = y * s.width + x
      s.grid[i] = cellColor(p.def, k)
      cells.push(i)
      colors.push(s.grid[i])
    })
    this.piece = null
    this.events.push({ type: 'lock', cells, color: p.def.color, colors })
    this.wildTakeover(cells)
    for (const id of regroup(s, this.book)) this.events.push({ type: 'merge', groupId: id })
    this.settle() // corrupted pieces break apart here; loose parts fall
    this.popStreak = 0
    if (s.phase === 'playing' && this.breakdownsOn()) this.machines.landed()
    this.softDrop = false // v1: fast drop stops when a piece lands
    if (!this.training || this.training.autoSpawn) this.spawnNext() // (a lesson may bring the next one in itself)
  }

  // F39 wild goop: a normal (coloured) cell that just locked next to a wild clump turns that WHOLE clump its colour
  // (v1 gameLogic.ts). A clump touched by two colours of a two-colour piece takes the first one it touched.
  // (A wild piece landing next to coloured goop changes nothing — wild only ever gives its colour up.)
  private wildTakeover(locked: number[]): void {
    const s = this.state
    for (const start of locked) {
      const color = s.grid[start]
      if (color === WILD || color === 0) continue
      for (const n of neighbours(start, s.width, s.height)) {
        if (s.grid[n] !== WILD) continue
        // the whole wild clump (wild cells touching up / down / left / right, round the tank)
        const clump = [n]
        s.grid[n] = color
        for (let k = 0; k < clump.length; k++) {
          for (const m of neighbours(clump[k], s.width, s.height)) {
            if (s.grid[m] === WILD) { s.grid[m] = color; clump.push(m) }
          }
        }
        this.events.push({ type: 'wildTurn', cells: clump.sort((a, b) => a - b), color })
      }
    }
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
      s.piece = { cells, colors: cells.map((_, k) => cellColor(p.def, k)), rotation: p.rotation, fall: p.fall }
      const landY = landingRow(s.grid, p.cells, s.spin + p.offset, p.y, s.width, s.height)
      s.ghost = placeCells(p.cells, s.spin + p.offset, landY, s.width)
    } else {
      s.piece = null
      s.ghost = []
    }
    s.next = this.nextDef.cells.map((_, k) => cellColor(this.nextDef, k))
    s.nextCells = this.nextDef.cells.map(([x, y]) => [x, y])
  }
}
