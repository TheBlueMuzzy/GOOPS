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

export interface ShiftReward {
  xp: number // XP this shift earned (score, or the floor)
  before: RankInfo
  after: RankInfo
  rankUps: number
  progress: Progress // the new progress to save
}

// A finished shift's final score (after the leftover penalty) becomes XP, never less than the floor.
export function rewardShift(p: Progress, finalScore: number, t: ProgressionTuning = tuning): ShiftReward {
  const before = rankInfo(p, t)
  const xp = Math.max(Math.max(0, Math.round(finalScore)), t.minXp, t.minXpPerRank * before.rank)
  const progress = { ...p, totalXp: p.totalXp + xp }
  const after = rankInfo(progress, t)
  return { xp, before, after, rankUps: after.rank - before.rank, progress }
}
