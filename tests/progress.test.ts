// Ranks + XP (F20) and the save.
import { describe, expect, it } from 'vitest'
import tuning from '../content/tuning/progression.json'
import { badgeAfterFinal, badgeTitle, freshProgress, isUnlocked, meterSteps, progressAtRank, rankInfo, rewardFirstDay, rewardShift, topRank, unlocksBetween, xpToNext } from '../src/progress/progression'
import { SAVE_VERSION, cleanName, clearProgress, loadCareers, loadOperatorName, loadProgress, nameMaxLength, saveCareers, saveOperatorName, saveProgress } from '../src/progress/save'
import nameTuning from '../content/tuning/name.json'
import goldenV1 from './saves/goops-progress-v1.json'
import goldenV2 from './saves/goops-progress-v2.json'
import goldenV3 from './saves/goops-progress-v3.json'
import goldenV4 from './saves/goops-progress-v4.json'
import goldenV5 from './saves/goops-progress-v5.json'
import goldenV4Focus4 from './saves/goops-progress-v4-focus4.json'
import { clampOwned, maxLevelOf, upgradeBook } from '../src/progress/upgradeShop'
import type { UpgradeBook } from '../src/engine/upgrades'
import { createLadder } from '../src/ladder'
import { ladder, maxRank, rankOf } from '../src/progress/ladder'

// sum of every rank's XP up to (not including) rank n
const cumulative = (n: number) => { let s = 0; for (let r = 0; r < n; r++) s += xpToNext(r); return s }
// the scraps earned by reaching a rank: scrapsPerRank a rank + the ladder's scraps grants on the way (F79: grants move)
const scrapsTo = (rank: number) => rank * tuning.scrapsPerRank + ladder.grantsUpTo('scraps', rank)
// (F79) the ranks in the XP and rank-lock tests below are inputs to progression.json's XP formula, not ladder beats:
// the formula is the same at any rank, so they stay plain numbers (each line says so with tuning-ok)

describe('ranks', () => {
  it('v1 formula: 3,500 + 250 × rank to the next rank; the first 10 ranks need 46,250 in all', () => {
    expect(xpToNext(0)).toBe(3500)
    expect(xpToNext(10)).toBe(6000)
    expect(cumulative(10)).toBe(46250)
    expect(cumulative(50)).toBe(481250)
    expect(rankInfo({ totalXp: 46250, scrapsSpent: 0 }).rank).toBe(10)
    expect(rankInfo({ totalXp: 46249, scrapsSpent: 0 })).toMatchObject({ rank: 9, xpIntoRank: 46249 - cumulative(9), xpToNext: 5750 }) // tuning-ok: the XP formula
  })

  it('stops at the max rank', () => {
    const r = rankInfo({ totalXp: 10_000_000, scrapsSpent: 0 })
    expect(r).toMatchObject({ rank: maxRank(), xpIntoRank: 0, xpToNext: 0, scraps: scrapsTo(maxRank()) })
  })
})

describe('rewardShift', () => {
  it('the final score becomes XP', () => {
    const r = rewardShift(freshProgress(), 1241, { quotaMet: false })
    expect(r.xp).toBe(1241)
    expect(r.progress.totalXp).toBe(1241)
    expect(r.rankUps).toBe(0)
  })

  it('never less than the floor: max(100, 100 × rank)', () => {
    expect(rewardShift(freshProgress(), 0, { quotaMet: false }).xp).toBe(100)
    const rank10 = { ...freshProgress(), totalXp: cumulative(10) }
    expect(rewardShift(rank10, 50, { quotaMet: false }).xp).toBe(1000)
  })

  it('a rank-up earns a scrap per rank', () => {
    const r = rewardShift({ ...freshProgress(), totalXp: cumulative(2) }, xpToNext(2) + 10, { quotaMet: true })
    expect(r.before.rank).toBe(2)
    expect(r.after).toMatchObject({ scraps: scrapsTo(3), rank: 3 }) // tuning-ok: the XP formula
    expect(r.rankUps).toBe(1)
  })

  it('spent scraps stay spent', () => {
    expect(rankInfo({ totalXp: cumulative(4), scrapsSpent: 3 }).scraps).toBe(scrapsTo(4) - 3)
  })
})

