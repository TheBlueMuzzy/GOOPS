// F26: which in-shift message shows when (src/game/messages.ts). Numbers from content/tuning/messages.json.
import { describe, expect, it } from 'vitest'
import { createMessages, messageWords, type MessageTuning } from '../src/game/messages'
import { createShift } from '../src/engine'
import type { ShiftEvent, ShiftState } from '../src/engine'
import tuning from '../content/tuning/messages.json'
import text from '../content/text/en.json'
import { oneShapeConfig, tank } from './engine/helpers'

const t = tuning as MessageTuning
// just the parts of the state the messages read
const state = (over: Partial<ShiftState> = {}) => ({ phase: 'playing', integrity: 1, pressure: 0, cracks: [], ...over }) as ShiftState
const keys = (list: { key: string }[]) => list.map((m) => m.key)

describe('refused zaps', () => {
  it('say why, at most once per cooldown however fast you tap', () => {
    const m = createMessages(t)
    const above: ShiftEvent = { type: 'reject', action: 'pop', reason: 'aboveLine' }
    expect(keys(m.step(state(), [above], 0))).toEqual(['refusedAboveLine'])
    expect(m.step(state(), [above, above], 100)).toEqual([]) // spam
    expect(m.step(state(), [{ type: 'reject', action: 'pop', reason: 'filling' }], 1000)).toEqual([]) // still cooling down
    const later = t.refusedCooldownSeconds * 1000 + 1
    expect(keys(m.step(state(), [{ type: 'reject', action: 'pop', reason: 'filling' }], later))).toEqual(['refusedFilling'])
  })

  it('other refusals (a blocked turn, an empty cell) say nothing', () => {
    const m = createMessages(t)
    expect(m.step(state(), [{ type: 'reject', action: 'spin' }, { type: 'reject', action: 'pop' }], 0)).toEqual([])
  })

  it("F68: a lesson's 'not this colour' jiggles but says nothing (the lesson's own line does)", () => {
    const m = createMessages(t)
    expect(m.step(state(), [{ type: 'reject', action: 'pop', reason: 'lessonColour', cell: 0 }], 0)).toEqual([])
  })

  it('a real refused zap in the engine gets its message', () => {
    const shift = createShift(oneShapeConfig([[0, 0]]), { seed: 1, rank: 0, startGrid: tank(['11'], 5) })
    shift.takeEvents()
    shift.act({ type: 'pop', x: 5, y: 23 }) // just landed: still filling
    expect(keys(createMessages(t).step(shift.state, shift.takeEvents(), 0))).toEqual(['refusedFilling'])
  })
})

describe('wrong colour on a crack (F68)', () => {
  // a 4-wide, 2-tall tank with one open green (3) crack at (1, 1)
  const tankWith = (on: number, cracks = [{ id: 7, x: 1, y: 1, color: 3, plugged: false }]) => {
    const grid = new Uint8Array(8)
    grid[1 * 4 + 1] = on
    return state({ width: 4, height: 2, grid, cracks })
  }

  it('says it the first time another colour covers an open crack — once per crack', () => {
    const m = createMessages(t)
    expect(m.step(tankWith(0), [], 0)).toEqual([]) // open, nothing on it
    expect(m.step(tankWith(3), [], 0)).toEqual([]) // its own colour: plugged, all good
    const first = m.step(tankWith(1), [], 0)
    expect(keys(first)).toEqual(['wrongCover'])
    expect(first[0].danger).toBe(false)
    expect(first[0].seconds).toBe(t.seconds.wrongCover)
    expect(m.step(tankWith(1), [], 100_000)).toEqual([]) // still covered: said already
    expect(m.step(tankWith(0), [], 200_000)).toEqual([])
    expect(m.step(tankWith(2), [], 300_000)).toEqual([]) // the same crack again: said already
  })

  it('at most once per cooldown across cracks', () => {
    const m = createMessages(t)
    const crack = (id: number) => [{ id, x: 1, y: 1, color: 3, plugged: false }]
    expect(keys(m.step(tankWith(1, crack(1)), [], 0))).toEqual(['wrongCover'])
    expect(m.step(tankWith(1, crack(2)), [], 1000)).toEqual([]) // cooling down (and crack 2 counts as said)
    expect(keys(m.step(tankWith(1, crack(3)), [], t.wrongCoverCooldownSeconds * 1000 + 1))).toEqual(['wrongCover'])
  })

  it('has words', () => {
    expect(messageWords('wrongCover', 'keys')).toBe(text.messages.wrongCover)
  })
})

