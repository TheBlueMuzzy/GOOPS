// F51 THE ECONOMY SIM — whole careers, rank 0 → the final shift, on the real engine + the real content files.
// Everything a career needs is the GAME's own code: ranks, XP and scraps (src/progress/progression.ts), buying,
// taking back and equipping (src/progress/upgradeShop.ts), what the upgrades do to a shift (upgradesForShift →
// createShift, exactly as App.tsx newEngine), a repair's steps (src/game/repairs.ts), the swap hold
// (src/input/controls.ts). The bot is the F27 bot (bot.ts). Measuring only: nothing here is read by the game.
// Settings: scripts/bots/economy.json (careers, buy styles, effect runs) + bots.json (bot skills).
// Deterministic: the same seeds + the same files = the same careers.
//
// What the bots do that the old runners (runShift / runFinal) don't, so upgrades the game reads OUTSIDE the engine
// can be measured too:
//   - the console mid-shift: a broken machine → the bot goes there after its reaction time (as runFinal); each repair
//     takes bots.json consoleRepairSec × its steps ÷ its steps with no upgrades (Quick Fix, the max-level fixes);
//     the shift runs at breakdowns.json consoleTimeScale × Focus Mode meanwhile; a valve stage (the final shift)
//     adds finalShift.json bots.valveSec, as runFinal does.
//   - the swap: a hold of swapHoldMs (Goop Swap shortens it) — the bot waits through it before the swap happens.
//   - actives: a ready active is fired after the bot's reaction time (the engine refuses one that can't help and keeps
//     its charge).
import { createShift } from '../../src/engine'
import type { BreakdownConfig, MachineId, ShiftConfig, ShiftEngine, TwistsConfig, UpgradeDef, WhiteGoopConfig } from '../../src/engine'
import type { FinalShiftConfig } from '../../src/engine/finalShift'
import { freshProgress, isUnlocked, rankInfo, rewardFirstDay, rewardShift, scrapsAt, type Progress } from '../../src/progress/progression'
import { activeSlots, buyLevel, costOf, levelOf, maxLevelOf, setEquipped, takeBackLevel, upgradeBook, upgradesForShift, whyNotBuy } from '../../src/progress/upgradeShop'
import { playableUpgrades } from '../../src/engine/upgrades'
import { repairSteps } from '../../src/game/repairs'
import { swapHoldMs } from '../../src/input/controls'
import shiftJson from '../../content/tuning/shift.json'
import breakdownsJson from '../../content/tuning/breakdowns.json'
import whiteGoopJson from '../../content/tuning/whiteGoop.json'
import twistsJson from '../../content/tuning/twists.json'
import finalShiftJson from '../../content/tuning/finalShift.json'
import tankJson from '../../content/tuning/tank.json'
import progressionJson from '../../content/tuning/progression.json'
import botsJson from './bots.json'
import economyJson from './economy.json'
import { Bot, type BotSkill } from './bot'

const shiftConfig = shiftJson as unknown as ShiftConfig
const breakdowns = breakdownsJson as unknown as BreakdownConfig
const whiteGoop = whiteGoopJson as unknown as WhiteGoopConfig
const twists = twistsJson as unknown as TwistsConfig
const finalShift = finalShiftJson as unknown as FinalShiftConfig
const MACHINES: MachineId[] = ['laser', 'visor', 'controls']

export type BuyStyle = 'spread' | 'rush' | 'activesFirst'
export type EconomySettings = typeof economyJson
export const economy: EconomySettings = economyJson
export const skillOf = (bot: string): BotSkill => (botsJson.bots as Record<string, BotSkill>)[bot]

// ---------------------------------------------------------------- one shift, as the game plays it

export interface ShiftInput {
  bot: string
  seed: number
  progress: Progress // what the player owns + has equipped (the rank comes from it unless `rank` is given)
  rank?: number // play at this rank instead (the effect runs)
}

