// The shift loop (GDD §4): pressure → cracks → tank integrity → rupture → end.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import type { ShiftConfig, ShiftEngine, ShiftEvent } from '../../src/engine'
import { crackEveryMs } from '../../src/engine/cracks'
import { dropPiece, idx, ofType, oneShapeConfig, sealACrack, tank, tickUntil } from './helpers'

const FLOOR = '2'.repeat(30)

// One-cell colour-1 pieces that hang at the top; optional integrity drain (0 = the tank never ruptures).
function calmConfig(drain = 0): ShiftConfig {
  const config = oneShapeConfig([[0, 0]])
  config.integrity.drainPerCrackPerSec = drain
  return config
}

// Tick in 10 ms steps for `ms`, collecting every event.
function run(shift: ShiftEngine, ms: number): ShiftEvent[] {
  const events: ShiftEvent[] = []
  for (let t = 0; t < ms && shift.state.status === 'playing'; t += 10) {
    shift.tick(10)
    events.push(...shift.takeEvents())
  }
  return events
}

describe('pressure', () => {
  it('rises steadily: 0 → 100% in riseMsToFull (75 s), then stays capped at 100%', () => {
    const shift = createShift(calmConfig(), { seed: 1, rank: 0 })
    expect(shift.state.pressure).toBe(0)
    shift.tick(7500)
    expect(shift.state.pressure).toBeCloseTo(0.1, 6)
    shift.tick(75000 - 7500)
    expect(shift.state.pressure).toBeCloseTo(1, 6)
    shift.tick(20000)
    expect(shift.state.pressure).toBe(1)
    expect(shift.state.status).toBe('playing') // a full tank is no longer the end by itself
    expect(shift.state.pressureRow).toBe(3) // the pop line is at the top visible row
  })

  it('the pop line follows pressure', () => {
    const shift = createShift(calmConfig(), { seed: 1, rank: 0 })
    expect(shift.state.pressureRow).toBe(23)
    shift.tick(75000 * 0.5) // 23 - 0.5 × 20 = 13
    expect(shift.state.pressureRow).toBe(13)
  })
})

