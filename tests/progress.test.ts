// Ranks + XP (F20) and the save.
import { describe, expect, it } from 'vitest'
import tuning from '../content/tuning/progression.json'
import { freshProgress, isUnlocked, meterSteps, progressAtRank, rankInfo, rewardFirstDay, rewardShift, topRank, unlocksBetween, xpToNext } from '../src/progress/progression'
import { NAME_MAX_LENGTH, SAVE_VERSION, cleanName, clearProgress, loadOperatorName, loadProgress, saveOperatorName, saveProgress } from '../src/progress/save'
import nameTuning from '../content/tuning/name.json'
import goldenV1 from './saves/goops-progress-v1.json'
import goldenV2 from './saves/goops-progress-v2.json'
import goldenV3 from './saves/goops-progress-v3.json'

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
    const rank10 = { ...freshProgress(), totalXp: cumulative(10) }
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
    const rank3 = { ...freshProgress(), totalXp: cumulative(3) + 5 }
    expect(rewardFirstDay(rank3, 200)).toEqual(rewardShift(rank3, 200))
  })
})

describe('save', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }

  // tests/saves/: one golden save per version, kept forever (a new version adds its own)
  const golden = (v: number) => JSON.stringify(v === 1 ? goldenV1 : v === 2 ? goldenV2 : goldenV3)

  it('round-trips (with what the scraps bought, F34)', () => {
    const s = memory()
    const p = { totalXp: 12345, scrapsSpent: 2, owned: { circuitStabilizer: 1, cooldownBooster: 1 }, equipped: ['cooldownBooster'] }
    saveProgress(p, s)
    expect(loadProgress(s)).toEqual(p)
    expect(JSON.parse(s.m.get('goops-progress')!).v).toBe(SAVE_VERSION)
  })

  it('golden version-1 save (the alpha) → version 3: XP and scraps spent KEPT, nothing owned yet, no name', () => {
    const s = memory()
    s.m.set('goops-progress', golden(1))
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: {}, equipped: [] })
    expect(loadOperatorName(s)).toBeNull()
    // saving it again writes version 3, and it still loads the same
    saveProgress(loadProgress(s), s)
    expect(JSON.parse(s.m.get('goops-progress')!)).toEqual({ v: 3, totalXp: 46250, scrapsSpent: 3, owned: {}, equipped: [], name: null })
  })

  it('golden version-2 save loads as it was (and steps up to version 3 with no name)', () => {
    const s = memory()
    s.m.set('goops-progress', golden(2))
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: { circuitStabilizer: 2, cooldownBooster: 1 }, equipped: ['cooldownBooster'] })
    expect(loadOperatorName(s)).toBeNull()
  })

  it('golden version-3 save loads as it was, name and all (F66)', () => {
    const s = memory()
    s.m.set('goops-progress', golden(3))
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: { circuitStabilizer: 2, cooldownBooster: 1 }, equipped: ['cooldownBooster'] })
    expect(loadOperatorName(s)).toBe('Muzzy')
  })

  it('a missing, broken, unknown-version or nonsense save starts fresh instead of crashing', () => {
    const s = memory()
    expect(loadProgress(s)).toEqual(freshProgress())
    for (const bad of ['{not json', 'null', '7', '{"v":99,"totalXp":5,"scrapsSpent":0}', '{"v":0,"totalXp":5,"scrapsSpent":0}',
      '{"v":1,"totalXp":-5,"scrapsSpent":0}', '{"v":1,"totalXp":"lots"}']) {
      s.m.set('goops-progress', bad)
      expect(loadProgress(s), bad).toEqual(freshProgress())
    }
    expect(loadProgress(null)).toEqual(freshProgress())
  })

  it('broken upgrade entries are dropped, not the whole save', () => {
    const s = memory()
    s.m.set('goops-progress', JSON.stringify({ v: 2, totalXp: 9000, scrapsSpent: 1, owned: { a: 2, b: -1, c: 'x', d: 0, e: 2.7 }, equipped: ['a', 'a', 5, null] }))
    expect(loadProgress(s)).toEqual({ totalXp: 9000, scrapsSpent: 1, owned: { a: 2, e: 2 }, equipped: ['a'] })
    s.m.set('goops-progress', JSON.stringify({ v: 2, totalXp: 9000, scrapsSpent: 1, owned: [1, 2], equipped: 'a' }))
    expect(loadProgress(s)).toEqual({ totalXp: 9000, scrapsSpent: 1, owned: {}, equipped: [] })
  })

  it('never writes over a newer build’s save', () => {
    const s = memory()
    const newer = JSON.stringify({ v: SAVE_VERSION + 1, totalXp: 99999, scrapsSpent: 4, somethingNew: true })
    s.m.set('goops-progress', newer)
    saveProgress(freshProgress(), s)
    saveOperatorName('Someone', s)
    expect(s.m.get('goops-progress')).toBe(newer)
  })
})