export interface ShiftOutcome {
  seed: number
  rank: number
  final: boolean
  won: boolean // quota met (a normal shift) · the third valve stage opened (the final shift)
  outcome: string // won / lost · the final shift: won / vetGone / overflow / integrity / timeout
  score: number // the final score (after the leftover penalty) = what becomes XP
  survivedMs: number // the SHIFT's time (rules clock) until the tank ruptured, or the shift ended — console trips count
  // at their slowed speed, so a shorter repair doesn't look like a shorter-lived tank
  realMs: number // the player's time until the shift ended, console trips included
  sealed: number
  needed: number
  quota: number // sealed ÷ needed, at most 1
  consoleMs: number
  repairs: number
  swaps: number
  fired: Record<string, number> // actives fired, by id
  stage: number // the final shift: valve stages opened
}

/** The shift's engine exactly as App.tsx newEngine makes it (wall kick: the game's default). */
export function shiftEngine(progress: Progress, seed: number, rank: number): { engine: ShiftEngine; upgrades: ReturnType<typeof upgradesForShift> } {
  const upgrades = upgradesForShift(progress)
  const engine = createShift(shiftConfig, { seed, rank, breakdowns, whiteGoop, twists, finalShift, swap: isUnlocked('swap', rank),
    modifiers: upgrades.modifiers, abilities: upgrades.abilities })
  return { engine, upgrades }
}

export function playShift(input: ShiftInput): ShiftOutcome {
  const rank = input.rank ?? rankInfo(input.progress).rank
  const skill = skillOf(input.bot)
  const { engine, upgrades } = shiftEngine(input.progress, input.seed, rank)
  const s = engine.state
  const bot = new Bot(skill)
  const frameMs = botsJson.frameMs
  const reactionMs = skill.reactionMs ?? 0
  // (App: × Focus Mode; the final shift has its own console speed — finalShift.json consoleTimeScale)
  const consoleScale = (s.final ? finalShift.consoleTimeScale : breakdownsJson.consoleTimeScale) * upgrades.modifiers.consoleTimeScaleMult
  const swapMs = swapHoldMs(upgrades.modifiers.swapHoldTimeMult)
  const repairSec = botsJson.consoleRepairSec
  const valveSec = finalShift.bots?.valveSec ?? 6
  const r: ShiftOutcome = { seed: input.seed, rank, final: !!s.final, won: false, outcome: 'timeout', score: 0, survivedMs: 0, realMs: 0, sealed: 0,
    needed: s.cracksNeeded, quota: 0, consoleMs: 0, repairs: 0, swaps: 0, fired: {}, stage: 0 }
  let now = 0 // the player's time
  let rulesMs = 0 // the shift's own clock (slower while at the console)
  let trip: { leftMs: number; valve: boolean } | null = null
  let brokenSince: number | null = null
  let swapAt: number | null = null // a swap being held: it happens at this time
  let pieceAtSwap = 0
  let pieces = 0
  const readySince = new Map<string, number>()
  bot.newPiece(0, false)
  engine.takeEvents()

  while (s.status === 'playing' && now < botsJson.maxShiftMs) {
    const dt = frameMs
    const broken = MACHINES.filter((m) => s.machines?.[m].broken)
    if (!trip && swapAt === null) {
      brokenSince = broken.length ? (brokenSince ?? now) : null
      const repairDue = brokenSince !== null && now - brokenSince >= reactionMs
      const valve = !!s.final?.waiting
      if ((valve || repairDue) && s.phase === 'playing') {
        const repairMs = broken.reduce((a, m) => a + (repairSec * 1000 * repairSteps(m, upgrades.fewerRepairSteps[m])) / repairSteps(m, 0), 0)
        trip = { leftMs: (valve ? valveSec * 1000 : 0) + repairMs, valve }
        engine.act({ type: 'softDrop', on: false })
        engine.act({ type: 'console', on: true })
      }
    }
    if (trip) {
      engine.tick(dt * consoleScale)
      rulesMs += dt * consoleScale
      r.consoleMs += dt
      trip.leftMs -= dt
      if (trip.leftMs <= 0) {
        for (const m of MACHINES) if (s.machines?.[m].broken) { engine.act({ type: 'repair', machine: m }); r.repairs++ }
        if (trip.valve) engine.openValveStage()
        engine.act({ type: 'console', on: false })
        trip = null
        brokenSince = null
        bot.newPiece(now, false) // (back at the tank: it takes a moment to see the piece again)
      }
    } else {
      // a ready active: fired once the bot has noticed it (and, for some, only when it helps — economy.json fireWhen)
      for (const a of s.abilities ?? []) {
        if (!a.ready || !fireNow(s, a.id)) { readySince.delete(a.id); continue }
        const since = readySince.get(a.id) ?? now
        readySince.set(a.id, since)
        if (now - since >= reactionMs) {
          engine.act({ type: 'ability', id: a.id })
          readySince.set(a.id, now) // (refused: it tries again after another reaction time)
        }
      }
      // holding to swap: the swap happens when the hold is long enough; a new piece meanwhile (it landed) cancels it
      if (swapAt !== null && pieces !== pieceAtSwap) swapAt = null
      if (swapAt !== null && now >= swapAt) { engine.act({ type: 'hold' }); swapAt = null }
      const controlsBroken = s.machines?.controls.broken
      const action = bot.decide(s, now, tankJson.spinRepeatMs * (controlsBroken ? breakdownsJson.controls.heldSpinSlowdown : 1))
      if (action?.type === 'hold') {
        if (swapAt === null) { swapAt = now + swapMs; pieceAtSwap = pieces; r.swaps++ }
      } else if (action && !(swapAt !== null && action.type === 'softDrop')) engine.act(action) // (while holding, the other hand still turns, rotates and zaps — but no fast drop)
      engine.tick(dt)
      rulesMs += dt
    }
    now += dt
    for (const e of engine.takeEvents()) {
      switch (e.type) {
        case 'spawn':
          pieces++
          bot.newPiece(now, false)
          break
        case 'hold':
          bot.newPiece(now, true)
          break
        case 'reject':
          if (e.action === 'spin') bot.spinRejected(s)
          if (e.action === 'rotate') bot.rotateRejected()
          break
        case 'ability':
          r.fired[e.id] = (r.fired[e.id] ?? 0) + 1
          break
        case 'rupture':
          r.survivedMs ||= rulesMs
          break
      }
    }
  }
  r.realMs = now
  r.survivedMs ||= rulesMs
  r.score = Math.max(0, Math.round(s.score))
  r.sealed = s.cracksSealed
  r.quota = s.cracksNeeded > 0 ? Math.min(1, s.cracksSealed / s.cracksNeeded) : 1
  if (s.final) {
    r.stage = s.final.stage
    r.outcome = s.status === 'playing' ? 'timeout' : s.final.outcome ?? 'timeout'
    r.won = r.outcome === 'won'
  } else {
    r.outcome = s.status === 'playing' ? 'timeout' : s.status
    r.won = s.status === 'won'
  }
  return r
}

