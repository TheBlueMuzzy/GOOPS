// F51 the economy sim (scripts/bots/career.ts): a career repeats exactly from its seed, and what the sim buys reaches
// the shift through the same path the game uses (upgradesForShift → createShift, as App.tsx newEngine).
import { describe, expect, it } from 'vitest'
import { NEUTRAL_MODIFIERS } from '../src/engine'
import { progressAtRank, rankInfo, scrapsAt } from '../src/progress/progression'
import { levelOf, upgradesForShift } from '../src/progress/upgradeShop'
import { effectBaseline, effectProgress, nextBuy, playShift, runCareer, shiftEngine, shop } from '../scripts/bots/career'

describe('the economy sim (F51)', () => {
  it('the same career seed plays the same career, shift for shift', () => {
    const a = runCareer({ bot: 'focused', style: 'activesFirst', seed: 3, toRank: 7 })
    const b = runCareer({ bot: 'focused', style: 'activesFirst', seed: 3, toRank: 7 })
    expect(a).toEqual(b)
    expect(a.reachedRank).toBeGreaterThanOrEqual(7) // ranks gained by real XP
    expect(a.shifts[0]).toMatchObject({ rank: 0, won: true }) // the first day ends at rank 1
    const c = runCareer({ bot: 'focused', style: 'activesFirst', seed: 4, toRank: 7 })
    expect(c.shifts.map((s) => s.xp)).not.toEqual(a.shifts.map((s) => s.xp)) // another seed, another career
  }, 60_000)

  it('shopping spends every scrap the style can, within the shop rules', () => {
    const p = shop(progressAtRank(9), 9, 'spread')
    expect(p.scrapsSpent).toBe(9)
    expect(scrapsAt(9, p)).toBe(0)
    expect(nextBuy(p, 9, 'spread')).toBeNull()
    expect(shop(progressAtRank(4), 4, 'spread')).toEqual(progressAtRank(4)) // the shop opens at rank 5
  })

  it('an upgrade bought in the sim reaches the shift’s tuning', () => {
    const p = shop(progressAtRank(9), 9, 'spread')
    expect(levelOf(p, 'pressureControl')).toBeGreaterThan(0)
    const { engine } = shiftEngine(p, 11, rankInfo(p).rank)
    const mods = engine.snapshot().options.modifiers!
    expect(mods).toEqual(upgradesForShift(p).modifiers)
    expect(mods.pressureRiseTimeMult).toBeGreaterThan(NEUTRAL_MODIFIERS.pressureRiseTimeMult)
    // an active bought + equipped by the sim is in the shift
    const a = shop(progressAtRank(5), 5, 'activesFirst')
    expect(a.equipped).toEqual(['cooldownBooster'])
    expect(shiftEngine(a, 11, 5).engine.state.abilities?.map((x) => x.id)).toEqual(['cooldownBooster'])
  })

  it('an upgrade on vs off changes the same seed’s shift (and off = owning nothing)', () => {
    const off = playShift({ bot: 'sharp', seed: 7_000_001, progress: effectBaseline('tougherTank'), rank: 22 })
    const on = playShift({ bot: 'sharp', seed: 7_000_001, progress: effectProgress('tougherTank', 4), rank: 22 })
    expect(effectBaseline('tougherTank').owned).toEqual({})
    expect(on.survivedMs).not.toBe(off.survivedMs)
    // a slot upgrade: the same actives both ways, one more goes in with it
    expect(upgradesForShift(effectBaseline('activeSlot')).abilities).toHaveLength(1)
    expect(upgradesForShift(effectProgress('activeSlot', 1)).abilities).toHaveLength(2)
    expect(upgradesForShift(effectProgress('activeSlot2', 1)).abilities).toHaveLength(3)
  }, 30_000)
})