describe('rewardFirstDay (F31)', () => {
  it('a fresh player always ends day one at rank 1: the XP is topped up to the first rank-up', () => {
    const r = rewardFirstDay(freshProgress(), 640, { quotaMet: false })
    expect(r.progress.totalXp).toBe(xpToNext(0))
    expect(r.xp).toBe(xpToNext(0))
    expect(r.after).toMatchObject({ rank: 1, xpIntoRank: 0 })
    expect(r.rankUps).toBe(1)
  })

  it('a day that earned enough on its own keeps its own XP', () => {
    const r = rewardFirstDay(freshProgress(), xpToNext(0) + 50, { quotaMet: false })
    expect(r.xp).toBe(xpToNext(0) + 50)
    expect(r.after).toMatchObject({ rank: 1, xpIntoRank: 50 })
  })

  it('a replay at a higher rank earns what any shift earns (no top-up)', () => {
    const later = { ...freshProgress(), totalXp: cumulative(3) + 5 }
    expect(rewardFirstDay(later, 200, { quotaMet: false })).toEqual(rewardShift(later, 200, { quotaMet: false }))
  })
})

describe('save', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }

  // tests/saves/: one golden save per version, kept forever (a new version adds its own)
  const golden = (v: number) => JSON.stringify(([goldenV1, goldenV2, goldenV3, goldenV4, goldenV5] as object[])[v - 1])

  it('round-trips (with what the scraps bought, F34)', () => {
    const s = memory()
    const p = { totalXp: 12345, scrapsSpent: 2, owned: { circuitStabilizer: 1, cooldownBooster: 1 }, equipped: ['cooldownBooster'] }
    saveProgress(p, s)
    expect(loadProgress(s)).toEqual(p)
    expect(JSON.parse(s.m.get('goops-progress')!).v).toBe(SAVE_VERSION)
  })

  // F54 (TDD D33): Goops 2 takes over v1's address, so a v1 player's browser still holds v1's save under its own keys —
  // a fresh start, the v1 save left as it is (never read, never written)
  it('a v1 player (Goops 1\'s save, gooptris_save_v3 / _v2) starts fresh; v1\'s save is left alone', () => {
    const s = memory()
    const v1Save = JSON.stringify({ careerRank: 12, // tuning-ok: Goops 1's own save, not this ladder
      careerScore: 90210, scraps: 4, powerUps: { CIRCUIT_STABILIZER: 2 }, equippedActives: [], firstRunComplete: true,
      settings: { masterVolume: 50, musicVolume: 80, sfxVolume: 100, invertRotation: false } })
    s.m.set('gooptris_save_v3', v1Save)
    s.m.set('gooptris_save_v2', JSON.stringify({ operatorRank: 3, operatorXP: 500 })) // tuning-ok: Goops 1's own save
    expect(loadProgress(s)).toEqual(freshProgress())
    expect(loadOperatorName(s)).toBeNull()
    saveProgress(loadProgress(s), s)
    expect(s.m.get('gooptris_save_v3')).toBe(v1Save)
  })

  // (F74: every save from before the rank lock steps up with its rank's quota counted as met — TDD D31)
  it('golden version-1 save (the alpha) → version 5: XP and scraps spent KEPT, nothing owned yet, no name, no badge, no careers, the rank unlocked', () => {
    const s = memory()
    s.m.set('goops-progress', golden(1))
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: {}, equipped: [], quotaMet: true })
    expect(loadOperatorName(s)).toBeNull()
    expect(loadCareers(s)).toBe(0)
    // saving it again writes version 5, and it still loads the same
    saveProgress(loadProgress(s), s)
    expect(JSON.parse(s.m.get('goops-progress')!)).toEqual({ v: 5, totalXp: 46250, scrapsSpent: 3, owned: {}, equipped: [], badge: null, quotaMet: true, xpHeld: false, name: null, careers: 0 })
  })

  it('golden version-2 save loads as it was (and steps up to version 3 with no name)', () => {
    const s = memory()
    s.m.set('goops-progress', golden(2))
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: { circuitStabilizer: 2, cooldownBooster: 1 }, equipped: ['cooldownBooster'], quotaMet: true })
    expect(loadOperatorName(s)).toBeNull()
  })

  it('golden version-3 save loads as it was, name and all (F66)', () => {
    const s = memory()
    s.m.set('goops-progress', golden(3))
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: { circuitStabilizer: 2, cooldownBooster: 1 }, equipped: ['cooldownBooster'], quotaMet: true })
    expect(loadOperatorName(s)).toBe('Muzzy')
    expect(loadCareers(s)).toBe(0) // (F65: steps up to version 4 — no badge, no careers)
  })

  it('golden version-4 save loads as it was: the badge (One Of Us) and the careers done (F65)', () => {
    const s = memory()
    s.m.set('goops-progress', golden(4))
    expect(loadProgress(s)).toEqual({ totalXp: 481250, scrapsSpent: 3, owned: { circuitStabilizer: 2, cooldownBooster: 1 }, equipped: ['cooldownBooster'], badge: 'oneOfUs', quotaMet: true })
    expect(loadOperatorName(s)).toBe('Muzzy')
    expect(loadCareers(s)).toBe(1)
  })

  it('a version-4 save mid-rank steps up unlocked: its next goal ranks it up without a quota (nobody stuck by the update)', () => {
    const s = memory()
    s.m.set('goops-progress', JSON.stringify({ v: 4, totalXp: cumulative(7) + xpToNext(7) - 100, scrapsSpent: 0, owned: {}, equipped: [], badge: null, name: null, careers: 0 }))
    const r = rewardShift(loadProgress(s), 900, { quotaMet: false })
    expect(r.after).toMatchObject({ rank: 8, xpIntoRank: 800, locked: false }) // tuning-ok: the XP formula
    expect(r.progress.quotaMet).toBe(false) // rank 8 needs its own
  })

  it('levels past an upgrade\'s maxLevel come off on load, their scraps back (F52 cuts Focus Mode 4 → 2 → 1, Focus Mode II split off) — golden v4 owning Focus Mode 4', () => {
    const s = memory()
    s.m.set('goops-progress', JSON.stringify(goldenV4Focus4))
    const max = maxLevelOf(upgradeBook.upgrades.find((u) => u.id === 'focusMode')!)
    const keep = Math.min(4, max)
    // (Focus Mode II is NOT handed out for the old levels: the scraps come back and the player buys it at rank 31)
    expect(loadProgress(s)).toEqual({ totalXp: 46250, scrapsSpent: 6 - (4 - keep), owned: { focusMode: keep, circuitStabilizer: 2 }, equipped: [], quotaMet: true })
    // a save from before the split, owning Focus Mode 2: level 1 kept, 1 scrap back
    const before = { ...freshProgress(), scrapsSpent: 2, owned: { focusMode: 2 } }
    expect(clampOwned(before, upgradeBook)).toEqual({ ...before, scrapsSpent: 2 - (2 - Math.min(2, max)), owned: { focusMode: Math.min(2, max) } })
    // the rule itself, with a book where Focus Mode stops at 2 (each level costs 1) and Circuit Stabilizer at 4
    const book = { ...upgradeBook, upgrades: upgradeBook.upgrades.map((u) => (u.id === 'focusMode' ? { ...u, maxLevel: 2 } : u)) } as UpgradeBook
    const p = { ...freshProgress(), scrapsSpent: 6, owned: { focusMode: 4, circuitStabilizer: 2, notAnUpgrade: 9 } }
    expect(clampOwned(p, book)).toEqual({ ...p, scrapsSpent: 4, owned: { focusMode: 2, circuitStabilizer: 2, notAnUpgrade: 9 } })
    expect(clampOwned(freshProgress(), book)).toEqual(freshProgress())
  })

  it('golden version-5 save loads as it was: the meter held full, no quota met (F74)', () => {
    const s = memory()
    s.m.set('goops-progress', golden(5))
    const p = loadProgress(s)
    expect(p).toEqual({ totalXp: 46250, scrapsSpent: 3, owned: { circuitStabilizer: 2, cooldownBooster: 1 }, equipped: ['cooldownBooster'], xpHeld: true })
    expect(rankInfo(p)).toMatchObject({ rank: 9, xpIntoRank: xpToNext(9), locked: true }) // tuning-ok: the golden save's XP
    saveProgress(p, s)
    expect(JSON.parse(s.m.get('goops-progress')!)).toEqual(goldenV5)
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
    expect(loadProgress(s)).toEqual({ totalXp: 9000, scrapsSpent: 1, owned: { a: 2, e: 2 }, equipped: ['a'], quotaMet: true })
    s.m.set('goops-progress', JSON.stringify({ v: 2, totalXp: 9000, scrapsSpent: 1, owned: [1, 2], equipped: 'a' }))
    expect(loadProgress(s)).toEqual({ totalXp: 9000, scrapsSpent: 1, owned: {}, equipped: [], quotaMet: true })
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
    expect(nameMaxLength()).toBe(nameTuning.maxLength)
    expect(nameMaxLength()).toBe(12)
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
    const [a, b] = [rankOf('laserBreaks'), rankOf('upgradesShop') + 2] // (any two ranks)
    saveProgress(progressAtRank(a), s)
    saveOperatorName('  Muzzy ', s)
    expect(loadOperatorName(s)).toBe('Muzzy')
    expect(rankInfo(loadProgress(s)).rank).toBe(a)
    saveProgress(progressAtRank(b), s) // (a shift ends: the progress is saved again)
    expect(loadOperatorName(s)).toBe('Muzzy')
    expect(rankInfo(loadProgress(s)).rank).toBe(b)
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
    const top = cumulative(maxRank())
    expect(meterSteps(p(top), p(top + 5000))).toEqual([])
  })
})

