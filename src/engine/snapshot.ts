// A shift's exact moment as plain JSON (the Dev Kit's Snapshots and Bug capture), and putting one back.
// Everything the engine needs to carry on exactly as it would have: the public state, the private bookkeeping (the
// falling piece, timers, fill clocks) and where the seeded random numbers are — so a restored shift plays the same
// pieces and cracks it would have. Numbers from tuning are NOT in it (they're the live files').
import type { ShiftConfig } from './config'
import type { BreakdownConfig } from './machines'
import type { Machines } from './machines'
import type { FallingPiece, PieceDef } from './pieces'
import type { AbilitySpec, ActiveEffects } from './abilities'
import type { Modifiers } from './upgrades'
import type { AbilityState, Crack, Group, SealedSpot, ShiftEngine, ShiftPhase, ShiftStatus, WallKickMode, WhiteGoop } from './types'
import type { WhiteGoopConfig } from './whiteGoop'
import type { PieceChoice, PieceFallback, TrainingRules } from './training'
import { createShift } from './shift'

export const SNAPSHOT_KIND = 'goops-shift'
export const SNAPSHOT_VERSION = 1

export interface ShiftSnapshot {
  kind: typeof SNAPSHOT_KIND
  version: number
  // training: only in a lesson's training shift (F30) — older snapshots have none
  options: { seed: number; rank: number; wallKick: WallKickMode; modifiers: Modifiers; abilities: AbilitySpec[]; training?: Partial<TrainingRules>; swap?: boolean }
  width: number
  height: number
  rng: number
  state: {
    grid: number[]
    spin: number
    pressure: number
    integrity: number
    phase: ShiftPhase
    ruptureReason: 'integrity' | 'overflow' | null
    cracks: Crack[]
    sealedCracks?: SealedSpot[] // (F36; older snapshots have none — still format 1, read as [])
    cracksSealed: number
    cracksNeeded: number
    quotaMet: boolean
    score: number
    status: ShiftStatus
    leftoverPenalty: number | null
    groups: Group[]
    abilities: AbilityState[]
    effects: ActiveEffects
    vet?: WhiteGoop | null // F63 the white goop (older snapshots have none — still format 1, read as none)
  }
  inner: {
    fillMs: [number, number][]
    nextGroupId: number
    nextCrackId: number
    colorCount: number
    piece: FallingPiece | null
    nextDef: PieceDef
    softDrop: boolean
    lockMs: number | null
    lockResets: number
    crackTimerMs: number
    popStreak: number
    playedMs: number
    primed: [number, string][]
    machines: ReturnType<Machines['save']>
    // (F30: a lesson's training shift only; F31: its fallback rule — older snapshots have none)
    training?: { rules: TrainingRules; queue: PieceChoice[]; fallback?: { rule: PieceFallback; index: number; nextFromRule: boolean } | null }
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Check something that should be a snapshot. Throws a plain reason when it's junk or from an older format. */
export function readSnapshot(x: unknown): ShiftSnapshot {
  if (!isObj(x)) throw new Error('That isn\'t a Goops snapshot (not an object).')
  if (x.kind !== SNAPSHOT_KIND) throw new Error('That isn\'t a Goops shift snapshot.')
  if (x.version !== SNAPSHOT_VERSION) throw new Error(`That snapshot is format ${String(x.version)}; this build reads format ${SNAPSHOT_VERSION}.`)
  const st = x.state, inner = x.inner, o = x.options
  if (!isObj(st) || !isObj(inner) || !isObj(o)) throw new Error('That snapshot is missing parts (state, inner or options).')
  const w = x.width, h = x.height
  if (typeof w !== 'number' || typeof h !== 'number' || !Array.isArray(st.grid) || st.grid.length !== w * h) {
    throw new Error('That snapshot\'s tank is broken (its grid doesn\'t match its size).')
  }
  if (!st.grid.every((c) => Number.isInteger(c) && c >= 0 && c < 256)) throw new Error('That snapshot\'s tank has cells that aren\'t goop colours.')
  if (typeof o.seed !== 'number' || typeof o.rank !== 'number' || typeof x.rng !== 'number') throw new Error('That snapshot has no seed, rank or random-number place.')
  if (!Array.isArray(st.groups) || !Array.isArray(st.cracks) || !isObj(inner.nextDef) || !isObj(inner.machines)) {
    throw new Error('That snapshot is missing the goop groups, cracks, next piece or machines.')
  }
  return x as unknown as ShiftSnapshot
}

/** A new engine that carries on from a snapshot (the game's live tuning + breakdowns + white goop (F63), the snapshot's
 *  own options). */
export function restoreShift(config: ShiftConfig, snapshot: unknown, breakdowns?: BreakdownConfig, whiteGoop?: WhiteGoopConfig): ShiftEngine {
  const snap = readSnapshot(snapshot)
  const engine = createShift(config, { ...snap.options, breakdowns, whiteGoop })
  engine.restore(snap)
  return engine
}
