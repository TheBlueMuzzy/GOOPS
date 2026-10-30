// Ranks and XP (v1 rules, numbers in content/tuning/progression.json).
// Two numbers are saved for ranks — all the XP ever earned and the scraps spent — and rank, XP-into-rank and scraps
// are worked out from them, so they can never disagree. F34 adds what the scraps bought: each upgrade's level and the
// actives taken into the shift (the rules for buying: src/progress/upgradeShop.ts).
// F74 THE RANK LOCK (Muzzy 2026-10-29, TDD D31): a rank-up needs BOTH the XP goal AND a crack quota met during this rank.
// Without one the XP stops at the goal (the meter sits full, extra XP is lost) and waits there; a met quota stays met
// until the rank-up, and the shift that meets it earns its XP × quotaXpMult. Two flags in the save say where that stands
// (quotaMet, xpHeld) — the rank is still worked out from the XP.
import tuning from '../../content/tuning/progression.json'

export type ProgressionTuning = typeof tuning

export interface Progress {
  totalXp: number
  scrapsSpent: number
  owned: Record<string, number> // F34: upgrade id → the level bought (missing = 0)
  equipped: string[] // F34: ids of the actives taken into the shift (at most the active slots)
  badge?: EndBadge | null // F65: an end title on this career's badge (missing / null = the rank's own title)
  // F74 THE RANK LOCK (TDD D31): a rank-up needs the XP goal AND a quota met during this rank
  quotaMet?: boolean // a shift met its crack quota during this rank: the key is in hand (the rank-up uses it up)
  xpHeld?: boolean // the XP sits full at this rank's goal, waiting for a quota (totalXp is then exactly where the next rank starts)
}
// The rank part of the progress — all that ranks, XP and scraps-in-hand need
export type XpProgress = Pick<Progress, 'totalXp' | 'scrapsSpent' | 'xpHeld'>

export interface RankInfo {
  rank: number
  xpIntoRank: number // XP earned since reaching this rank
  xpToNext: number // XP this rank needs in all (0 at max rank)
  scraps: number // scraps earned by ranking up, minus those spent
  locked: boolean // F74: the XP is full but no quota was met this rank — the rank waits (the meter says QUOTA NEEDED)
}

export const freshProgress = (): Progress => ({ totalXp: 0, scrapsSpent: 0, owned: {}, equipped: [] })

// XP needed to go from `rank` to rank + 1
export function xpToNext(rank: number, t: ProgressionTuning = tuning): number {
  return t.xpBase + t.xpPerRank * rank
}

export function rankInfo(p: XpProgress, t: ProgressionTuning = tuning): RankInfo {
  let rank = 0, left = p.totalXp
  while (rank < t.maxRank && left >= xpToNext(rank, t)) { left -= xpToNext(rank, t); rank++ }
  // F74: XP held full at the goal sits exactly where the next rank starts — but that rank isn't reached yet. (Only
  // there: a held flag off a boundary — the XP table retuned under an old save — is ignored, never a rank taken away.)
  if (p.xpHeld && left === 0 && rank > 0) {
    const need = xpToNext(rank - 1, t)
    return { rank: rank - 1, xpIntoRank: need, xpToNext: need, scraps: scrapsAt(rank - 1, p, t), locked: true }
  }
  const atMax = rank >= t.maxRank
  return { rank, xpIntoRank: atMax ? 0 : left, xpToNext: atMax ? 0 : xpToNext(rank, t), scraps: scrapsAt(rank, p, t), locked: false }
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
  xp: number // XP this shift earned (score, or the floor; × quotaXpMult when it met its quota)
  before: RankInfo
  after: RankInfo
  rankUps: number
  progress: Progress // the new progress to save
  quotaMet: boolean // F74: this shift met its crack quota (the report's quota line)
  lostXp: number // F74: XP that didn't fit — the meter was full and the rank locked
  metEarlier: boolean // F74: a quota was already met at this rank before this shift (the rank was unlocked going in)
}