// Should the bot fire this ready active now? economy.json fireWhen: 'pieceMatchesCrack' = only while the falling piece's
// colour is the colour of an open crack (a player using Colorizer / Goop Dump to feed a crack); anything else = at once.
function fireNow(s: ShiftEngine['state'], id: string): boolean {
  const rule = (economy.fireWhen as Record<string, string>)[id]
  if (rule !== 'pieceMatchesCrack') return true
  const colour = s.piece?.colors[0]
  return colour !== undefined && s.cracks.some((c) => !c.plugged && c.color === colour)
}

// ---------------------------------------------------------------- the shop

const book = upgradeBook
export const shopUpgrades = (): UpgradeDef[] => playableUpgrades(book)
const bandOf = (rank: number) => economy.bands.filter((b) => rank >= b).length - 1

/** The next level a buy style wants, or null (nothing it can buy). Only upgrades the shop would sell right now. */
export function nextBuy(p: Progress, rank: number, style: BuyStyle, skip: string[] = []): string | null {
  const neverBuy: string[] = [...economy.neverBuy, ...skip] // (an empty list in the JSON reads as never[])
  const open = shopUpgrades().filter((u) => !neverBuy.includes(u.id) && whyNotBuy(p, u.id, rank) === null)
  if (!open.length) return null
  // fewest levels (as a share of its max) first, then the older one (lower rank), then file order
  const evenly = (list: UpgradeDef[]) => [...list].sort((a, b) => levelOf(p, a.id) / maxLevelOf(a) - levelOf(p, b.id) / maxLevelOf(b) || a.rank - b.rank)[0]
  if (style === 'rush') {
    const newest = Math.max(...open.map((u) => bandOf(u.rank)))
    return evenly(open.filter((u) => bandOf(u.rank) === newest)).id
  }
  if (style === 'activesFirst') {
    const actives = open.filter((u) => u.type === 'active' || u.feature === 'abilitySlots')
    if (actives.length) return evenly(actives).id
  }
  return evenly(open).id
}