// F74 THE RANK LOCK (Muzzy 2026-10-29, TDD D31): rank-up = the XP goal + a quota met this rank
describe('the rank lock (F74)', () => {
  const missed = { quotaMet: false }, met = { quotaMet: true }
  // (the lock works the same at any rank: R is an input to the XP formula, 4,250 to its goal)
  const R = 3 // tuning-ok: the XP formula, not a ladder beat
  const atR = (into = 0) => ({ ...freshProgress(), totalXp: cumulative(R) + into })
  const goalR = xpToNext(R) // 4250

  it('the bonus comes from content: quotaXpMult 2', () => {
    expect(tuning.quotaXpMult).toBe(2)
  })

  it('no quota met this rank: the XP stops at the goal (the meter sits full, the rest is lost, no rank-up)', () => {
    const r = rewardShift(atR(4000), 1000, missed)
    expect(r.xp).toBe(1000)
    expect(r.rankUps).toBe(0)
    expect(r.after).toMatchObject({ rank: R, xpIntoRank: goalR, xpToNext: goalR, locked: true })
    expect(r.lostXp).toBe(750)
    expect(r.progress).toMatchObject({ totalXp: cumulative(R + 1), xpHeld: true, quotaMet: false })
    // another missed shift: still full, all of its XP lost
    const again = rewardShift(r.progress, 2000, missed)
    expect(again.after).toMatchObject({ rank: R, xpIntoRank: goalR, locked: true })
    expect(again.lostXp).toBe(2000)
    expect(again.progress.totalXp).toBe(cumulative(R + 1))
  })

  it('a shift that meets its quota earns double — and, at a full meter, ranks up (the overflow fills the next rank)', () => {
    const held = rewardShift(atR(4000), 1000, missed).progress
    const r = rewardShift(held, 1000, met)
    expect(r.xp).toBe(2000)
    expect(r.quotaMet).toBe(true)
    expect(r.rankUps).toBe(1)
    expect(r.after).toMatchObject({ rank: R + 1, xpIntoRank: 2000, locked: false })
    expect(r.progress).toMatchObject({ quotaMet: false, xpHeld: false }) // the rank-up used the quota up
  })

  it('winning the final shift is not paid double (its valve sets quotaMet, but there is no rank to unlock) — review 2026-10-29', () => {
    const r = rewardShift(progressAtRank(topRank()), 20000, met) // (above rank 50's XP floor of minXpPerRank × 50)
    expect(r.xp).toBe(20000)
    expect(r.quotaMet).toBe(false)
    expect(r.rankUps).toBe(0)
  })

  it('a met quota stays met until the rank-up, over later shifts that miss it', () => {
    const a = rewardShift(atR(0), 500, met) // met early: 1000 XP, far from the goal
    expect(a.after).toMatchObject({ rank: R, xpIntoRank: 1000 })
    expect(a.progress.quotaMet).toBe(true)
    const b = rewardShift(a.progress, 1500, missed) // missed — the key is still in hand
    expect(b.progress.quotaMet).toBe(true)
    const c = rewardShift(b.progress, 2000, missed) // reaches the goal: ranks up
    expect(c.rankUps).toBe(1)
    expect(c.after).toMatchObject({ rank: R + 1, xpIntoRank: 1000 + 1500 + 2000 - goalR })
    expect(c.progress.quotaMet).toBe(false)
    expect([a.metEarlier, b.metEarlier, c.metEarlier]).toEqual([false, true, true]) // (the report's "Met earlier")
  })

  it('one quota = one rank-up: a huge shift stops full at the next rank goal', () => {
    const r = rewardShift(atR(0), 50_000, met)
    expect(r.rankUps).toBe(1)
    expect(r.after).toMatchObject({ rank: R + 1, xpIntoRank: xpToNext(R + 1), locked: true })
    expect(r.lostXp).toBe(100_000 - goalR - xpToNext(R + 1))
  })

  it('the meter fills to full and says locked; the next shift meets the quota → the rank-up steps', () => {
    const before = atR(4000)
    const held = rewardShift(before, 1000, missed).progress
    expect(meterSteps(before, held)).toEqual([{ level: R, from: 4000, to: goalR, max: goalR }])
    expect(meterSteps(held, rewardShift(held, 900, missed).progress)).toEqual([]) // nothing moved
    const up = rewardShift(held, 300, met).progress
    expect(meterSteps(held, up)).toEqual([{ level: R, from: goalR, to: goalR, max: goalR }, { level: R + 1, from: 0, to: 600, max: xpToNext(R + 1) }])
  })

  it('a held flag off a rank boundary (an XP table retuned under an old save) is ignored — no rank taken away', () => {
    expect(rankInfo({ totalXp: cumulative(R + 1) + 7, scrapsSpent: 0, xpHeld: true })).toMatchObject({ rank: R + 1, xpIntoRank: 7, locked: false })
    expect(rankInfo({ totalXp: cumulative(R + 1), scrapsSpent: 0, xpHeld: true })).toMatchObject({ rank: R, xpIntoRank: goalR, locked: true, scraps: scrapsTo(R) })
  })

  it('the first day works as before the lock: no quota needed for rank 1, not doubled', () => {
    const r = rewardFirstDay(freshProgress(), 640, met)
    expect(r.after).toMatchObject({ rank: 1, xpIntoRank: 0, locked: false })
    expect(r.xp).toBe(xpToNext(0))
    const big = rewardFirstDay(freshProgress(), xpToNext(0) + 50, met)
    expect(big.xp).toBe(xpToNext(0) + 50)
    expect(big.after).toMatchObject({ rank: 1, xpIntoRank: 50 })
    expect(big.progress.quotaMet).toBe(false) // rank 1 needs its own quota
  })

  it('the final shift (the top rank) works as before: nothing to fill, never locked', () => {
    const top = progressAtRank(maxRank())
    const r = rewardShift(top, 900, missed)
    expect(r.after).toMatchObject({ rank: maxRank(), xpToNext: 0, locked: false })
    expect(r.rankUps).toBe(0)
    // and reaching it takes a quota like any rank
    const at49 = { ...progressAtRank(maxRank() - 1), totalXp: cumulative(maxRank()) - 100 }
    expect(rewardShift(at49, 500, missed).after).toMatchObject({ rank: maxRank() - 1, locked: true })
    expect(rewardShift(at49, 500, met).after.rank).toBe(maxRank())
  })
})

