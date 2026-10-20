// F32: the console monitor's words type out letter by letter (src/game/crt.ts)
import { describe, expect, it } from 'vitest'
import { crtPreset, crtVars, typedCount } from '../src/game/crt'
import crt from '../content/tuning/crt.json'

describe('the monitor types its words out', () => {
  it('nothing typed at the start, then letters at the set speed', () => {
    expect(typedCount(0, 40, 20)).toBe(0)
    expect(typedCount(100, 40, 20)).toBe(4)
    expect(typedCount(249, 40, 20)).toBe(9)
  })
  it('never more than the text, never less than nothing', () => {
    expect(typedCount(10_000, 40, 20)).toBe(20)
    expect(typedCount(-50, 40, 20)).toBe(0)
  })
  it('reduce motion, or a speed of 0: all of it at once', () => {
    expect(typedCount(0, 40, 20, true)).toBe(20)
    expect(typedCount(0, 0, 20)).toBe(20)
  })
  it('the shipped speed is quick: a 40-letter line in under a second and a half', () => {
    expect(typedCount(1500, crt.presets.dos.lettersPerSecond, 40)).toBe(40)
  })
})

// F60: the look is presets any panel can take (content/tuning/crt.json); applying one = <CrtLook preset|place>
describe('the CRT look presets', () => {
  it('dos, amber and off exist with the same knobs, and the monitor wears one of them', () => {
    const knobs = Object.keys(crt.presets.dos).sort()
    for (const name of ['amber', 'off'] as const) expect(Object.keys(crt.presets[name]).sort()).toEqual(knobs)
    expect(Object.keys(crt.presets)).toContain(crt.use.monitor)
  })
  it('off switches every layer off', () => {
    const off = crt.presets.off
    expect([off.tint, off.glow, off.scanLines, off.wobble, off.typing]).toEqual([false, false, false, false, false])
  })
  it('an unknown preset name falls back to off', () => {
    expect(crtPreset('no-such-look')).toEqual(crt.presets.off)
  })
  it('scan lines: the width never covers more than the gap, and alpha is a percent', () => {
    const vars = crtVars({ ...crt.presets.dos, scanWidth: 99, scanAlpha: 0.28 }) as Record<string, unknown>
    expect(vars['--crt-scan-width']).toBe(crt.presets.dos.scanGap)
    expect(vars['--crt-scan-alpha']).toBe('28%')
  })
  it('dos keeps the F32 monitor look exactly (old scanLine 0.45 of a 6 gap = 2.7 thick, 28% dark, still)', () => {
    const d = crt.presets.dos
    expect([d.scanGap, d.scanWidth, d.scanAlpha, d.scanSpeed]).toEqual([6, 2.7, 0.28, 0])
    expect([d.textColor, d.glowColor, d.glowSize, d.glowStrength, d.wobbleSize, d.wobbleSeconds]).toEqual(['#9cffb0', '#2bff6a', 0.4, 0.7, 0.04, 5])
  })
})
