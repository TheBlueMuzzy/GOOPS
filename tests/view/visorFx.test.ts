// F25: the visor glitch amount comes from the visor's signal; dev URL overrides parse safely.
import { describe, expect, it } from 'vitest'
import { visorAmount, parseVisorOverride } from '../../src/view/visorFx'
import fx from '../../content/tuning/visor-fx.json'
import breakdowns from '../../content/tuning/breakdowns.json'

const visor = (health: number, unlocked = true, broken = false) => ({ id: 'visor' as const, unlocked, health, broken, cooldownMs: 0 })

describe('visorAmount', () => {
  it('is 0 while fine, locked, or missing', () => {
    expect(visorAmount(visor(1))).toBe(0)
    expect(visorAmount(visor(fx.healthClean))).toBe(0)
    expect(visorAmount(visor(0.05, false))).toBe(0)
    expect(visorAmount(undefined)).toBe(0)
  })
  it('rises as the signal fades and is 1 when broken', () => {
    expect(visorAmount(visor((fx.healthClean + fx.healthBroken) / 2))).toBeCloseTo(0.5)
    expect(visorAmount(visor(fx.healthBroken))).toBe(1)
    expect(visorAmount(visor(breakdowns.visor.brokenHealth, true, true))).toBe(1)
  })
  it('reaches 1 at the visor break point', () => {
    expect(fx.healthBroken).toBe(breakdowns.visor.breakAt)
  })
})

describe('parseVisorOverride', () => {
  it('reads ?visor= and ?pixel=', () => {
    expect(parseVisorOverride('?visor=0.6')).toEqual({ amount: 0.6, pixelate: null })
    expect(parseVisorOverride('?visor=off&pixel=off')).toEqual({ amount: 0, pixelate: false })
    expect(parseVisorOverride('?visor=7&pixel=on')).toEqual({ amount: 1, pixelate: true })
    expect(parseVisorOverride('?seed=7')).toEqual({ amount: null, pixelate: null })
    expect(parseVisorOverride('?visor=abc')).toEqual({ amount: null, pixelate: null })
  })
})