// The rank meter's steps from one progress to another (F21): one per rank the XP passes through, each
// { level: rank, from, to, max: XP that rank needs } — what the console's meter plays when you come back to it.
// Ending exactly on a rank-up adds the new rank's empty bar, so the rank-up still shows. Nothing moved: no steps.
// (F74: worked out from the two ranks, not the XP between them — a held meter sits on a rank's boundary, so the XP
// alone can't say which side of it you're on.)
export function meterSteps(before: XpProgress, after: XpProgress, t: ProgressionTuning = tuning) {
  const from = rankInfo(before, t), to = rankInfo(after, t)
  const steps: { level: number; from: number; to: number; max: number }[] = []
  if (to.rank < from.rank || (to.rank === from.rank && to.xpIntoRank <= from.xpIntoRank)) return steps // (nothing gained)
  for (let level = from.rank; level <= to.rank; level++) {
    const max = level >= t.maxRank ? 0 : xpToNext(level, t)
    steps.push({ level, from: level === from.rank ? from.xpIntoRank : 0, to: level === to.rank ? to.xpIntoRank : max, max })
  }
  return steps
}

// What the game knows about the finished shift for the rank lock (F74).
export type ShiftDone = { quotaMet: boolean }

// A finished shift's final score (after the leftover penalty) becomes XP, never less than the floor — doubled
// (quotaXpMult) when the shift met its crack quota. F74: the XP goes in under the rank lock (addXp).
export function rewardShift(p: Progress, finalScore: number, shift: ShiftDone, t: ProgressionTuning = tuning): ShiftReward {
  const before = rankInfo(p, t)
  const earned = Math.max(Math.max(0, Math.round(finalScore)), t.minXp, t.minXpPerRank * before.rank)
  // (only below the top rank: the final shift's win sets quotaMet when the valve opens, but it has no rank to unlock —
  // review 2026-10-29: winning it paid double)
  const quotaMet = shift.quotaMet && before.rank < t.maxRank
  const xp = quotaMet ? Math.round(earned * t.quotaXpMult) : earned
  const progress = addXp(p, xp, quotaMet, t)
  const after = rankInfo(progress, t)
  return { xp, before, after, rankUps: after.rank - before.rank, progress, quotaMet, lostXp: p.totalXp + xp - progress.totalXp,
    metEarlier: !!p.quotaMet }
}

// F74: XP into the meter under the rank lock. Each rank's goal is a gate: with a quota met this rank (before or in this
// shift) the XP goes through it — a rank-up, which uses the quota up, so the next rank needs its own — and fills on;
// without one it stops at the goal and the rest is lost (xpHeld: the meter sits full till a shift meets its quota).
// The top rank has nothing to fill: its XP goes in as before.
function addXp(p: Progress, xp: number, metNow: boolean, t: ProgressionTuning): Progress {
  const start = rankInfo(p, t)
  let rank = start.rank, into = start.xpIntoRank, totalXp = p.totalXp, left = xp
  let key = !!p.quotaMet || metNow
  while (rank < t.maxRank) {
    const room = xpToNext(rank, t) - into
    if (left < room) return { ...p, totalXp: totalXp + left, quotaMet: key, xpHeld: false }
    totalXp += room; left -= room
    if (!key) return { ...p, totalXp, quotaMet: false, xpHeld: true } // full and locked: the rest is lost
    rank++; into = 0; key = false // the rank-up uses the quota up
  }
  return { ...p, totalXp: totalXp + left, quotaMet: false, xpHeld: false }
}

// F31: the end of "your first day" (the guided first shift): its XP like any shift, topped up to the first rank-up if it
// fell short — so day one always ends at rank 1. Only from rank 0: a replay (Settings → Replay lessons) at a higher
// rank earns what any shift earns, nothing more. F74: day one needs no quota for its rank-up and isn't doubled (it
// works as before the lock); from rank 1 the lock holds like any rank.
export function rewardFirstDay(p: Progress, finalScore: number, shift: ShiftDone, t: ProgressionTuning = tuning): ShiftReward {
  if (rankInfo(p, t).rank !== 0) return rewardShift(p, finalScore, shift, t)
  const r = rewardShift({ ...p, quotaMet: true }, finalScore, { quotaMet: false }, t)
  if (r.after.rank > 0) return r
  const progress = { ...p, totalXp: xpToNext(0, t), quotaMet: false, xpHeld: false } // (all the XP rank 1 needs)
  const after = rankInfo(progress, t)
  return { xp: progress.totalXp - p.totalXp, before: r.before, after, rankUps: after.rank - r.before.rank, progress, quotaMet: false, lostXp: 0, metEarlier: false }
}
