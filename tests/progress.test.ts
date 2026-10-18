// Ranks + XP (F20) and the save.
import { describe, expect, it } from 'vitest'
import tuning from '../content/tuning/progression.json'
import { freshProgress, rankInfo, rewardShift, xpToNext } from '../src/progress/progression'
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