/** Spend every scrap the style wants to, then take the best actives into the shift (economy.json activePriority). */
export function shop(p: Progress, rank: number, style: BuyStyle, skip: string[] = []): Progress {
  if (!isUnlocked('upgrades', rank)) return p
  let next = p
  for (let id = nextBuy(next, rank, style, skip); id; id = nextBuy(next, rank, style, skip)) next = buyLevel(next, id, rank)
  return equipBest(next)
}

export function equipBest(p: Progress, leaveOut: string[] = []): Progress {
  const owned = shopUpgrades().filter((u) => u.type === 'active' && levelOf(p, u.id) > 0 && !leaveOut.includes(u.id)).map((u) => u.id)
  const order = [...owned].sort((a, b) => rankIn(a) - rankIn(b))
  const want = order.slice(0, activeSlots(p))
  let next: Progress = { ...p, equipped: [] }
  for (const id of [...want].reverse()) next = setEquipped(next, id, true).progress // (least wanted first: the most wanted is equipped last)
  return next
}
const rankIn = (id: string) => {
  const i = economy.activePriority.indexOf(id)
  return i < 0 ? economy.activePriority.length : i
}

// ---------------------------------------------------------------- a whole career

export interface CareerInput {
  bot: string
  style: BuyStyle
  seed: number
  toRank?: number // stop on reaching this rank (the quick mode); default: play the final shift until it's won
  maxShifts?: number
  finalTries?: number
}

export interface CareerShift {
  rank: number // the rank it was played at
  won: boolean
  xp: number
  survivedS: number
  quota: number
  scraps: number // scraps in hand when it started (after shopping)
  spent: number // scraps spent in all when it started
  fired: number // actives fired
  repairs: number
  outcome?: string // the final shift
}

export interface CareerResult {
  bot: string
  style: BuyStyle
  seed: number
  shifts: CareerShift[]
  reachedRank: number
  finalWon: boolean
  finalTries: number
  ownedAt: Record<number, Record<string, number>> // what it owned when it reached ranks 10, 20, 30, 40, 50
  equippedAt: Record<number, string[]>
  loadout50: Progress | null // what it took into its first final shift
  loadout50Raw: Progress | null // the same before leaving out economy.json finalLeaveOut (what it had equipped till then)
  scrapsEarned: number
  scrapsSpent: number
  unspentByRank: Record<number, number> // scraps left in hand after shopping, at the start of each rank
}

const shiftSeed = (careerSeed: number, k: number) => careerSeed * 100_000 + k

