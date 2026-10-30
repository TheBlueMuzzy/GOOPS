// F64 one headless FINAL SHIFT (rank 50): the real engine, the real tuning (passed in by final.mjs), one bot — with the
// white goop, the rank twists and the final shift switched on, as the game plays it. Deterministic: same seed + same
// tuning + same bot = the same shift.
// The console stand-ins (the bots in runShift never leave the tank):
//   - a valve stage waiting → the bot goes to the console for finalShift.json bots.valveSec seconds of ITS time; the
//     shift runs on at finalShift.json consoleTimeScale meanwhile; then the stage opens (until Muzzy's valve mini-game).
//   - a broken machine → the same trip, bots.json consoleRepairSec seconds per machine (each repair is ~4 clicks).
//     A valve trip repairs whatever is broken too.
import { createShift } from '../../src/engine'
import type { BreakdownConfig, MachineId, ShiftConfig, TwistsConfig, WhiteGoopConfig } from '../../src/engine'
import type { FinalShiftConfig } from '../../src/engine/finalShift'
import { Bot, type BotSkill } from './bot'

export interface FinalInput {
  bot: string
  skill: BotSkill
  seed: number
  shift: ShiftConfig
  breakdowns: BreakdownConfig
  whiteGoop: WhiteGoopConfig
  twists: TwistsConfig
  finalShift: FinalShiftConfig
  spinRepeatMs: number
  frameMs: number
  maxShiftMs: number
  repairSec: number // bots.json consoleRepairSec
}

export interface FinalResult {
  bot: string
  seed: number
  outcome: 'won' | 'overflow' | 'integrity' | 'timeout' // (F75: lost only when the tank breaks)
  vetAlive: boolean // F75: the Veteran made it to the end (won with him alive = "saved him": the happy ending)
  vetGoneAt: number | null // F75: real ms he was worn out at (null = never)
  stage: number // valve stages opened
  realMs: number // the player's time, console trips included (what the shift "feels" like)
  rulesMs: number // the shift's own clock (slower at the console)
  playerSeals: number
  vetSeals: number
  vetSize: number // how much of him was left at the end
  consoleMs: number // real time spent at the console
  repairs: number
  stageAt: number[] // real ms each stage was opened at
}

const MACHINES: MachineId[] = ['laser', 'visor', 'controls']

export function runFinal(input: FinalInput): FinalResult {
  const engine = createShift(input.shift, {
    seed: input.seed, rank: input.finalShift.rank, breakdowns: input.breakdowns, whiteGoop: input.whiteGoop, twists: input.twists, finalShift: input.finalShift,
  })
  const s = engine.state
  const bot = new Bot(input.skill)
  const r: FinalResult = { bot: input.bot, seed: input.seed, outcome: 'timeout', vetAlive: true, vetGoneAt: null, stage: 0, realMs: 0, rulesMs: 0, playerSeals: 0, vetSeals: 0, vetSize: 1,
    consoleMs: 0, repairs: 0, stageAt: [] }
  const scale = input.finalShift.consoleTimeScale // (the final shift's own console speed, as the game's App uses)
  let now = 0 // the bot's (real) time
  let trip: { leftMs: number; valve: boolean } | null = null
  let brokenSince: number | null = null
  bot.newPiece(0, false)
  engine.takeEvents()

  while (s.status === 'playing' && now < input.maxShiftMs) {
    const dt = input.frameMs
    const f = s.final!
    const broken = MACHINES.filter((m) => s.machines?.[m].broken)
    if (!trip) {
      // go to the console: a stage is waiting, or a machine has been broken for the bot's reaction time
      brokenSince = broken.length ? (brokenSince ?? now) : null
      const repairDue = brokenSince !== null && now - brokenSince >= (input.skill.reactionMs ?? 0)
      if (f.waiting || repairDue) {
        trip = { leftMs: (f.waiting ? (input.finalShift.bots?.valveSec ?? 6) * 1000 : 0) + broken.length * input.repairSec * 1000, valve: f.waiting }
        engine.act({ type: 'softDrop', on: false })
        engine.act({ type: 'console', on: true })
      }
    }
    if (trip) {
      engine.tick(dt * scale)
      r.rulesMs += dt * scale
      r.consoleMs += dt
      trip.leftMs -= dt
      if (trip.leftMs <= 0) {
        for (const m of MACHINES) if (s.machines?.[m].broken) { engine.act({ type: 'repair', machine: m }); r.repairs++ }
        if (trip.valve && engine.openValveStage()) r.stageAt.push(now)
        engine.act({ type: 'console', on: false })
        trip = null
        brokenSince = null
        bot.newPiece(now, false) // (back at the tank: it takes a moment to see the piece again)
      }
    } else {
      const action = bot.decide(s, now, input.spinRepeatMs * (s.machines?.controls.broken ? input.breakdowns.controls.heldSpinSlowdown : 1))
      if (action) engine.act(action)
      engine.tick(dt)
      r.rulesMs += dt
    }
    now += dt
    for (const e of engine.takeEvents()) {
      switch (e.type) {
        case 'spawn':
          bot.newPiece(now, false)
          break
        case 'hold':
          bot.newPiece(now, true)
          break
        case 'reject':
          if (e.action === 'spin') bot.spinRejected(s)
          if (e.action === 'rotate') bot.rotateRejected()
          break
        case 'pop':
          r.playerSeals += e.sealed.length
          break
        case 'vetSeal':
          r.vetSeals++
          break
        case 'vetGone':
          r.vetGoneAt = now
          break
      }
    }
  }
  r.realMs = now
  r.stage = s.final!.stage
  r.vetSize = s.vet?.size ?? 0
  r.vetAlive = s.final!.vetAlive
  r.outcome = s.status === 'playing' ? 'timeout' : s.final!.outcome ?? 'timeout'
  return r
}
