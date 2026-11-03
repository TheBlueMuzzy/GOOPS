// F51 the economy sim (scripts/bots/career.ts): a career repeats exactly from its seed, and what the sim buys reaches
// the shift through the same path the game uses (upgradesForShift → createShift, as App.tsx newEngine).
import { describe, expect, it } from 'vitest'
import { NEUTRAL_MODIFIERS } from '../src/engine'
import { progressAtRank, rankInfo, scrapsAt } from '../src/progress/progression'
import { levelOf, upgradesForShift } from '../src/progress/upgradeShop'
import { effectBaseline, effectProgress, nextBuy, playShift, runCareer, shiftEngine, shop } from '../scripts/bots/career'
import { rankOf } from '../src/progress/ladder'

// (F79: the ranks are the ladder's) the shop's rank; Pressure Control's (a few upgrades open by then); the first active's
const SHOP = rankOf('upgradesShop'), SEVERAL = rankOf('upgrades.pressureControl')
const FIRST_ACTIVE = Math.max(SHOP, rankOf('upgrades.cooldownBooster'))

describe('the economy sim (F51)', () => {
  it('the same career seed plays the same career, shift for shift', () => {
    // (to the shop's rank, past its opening — under the rank lock (F74) these 3 careers 2 ranks further took 29 shifts, 60 s+)
    const a = runCareer({ bot: 'focused', style: 'activesFirst', seed: 3, toRank: SHOP })
    const b = runCareer({ bot: 'focused', style: 'activesFirst', seed: 3, toRank: SHOP })
    expect(a).toEqual(b)
    expect(a.reachedRank).toBeGreaterThanOrEqual(SHOP) // ranks gained by real XP + met quotas
    expect(a.shifts[0]).toMatchObject({ rank: 0, won: true }) // the first day ends at rank 1
    const c = runCareer({ bot: 'focused', style: 'activesFirst', seed: 4, toRank: SHOP })
    expect(c.shifts.map((s) => s.xp)).not.toEqual(a.shifts.map((s) => s.xp)) // another seed, another career
  }, 60_000)

  it('shopping spends every scrap the style can, within the shop rules', () => {
    const p = shop(progressAtRank(SEVERAL), SEVERAL, 'spread')
    expect(p.scrapsSpent).toBe(rankInfo(progressAtRank(SEVERAL)).scraps)
    expect(scrapsAt(SEVERAL, p)).toBe(0)
    expect(nextBuy(p, SEVERAL, 'spread')).toBeNull()
    expect(shop(progressAtRank(SHOP - 1), SHOP - 1, 'spread')).toEqual(progressAtRank(SHOP - 1)) // the shop opens at upgradesShop
  })

  it('an upgrade bought in the sim reaches the shift’s tuning', () => {
    const p = shop(progressAtRank(SEVERAL), SEVERAL, 'spread')
    expect(levelOf(p, 'pressureControl')).toBeGreaterThan(0)
    const { engine } = shiftEngine(p, 11, rankInfo(p).rank)
    const mods = engine.snapshot().options.modifiers!
    expect(mods).toEqual(upgradesForShift(p).modifiers)
    expect(mods.pressureRiseTimeMult).toBeGreaterThan(NEUTRAL_MODIFIERS.pressureRiseTimeMult)
    // an active bought + equipped by the sim is in the shift
    const a = shop(progressAtRank(FIRST_ACTIVE), FIRST_ACTIVE, 'activesFirst')
    expect(a.equipped).toEqual(['cooldownBooster'])
    expect(shiftEngine(a, 11, FIRST_ACTIVE).engine.state.abilities?.map((x) => x.id)).toEqual(['cooldownBooster'])
  })

  it('an upgrade on vs off changes the same seed’s shift (and off = owning nothing)', () => {
    const off = playShift({ bot: 'sharp', seed: 7_000_001, progress: effectBaseline('tougherTank'), rank: rankOf('upgrades.tougherTank') })
    const on = playShift({ bot: 'sharp', seed: 7_000_001, progress: effectProgress('tougherTank', 4), rank: rankOf('upgrades.tougherTank') })
    expect(effectBaseline('tougherTank').owned).toEqual({})
    expect(on.survivedMs).not.toBe(off.survivedMs)
    // a slot upgrade: the same actives both ways, one more goes in with it
    expect(upgradesForShift(effectBaseline('activeSlot')).abilities).toHaveLength(1)
    expect(upgradesForShift(effectProgress('activeSlot', 1)).abilities).toHaveLength(2)
    expect(upgradesForShift(effectProgress('activeSlot2', 1)).abilities).toHaveLength(3)
  }, 30_000)
})
