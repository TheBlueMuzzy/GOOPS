// F32: the console monitor's words type out letter by letter (src/game/crt.ts)
import { describe, expect, it } from 'vitest'
import { typedCount } from '../src/game/crt'
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
    expect(typedCount(1500, crt.lettersPerSecond, 40)).toBe(40)
  })
})
