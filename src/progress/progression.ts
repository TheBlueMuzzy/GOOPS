// Ranks and XP (v1 rules, numbers in content/tuning/progression.json).
// Only two numbers are saved — all the XP ever earned and the scraps spent — and rank, XP-into-rank and scraps
// are worked out from them, so they can never disagree.
import tuning from '../../content/tuning/progression.json'

export type ProgressionTuning = typeof tuning

export interface Progress {
  totalXp: number
  scrapsSpent: number
}

export interface RankInfo {
  rank: number
  xpIntoRank: number // XP earned since reaching this rank
  xpToNext: number // XP this rank needs in all (0 at max rank)
  scraps: number // scraps earned by ranking up, minus those spent
}

export const freshProgress = (): Progress => ({ totalXp: 0, scrapsSpent: 0 })

// XP needed to go from `rank` to rank + 1
export function xpToNext(rank: number, t: ProgressionTuning = tuning): number {
  return t.xpBase + t.xpPerRank * rank
}

export function rankInfo(p: Progress, t: ProgressionTuning = tuning): RankInfo {
  let rank = 0, left = p.totalXp
  while (rank < t.maxRank && left >= xpToNext(rank, t)) { left -= xpToNext(rank, t); rank++ }
  const atMax = rank >= t.maxRank
  return { rank, xpIntoRank: atMax ? 0 : left, xpToNext: atMax ? 0 : xpToNext(rank, t), scraps: rank * t.scrapsPerRank - p.scrapsSpent }
}

// UNLOCKS (F59): what a rank opens up — content/tuning/progression.json → unlocks (the rank each one needs). The HUD,
// the controls and the console all ask isUnlocked; no rank numbers anywhere else.
export type Unlock = keyof ProgressionTuning['unlocks']
export const UNLOCKS: Unlock[] = ['nextPiece', 'swap', 'upgrades'] // (in the order they come)

/** Is this part of the game unlocked at this rank? */
export function isUnlocked(what: Unlock, rank: number, t: ProgressionTuning = tuning): boolean {
  return rank >= t.unlocks[what]
}

/** What ranking up from `from` to `to` unlocked (the end report names it), in the order they come. */
export function unlocksBetween(from: number, to: number, t: ProgressionTuning = tuning): Unlock[] {
  return UNLOCKS.filter((u) => !isUnlocked(u, from, t) && isUnlocked(u, to, t))
}

export interface ShiftReward {
  xp: number // XP this shift earned (score, or the floor)
  before: RankInfo
  after: RankInfo
  rankUps: number
  progress: Progress // the new progress to save
}

// The rank meter's steps from one progress to another (F21): one per rank the XP passes through, each
// { level: rank, from, to, max: XP that rank needs } — what the console's meter plays when you come back to it.
// Ending exactly on a rank-up adds the new rank's empty bar, so the rank-up still shows. No XP gained: no steps.
export function meterSteps(before: Progress, after: Progress, t: ProgressionTuning = tuning) {
  const steps: { level: number; from: number; to: number; max: number }[] = []
  let at = before.totalXp
  while (at < after.totalXp) {
    const { rank, xpIntoRank, xpToNext: need } = rankInfo({ ...after, totalXp: at }, t)
    if (need === 0) break // top rank: nothing more to fill
    const end = Math.min(need, xpIntoRank + (after.totalXp - at))
    steps.push({ level: rank, from: xpIntoRank, to: end, max: need })
    at += end - xpIntoRank
    if (end === need && at >= after.totalXp) {
      const next = rankInfo({ ...after, totalXp: at }, t)
      steps.push({ level: next.rank, from: 0, to: 0, max: next.xpToNext })
    }
  }
  return steps
}

// A finished shift's final score (after the leftover penalty) becomes XP, never less than the floor.
export function rewardShift(p: Progress, finalScore: number, t: ProgressionTuning = tuning): ShiftReward {
  const before = rankInfo(p, t)
  const xp = Math.max(Math.max(0, Math.round(finalScore)), t.minXp, t.minXpPerRank * before.rank)
  const progress = { ...p, totalXp: p.totalXp + xp }
  const after = rankInfo(progress, t)
  return { xp, before, after, rankUps: after.rank - before.rank, progress }
}
