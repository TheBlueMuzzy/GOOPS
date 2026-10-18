// One headless shift: the real engine, the real tuning (passed in, read from content/tuning by the caller), one bot.
// Deterministic: same seed + same tuning + same bot = the same shift. Returns what the balance report needs.
import { createShift } from '../../src/engine'
import type { BreakdownConfig, ShiftConfig, ShiftState } from '../../src/engine'
import { isOnScreen } from '../../src/engine/tank'
import { Bot, stackHeight, type BotSkill } from './bot'

export interface RunInput {
  bot: string
  skill: BotSkill
  seed: number
  rank: number
  shift: ShiftConfig
  breakdowns: BreakdownConfig | undefined // undefined = breakdowns off
  spinRepeatMs: number // tank.json
  heldSpinSlowdown: number // breakdowns.json controls (a held spin while the controls are broken)
  frameMs: number
  maxShiftMs: number
  progression: { minXp: number; minXpPerRank: number }
  timeline: boolean
}

// Where a crack formed, as a player would see it:
// 'surface' = on the floor or on top of goop with open sky above (a piece can land on it now)
// 'air'     = nothing under it yet (the column must be built up to reach it)
// 'under'   = goop somewhere above it in its column (buried: dig down first)
export type CrackSpot = 'surface' | 'air' | 'under'

export interface CrackRecord {
  formedAt: number
  pressure: number
  spot: CrackSpot
  visible: boolean
  sealedAt: number | null
  openMs: number // until sealed, or until the rupture
  aboveLineMs: number // time it sat above the pop line (unsealable until pressure rises again)
}

export interface RunResult {
  bot: string
  seed: number
  rank: number
  breakdowns: boolean
  ruptureReason: 'integrity' | 'overflow' | null
  ruptureAt: number | null
  pressureAtRupture: number | null
  endAt: number
  timedOut: boolean
  reached100At: number | null // first time pressure hit 100%
  quotaMet: boolean
  quotaAt: number | null
  cracksSealed: number
  cracksNeeded: number
  cracksFormed: number
  score: number
  xp: number
  pieces: number
  pops: number
  breakdownsCount: Record<string, number>
  firstBreakAt: Record<string, number | null>
  meanPressure: number // average pressure before the rupture
  crackSeconds: number // sum over time of open cracks (before the rupture)
  integrityLost: number
  cracks: CrackRecord[]
  timeline?: { t: number; pressure: number; integrity: number; open: number; stack: number; formed: number; sealed: number }[]
}

function spotOf(s: ShiftState, x: number, y: number): CrackSpot {
  for (let yy = 0; yy < y; yy++) if (s.grid[yy * s.width + x] !== 0) return 'under'
  if (y === s.height - 1 || s.grid[(y + 1) * s.width + x] !== 0) return 'surface'
  return 'air'
}

export function runShift(input: RunInput): RunResult {
  const engine = createShift(input.shift, { seed: input.seed, rank: input.rank, breakdowns: input.breakdowns })
  const s = engine.state
  const bot = new Bot(input.skill)
  const cracks = new Map<number, CrackRecord>()
  const r: RunResult = {
    bot: input.bot, seed: input.seed, rank: input.rank, breakdowns: !!input.breakdowns,
    ruptureReason: null, ruptureAt: null, pressureAtRupture: null, endAt: 0, timedOut: false, reached100At: null,
    quotaMet: false, quotaAt: null, cracksSealed: 0, cracksNeeded: s.cracksNeeded, cracksFormed: 0,
    score: 0, xp: 0, pieces: 0, pops: 0, breakdownsCount: { laser: 0, visor: 0, controls: 0 },
    firstBreakAt: { laser: null, visor: null, controls: null }, meanPressure: 0, crackSeconds: 0, integrityLost: 0,
    cracks: [], timeline: input.timeline ? [] : undefined,
  }
  let now = 0
  let pressureSum = 0
  let playingMs = 0
  let nextSample = 0
  bot.newPiece(0, false)
  engine.takeEvents()

  while (s.status === 'playing' && now < input.maxShiftMs) {
    // the bot acts (at most once a frame)
    const slow = s.machines?.controls.broken ? input.heldSpinSlowdown : 1
    const action = bot.decide(s, now, input.spinRepeatMs * slow)
    if (action) engine.act(action)

    const dt = input.frameMs
    const integrityBefore = s.integrity
    if (s.phase === 'playing') {
      for (const c of s.cracks) {
        const rec = cracks.get(c.id)
        if (!rec) continue
        rec.openMs += dt
        if (c.y < s.pressureRow) rec.aboveLineMs += dt
      }
      r.crackSeconds += (s.cracks.length * dt) / 1000
      pressureSum += s.pressure * dt
      playingMs += dt
    }
    engine.tick(dt)
    now += dt
    if (s.phase === 'playing' || r.ruptureAt === now) r.integrityLost += integrityBefore - s.integrity
    if (r.reached100At === null && s.pressure >= 1) r.reached100At = now

    for (const e of engine.takeEvents()) {
      switch (e.type) {
        case 'spawn':
          r.pieces++
          bot.newPiece(now, false)
          break
        case 'hold':
          bot.newPiece(now, true)
          break
        case 'reject':
          if (e.action === 'spin') bot.spinRejected(s)
          if (e.action === 'rotate') bot.rotateRejected()
          break
        case 'crack': {
          const c = e.crack
          cracks.set(c.id, {
            formedAt: now, pressure: s.pressure, spot: spotOf(s, c.x, c.y),
            visible: isOnScreen(c.x, s.spin, s.width, s.visibleWidth), sealedAt: null, openMs: 0, aboveLineMs: 0,
          })
          r.cracksFormed++
          break
        }
        case 'pop':
          r.pops++
          for (const id of e.sealed) {
            const rec = cracks.get(id)
            if (rec) rec.sealedAt = now
          }
          break
        case 'quotaMet':
          r.quotaAt = now
          break
        case 'rupture':
          r.ruptureReason = e.reason
          r.ruptureAt = now
          r.pressureAtRupture = s.pressure
          break
        case 'breakdown':
          r.breakdownsCount[e.machine]++
          r.firstBreakAt[e.machine] ??= now
          break
      }
    }

    if (r.timeline && now >= nextSample) {
      r.timeline.push({
        t: Math.round(now / 1000), pressure: round(s.pressure), integrity: round(s.integrity), open: s.cracks.length,
        stack: stackHeight(s), formed: r.cracksFormed, sealed: s.cracksSealed,
      })
      nextSample += 1000
    }
  }

  r.endAt = now
  r.timedOut = s.status === 'playing'
  r.quotaMet = s.quotaMet
  r.cracksSealed = s.cracksSealed
  r.score = s.score
  // XP as src/progress/progression.ts rewardShift: the final score, never less than the floor for the rank.
  r.xp = Math.max(Math.max(0, Math.round(s.score)), input.progression.minXp, input.progression.minXpPerRank * input.rank)
  r.meanPressure = playingMs ? pressureSum / playingMs : 0
  r.cracks = [...cracks.values()]
  return r
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
