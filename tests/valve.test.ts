// F64: the release valve's puzzle (src/game/valve.ts) — Muzzy's mini-game, 2026-10-26: two wheels steer one needle
// into the green.
import { describe, expect, it } from 'vitest'
import valveFile from '../content/tuning/valve.json'
import { TAU, clickSize, greenWidth, holdDone, holdStep, inGreen, keyTurn, needleTarget, newValve, seededRand, snap, stepNeedle, valveConfig, wheelOff, wheelsTarget, wrap } from '../src/game/valve'

const cfg = valveConfig()

describe('valve.json', () => {
  it('builds with the sketch defaults (rule 2, 8 clicks, fine 0.3, green 0.16, shrink 0.75, hold 0.6, sway 9)', () => {
    expect([cfg.rule, cfg.detents, cfg.fine, cfg.green, cfg.shrink, cfg.hold, cfg.sway]).toEqual([2, 8, 0.3, 0.16, 0.75, 0.6, 9])
  })
  it('every number has a help line and a range', () => {
    for (const key of Object.keys(valveFile).filter((k) => !k.startsWith('_'))) {
      expect(valveFile._help, key).toHaveProperty(key)
      expect(valveFile._ranges, key).toHaveProperty(key)
    }
  })
  it('a broken number falls back to its default', () => {
    expect(valveConfig({ ...valveFile, detents: Number.NaN, hold: -1 } as never)).toMatchObject({ detents: 8, hold: 0 })
  })
})

describe('the wheels click (detents)', () => {
  it('8 clicks a turn: a key turns one click, a drag lands on the nearest', () => {
    expect(clickSize(cfg)).toBeCloseTo(TAU / 8)
    expect(keyTurn(cfg)).toBeCloseTo(TAU / 8)
    expect(snap(TAU / 8 * 2.4, cfg)).toBeCloseTo(TAU / 8 * 2)
    expect(snap(TAU / 8 * 2.6, cfg)).toBeCloseTo(TAU / 8 * 3)
  })
  it('0 = smooth: nothing snaps, a key turns 1/24 of a turn', () => {
    const smooth = { ...cfg, detents: 0 }
    expect(clickSize(smooth)).toBe(0)
    expect(snap(1.234, smooth)).toBe(1.234)
    expect(keyTurn(smooth)).toBeCloseTo(TAU / 24)
  })
  it('how far a wheel is from right wraps the short way round (−1..1)', () => {
    expect(wrap(TAU + 0.5)).toBeCloseTo(0.5)
    expect(wheelOff(0.1, TAU - 0.1)).toBeCloseTo(0.2 / Math.PI)
    expect(wheelOff(Math.PI / 2, 0)).toBeCloseTo(0.5)
    expect(wheelOff(-Math.PI / 2, 0)).toBeCloseTo(-0.5)
  })
})

describe('the needle rule', () => {
  it('both wheels right = the needle in the middle, for every rule', () => {
    for (const rule of [1, 2, 3]) expect(needleTarget({ ...cfg, rule }, 0, 0)).toBe(0)
  })
  it('rule 2 (coarse + fine): the right wheel moves it `fine` as much as the left; it never leaves the dial', () => {
    const left = needleTarget(cfg, 0.1, 0), right = needleTarget(cfg, 0, 0.1)
    expect(right / left).toBeCloseTo(cfg.fine)
    expect(needleTarget(cfg, 1, 1)).toBe(1)
    expect(needleTarget(cfg, -1, -1)).toBe(-1)
  })
  it('rule 1 (add): two wrong turns can cancel out', () => {
    expect(needleTarget({ ...cfg, rule: 1 }, 0.25, -0.25)).toBe(0)
  })
  it('rule 3 (worst wins): the needle shows whichever wheel is further off', () => {
    expect(needleTarget({ ...cfg, rule: 3 }, 0.1, -0.4)).toBe(-0.4)
    expect(needleTarget({ ...cfg, rule: 3 }, 0, 0.25)).toBe(0.25)
  })
  it('the green narrows each stage (× shrink)', () => {
    expect(greenWidth(cfg, 0)).toBeCloseTo(0.16)
    expect(greenWidth(cfg, 1)).toBeCloseTo(0.12)
    expect(greenWidth(cfg, 2)).toBeCloseTo(0.09)
    expect(inGreen(0.079, cfg, 0)).toBe(true)
    expect(inGreen(0.079, cfg, 2)).toBe(false)
  })
  it('the needle springs to where the wheels say and settles there', () => {
    let n = { pos: -1, vel: 0 }
    for (let i = 0; i < 240; i++) n = stepNeedle(n, 0.3, cfg.sway, 1 / 120)
    expect(n.pos).toBeCloseTo(0.3, 2)
  })
})

describe('a new valve, and solving it', () => {
  it('every stage starts with the needle out of the green, on clicks, and setting both wheels right solves it', () => {
    const rand = seededRand(7)
    for (let i = 0; i < 300; i++) {
      const stage = i % 3
      const v = newValve(rand, cfg, stage)
      expect(inGreen(wheelsTarget(cfg, v), cfg, stage)).toBe(false)
      for (const a of [...v.right, ...v.angle]) expect(Math.abs(a / clickSize(cfg) - Math.round(a / clickSize(cfg)))).toBeLessThan(1e-9)
      expect(wheelsTarget(cfg, { right: v.right, angle: [v.right[0] + TAU, v.right[1] - TAU] })).toBeCloseTo(0)
    }
  })
  it('the same seed = the same valve (scripted checks get a fixed one)', () => {
    expect(newValve(seededRand(3), cfg, 1)).toEqual(newValve(seededRand(3), cfg, 1))
  })
  it('a valve so loose that every start reads green: the left wheel starts half a turn off', () => {
    const loose = { ...cfg, green: 5 }
    const v = newValve(seededRand(1), loose, 0)
    expect(Math.abs(wheelOff(v.angle[0], v.right[0]))).toBeCloseTo(1, 5)
  })
  it('solved = held in the green for `hold` seconds; leaving the green (or holding a wheel) starts the count again', () => {
    let held = 0
    for (let i = 0; i < 30; i++) held = holdStep(held, true, 0.01)
    expect(holdDone(held, cfg)).toBe(false)
    held = holdStep(held, false, 0.01)
    expect(held).toBe(0)
    for (let i = 0; i < 61; i++) held = holdStep(held, true, 0.01)
    expect(holdDone(held, cfg)).toBe(true)
    expect(holdDone(0, { ...cfg, hold: 0 })).toBe(true)
  })
})
