// F63 the white goop (the Veteran, gooped): in the tank from rank 31, never merges or pops (the laser passes through
// him), oozes behind the goop to the crack hardest for you and seals it after sealTime. src/engine/whiteGoop.ts
import { describe, expect, it } from 'vitest'
import { createShift, type ShiftEngine, type ShiftEvent, type WhiteGoopConfig } from '../../src/engine'
import { restoreShift } from '../../src/engine/snapshot'
import { crackHardness } from '../../src/engine/whiteGoop'
import { createRng } from '../../src/engine/rng'
import whiteGoopJson from '../../content/tuning/whiteGoop.json'
import breakdowns from '../../content/tuning/breakdowns.json'
import { idx, ofType, realConfig, straightLineCracks, tank, tickUntil } from './helpers'

const whiteGoop = () => structuredClone(whiteGoopJson) as WhiteGoopConfig
// no cracks of the shift's own (the tests place theirs), pieces hanging still at the top
function quietConfig() {
  const config = straightLineCracks(realConfig(), 1e12, 1e12)
  config.fall.msPerRow = 1e9
  return config
}
const EMPTY = new Uint8Array(30 * 24)

function landed(shift: ShiftEngine) {
  tickUntil(shift, () => shift.state.vet!.mode !== 'drop', 10_000, 5)
  return shift.state.vet!
}

