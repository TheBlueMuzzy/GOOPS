// F24: the console's repair puzzles (src/game/repairs.ts) — Muzzy's rules, 2026-10-18.
import { describe, expect, it } from 'vitest'
import { controlsDone, controlsTurn, laserSolved, newControls, newLaser, newVisor, visorDone, visorLitButton, visorPress, visorSlide } from '../src/game/repairs'

// a seeded random (mulberry32), so every run is the same
const seeded = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('laser', () => {
  it('lights exactly 2 of the 4 sliders, each needing left or right', () => {
    for (let s = 1; s < 200; s++) {
      const want = newLaser(seeded(s))
      expect(want).toHaveLength(4)
      expect(want.filter((w) => w !== null)).toHaveLength(2)
      for (const w of want) expect([null, 0, 2]).toContain(w)
    }
  })
  it('is solved when both lit sliders are at their end; the unlit ones need nothing', () => {
    const want = [0, null, 2, null] as const
    expect(laserSolved([...want], [1, 1, 1, 1])).toBe(false)
    expect(laserSolved([...want], [0, 1, 1, 1])).toBe(false)
    expect(laserSolved([...want], [0, 2, 2, 0])).toBe(true)
  })
})

describe('visor (reset lights)', () => {
  it('3 buttons, never the same twice running', () => {
    for (let s = 1; s < 200; s++) {
      const { order, step, slider } = newVisor(seeded(s))
      expect(order).toHaveLength(3)
      expect(order[0]).not.toBe(order[1])
      expect(order[1]).not.toBe(order[2])
      expect(step).toBe(0)
      expect(slider).toBe(1) // starts down
    }
  })
  it('slide up → the lit buttons in turn → slide down; the slider is refused out of turn; a wrong button only shakes', () => {
    let v = newVisor(seeded(3))
    expect(visorSlide(v, 1)).toBeNull() // already down: nothing asked
    expect(visorPress(v, v.order[0]).wrong).toBe(true) // buttons before the slide: wrong, nothing changes
    v = visorSlide(v, 0)!
    expect(v.step).toBe(1)
    expect(visorSlide(v, 1)).toBeNull() // can't slide down yet
    for (let i = 0; i < 3; i++) {
      const lit = visorLitButton(v)!
      expect(lit).toBe(v.order[i])
      const wrong = visorPress(v, (lit + 1) % 3)
      expect(wrong.wrong).toBe(true)
      expect(wrong.visor).toBe(v) // no reset
      v = visorPress(v, lit).visor
    }
    expect(visorLitButton(v)).toBeNull()
    expect(visorDone(v)).toBe(false)
    v = visorSlide(v, 1)!
    expect(visorDone(v)).toBe(true)
  })
})

describe('controls (the dial)', () => {
  it('3 corners, each different from the one before and from where the dial starts', () => {
    for (let s = 1; s < 200; s++) {
      const c = newControls(seeded(s), s % 4)
      expect(c.targets).toHaveLength(3)
      expect(c.targets[0]).not.toBe(s % 4)
      expect(c.targets[1]).not.toBe(c.targets[0])
      expect(c.targets[2]).not.toBe(c.targets[1])
    }
  })
  it('turning to the lit corner locks it by itself; other corners just move the dial', () => {
    let c = newControls(seeded(9), 0)
    const other = [0, 1, 2, 3].find((k) => k !== c.targets[0])!
    c = controlsTurn(c, other)
    expect(c.step).toBe(0)
    expect(c.dial).toBe(other)
    for (let i = 0; i < 3; i++) c = controlsTurn(c, c.targets[i])
    expect(controlsDone(c)).toBe(true)
  })
})