// F59: what each rank unlocks (F78: content/tuning/ladder.json beats)
describe('unlocks', () => {
  it('next piece, swap, upgrades — each from its beat on (nextPiece / swap / upgradesShop), not the rank before', () => {
    for (const [unlock, beat] of [['nextPiece', 'nextPiece'], ['swap', 'swap'], ['upgrades', 'upgradesShop']] as const) {
      const from = rankOf(beat)
      for (let r = 0; r <= maxRank(); r++) expect(isUnlocked(unlock, r), `${unlock} at ${r}`).toBe(r >= from)
    }
  })

  it('reads the ranks from the ladder file (F78)', () => {
    const t = createLadder({ maxRank: 50, beats: { nextPiece: 0, swap: 10, upgradesShop: 2 } }) // tuning-ok: a made-up ladder
    expect(isUnlocked('nextPiece', 0, t)).toBe(true)
    expect(isUnlocked('swap', 9, t)).toBe(false)
    expect(isUnlocked('upgrades', 2, t)).toBe(true)
  })

  it('names what a rank-up unlocked, in order (none when nothing new)', () => {
    // (today nextPiece < swap < upgradesShop, with a quiet rank between the first two)
    const [next, swap, shop] = [rankOf('nextPiece'), rankOf('swap'), rankOf('upgradesShop')]
    expect(unlocksBetween(next - 1, next)).toEqual(['nextPiece'])
    expect(unlocksBetween(next, swap - 1)).toEqual([])
    expect(unlocksBetween(swap - 1, swap)).toEqual(['swap'])
    expect(unlocksBetween(0, shop + 1)).toEqual(['nextPiece', 'swap', 'upgrades'])
    expect(unlocksBetween(shop, shop)).toEqual([])
  })
})
describe('rank select (F70: the start of a rank, upgrades refunded; 0 = a fresh save)', () => {
  it('rank N = all the XP to reach it, 0 into it, nothing bought or spent', () => {
    const r = rankOf('upgradesShop') + 2 // (any rank past the shop)
    const p = progressAtRank(r)
    expect(rankInfo(p)).toMatchObject({ rank: r, xpIntoRank: 0, scraps: scrapsTo(r) })
    expect(p).toEqual({ totalXp: cumulative(r), scrapsSpent: 0, owned: {}, equipped: [] })
    expect(progressAtRank(0)).toEqual(freshProgress())
  })

  it('every rank 0…maxRank lands on itself; outside that it clamps', () => {
    for (let r = 0; r <= topRank(); r++) expect(rankInfo(progressAtRank(r)).rank).toBe(r)
    expect(topRank()).toBe(maxRank())
    expect(rankInfo(progressAtRank(topRank() + 5)).rank).toBe(maxRank())
    expect(progressAtRank(-3)).toEqual(freshProgress())
  })

  it('clearProgress forgets the save: the next load is a fresh start', () => {
    const store = new Map<string, string>()
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } }
    saveProgress(progressAtRank(rankOf('fifthColour')), storage)
    expect(rankInfo(loadProgress(storage)).rank).toBe(rankOf('fifthColour'))
    clearProgress(storage)
    expect(loadProgress(storage)).toEqual(freshProgress())
  })
})

