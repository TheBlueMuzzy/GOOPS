// F24: the console's repair puzzles (src/game/repairs.ts) — Muzzy's rules, 2026-10-18.
import { describe, expect, it } from 'vitest'
import breakdowns from '../content/tuning/breakdowns.json'
import { controlAnswers, controlsDone, controlsTurn, laserSolved, newControls, newLaser, newVisor, repairSteps, visorDone, visorLitButton, visorPress, visorSlide } from '../src/game/repairs'

// a seeded random (mulberry32), so every run is the same
const seeded = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

describe('repairSteps: how many steps each repair takes (the tuning, minus upgrades later)', () => {
  it('today: laser 4 sliders, visor 3 buttons, controls 4 corners', () => {
    expect(repairSteps('laser')).toBe(4)
    expect(repairSteps('visor')).toBe(3)
    expect(repairSteps('controls')).toBe(4)
  })
  it('a "Quick Fix" upgrade: −1 → 3 steps, −2 → 2 steps; never below 1, never more than the tuning', () => {
    expect(repairSteps('laser', 1)).toBe(3)
    expect(repairSteps('laser', 2)).toBe(2)
    expect(repairSteps('controls', 1)).toBe(3)
    expect(repairSteps('controls', 2)).toBe(2)
    expect(repairSteps('visor', 2)).toBe(1)
    expect(repairSteps('visor', 9)).toBe(1)
    expect(repairSteps('laser', -3)).toBe(4)
  })
  it('the puzzles take those counts: 2 sliders lit, 2 corners, a 1-button visor that still slides up and down', () => {
    expect(newLaser(seeded(1), repairSteps('laser', 2)).filter((w) => w !== null)).toHaveLength(2)
    expect(newControls(seeded(1), repairSteps('controls', 2)).targets).toHaveLength(2)
    let v = newVisor(seeded(1), repairSteps('visor', 2))
    v = visorSlide(v, 0)!
    v = visorPress(v, visorLitButton(v)!).visor
    expect(visorLitButton(v)).toBeNull()
    expect(visorDone(v)).toBe(false)
    expect(visorDone(visorSlide(v, 1)!)).toBe(true)
  })
})

describe('laser', () => {
  it('lights all 4 sliders (the tuning), each needing left or right — and both ends come up', () => {
    const ends = new Set<number | null>()
    for (let s = 1; s < 200; s++) {
      const want = newLaser(seeded(s), breakdowns.laser.repairSliders)
      expect(want).toHaveLength(4)
      for (const w of want) expect([0, 2]).toContain(w)
      want.forEach((w) => ends.add(w))
    }
    expect(ends).toEqual(new Set([0, 2]))
  })
  it('a smaller tuning lights only that many; the rest need nothing', () => {
    for (let s = 1; s < 50; s++) expect(newLaser(seeded(s), 2).filter((w) => w !== null)).toHaveLength(2)
  })
  it('is solved when every lit slider is at its end; unlit ones need nothing (a 2-lit puzzle)', () => {
    const want = [0, null, 2, null] as const
    expect(laserSolved([...want], [1, 1, 1, 1])).toBe(false)
    expect(laserSolved([...want], [0, 1, 1, 1])).toBe(false)
    expect(laserSolved([...want], [0, 2, 2, 0])).toBe(true)
  })
})

describe('visor (reset lights)', () => {
  it('3 buttons, never the same twice running', () => {
    for (let s = 1; s < 200; s++) {
      const { order, step, slider } = newVisor(seeded(s), repairSteps('visor'))
      expect(order).toHaveLength(3)
      expect(order[0]).not.toBe(order[1])
      expect(order[1]).not.toBe(order[2])
      expect(step).toBe(0)
      expect(slider).toBe(1) // starts down
    }
  })
  it('slide up → the lit buttons in turn → slide down; the slider is refused out of turn; a wrong button only shakes', () => {
    let v = newVisor(seeded(3), 3)
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
  it('4 corners (the tuning), each different from the corner the dial is on at that moment', () => {
    let repeats = 0
    for (let s = 1; s < 200; s++) {
      const c = newControls(seeded(s), breakdowns.controls.repairCorners, s % 4)
      expect(c.targets).toHaveLength(4)
      expect(c.targets[0]).not.toBe(s % 4)
      for (let i = 1; i < 4; i++) expect(c.targets[i]).not.toBe(c.targets[i - 1])
      if (new Set(c.targets).size < 4) repeats++
    }
    expect(repeats).toBeGreaterThan(0) // an earlier corner may come back (just never the current one)
  })
  it('turning to the lit corner locks it by itself; other corners just move the dial', () => {
    let c = newControls(seeded(9), 4, 0)
    const other = [0, 1, 2, 3].find((k) => k !== c.targets[0])!
    c = controlsTurn(c, other)
    expect(c.step).toBe(0)
    expect(c.dial).toBe(other)
    for (let i = 0; i < 4; i++) c = controlsTurn(c, c.targets[i])
    expect(controlsDone(c)).toBe(true)
  })
})

// F32 (Muzzy's second try): during a lesson only the outlined part answers; with no lesson every control does
describe('during a lesson only the outlined part answers', () => {
  it('no lesson (nothing outlined): every control works', () => {
    expect(controlAnswers([], undefined)).toBe(true)
    expect(controlAnswers([], 'repair-laser')).toBe(true)
  })
  it('a step outlines a part: that part works, the others do not', () => {
    expect(controlAnswers(['repair-laser'], 'repair-laser')).toBe(true)
    expect(controlAnswers(['repair-laser'], undefined)).toBe(false)
    expect(controlAnswers(['repair-laser'], 'repair-visor')).toBe(false)
  })
  it('a step outlining something else (the monitor): no repair control works', () => {
    expect(controlAnswers(['monitor', 'crt'], 'repair-visor')).toBe(false)
  })
})