describe('machines, quota, rupture', () => {
  it('a broken machine names itself (danger); quota met; rupture says why', () => {
    const m = createMessages(t)
    const out = m.step(state(), [{ type: 'breakdown', machine: 'laser' }, { type: 'breakdown', machine: 'controls' },
      { type: 'quotaMet' }, { type: 'rupture', reason: 'integrity' }], 0)
    expect(keys(out)).toEqual(['brokeLaser', 'brokeControls', 'quotaMet', 'ruptureCracks'])
    expect(out.map((x) => x.danger)).toEqual([true, true, false, true])
    expect(keys(m.step(state(), [{ type: 'rupture', reason: 'overflow' }], 0))).toEqual(['ruptureOverflow'])
  })
})

describe('warnings fire once per crossing', () => {
  it('tank integrity low: once when it falls below, again only after it climbs back above', () => {
    const m = createMessages(t)
    const low = t.integrityLowAt - 0.01
    expect(m.step(state({ integrity: t.integrityLowAt + 0.1 }), [], 0)).toEqual([])
    expect(keys(m.step(state({ integrity: low }), [], 0))).toEqual(['integrityLow'])
    expect(m.step(state({ integrity: low - 0.1 }), [], 0)).toEqual([])
    m.step(state({ integrity: t.integrityLowAt + 0.05 }), [], 0)
    expect(keys(m.step(state({ integrity: low }), [], 0))).toEqual(['integrityLow'])
  })

  it('pressure near max: once, re-armed only after it drops below the reset line (no flicker at the threshold)', () => {
    const m = createMessages(t)
    expect(keys(m.step(state({ pressure: t.pressureHighAt }), [], 0))).toEqual(['pressureHigh'])
    const between = (t.pressureHighAt + t.pressureHighResetAt) / 2
    m.step(state({ pressure: between }), [], 0)
    expect(m.step(state({ pressure: t.pressureHighAt }), [], 0)).toEqual([]) // dipped, but not far enough
    m.step(state({ pressure: t.pressureHighResetAt - 0.01 }), [], 0)
    expect(keys(m.step(state({ pressure: t.pressureHighAt }), [], 0))).toEqual(['pressureHigh'])
  })

  it('no warnings during a rupture (the tank is already lost)', () => {
    const m = createMessages(t)
    expect(m.step(state({ phase: 'rupture', integrity: 0, pressure: 0.9 }), [], 0)).toEqual([])
  })
})

describe('words and numbers', () => {
  it('every message has short words (phone-sized) and a time on screen', () => {
    for (const [key, entry] of Object.entries(text.messages)) {
      // (an input-dependent one: every wording counts)
      for (const words of typeof entry === 'string' ? [entry] : Object.values(entry)) {
        expect(words.length, key).toBeGreaterThan(0)
        expect(words.length, key).toBeLessThanOrEqual(40)
      }
    }
    for (const s of Object.values(t.seconds)) expect(s).toBeGreaterThan(0)
    expect(t.pressureHighResetAt).toBeLessThan(t.pressureHighAt)
  })

  // F38: "swipe up to fix" was wrong on a PC. The broken-machine messages say how to reach the console with the input
  // used last — like the lessons (W / ↑ on keys, a flick up with a mouse, a swipe up on a phone).
  it('the broken-machine messages have every wording, each true to its input', () => {
    for (const key of ['brokeLaser', 'brokeVisor', 'brokeControls'] as const) {
      const entry = text.messages[key]
      expect(typeof entry, key).toBe('object')
      for (const input of ['keys', 'mouse', 'phone'] as const) expect(messageWords(key, input).trim(), `${key}.${input}`).not.toBe('')
      expect(messageWords(key, 'keys'), key).toContain('W or ↑')
      expect(messageWords(key, 'keys'), key).not.toMatch(/swipe|flick/i)
      expect(messageWords(key, 'mouse'), key).toContain('flick up')
      expect(messageWords(key, 'phone'), key).toContain('swipe up')
    }
    expect(messageWords('quotaMet', 'keys')).toBe(messageWords('quotaMet', 'phone')) // a plain line is the same for all
  })
})