describe('the white goop', () => {
  it('is in the tank from rank 31, not at 30, and never in a lesson', () => {
    const cfg = whiteGoop()
    expect(createShift(realConfig(), { seed: 1, rank: 30, whiteGoop: cfg }).state.vet).toBeNull()
    expect(createShift(realConfig(), { seed: 1, rank: 31, whiteGoop: cfg }).state.vet).toBeTruthy()
    expect(createShift(realConfig(), { seed: 1, rank: 31 }).state.vet).toBeNull() // (no tuning handed in: no white goop)
    expect(createShift(realConfig(), { seed: 1, rank: 35, whiteGoop: cfg, training: {} }).state.vet).toBeNull()
  })

  it('drops in at the start and lands on the goop under him (he is not a grid cell)', () => {
    const shift = createShift(quietConfig(), { seed: 2, rank: 31, whiteGoop: whiteGoop(), startGrid: EMPTY })
    const v = shift.state.vet!
    expect(v.mode).toBe('drop')
    expect(v.x).toBe(27) // 3 left of the centre column (spin 0)
    expect(landed(shift).y).toBe(23) // the floor of an empty tank
    expect(shift.state.grid.every((c) => c === 0)).toBe(true)

    const onGoop = createShift(quietConfig(), { seed: 2, rank: 31, whiteGoop: whiteGoop(), startGrid: tank(['1', '1'], 27) })
    expect(landed(onGoop).y).toBe(21) // on top of a 2-high stack
  })

  it('never pops: the laser passes through him with an "ow", and goop in front of him still pops', () => {
    const shift = createShift(quietConfig(), { seed: 3, rank: 31, whiteGoop: whiteGoop(), startGrid: EMPTY })
    const v = landed(shift)
    shift.takeEvents()
    shift.act({ type: 'pop', x: v.x, y: v.y })
    const events = shift.takeEvents()
    expect(ofType(events, 'vetOw')).toHaveLength(1)
    expect(ofType(events, 'pop')).toHaveLength(0)
    expect(ofType(events, 'reject')).toHaveLength(0) // (the tap did something: no "nope")
    expect(shift.state.vet).toBeTruthy()
    // a tap beside him: no ow
    shift.act({ type: 'pop', x: v.x + 2, y: v.y })
    expect(ofType(shift.takeEvents(), 'vetOw')).toHaveLength(0)
  })

  it('never merges: goop landing in his cell passes in front of him, and pops round him', () => {
    const config = quietConfig()
    const shift = createShift(config, { seed: 4, rank: 31, whiteGoop: whiteGoop(), startGrid: EMPTY })
    const v = landed(shift)
    shift.state.grid[idx(v.x, v.y)] = 1 // goop sits where he is (put straight in the grid: this isn't a lesson's shift)
    shift.tick(16)
    expect(shift.state.vet!.behind).toBe(true)
    expect(shift.state.grid[idx(v.x, v.y)]).toBe(1) // still just goop in the grid
  })

  it('goes for the crack hardest for you and seals it after sealTime', () => {
    const cfg = whiteGoop()
    const shift = createShift(quietConfig(), { seed: 5, rank: 31, whiteGoop: cfg, startGrid: tank(['2.']) })
    const s = shift.state
    const easy = { id: 901, x: 1, y: 23, color: 1, plugged: false } // on the floor: nothing to build
    const hard = { id: 902, x: 24, y: 17, color: 1, plugged: false } // 6 rows up in the air
    s.cracks.push(easy, hard)
    expect(crackHardness(s, hard, cfg)).toBeGreaterThan(crackHardness(s, easy, cfg))
    landed(shift)
    tickUntil(shift, () => s.vet!.targetId !== null, 2000, 5)
    expect(s.vet!.targetId).toBe(902)
    const events: ShiftEvent[] = []
    tickUntil(shift, () => { events.push(...shift.takeEvents()); return s.vet!.mode === 'seal' }, 60_000, 10)
    expect([s.vet!.x, s.vet!.y]).toEqual([24, 17])
    // not sealed a moment before sealTime…
    shift.tick(cfg.sealTime * 1000 - 100)
    expect(s.cracks.some((c) => c.id === 902)).toBe(true)
    expect(s.vet!.seal).toBeGreaterThan(0.95)
    // …sealed just after
    shift.tick(200)
    events.push(...shift.takeEvents())
    expect(s.cracks.some((c) => c.id === 902)).toBe(false)
    expect(ofType(events, 'vetSeal').map((e) => e.crackId)).toEqual([902])
    expect(s.sealedCracks!.some((c) => c.id === 902)).toBe(true)
    expect(s.cracksSealed).toBe(1) // countsForQuota: true (Ask Muzzy)
    expect(s.vet!.mode).toBe('rest')
    // after his rest he heads for the other one
    shift.tick(cfg.restAfter * 1000 + 50)
    expect(s.vet!.targetId).toBe(901)
  })

  it('a wrong colour covering a crack makes it harder; his seals can be set not to count', () => {
    const cfg = whiteGoop()
    cfg.countsForQuota = false
    const shift = createShift(quietConfig(), { seed: 6, rank: 31, whiteGoop: cfg, startGrid: tank(['2']) })
    const s = shift.state
    const covered = { id: 1, x: 0, y: 23, color: 1, plugged: false }
    expect(crackHardness(s, covered, cfg)).toBe(cfg.coveredHardness)
    // reads the tuning live: a 1 s seal from now on
    cfg.sealTime = 1
    const onFloor = { id: 2, x: 27, y: 23, color: 1, plugged: false } // right where he lands
    s.cracks.push(onFloor)
    landed(shift)
    tickUntil(shift, () => !s.cracks.some((c) => c.id === 2), 1500, 10)
    expect(s.cracks.some((c) => c.id === 2)).toBe(false)
    expect(s.cracksSealed).toBe(0)
  })

  it('stands still while the rules clock does (no ticks = no movement)', () => {
    const shift = createShift(quietConfig(), { seed: 7, rank: 31, whiteGoop: whiteGoop(), startGrid: EMPTY })
    shift.state.cracks.push({ id: 5, x: 20, y: 23, color: 1, plugged: false })
    landed(shift)
    shift.tick(300)
    const before = JSON.stringify(shift.state.vet)
    shift.tick(0)
    expect(JSON.stringify(shift.state.vet)).toBe(before)
  })

  it('a snapshot keeps him: a restored shift plays on exactly as the original', () => {
    const config = realConfig()
    const cfg = whiteGoop()
    const original = createShift(config, { seed: 31, rank: 31, breakdowns, whiteGoop: cfg })
    const bot = (engine: ShiftEngine, seed: number, ticks: number) => {
      const r = createRng(seed)
      const out: ShiftEvent[] = []
      for (let t = 0; t < ticks && engine.state.status === 'playing'; t++) {
        const k = r.next()
        if (k < 0.1) engine.act({ type: 'spin', dir: r.chance(0.5) ? 1 : -1 })
        else if (k < 0.2) engine.act({ type: 'softDrop', on: r.chance(0.5) })
        else if (k < 0.3) engine.act({ type: 'pop', x: r.int(engine.state.width), y: engine.state.height - 1 - r.int(3) })
        engine.tick(50)
        out.push(...engine.takeEvents())
      }
      return out
    }
    bot(original, 1, 600)
    expect(original.state.vet!.mode).not.toBe('drop')
    const saved = JSON.parse(JSON.stringify(original.snapshot()))
    expect(saved.state.vet).toBeTruthy()
    const copy = restoreShift(config, saved, breakdowns, cfg)
    expect(copy.state.vet).toEqual(original.state.vet)
    const a = bot(original, 9, 800)
    const b = bot(copy, 9, 800)
    expect(b).toEqual(a)
    expect(copy.state.vet).toEqual(original.state.vet)
  })
})
