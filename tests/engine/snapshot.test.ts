// The Dev Kit's Snapshots: a shift saved as plain JSON and put back plays on EXACTLY as the original would have.
import { describe, expect, it } from 'vitest'
import { createShift, type ShiftEngine, type ShiftEvent } from '../../src/engine'
import { readSnapshot, restoreShift } from '../../src/engine/snapshot'
import { createRng } from '../../src/engine/rng'
import breakdowns from '../../content/tuning/breakdowns.json'
import { realConfig } from './helpers'

// A simple seeded bot: turns, rotations, fast drop and zaps at the bottom row — the same moves for any engine
function play(engine: ShiftEngine, botSeed: number, ticks: number): ShiftEvent[] {
  const bot = createRng(botSeed)
  const events: ShiftEvent[] = []
  for (let t = 0; t < ticks && engine.state.status === 'playing'; t++) {
    const r = bot.next()
    if (r < 0.1) engine.act({ type: 'spin', dir: bot.chance(0.5) ? 1 : -1 })
    else if (r < 0.15) engine.act({ type: 'rotate', dir: 1 })
    else if (r < 0.2) engine.act({ type: 'softDrop', on: bot.chance(0.5) })
    else if (r < 0.3) engine.act({ type: 'pop', x: bot.int(engine.state.width), y: engine.state.height - 1 - bot.int(3) })
    engine.tick(50)
    events.push(...engine.takeEvents())
  }
  return events
}

const comparable = (e: ShiftEngine) => JSON.parse(JSON.stringify(e.snapshot()))

describe('shift snapshots', () => {
  for (const [seed, rank] of [[3, 2], [11, 6], [42, 9]]) {
    it(`seed ${seed}, rank ${rank}: a restored shift plays on exactly as the original`, () => {
      const config = realConfig()
      const original = createShift(config, { seed, rank, breakdowns })
      play(original, seed + 1, 400)
      const saved = JSON.parse(JSON.stringify(original.snapshot())) // through JSON, as the Dev Kit stores it
      const copy = restoreShift(config, saved, breakdowns)
      expect(comparable(copy)).toEqual(comparable(original))
      const a = play(original, 99, 800)
      const b = play(copy, 99, 800)
      expect(b).toEqual(a)
      expect(comparable(copy)).toEqual(comparable(original))
      expect(a.length).toBeGreaterThan(50)
    })
  }

  it('a snapshot is plain JSON (no Maps, typed arrays or functions)', () => {
    const e = createShift(realConfig(), { seed: 5, rank: 4, breakdowns })
    play(e, 6, 100)
    const snap = e.snapshot()
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
  })

  it('refuses junk with a plain reason', () => {
    expect(() => readSnapshot(null)).toThrow(/isn't a Goops snapshot/)
    expect(() => readSnapshot({ kind: 'something' })).toThrow(/isn't a Goops shift snapshot/)
    expect(() => readSnapshot({ kind: 'goops-shift', version: 99 })).toThrow(/format 99/)
    const good = JSON.parse(JSON.stringify(createShift(realConfig(), { seed: 1, rank: 1 }).snapshot()))
    expect(() => readSnapshot({ ...good, state: { ...good.state, grid: [1, 2, 3] } })).toThrow(/grid doesn't match/)
    expect(readSnapshot(good).kind).toBe('goops-shift')
  })

  it('refuses a snapshot from a different-sized tank', () => {
    const snap = createShift(realConfig(), { seed: 1, rank: 1 }).snapshot()
    const small = realConfig()
    small.tank.width = 20
    expect(() => restoreShift(small, JSON.parse(JSON.stringify(snap)))).toThrow(/tank is 30×24/)
  })
})