describe('cracks', () => {
  it('the interval shrinks with pressure: 5 s at 0% → 1 s at 100%, in a straight line', () => {
    const config = calmConfig()
    expect(crackEveryMs(config, 0)).toBe(5000)
    expect(crackEveryMs(config, 0.5)).toBe(3000)
    expect(crackEveryMs(config, 1)).toBe(1000)
  })

  it('about 2 cracks in the first 10 s; about 10 in 10 s at full pressure; they keep coming', () => {
    const shift = createShift(calmConfig(), { seed: 2, rank: 0 })
    expect(ofType(run(shift, 10000), 'crack')).toHaveLength(2)
    run(shift, 65000)
    const atFull = ofType(run(shift, 10000), 'crack').length
    expect(atFull).toBeGreaterThanOrEqual(9)
    expect(atFull).toBeLessThanOrEqual(11)
  })

  it('only where they can be sealed now: empty cells at or below the pop line — never in the row just above it', () => {
    // A floor two rows deep. At 5 s the line is at row 21.67: only rows 22-23 can pop, and they're full of goop,
    // so there is nowhere to put a crack (v1 put one in row 21, which could not be popped yet).
    const shift = createShift(calmConfig(), { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    expect(ofType(run(shift, 7400), 'crack')).toHaveLength(0)
    // Later the line reaches row 21 and cracks appear there.
    const first = ofType(run(shift, 10000), 'crack')[0].crack
    expect(first.y).toBe(21)
  })

  it('a long run: every new crack is on an empty cell, at or below the pop line, in a playable colour', () => {
    // Lumpy goop of colours 2-4 (it never moves: pieces hang at the top).
    const rows = ['..2...3.....4', '.22..33...444.', '2222333.444442']
    const config = calmConfig()
    config.colorsByRank = [{ rank: 0, count: 4 }]
    const shift = createShift(config, { seed: 9, rank: 0, startGrid: tank(rows, 4) })
    let seen = 0
    for (let t = 0; t < 70000; t += 10) {
      shift.tick(10)
      for (const e of ofType(shift.takeEvents(), 'crack')) {
        seen++
        const { x, y, color } = e.crack
        expect(y).toBeGreaterThanOrEqual(shift.state.pressureRow)
        expect(y).toBeLessThan(shift.state.height)
        expect(shift.state.grid[idx(x, y)]).toBe(0)
        expect(color).toBeGreaterThanOrEqual(1)
        expect(color).toBeLessThanOrEqual(4)
      }
    }
    expect(seen).toBeGreaterThan(20)
    const spots = new Set(shift.state.cracks.map((c) => idx(c.x, c.y)))
    expect(spots.size).toBe(shift.state.cracks.length) // never two cracks on one cell
  })
})

describe('tank integrity', () => {
  it('starts full and each open crack drains 0.4% per second', () => {
    const shift = createShift(calmConfig(0.004), { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    expect(shift.state.integrity).toBe(1)
    tickUntil(shift, () => shift.state.cracks.length === 1)
    expect(shift.state.integrity).toBeCloseTo(1, 2)
    let before = shift.state.integrity
    shift.tick(1000) // the next crack is seconds away
    expect(shift.state.integrity).toBeCloseTo(before - 0.004, 6)
    tickUntil(shift, () => shift.state.cracks.length === 2)
    before = shift.state.integrity
    shift.tick(1000)
    expect(shift.state.integrity).toBeCloseTo(before - 0.008, 6)
  })

  it('with sealRefund 0, sealing stops the drain but does not refill', () => {
    const config = calmConfig(0.004)
    config.integrity.sealRefund = 0
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    sealACrack(shift, config)
    expect(shift.state.cracks).toHaveLength(0)
    const after = shift.state.integrity
    expect(after).toBeLessThan(1)
    shift.tick(500)
    expect(shift.state.integrity).toBe(after)
  })

  it('at 0 the tank ruptures', () => {
    const shift = createShift(calmConfig(1), { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    tickUntil(shift, () => shift.state.cracks.length === 1)
    const events = run(shift, 1100)
    expect(ofType(events, 'rupture')).toEqual([{ type: 'rupture', reason: 'integrity' }])
    expect(shift.state.integrity).toBe(0)
    expect(shift.state.phase).toBe('rupture')
    expect(shift.state.status).toBe('playing') // not over yet: pressure has to drain first
  })
})

describe('rupture', () => {
  const ruptured = () => {
    const config = calmConfig(1)
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    tickUntil(shift, () => shift.state.phase === 'rupture')
    shift.takeEvents()
    return { shift, config }
  }

  it('drains pressure by 100% per 5 s (the line sinks with it); no new cracks; integrity no longer matters', () => {
    const { shift } = ruptured()
    const before = shift.state.pressure
    expect(before).toBeGreaterThan(0.1)
    const events = run(shift, 300)
    expect(shift.state.pressure).toBeCloseTo(before - 300 / 5000, 6)
    expect(ofType(events, 'crack')).toHaveLength(0)
    expect(shift.state.integrity).toBe(0)
  })

  it('pieces keep coming', () => {
    const { shift, config } = ruptured()
    const events = dropPiece(shift, config)
    expect(ofType(events, 'lock')).toHaveLength(1)
    expect(ofType(events, 'spawn')).toHaveLength(1)
    expect(shift.state.status).toBe('playing')
  })

  it('goop can still be zapped, but zaps do not vent (the drain is the clock)', () => {
    const shift = createShift(calmConfig(1), { seed: 1, rank: 0, startGrid: tank(['11'], 5) })
    tickUntil(shift, () => shift.state.phase === 'rupture')
    const before = shift.state.pressure
    shift.act({ type: 'pop', x: 5, y: 23 })
    expect(ofType(shift.takeEvents(), 'pop')).toHaveLength(1)
    expect(shift.state.pressure).toBe(before)
  })

  it('ends when pressure reaches 0: lost without the quota, minus 50 per leftover cell', () => {
    const { shift, config } = ruptured()
    dropPiece(shift, config) // one more goop cell in the tank
    const left = shift.state.grid.filter((c) => c !== 0).length
    const events = run(shift, 10000)
    expect(shift.state.status).toBe('lost')
    expect(shift.state.pressure).toBe(0)
    expect(shift.state.leftoverPenalty).toBe(left * 50)
    expect(events.at(-1)).toEqual({ type: 'end', status: 'lost' })
    shift.act({ type: 'spin', dir: 1 }) // nothing happens after the end
    expect(ofType(shift.takeEvents(), 'spin')).toHaveLength(0)
  })

  it('ends won when the quota was met before the rupture', () => {
    const config = calmConfig(0.004)
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    sealACrack(shift, config)
    config.integrity.drainPerCrackPerSec = 1 // the engine reads its config live: make the next crack break the tank
    const events = run(shift, 30000)
    expect(ofType(events, 'rupture')).toHaveLength(1)
    expect(shift.state.status).toBe('won')
    expect(events.at(-1)).toEqual({ type: 'end', status: 'won' })
  })

  it('a piece with no room to spawn ruptures the tank (overflow) instead of ending the shift', () => {
    // Column 0 full from row 2 down: two pieces fit on top, the third has no room.
    const grid = new Uint8Array(30 * 24)
    for (let y = 2; y < 24; y++) grid[idx(0, y)] = 2
    const config = calmConfig()
    const shift = createShift(config, { seed: 1, rank: 0, startGrid: grid })
    shift.tick(3000)
    dropPiece(shift, config)
    const events = dropPiece(shift, config)
    expect(ofType(events, 'rupture')).toEqual([{ type: 'rupture', reason: 'overflow' }])
    expect(shift.state.ruptureReason).toBe('overflow') // the end report says why
    expect(shift.state.phase).toBe('rupture')
    expect(shift.state.status).toBe('playing')
    expect(shift.state.piece).toBe(null)
    run(shift, 10000) // pressure (4%) drains away, then it's over
    expect(shift.state.status).toBe('lost')
  })

  it('a piece with no room to spawn DURING a rupture waits for room; the shift still ends only at pressure 0', () => {
    // Column 0 full from row 3 down: three pieces fit on top, the fourth has no room.
    const grid = new Uint8Array(30 * 24)
    for (let y = 3; y < 24; y++) grid[idx(0, y)] = 2
    const config = calmConfig(1)
    const shift = createShift(config, { seed: 1, rank: 0, startGrid: grid })
    tickUntil(shift, () => shift.state.phase === 'rupture')
    expect(shift.state.pressure).toBeGreaterThan(0.05)
    dropPiece(shift, config)
    dropPiece(shift, config)
    const events = dropPiece(shift, config)
    expect(ofType(events, 'end')).toHaveLength(0) // still zapping time
    expect(shift.state.status).toBe('playing')
    expect(shift.state.piece).toBe(null)
    const rest = run(shift, 10000)
    expect(shift.state.pressure).toBe(0)
    expect(ofType(rest, 'end')).toEqual([{ type: 'end', status: 'lost' }])
  })
})

describe('quota', () => {
  it('quotaMet fires once when the last needed crack is sealed; play goes on and later seals still count', () => {
    const config = calmConfig()
    const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([FLOOR, FLOOR]) })
    expect(shift.state.cracksNeeded).toBe(1)
    expect(shift.state.quotaMet).toBe(false)
    const first = sealACrack(shift, config)
    expect(ofType(first, 'quotaMet')).toHaveLength(1)
    expect(shift.state.quotaMet).toBe(true)
    expect(shift.state.status).toBe('playing')
    const scoreAfterFirst = shift.state.score
    const second = sealACrack(shift, config) // cracks keep coming after the quota
    expect(ofType(second, 'quotaMet')).toHaveLength(0)
    expect(shift.state.cracksSealed).toBe(2)
    expect(shift.state.score).toBeGreaterThan(scoreAfterFirst)
  })
})