export function runCareer(input: CareerInput): CareerResult {
  const maxShifts = input.maxShifts ?? economy.maxShifts
  const maxFinal = input.finalTries ?? economy.finalTries
  const top = progressionJson.maxRank
  const r: CareerResult = { bot: input.bot, style: input.style, seed: input.seed, shifts: [], reachedRank: 0, finalWon: false, finalTries: 0,
    ownedAt: {}, equippedAt: {}, loadout50: null, loadout50Raw: null, scrapsEarned: 0, scrapsSpent: 0, unspentByRank: {} }
  // the first day (a guided training shift) always ends at rank 1 — rewardFirstDay with no score (it needs no quota)
  let p = rewardFirstDay(freshProgress(), 0, { quotaMet: false }).progress
  r.shifts.push({ rank: 0, won: true, xp: p.totalXp, survivedS: 0, quota: 1, scraps: 0, spent: 0, fired: 0, repairs: 0 })
  let lastRank = -1
  for (let k = 1; r.shifts.length < maxShifts; k++) {
    const rank = rankInfo(p).rank
    if (input.toRank !== undefined && rank >= input.toRank) break
    p = shop(p, rank, input.style)
    if (rank >= top) {
      // the final shift: a player who has lost to the dump's rain leaves it at home (economy.json finalLeaveOut)
      if (!r.loadout50Raw) r.loadout50Raw = structuredClone(p)
      // …and takes back what slows it there (economy.json finalTakeBack: Dense Goop), spending the scraps elsewhere
      const takeBack: string[] = economy.finalTakeBack
      for (const id of takeBack) while (levelOf(p, id) > 0) p = takeBackLevel(p, id)
      p = shop(p, rank, input.style, takeBack)
      p = equipBest(p, economy.finalLeaveOut)
    }
    if (rank !== lastRank) {
      r.unspentByRank[rank] = scrapsAt(rank, p)
      if (rank % 10 === 0 && rank > 0) { r.ownedAt[rank] = { ...p.owned }; r.equippedAt[rank] = [...p.equipped] }
      lastRank = rank
    }
    if (rank >= top && !r.loadout50) r.loadout50 = structuredClone(p)
    const o = playShift({ bot: input.bot, seed: shiftSeed(input.seed, k), progress: p })
    const reward = rewardShift(p, o.score, { quotaMet: o.won }) // F74 — Rank lock: a rank-up needs a quota met this rank
    r.shifts.push({ rank, won: o.won, xp: reward.xp, survivedS: Math.round(o.survivedMs / 100) / 10, quota: Math.round(o.quota * 1000) / 1000,
      scraps: scrapsAt(rank, p), spent: p.scrapsSpent, fired: Object.values(o.fired).reduce((a, b) => a + b, 0), repairs: o.repairs,
      ...(o.final ? { outcome: o.outcome } : {}) })
    p = reward.progress
    if (o.final) {
      r.finalTries++
      if (o.won) { r.finalWon = true; break }
      if (r.finalTries >= maxFinal) break
    }
  }
  r.reachedRank = rankInfo(p).rank
  r.scrapsEarned = r.reachedRank * progressionJson.scrapsPerRank
  r.scrapsSpent = p.scrapsSpent
  return r
}

// ---------------------------------------------------------------- one upgrade on vs off

/** The progress for an effect run: owning only `id` at `level` (an active equipped). A slot upgrade is measured with
 *  one more active owned than the slots without it (economy.json slotTestActives, level 1 each, all equipped): with
 *  the slot they all go in, without it the one equipped first stays out (effectBaseline). */
export function effectProgress(id: string | null, level: number): Progress {
  if (!id) return freshProgress()
  const def = shopUpgrades().find((u) => u.id === id)!
  if (def.feature === 'abilitySlots') return withSlotActives(id, { [id]: level })
  let p: Progress = { ...effectBaseline(id), owned: { ...effectBaseline(id).owned, [id]: level } }
  if (def.type === 'active') p = setEquipped(p, id, true).progress
  return p
}

/** The baseline an upgrade is compared with: owning nothing — for a slot upgrade, the same actives without it; for an
 *  upgrade that only works through an active (Sealing Bonus), that active (economy.json effectCompanions). */
export function effectBaseline(id: string | null): Progress {
  const def = id ? shopUpgrades().find((u) => u.id === id) : null
  if (def?.feature === 'abilitySlots') return withSlotActives(def.id, {})
  const companions = id ? (economy.effectCompanions as Record<string, string[]>)[id] ?? [] : []
  let p: Progress = { ...freshProgress(), owned: Object.fromEntries(companions.map((c) => [c, 1])) }
  for (const c of companions) p = setEquipped(p, c, true).progress
  return p
}

// the slot upgrades that come before this one (owned in both runs), plus enough actives to fill one more slot
function withSlotActives(id: string, extra: Record<string, number>): Progress {
  const slotDefs = shopUpgrades().filter((u) => u.feature === 'abilitySlots')
  const before = slotDefs.slice(0, slotDefs.findIndex((u) => u.id === id))
  const actives = economy.slotTestActives.slice(0, before.length + 2)
  let p: Progress = { ...freshProgress(), owned: { ...Object.fromEntries([...before.map((u) => u.id), ...actives].map((a) => [a, 1])), ...extra } }
  for (const a of actives) p = setEquipped(p, a, true).progress
  return p
}

export const effectSeed = (seed: number) => 7_000_000 + seed
export { costOf, maxLevelOf }
