// Ranks + XP (F20) and the save.
import { describe, expect, it } from 'vitest'
import tuning from '../content/tuning/progression.json'
import { freshProgress, isUnlocked, meterSteps, rankInfo, rewardFirstDay, rewardShift, unlocksBetween, xpToNext } from '../src/progress/progression'
import { loadProgress, saveProgress } from '../src/progress/save'

// sum of every rank's XP up to (not including) rank n
const cumulative = (n: number) => { let s = 0; for (let r = 0; r < n; r++) s += xpToNext(r); return s }

describe('ranks', () => {
  it('v1 formula: 3,500 + 250 × rank to the next rank; rank 10 needs 46,250 in all', () => {
    expect(xpToNext(0)).toBe(3500)
    expect(xpToNext(10)).toBe(6000)
    expect(cumulative(10)).toBe(46250)
    expect(cumulative(50)).toBe(481250)
    expect(rankInfo({ totalXp: 46250, scrapsSpent: 0 }).rank).toBe(10)
    expect(rankInfo({ totalXp: 46249, scrapsSpent: 0 })).toMatchObject({ rank: 9, xpIntoRank: 46249 - cumulative(9), xpToNext: 5750 })
  })

  it('stops at the max rank', () => {
    const r = rankInfo({ totalXp: 10_000_000, scrapsSpent: 0 })
    expect(r).toMatchObject({ rank: tuning.maxRank, xpIntoRank: 0, xpToNext: 0, scraps: tuning.maxRank })
  })
})

describe('rewardShift', () => {
  it('the final score becomes XP', () => {
    const r = rewardShift(freshProgress(), 1241)
    expect(r.xp).toBe(1241)
    expect(r.progress.totalXp).toBe(1241)
    expect(r.rankUps).toBe(0)
  })

  it('never less than the floor: max(100, 100 × rank)', () => {
    expect(rewardShift(freshProgress(), 0).xp).toBe(100)
    const rank10 = { totalXp: cumulative(10), scrapsSpent: 0 }
    expect(rewardShift(rank10, 50).xp).toBe(1000)
  })

  it('a big shift can jump several ranks and earns a scrap per rank', () => {
    const r = rewardShift(freshProgress(), cumulative(3) + 10)
    expect(r.before.rank).toBe(0)
    expect(r.after).toMatchObject({ rank: 3, xpIntoRank: 10, scraps: 3 })
    expect(r.rankUps).toBe(3)
  })

  it('spent scraps stay spent', () => {
    expect(rankInfo({ totalXp: cumulative(4), scrapsSpent: 3 }).scraps).toBe(1)
  })
})

describe('rewardFirstDay (F31)', () => {
  it('a fresh player always ends day one at rank 1: the XP is topped up to the first rank-up', () => {
    const r = rewardFirstDay(freshProgress(), 640)
    expect(r.progress.totalXp).toBe(xpToNext(0))
    expect(r.xp).toBe(xpToNext(0))
    expect(r.after).toMatchObject({ rank: 1, xpIntoRank: 0 })
    expect(r.rankUps).toBe(1)
  })

  it('a day that earned enough on its own keeps its own XP', () => {
    const r = rewardFirstDay(freshProgress(), xpToNext(0) + 50)
    expect(r.xp).toBe(xpToNext(0) + 50)
    expect(r.after).toMatchObject({ rank: 1, xpIntoRank: 50 })
  })

  it('a replay at a higher rank earns what any shift earns (no top-up)', () => {
    const rank3 = { totalXp: cumulative(3) + 5, scrapsSpent: 0 }
    expect(rewardFirstDay(rank3, 200)).toEqual(rewardShift(rank3, 200))
  })
})

describe('save', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }

  it('round-trips', () => {
    const s = memory()
    saveProgress({ totalXp: 12345, scrapsSpent: 2 }, s)
    expect(loadProgress(s)).toEqual({ totalXp: 12345, scrapsSpent: 2 })
  })

  it('a missing, broken, wrong-version or nonsense save starts fresh instead of crashing', () => {
    const s = memory()
    expect(loadProgress(s)).toEqual(freshProgress())
    for (const bad of ['{not json', '{"v":99,"totalXp":5,"scrapsSpent":0}', '{"v":1,"totalXp":-5,"scrapsSpent":0}', '{"v":1,"totalXp":"lots"}']) {
      s.m.set('goops-progress', bad)
      expect(loadProgress(s)).toEqual(freshProgress())
    }
    expect(loadProgress(null)).toEqual(freshProgress())
  })
})

describe('rank meter steps (F21: the console meter fills with the XP since it last showed)', () => {
  const p = (totalXp: number) => ({ totalXp, scrapsSpent: 0 })
  it('inside one rank: one step', () => {
    expect(meterSteps(p(100), p(1100))).toEqual([{ level: 0, from: 100, to: 1100, max: 3500 }])
  })
  it('across ranks (several shifts or a big one): one step per rank, ending where the progress is', () => {
    const steps = meterSteps(p(3000), p(3500 + 3750 + 200))
    expect(steps).toEqual([
      { level: 0, from: 3000, to: 3500, max: 3500 },
      { level: 1, from: 0, to: 3750, max: 3750 },
      { level: 2, from: 0, to: 200, max: 4000 },
    ])
    const last = steps[steps.length - 1], now = rankInfo(p(3500 + 3750 + 200))
    expect([last.level, last.to, last.max]).toEqual([now.rank, now.xpIntoRank, now.xpToNext])
  })
  it('ending exactly on a rank-up still shows the new rank (an empty bar)', () => {
    expect(meterSteps(p(3000), p(3500))).toEqual([{ level: 0, from: 3000, to: 3500, max: 3500 }, { level: 1, from: 0, to: 0, max: 3750 }])
  })
  it('no XP gained: no steps; the top rank: stops', () => {
    expect(meterSteps(p(500), p(500))).toEqual([])
    const top = 481250
    expect(meterSteps(p(top), p(top + 5000))).toEqual([])
  })
})

// F59: what each rank unlocks (content/tuning/progression.json → unlocks)
describe('unlocks', () => {
  it('next piece at 1, swap at 3, upgrades at 5 — from that rank on', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((r) => isUnlocked('nextPiece', r))).toEqual([false, true, true, true, true, true, true])
    expect([0, 1, 2, 3, 4, 5, 6].map((r) => isUnlocked('swap', r))).toEqual([false, false, false, true, true, true, true])
    expect([0, 1, 2, 3, 4, 5, 6].map((r) => isUnlocked('upgrades', r))).toEqual([false, false, false, false, false, true, true])
  })

  it('reads the ranks from the tuning file', () => {
    const t = { ...tuning, unlocks: { nextPiece: 0, swap: 10, upgrades: 2 } }
    expect(isUnlocked('nextPiece', 0, t)).toBe(true)
    expect(isUnlocked('swap', 9, t)).toBe(false)
    expect(isUnlocked('upgrades', 2, t)).toBe(true)
  })

  it('names what a rank-up unlocked, in order (none when nothing new)', () => {
    expect(unlocksBetween(0, 1)).toEqual(['nextPiece'])
    expect(unlocksBetween(1, 2)).toEqual([])
    expect(unlocksBetween(2, 3)).toEqual(['swap'])
    expect(unlocksBetween(0, 6)).toEqual(['nextPiece', 'swap', 'upgrades'])
    expect(unlocksBetween(5, 5)).toEqual([])
  })
})