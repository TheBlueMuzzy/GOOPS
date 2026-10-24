// F41: the payslip is theatre — net always equals the real XP, paydays always add up to the payment due.
import { describe, expect, it } from 'vitest'
import tuning from '../../content/tuning/payslip.json'
import en from '../../content/text/en.json'
import { freshProgress, rewardFirstDay, rewardShift, xpToNext, type Progress } from '../../src/progress/progression'
import { NO_FACTS, debtAt, makePayslip, split, type ShiftFacts } from '../../src/progress/payslip'

const extras = en.payslip.extras.length
const at = (totalXp: number): Progress => ({ ...freshProgress(), totalXp })
const xpForRank = (rank: number) => { let xp = 0; for (let r = 0; r < rank; r++) xp += xpToNext(r); return xp }
const sum = (lines: { amount: number }[]) => lines.reduce((a, l) => a + l.amount, 0)

describe('payslip', () => {
  it('net = the real XP and gross − fines = net, for many scores and ranks', () => {
    for (const rank of [0, 1, 5, 12, 29, 30, 44]) for (const score of [0, 7, 120, 1800, 2900, 9000]) for (const seed of [1, 2, 3]) {
      const reward = rewardShift(at(xpForRank(rank) + 10), score)
      const p = makePayslip(reward, NO_FACTS, { firstDay: false, seed, extras })
      expect(p.net).toBe(reward.xp)
      expect(p.gross - sum(p.fines)).toBe(p.net)
      expect(p.fines.length).toBeLessThanOrEqual(tuning.fineLines)
      for (const f of p.fines) expect(f.amount).toBeGreaterThan(0)
    }
  })

  it('fines total about the fine share of the shift', () => {
    const reward = rewardShift(at(xpForRank(3)), 1800)
    const p = makePayslip(reward, NO_FACTS, { firstDay: false, seed: 4, extras })
    expect(sum(p.fines)).toBe(Math.round(1800 * tuning.fineShare))
    expect(p.fines).toHaveLength(tuning.fineLines)
  })

  it('real events are fined first, then silly ones; rank-gated silly fines wait for their rank', () => {
    const facts: ShiftFacts = { ...NO_FACTS, ruptured: true, broke: ['laser'] }
    const p = makePayslip(rewardShift(at(xpForRank(3)), 2000), facts, { firstDay: false, seed: 5, extras })
    expect(p.fines.slice(0, 2).map((f) => f.key).sort()).toEqual(['fines.laser', 'fines.rupture'])
    expect(p.fines[2].key.startsWith('silly.')).toBe(true)
    for (let seed = 0; seed < 50; seed++) {
      const low = makePayslip(rewardShift(at(xpForRank(3)), 2000), NO_FACTS, { firstDay: false, seed, extras })
      expect(low.fines.some((f) => f.key === 'silly.hearingVoices' || f.key === 'silly.talkingBack')).toBe(false)
    }
  })

  it('every fine and payday key has words in en.json', () => {
    const words = en.payslip as unknown as Record<string, Record<string, string>>
    for (const k of ['association', 'rupture', 'laser', 'visor', 'controls', 'openCracks', 'goopLeft', 'loitering', 'zapping']) expect(words.fines[k]).toBeTruthy()
    for (const k of Object.keys(tuning.sillyFines)) expect(words.silly[k]).toBeTruthy()
    for (const k of Object.keys(tuning.payday)) if (k !== 'extra') expect(words.payday[k]).toBeTruthy()
  })

  it('a payday takes exactly the payment due, in 5 items', () => {
    const reward = rewardShift(at(xpForRank(3) + 4000), 2900) // 4,250 due at rank 3
    const p = makePayslip(reward, NO_FACTS, { firstDay: false, seed: 6, extras })
    expect(p.paydays).toHaveLength(1)
    expect(p.paydays[0].due).toBe(xpToNext(3))
    expect(sum(p.paydays[0].items)).toBe(xpToNext(3))
    expect(p.paydays[0].items).toHaveLength(5)
    expect(p.credits).toBe(reward.after.xpIntoRank)
  })

  it('two rank-ups in one shift = two paydays in a row', () => {
    const reward = rewardShift(at(0), xpToNext(0) + xpToNext(1) + 50)
    const p = makePayslip(reward, NO_FACTS, { firstDay: false, seed: 7, extras })
    expect(p.paydays.map((d) => [d.from, d.to])).toEqual([[0, 1], [1, 2]])
    for (const d of p.paydays) expect(sum(d.items)).toBe(d.due)
  })

  it('the first day has no fines but still pays day', () => {
    const reward = rewardFirstDay(freshProgress(), 300)
    const p = makePayslip(reward, { ...NO_FACTS, ruptured: true }, { firstDay: true, seed: 8, extras })
    expect(p.fines).toEqual([])
    expect(p.gross).toBe(p.net)
    expect(p.paydays).toHaveLength(1)
  })

  it('passage debt barely moves before rank 30, then goes up', () => {
    const d0 = debtAt(0), d29 = debtAt(29), d40 = debtAt(40)
    expect(d0).toBe(tuning.debt.start)
    expect(Math.abs(d29 - d0)).toBeLessThan(d0 * 0.1)
    for (let r = 30; r < 40; r++) expect(debtAt(r + 1)).toBeGreaterThan(debtAt(r))
    expect(d40).toBeGreaterThan(d29)
  })

  it('split keeps whole parts that add up', () => {
    expect(sum(split(10, [1, 1, 1]).map((amount) => ({ amount })))).toBe(10)
    expect(split(3, [5, 1, 1]).every((v) => v >= 1)).toBe(true)
  })
})
