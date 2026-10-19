// F25: the visor glitch amount comes from the visor's signal; dev URL overrides parse safely.
import { describe, expect, it } from 'vitest'
import { visorAmount, parseVisorOverride, curvedY } from '../../src/view/visorFx'
import fx from '../../content/tuning/visor-fx.json'
import breakdowns from '../../content/tuning/breakdowns.json'

const visor = (health: number, unlocked = true, broken = false, brokenMs = 0) => ({ id: 'visor' as const, unlocked, health, broken, cooldownMs: 0, brokenMs })

// Muzzy 2026-10-18: "the screen [doesn't start] its glitch cycle until the meter reaches 0" — then it builds up.
describe('visorAmount', () => {
  it('is 0 while the meter still has signal — however low — or the visor is locked or missing', () => {
    expect(visorAmount(visor(1))).toBe(0)
    expect(visorAmount(visor(0.3))).toBe(0)
    expect(visorAmount(visor(breakdowns.visor.breakAt + 0.01))).toBe(0)
    expect(visorAmount(visor(0.05, false, true, 99999))).toBe(0)
    expect(visorAmount(undefined)).toBe(0)
  })
  it('builds from 0 to 1 over rampMs once broken, then stays at 1', () => {
    const b = breakdowns.visor.brokenHealth
    expect(visorAmount(visor(b, true, true, 0))).toBe(0)
    expect(visorAmount(visor(b, true, true, fx.rampMs / 2))).toBeCloseTo(0.5)
    expect(visorAmount(visor(b, true, true, fx.rampMs))).toBe(1)
    expect(visorAmount(visor(b, true, true, fx.rampMs * 3))).toBe(1)
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

// The pressure readout's dot sits on the BENT pressure line (Muzzy 2026-10-18: "the circle end of the diagonal line sits
// on the actual pressure line"): curvedY must undo the shader's barrel (c *= 1 + curve * 0.10 * |c|²).
describe('curvedY', () => {
  const rect = { left: 100, top: 50, width: 400, height: 600 }
  const barrel = (x: number, y: number, curve: number) => { // screen point → the flat point the shader shows there
    const cx = ((x - rect.left) / rect.width) * 2 - 1, cy = ((y - rect.top) / rect.height) * 2 - 1
    const m = 1 + curve * 0.1 * (cx * cx + cy * cy)
    return rect.top + ((cy * m + 1) / 2) * rect.height
  }
  it('leaves y alone with no curve', () => expect(curvedY(150, 400, rect, 0)).toBe(400))
  it('finds where the bent line really is', () => {
    for (const curve of [0.5, 1, 3]) for (const [x, y] of [[150, 500], [300, 120], [480, 640], [300, 350]]) {
      const shown = curvedY(x, y, rect, curve)
      expect(barrel(x, shown, curve)).toBeCloseTo(y, 3)
    }
  })
  it('pulls a line near the bottom up toward the middle', () => expect(curvedY(150, 550, rect, 1)).toBeLessThan(550))
})
