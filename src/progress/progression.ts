// Ranks and XP (v1 rules, numbers in content/tuning/progression.json).
// Two numbers are saved for ranks — all the XP ever earned and the scraps spent — and rank, XP-into-rank and scraps
// are worked out from them, so they can never disagree. F34 adds what the scraps bought: each upgrade's level and the
// actives taken into the shift (the rules for buying: src/progress/upgradeShop.ts).
import tuning from '../../content/tuning/progression.json'

export type ProgressionTuning = typeof tuning

export interface Progress {
  totalXp: number
  scrapsSpent: number
  owned: Record<string, number> // F34: upgrade id → the level bought (missing = 0)
  equipped: string[] // F34: ids of the actives taken into the shift (at most the active slots)
  badge?: EndBadge | null // F65: an end title on this career's badge (missing / null = the rank's own title)
}
// The rank part of the progress — all that ranks, XP and scraps-in-hand need
export type XpProgress = Pick<Progress, 'totalXp' | 'scrapsSpent'>

export interface RankInfo {
  rank: number
  xpIntoRank: number // XP earned since reaching this rank
  xpToNext: number // XP this rank needs in all (0 at max rank)
  scraps: number // scraps earned by ranking up, minus those spent
}

export const freshProgress = (): Progress => ({ totalXp: 0, scrapsSpent: 0, owned: {}, equipped: [] })

// XP needed to go from `rank` to rank + 1
export function xpToNext(rank: number, t: ProgressionTuning = tuning): number {
  return t.xpBase + t.xpPerRank * rank
}

export function rankInfo(p: XpProgress, t: ProgressionTuning = tuning): RankInfo {
  let rank = 0, left = p.totalXp
  while (rank < t.maxRank && left >= xpToNext(rank, t)) { left -= xpToNext(rank, t); rank++ }
  const atMax = rank >= t.maxRank
  return { rank, xpIntoRank: atMax ? 0 : left, xpToNext: atMax ? 0 : xpToNext(rank, t), scraps: scrapsAt(rank, p, t) }
}

// Scraps in hand at a rank: earned by ranking up to it, minus those spent (F59: the console's Upgrades button shows it).
export function scrapsAt(rank: number, p: XpProgress, t: ProgressionTuning = tuning): number {
  return rank * t.scrapsPerRank - p.scrapsSpent
}

// UNLOCKS (F59): what a rank opens up — content/tuning/progression.json → unlocks (the rank each one needs). The HUD,
// the controls and the console all ask isUnlocked; no rank numbers anywhere else.
export type Unlock = keyof ProgressionTuning['unlocks']
export const UNLOCKS: Unlock[] = ['nextPiece', 'swap', 'upgrades'] // (in the order they come)

/** Is this part of the game unlocked at this rank? */
export function isUnlocked(what: Unlock, rank: number, t: ProgressionTuning = tuning): boolean {
  return rank >= t.unlocks[what]
}

/** The rank this unlocks at (words like "opens at rank 5"). */
export function unlockRank(what: Unlock, t: ProgressionTuning = tuning): number {
  return t.unlocks[what]
}

/** What ranking up from `from` to `to` unlocked (the end report names it), in the order they come. */
export function unlocksBetween(from: number, to: number, t: ProgressionTuning = tuning): Unlock[] {
  return UNLOCKS.filter((u) => !isUnlocked(u, from, t) && isUnlocked(u, to, t))
}

// RANK SELECT (F70, a Dev Kit tool): the START of a rank — all the XP it takes to just reach it (0 XP into it), with
// nothing bought (every scrap back, as Respec gives them). Clamped to 0…maxRank.
export const topRank = (t: ProgressionTuning = tuning) => t.maxRank
export function progressAtRank(rank: number, t: ProgressionTuning = tuning): Progress {
  const to = Math.max(0, Math.min(t.maxRank, Math.floor(rank)))
  let totalXp = 0
  for (let r = 0; r < to; r++) totalXp += xpToNext(r, t)
  return { ...freshProgress(), totalXp }
}

// TITLES (F35): the title a rank carries — the band that starts at or below it (content/tuning/progression.json titles;
// words: en.json story.titles). The ids are in rank order in the file.
export type TitleId = keyof ProgressionTuning['titles']
export function titleAt(rank: number, t: ProgressionTuning = tuning): TitleId {
  let id = Object.keys(t.titles)[0] as TitleId
  for (const [key, from] of Object.entries(t.titles) as [TitleId, number][]) if (rank >= from) id = key
  return id
}

// F65 END TITLES (design/story.md "Rank titles"): titles that aren't a rank band — the goop gives them, not Management.
//   oneOfUs = the final shift was lost: it replaces Acting Deputy and stays until you win · savior = you won it (the goop
//   writes it on your badge in the ending) · formerEmployee = a new career's first band (rank 0), once a career is done.
// Words: en.json story.titles (same ids). A new career starts with no badge (freshProgress).
export type EndBadge = 'oneOfUs' | 'savior'
export type BadgeTitle = TitleId | EndBadge | 'formerEmployee'

/** The title on the badge: an end title if this career has one, else the rank's — Former Employee instead of the first
 *  band once a career is done (careers = how many this device finished). */
export function badgeTitle(rank: number, badge: EndBadge | null | undefined, careers: number, t: ProgressionTuning = tuning): BadgeTitle {
  if (badge) return badge
  const id = titleAt(rank, t)
  return careers > 0 && id === titleAt(0, t) ? 'formerEmployee' : id
}

/** The badge after a final shift: the win → savior; a loss → One Of Us (a win already given is never taken back). */
export function badgeAfterFinal(badge: EndBadge | null | undefined, won: boolean): EndBadge {
  return won || badge === 'savior' ? 'savior' : 'oneOfUs'
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
export function meterSteps(before: XpProgress, after: XpProgress, t: ProgressionTuning = tuning) {
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

// F31: the end of "your first day" (the guided first shift): its XP like any shift, topped up to the first rank-up if it
// fell short — so day one always ends at rank 1. Only from rank 0: a replay (Settings → Replay lessons) at a higher
// rank earns what any shift earns, nothing more.
export function rewardFirstDay(p: Progress, finalScore: number, t: ProgressionTuning = tuning): ShiftReward {
  const r = rewardShift(p, finalScore, t)
  if (r.before.rank !== 0 || r.after.rank > 0) return r
  const progress = { ...p, totalXp: xpToNext(0, t) } // (all the XP rank 1 needs)
  const after = rankInfo(progress, t)
  return { xp: progress.totalXp - p.totalXp, before: r.before, after, rankUps: after.rank - r.before.rank, progress }
}