// F65 END TITLES (design/story.md "Rank titles", TDD D28)
describe('end titles that stick', () => {
  const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m } }

  it('the badge: the rank band, unless the career has an end title; Former Employee for a new career at rank 0', () => {
    expect(badgeTitle(0, null, 0)).toBe('intern')
    expect(badgeTitle(maxRank() - 1, null, 0)).toBe('deputy')
    expect(badgeTitle(maxRank(), 'oneOfUs', 0)).toBe('oneOfUs')
    expect(badgeTitle(maxRank(), 'savior', 0)).toBe('savior')
    expect(badgeTitle(0, null, 1)).toBe('formerEmployee')
    expect(badgeTitle(1, null, 1)).toBe(ladder.lastAt('titles', 1)) // (it lasts one rank, then the titles as usual)
    expect(badgeTitle(rankOf('titles.deputy'), null, 3)).toBe('deputy')
  })

  it('lose the final shift → One Of Us until a win; win → The Savior of Goopkind (never taken back by a loss)', () => {
    expect(badgeAfterFinal(null, false)).toBe('oneOfUs')
    expect(badgeAfterFinal('oneOfUs', false)).toBe('oneOfUs')
    expect(badgeAfterFinal('oneOfUs', true)).toBe('savior')
    expect(badgeAfterFinal(null, true)).toBe('savior')
    expect(badgeAfterFinal('savior', false)).toBe('savior')
  })

  it('the badge and the careers are saved on the device; saving the progress or the name keeps the careers', () => {
    const s = memory()
    saveProgress({ ...progressAtRank(maxRank()), badge: 'oneOfUs' }, s)
    expect(loadProgress(s).badge).toBe('oneOfUs')
    saveCareers(1, s)
    saveOperatorName('Muzzy', s)
    saveProgress({ ...loadProgress(s), badge: 'savior' }, s)
    expect(loadCareers(s)).toBe(1)
    expect(loadProgress(s).badge).toBe('savior')
    expect(loadOperatorName(s)).toBe('Muzzy')
  })

  it('a new career (fresh progress) has no badge; a rank pick (RANK SELECT) drops it too; careers stay', () => {
    const s = memory()
    saveProgress({ ...progressAtRank(maxRank()), badge: 'savior' }, s)
    saveCareers(2, s)
    saveProgress(freshProgress(), s)
    expect(loadProgress(s).badge).toBeUndefined()
    expect(loadCareers(s)).toBe(2)
    saveProgress(progressAtRank(rankOf('fifthColour')), s)
    expect(loadProgress(s).badge).toBeUndefined()
  })

  it('a broken badge or careers count = none (the rest of the save stays)', () => {
    const s = memory()
    s.m.set('goops-progress', JSON.stringify({ v: 5, totalXp: 5, scrapsSpent: 0, owned: {}, equipped: [], badge: 'king', name: null, careers: -3 }))
    expect(loadProgress(s)).toEqual({ totalXp: 5, scrapsSpent: 0, owned: {}, equipped: [] })
    expect(loadCareers(s)).toBe(0)
    s.m.set('goops-progress', JSON.stringify({ v: 4, totalXp: 5, scrapsSpent: 0, owned: {}, equipped: [], badge: null, name: null, careers: 'two' }))
    expect(loadCareers(s)).toBe(0)
  })
})
