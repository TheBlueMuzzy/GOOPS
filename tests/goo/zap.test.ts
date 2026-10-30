// F67 the zap look's timeline (src/goo/shared/zap.ts), with Muzzy's picks from content/tuning/zap.json.
import { describe, expect, it } from 'vitest'
import { beamStrength, heatTime, laserGlow, sprayDrops, sprayDue, suckIn, zapEnd, zapFade, zapHeat, zapLook } from '../../src/goo/shared/zap'
import zapFile from '../../content/tuning/zap.json'

describe('the zap timeline', () => {
  const Z = zapLook()

  it('reads Muzzy\'s pick from zap.json', () => {
    expect(Z).toEqual({ beamTime: 0.3, whiteHot: 0.52, swell: 0.14, suckTime: 0.27, droplets: 15, dropSpeed: 95, dropLife: 1.4, gravity: 310, sprayAt: 0.6 })
    expect(zapFile._help).toBeTruthy()
  })

  it('heats for 40% of the beam, then sucks in nearest-first, and is gone at the end', () => {
    expect(heatTime(Z)).toBeCloseTo(0.12)
    expect(zapEnd(Z)).toBeCloseTo(0.39)
    expect(zapHeat(Z, 0.06)).toBeCloseTo(0.5)
    expect(zapHeat(Z, 0.2)).toBe(1)
    expect(suckIn(Z, 0.1, 0)).toBe(0) // still heating
    const mid = 0.12 + 0.27 * 0.4
    expect(suckIn(Z, mid, 0)).toBeGreaterThan(suckIn(Z, mid, 1)) // the near side goes first: a teardrop
    expect(suckIn(Z, zapEnd(Z), 1)).toBe(1)
    expect(zapFade(0.5)).toBe(1)
    expect(zapFade(1)).toBe(0)
  })

  it('sprays once, at sprayAt of the whole zap; the beam fades over beamTime; the laser point glows during the suck-in', () => {
    expect(sprayDue(Z, 0.6 * 0.39 - 0.01)).toBe(false)
    expect(sprayDue(Z, 0.6 * 0.39 + 0.01)).toBe(true)
    expect(beamStrength(Z, 0)).toBe(1)
    expect(beamStrength(Z, 0.3)).toBe(0)
    expect(laserGlow(Z, 0.1)).toBeNull()
    expect(laserGlow(Z, 0.2)!.alpha).toBeGreaterThan(0)
    expect(laserGlow(Z, 0.4)).toBeNull()
  })

  it('droplets: v1 px on a 30-px cell → cells, flying out of the goop', () => {
    const xs = [0, 1, 1, 0]
    const ys = [0, 0, 1, 1]
    const drops = sprayDrops(Z, xs, ys, () => 0.5)
    expect(drops).toHaveLength(15)
    const d = drops[0]
    expect(d.g).toBeCloseTo(310 / 30)
    expect(d.r).toBeCloseTo((9 * 0.85) / 30)
    expect(d.life).toBeCloseTo(1.4)
    expect(d.vy).toBeLessThan(0) // pushed up (v1's upward bias)
  })

  it('reduce motion: no swell and no spray — the beam and the suck-in stay', () => {
    const S = zapLook(true)
    expect(S.swell).toBe(0)
    expect(S.droplets).toBe(0)
    expect(sprayDrops(S, [0, 1], [0, 1])).toEqual([])
    expect(S.beamTime).toBe(0.3)
    expect(S.suckTime).toBe(0.27)
  })
})