// F66 YOUR NAME (TDD D20): signed on the first day's monitor, kept in the save
describe('your name', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m } }

  it('the limit comes from content/tuning/name.json (12, Muzzy 2026-10-25)', () => {
    expect(NAME_MAX_LENGTH).toBe(nameTuning.maxLength)
    expect(NAME_MAX_LENGTH).toBe(12)
  })

  it('signing keeps the name — trimmed, at most 12 letters; empty or spaces = no name', () => {
    expect(cleanName('  Muzzy  ')).toBe('Muzzy')
    expect(cleanName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKL')
    expect(cleanName('Ann Marie Smith')).toBe('Ann Marie Sm')
    expect(cleanName('Mary Jo     X')).toBe('Mary Jo') // (cut at 12, then the spaces at the end trimmed)
    expect(cleanName('')).toBeNull()
    expect(cleanName('    ')).toBeNull()
    expect([...cleanName('😀'.repeat(20))!].length).toBe(12) // (letters, not halves of an emoji)
  })

  it('saving the progress keeps the name (and signing keeps the progress)', () => {
    const s = memory()
    saveProgress(progressAtRank(4), s)
    saveOperatorName('  Muzzy ', s)
    expect(loadOperatorName(s)).toBe('Muzzy')
    expect(rankInfo(loadProgress(s)).rank).toBe(4)
    saveProgress(progressAtRank(7), s) // (a shift ends: the progress is saved again)
    expect(loadOperatorName(s)).toBe('Muzzy')
    expect(rankInfo(loadProgress(s)).rank).toBe(7)
  })

  it('a fresh device has no name; a broken name in the save is no name', () => {
    const s = memory()
    expect(loadOperatorName(s)).toBeNull()
    expect(loadOperatorName(null)).toBeNull()
    s.m.set('goops-progress', JSON.stringify({ v: 3, totalXp: 5, scrapsSpent: 0, owned: {}, equipped: [], name: 42 }))
    expect(loadOperatorName(s)).toBeNull()
    expect(loadProgress(s).totalXp).toBe(5) // (the rest of the save stays)
    s.m.set('goops-progress', JSON.stringify({ v: 3, totalXp: 5, scrapsSpent: 0, owned: {}, equipped: [], name: '   way too long a name   ' }))
    expect(loadOperatorName(s)).toBe('way too long')
  })

  it('RANK SELECT 0 (clearProgress) wipes the name with the rest of the save', () => {
    const s = memory()
    saveOperatorName('Muzzy', s)
    expect(loadOperatorName(s)).toBe('Muzzy')
    clearProgress(s)
    expect(loadOperatorName(s)).toBeNull()
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
describe('rank select (F70: the start of a rank, upgrades refunded; 0 = a fresh save)', () => {
  it('rank N = all the XP to reach it, 0 into it, nothing bought or spent', () => {
    const p = progressAtRank(7)
    expect(rankInfo(p)).toMatchObject({ rank: 7, xpIntoRank: 0, scraps: 7 * tuning.scrapsPerRank })
    expect(p).toEqual({ totalXp: cumulative(7), scrapsSpent: 0, owned: {}, equipped: [] })
    expect(progressAtRank(0)).toEqual(freshProgress())
  })

  it('every rank 0…maxRank lands on itself; outside that it clamps', () => {
    for (let r = 0; r <= topRank(); r++) expect(rankInfo(progressAtRank(r)).rank).toBe(r)
    expect(topRank()).toBe(tuning.maxRank)
    expect(rankInfo(progressAtRank(topRank() + 5)).rank).toBe(tuning.maxRank)
    expect(progressAtRank(-3)).toEqual(freshProgress())
  })

  it('clearProgress forgets the save: the next load is a fresh start', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
    saveProgress(progressAtRank(12), storage)
    expect(rankInfo(loadProgress(storage)).rank).toBe(12)
    clearProgress(storage)
    expect(loadProgress(storage)).toEqual(freshProgress())
  })
})
