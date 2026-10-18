// F23: breakdowns in the engine (GDD §5). Three machines with v1's meters (content/tuning/breakdowns.json):
// laser (capacitor), visor (signal), controls (heat). They break from their unlock rank, apply their effect
// (only the laser's lives in the engine), and are fixed by the console's 'repair' action.
import { describe, expect, it } from 'vitest'
import breakdownsJson from '../../content/tuning/breakdowns.json'
import { createShift } from '../../src/engine'
import type { BreakdownConfig, MachineId, Modifiers, ShiftConfig, ShiftEngine, ShiftEvent, ShiftOptions } from '../../src/engine'
import { createRng } from '../../src/engine/rng'
import { dropPiece, idx, ofType, oneShapeConfig, realConfig, tank } from './helpers'

const breakdowns = () => structuredClone(breakdownsJson) as BreakdownConfig

// One-cell colour-1 pieces hanging at the top; the tank never wears out (no integrity drain).
function calmConfig(): ShiftConfig {
  const config = oneShapeConfig([[0, 0]])
  config.integrity.drainPerCrackPerSec = 0
  return config
}

// A floor row of 30 single-cell groups (colours 1, 2, 1, 2…): each is its own group, ready 375 ms after the start.
const FLOOR = tank(['12'.repeat(15)])

function machineShift(rank: number, extra: Partial<ShiftOptions> = {}, config = calmConfig()) {
  const shift = createShift(config, { seed: 1, rank, breakdowns: breakdowns(), startGrid: FLOOR, ...extra })
  return { shift, config, m: shift.state.machines! }
}

function run(shift: ShiftEngine, ms: number, step = 10): ShiftEvent[] {
  const events: ShiftEvent[] = []
  for (let t = 0; t < ms && shift.state.status === 'playing'; t += step) {
    shift.tick(step)
    events.push(...shift.takeEvents())
  }
  return events
}

// Zap `count` floor cells (columns from `from` on). Returns the events.
function zapFloor(shift: ShiftEngine, count: number, from = 0): ShiftEvent[] {
  const events: ShiftEvent[] = []
  for (let x = from; x < from + count; x++) {
    shift.act({ type: 'pop', x, y: 23 })
    events.push(...shift.takeEvents())
  }
  return events
}

function spins(shift: ShiftEngine, count: number): ShiftEvent[] {
  for (let i = 0; i < count; i++) shift.act({ type: 'spin', dir: 1 })
  return shift.takeEvents()
}

describe('unlock ranks', () => {
  it('visor from rank 2, laser from 4, controls from 6', () => {
    const unlocked = (rank: number) => {
      const m = machineShift(rank).m
      return (['laser', 'visor', 'controls'] as MachineId[]).filter((id) => m[id].unlocked)
    }
    expect(unlocked(0)).toEqual([])
    expect(unlocked(1)).toEqual([])
    expect(unlocked(2)).toEqual(['visor'])
    expect(unlocked(4)).toEqual(['laser', 'visor'])
    expect(unlocked(6)).toEqual(['laser', 'visor', 'controls'])
  })

  it('every machine starts fine: health 1, not broken, no cooldown', () => {
    const { m } = machineShift(6)
    for (const id of ['laser', 'visor', 'controls'] as MachineId[]) {
      expect(m[id]).toEqual({ id, unlocked: true, health: 1, broken: false, cooldownMs: 0 })
    }
    expect(machineShift(6).shift.state.primed).toEqual([])
  })

  it('without the breakdowns tuning every machine stays locked', () => {
    const shift = createShift(calmConfig(), { seed: 1, rank: 10, startGrid: FLOOR })
    expect(Object.values(shift.state.machines!).every((m) => !m.unlocked)).toBe(true)
  })

  it('locked machines never move or break, whatever you do', () => {
    const { shift, m } = machineShift(1)
    run(shift, 600)
    const events = [...zapFloor(shift, 30), ...spins(shift, 40), ...run(shift, 30000)]
    expect(ofType(events, 'breakdown')).toEqual([])
    for (const id of ['laser', 'visor', 'controls'] as MachineId[]) expect(m[id]).toMatchObject({ health: 1, broken: false })
  })
})

describe('laser (capacitor)', () => {
  it('drains 0.04 per zapped cell and refills 0.10 per landed piece', () => {
    const { shift, config, m } = machineShift(4)
    run(shift, 400)
    zapFloor(shift, 5)
    expect(m.laser.health).toBeCloseTo(0.8)
    dropPiece(shift, config)
    expect(m.laser.health).toBeCloseTo(0.9)
    dropPiece(shift, config)
    dropPiece(shift, config)
    expect(m.laser.health).toBe(1) // never above full
  })

  it('breaks when empty (25 cells), once', () => {
    const { shift, m } = machineShift(4)
    run(shift, 400)
    const events = zapFloor(shift, 26)
    expect(ofType(events, 'breakdown')).toEqual([{ type: 'breakdown', machine: 'laser' }])
    expect(m.laser).toMatchObject({ health: 0, broken: true })
    // the breakdown comes right after the zap that emptied it
    const i = events.findIndex((e) => e.type === 'breakdown')
    expect(events[i - 1].type).toBe('pop')
  })

  it('a landed piece does not refill a broken laser', () => {
    const { shift, config, m } = machineShift(4)
    run(shift, 400)
    zapFloor(shift, 25)
    dropPiece(shift, config)
    expect(m.laser).toMatchObject({ health: 0, broken: true })
  })

  it('broken: the first zap primes a ready group (no score, no pop), the second pops it', () => {
    const { shift, m } = machineShift(4)
    run(shift, 400)
    zapFloor(shift, 25)
    expect(m.laser.broken).toBe(true)
    const s = shift.state
    const score = s.score
    const id = s.groupOf[idx(27, 23)]
    shift.act({ type: 'pop', x: 27, y: 23 })
    let events = shift.takeEvents()
    expect(events).toEqual([{ type: 'prime', groupId: id }])
    expect(s.primed).toEqual([id])
    expect(s.score).toBe(score)
    expect(s.grid[idx(27, 23)]).toBe(2)
    shift.act({ type: 'pop', x: 27, y: 23 })
    events = shift.takeEvents()
    expect(ofType(events, 'pop')).toHaveLength(1)
    expect(s.score).toBeGreaterThan(score)
    expect(s.primed).toEqual([])
    expect(s.grid[idx(27, 23)]).toBe(0)
  })

  it('a group that is not ready is still rejected (not primed)', () => {
    const { shift } = machineShift(4)
    run(shift, 400)
    zapFloor(shift, 25)
    shift.act({ type: 'pop', x: 10, y: 10 }) // empty cell
    expect(shift.takeEvents()).toEqual([{ type: 'reject', action: 'pop' }])
    expect(shift.state.primed).toEqual([])
  })

  it('primed marks clear when the group changes (a piece merges into it)', () => {
    const { shift, config } = machineShift(4)
    run(shift, 400)
    zapFloor(shift, 25, 1) // columns 1..25; column 0 (colour 1) is left
    shift.act({ type: 'pop', x: 0, y: 23 })
    expect(shift.state.primed).toHaveLength(1)
    dropPiece(shift, config) // a colour-1 cell lands on column 0 and joins it
    expect(shift.state.grid[idx(0, 22)]).toBe(1)
    expect(shift.state.primed).toEqual([])
  })

  it('primed marks clear on repair', () => {
    const { shift } = machineShift(4)
    run(shift, 400)
    zapFloor(shift, 25)
    shift.act({ type: 'pop', x: 27, y: 23 })
    expect(shift.state.primed).toHaveLength(1)
    shift.act({ type: 'repair', machine: 'laser' })
    expect(shift.takeEvents()).toEqual([{ type: 'prime', groupId: shift.state.groupOf[idx(27, 23)] }, { type: 'repaired', machine: 'laser' }])
    expect(shift.state.primed).toEqual([])
    // working again: one zap pops
    shift.act({ type: 'pop', x: 27, y: 23 })
    expect(ofType(shift.takeEvents(), 'pop')).toHaveLength(1)
  })
})

describe('visor (signal)', () => {
  it('holds for 5 s, then fades to 0.10 over 5 s and breaks (snaps to 0.05)', () => {
    const { shift, m } = machineShift(2)
    run(shift, 5000)
    expect(m.visor.health).toBe(1)
    run(shift, 2500)
    expect(m.visor.health).toBeCloseTo(1 - 0.9 * 0.5)
    const events = run(shift, 2600)
    expect(ofType(events, 'breakdown')).toEqual([{ type: 'breakdown', machine: 'visor' }])
    expect(m.visor).toMatchObject({ health: 0.05, broken: true })
    run(shift, 5000)
    expect(m.visor.health).toBe(0.05) // a broken meter stays put until repaired
  })

  it('fast-dropping recovers it at 4/s and restarts the grace', () => {
    const { shift, m } = machineShift(2)
    run(shift, 7500) // 0.55
    shift.act({ type: 'softDrop', on: true })
    run(shift, 100)
    expect(m.visor.health).toBeCloseTo(0.95)
    run(shift, 100)
    expect(m.visor.health).toBe(1)
    shift.act({ type: 'softDrop', on: false })
    run(shift, 5000)
    expect(m.visor.health).toBe(1) // a fresh grace
    run(shift, 1000)
    expect(m.visor.health).toBeCloseTo(1 - 0.9 * 0.2)
  })

  it('visorGraceMult stretches the grace (Circuit Stabilizer)', () => {
    const { shift, m } = machineShift(2, { modifiers: { visorGraceMult: 2 } })
    run(shift, 10000)
    expect(m.visor.health).toBe(1)
    run(shift, 1000)
    expect(m.visor.health).toBeCloseTo(0.82)
  })
})

describe('controls (heat)', () => {
  it('each spin adds 0.05 heat; after 200 ms idle it cools at 0.5/s', () => {
    const { shift, m } = machineShift(6)
    spins(shift, 10)
    expect(m.controls.health).toBeCloseTo(0.5)
    run(shift, 192, 16)
    expect(m.controls.health).toBeCloseTo(0.5) // still within the 200 ms
    run(shift, 208, 16) // 400 ms idle in all → 200 ms of cooling
    expect(m.controls.health).toBeCloseTo(0.6)
    run(shift, 2000)
    expect(m.controls.health).toBe(1)
  })

  it('breaks at full heat (20 spins), and spins are NOT slowed by the engine', () => {
    const { shift, m } = machineShift(6)
    const events = spins(shift, 25)
    expect(ofType(events, 'breakdown')).toEqual([{ type: 'breakdown', machine: 'controls' }])
    expect(ofType(events, 'spin')).toHaveLength(25)
    expect(m.controls).toMatchObject({ health: 0, broken: true })
  })

  it('controlsCoolMult speeds the cooling (Gear Lubrication)', () => {
    const { shift, m } = machineShift(6, { modifiers: { controlsCoolMult: 2 } })
    spins(shift, 10)
    run(shift, 400, 16)
    expect(m.controls.health).toBeCloseTo(0.7)
  })
})

describe('repair and cooldown', () => {
  it('repair → health 1, not broken, a "repaired" event, cooldown max(8, 20 − (rank − unlock)) s', () => {
    const cases: [rank: number, seconds: number][] = [
      [6, 20],
      [10, 16],
      [20, 8],
      [40, 8],
    ]
    for (const [rank, seconds] of cases) {
      const { shift, m } = machineShift(rank)
      spins(shift, 20)
      shift.act({ type: 'repair', machine: 'controls' })
      expect(shift.takeEvents()).toEqual([{ type: 'repaired', machine: 'controls' }])
      expect(m.controls).toMatchObject({ health: 1, broken: false, cooldownMs: seconds * 1000 })
    }
    // laser (unlock 4) at rank 10: max(8, 20 − 6) = 14 s, as v1's PRD example
    const { shift, m } = machineShift(10)
    run(shift, 400)
    zapFloor(shift, 25)
    shift.act({ type: 'repair', machine: 'laser' })
    expect(m.laser.cooldownMs).toBe(14000)
  })

  it('repair on a machine that is not broken (or locked) is rejected', () => {
    const { shift, m } = machineShift(4)
    shift.takeEvents()
    shift.act({ type: 'repair', machine: 'laser' })
    shift.act({ type: 'repair', machine: 'controls' }) // locked at rank 4
    expect(shift.takeEvents()).toEqual([
      { type: 'reject', action: 'repair' },
      { type: 'reject', action: 'repair' },
    ])
    expect(m.laser.cooldownMs).toBe(0)
  })

  it('during the cooldown the meter moves but stays above its break point; after it, it can break again', () => {
    const { shift, m } = machineShift(6)
    spins(shift, 20)
    shift.act({ type: 'repair', machine: 'controls' })
    shift.takeEvents()
    let events = spins(shift, 40)
    expect(ofType(events, 'breakdown')).toEqual([])
    expect(m.controls).toMatchObject({ broken: false })
    expect(m.controls.health).toBeCloseTo(0.05) // the margin above full heat
    run(shift, 20000) // the cooldown runs out (and it cools down meanwhile)
    expect(m.controls.cooldownMs).toBe(0)
    events = spins(shift, 20)
    expect(ofType(events, 'breakdown')).toEqual([{ type: 'breakdown', machine: 'controls' }])
  })

  it('the cooldown counts down with time', () => {
    const { shift, m } = machineShift(6)
    spins(shift, 20)
    shift.act({ type: 'repair', machine: 'controls' })
    run(shift, 5000)
    expect(m.controls.cooldownMs).toBe(15000)
  })

  it('breakdownCooldownMult stretches the cooldown', () => {
    const { shift, m } = machineShift(6, { modifiers: { breakdownCooldownMult: 1.5 } })
    spins(shift, 20)
    shift.act({ type: 'repair', machine: 'controls' })
    expect(m.controls.cooldownMs).toBe(30000)
  })

  it('a repaired visor gets a fresh grace', () => {
    const { shift, m } = machineShift(2)
    run(shift, 10100)
    expect(m.visor.broken).toBe(true)
    shift.act({ type: 'repair', machine: 'visor' })
    run(shift, 5000)
    expect(m.visor.health).toBe(1)
  })
})

describe('at the console mid-shift: break-progress pauses (Muzzy, 2026-10-18)', () => {
  it('the visor does not fade over a long stay, and fades again as normal once back', () => {
    const { shift, m } = machineShift(6)
    run(shift, 4000) // 4 s of its 5 s grace used
    shift.act({ type: 'console', on: true })
    run(shift, 60000)
    expect(m.visor).toMatchObject({ health: 1, broken: false })
    shift.act({ type: 'console', on: false })
    run(shift, 1000 + 2500) // the last 1 s of grace (it stood still), then half the fade
    expect(m.visor.health).toBeCloseTo(1 - 0.9 / 2, 5)
  })

  it('heat does not build at the console; the controls still cool', () => {
    const { shift, m } = machineShift(6)
    spins(shift, 10) // heat 0.5
    shift.act({ type: 'console', on: true })
    spins(shift, 30) // (input is off there anyway — but even if a turn got through, no heat)
    expect(m.controls.health).toBeCloseTo(0.5)
    run(shift, 400) // 200 ms delay, then 0.5/s for 200 ms: cooling keeps going
    expect(m.controls.health).toBeCloseTo(0.6)
    shift.act({ type: 'console', on: false })
    spins(shift, 2)
    expect(m.controls.health).toBeCloseTo(0.5)
  })

  it('zaps do not drain the laser at the console; back at the tank they do', () => {
    const { shift, m } = machineShift(6)
    run(shift, 400)
    shift.act({ type: 'console', on: true })
    zapFloor(shift, 3)
    expect(m.laser.health).toBe(1)
    shift.act({ type: 'console', on: false })
    zapFloor(shift, 3, 3)
    expect(m.laser.health).toBeCloseTo(1 - 3 * 0.04)
  })

  it('repair cooldowns do not run down at the console', () => {
    const { shift, m } = machineShift(6)
    spins(shift, 20)
    shift.act({ type: 'console', on: true })
    shift.act({ type: 'repair', machine: 'controls' }) // the repair itself still works there
    expect(m.controls.cooldownMs).toBe(20000)
    run(shift, 10000)
    expect(m.controls.cooldownMs).toBe(20000)
    shift.act({ type: 'console', on: false })
    run(shift, 5000)
    expect(m.controls.cooldownMs).toBe(15000)
  })

  it('pressure, cracks and falling still run at the console (only the machines pause)', () => {
    const a = machineShift(6), b = machineShift(6)
    b.shift.act({ type: 'console', on: true })
    run(a.shift, 8000); run(b.shift, 8000)
    expect(b.shift.state.pressure).toBe(a.shift.state.pressure)
    expect([...b.shift.state.grid]).toEqual([...a.shift.state.grid])
    expect(b.shift.state.cracks).toEqual(a.shift.state.cracks)
  })
})

describe('several machines', () => {
  it('can be broken at once', () => {
    const { shift, m } = machineShift(6)
    run(shift, 400)
    const events = [...zapFloor(shift, 25), ...spins(shift, 20), ...run(shift, 10000)]
    expect(ofType(events, 'breakdown').map((e) => e.machine)).toEqual(['laser', 'controls', 'visor'])
    expect(m.laser.broken && m.visor.broken && m.controls.broken).toBe(true)
    shift.act({ type: 'repair', machine: 'visor' })
    expect(m.laser.broken && !m.visor.broken && m.controls.broken).toBe(true)
  })
})

describe('during a rupture', () => {
  // The first crack (12 s) ruptures the tank at once; the rupture then lasts a long time.
  function ruptureConfig(): ShiftConfig {
    const config = calmConfig()
    config.integrity.drainPerCrackPerSec = 1000
    config.cracks.everyMsAtEmpty = 12000
    config.cracks.everyMsAtFull = 12000
    config.rupture.drainMs = 1e7
    return config
  }

  it('meters freeze and nothing new breaks; repairs still work', () => {
    const { shift, m } = machineShift(6, {}, ruptureConfig())
    run(shift, 400)
    zapFloor(shift, 20) // laser 0.2
    let events = run(shift, 12000) // the visor breaks at ~10 s, then the tank ruptures
    expect(ofType(events, 'breakdown').map((e) => e.machine)).toEqual(['visor'])
    expect(shift.state.phase).toBe('rupture')
    const laser = m.laser.health
    events = [...zapFloor(shift, 10, 20), ...spins(shift, 30), ...run(shift, 20000)]
    expect(ofType(events, 'pop').length).toBeGreaterThan(0) // zapping still works…
    expect(ofType(events, 'breakdown')).toEqual([]) // …but the laser doesn't drain or break
    expect(m.laser.health).toBe(laser)
    expect(m.controls.health).toBe(1)
    shift.act({ type: 'repair', machine: 'visor' })
    expect(shift.takeEvents()).toEqual([{ type: 'repaired', machine: 'visor' }])
    run(shift, 20000)
    expect(m.visor).toMatchObject({ health: 1, broken: false })
  })
})

describe('no upgrades, ranks 0–1: exactly as before breakdowns', () => {
  // The busy bot from fullShift/upgrades tests: spins, turns, fast-drops, pops anything ready.
  function playShift(seed: number, rank: number, extra: Partial<ShiftOptions> = {}) {
    const shift = createShift(realConfig(), { seed, rank, ...extra })
    const bot = createRng(seed * 7 + 1)
    const log: ShiftEvent[] = []
    let ms = 0
    while (shift.state.status === 'playing' && ms < 20 * 60 * 1000) {
      const roll = bot.next()
      if (roll < 0.25) shift.act({ type: 'spin', dir: bot.chance(0.5) ? 1 : -1 })
      else if (roll < 0.3) shift.act({ type: 'rotate', dir: bot.chance(0.5) ? 1 : -1 })
      else if (roll < 0.33) shift.act({ type: 'softDrop', on: bot.chance(0.8) })
      for (const g of shift.state.groups.values()) {
        if (g.ready) {
          const i = g.cells[0]
          shift.act({ type: 'pop', x: i % shift.state.width, y: Math.floor(i / shift.state.width) })
          break
        }
      }
      shift.tick(50)
      ms += 50
      log.push(...shift.takeEvents())
    }
    return { log, score: shift.state.score, grid: [...shift.state.grid] }
  }

  it('same events, score and tank with or without the breakdowns tuning', () => {
    for (const rank of [0, 1]) {
      for (const seed of [3, 11]) {
        expect(playShift(seed, rank, { breakdowns: breakdowns() })).toEqual(playShift(seed, rank))
      }
    }
  })

  it('at rank 2 the only difference is the visor (it has no rule effect in the engine)', () => {
    const plain = playShift(5, 2)
    const withVisor = playShift(5, 2, { breakdowns: breakdowns() })
    const rest = withVisor.log.filter((e) => e.type !== 'breakdown')
    expect(rest).toEqual(plain.log)
    expect(withVisor.score).toBe(plain.score)
  })
})

describe('each breakdown modifier changes only its own value', () => {
  // A scripted stretch at rank 6 that moves every meter and repairs the controls once.
  function scenario(modifiers: Partial<Modifiers> = {}) {
    const { shift, m } = machineShift(6, { modifiers })
    spins(shift, 20) // controls break
    shift.act({ type: 'repair', machine: 'controls' })
    spins(shift, 10) // heat 0.5, during the cooldown
    run(shift, 800)
    zapFloor(shift, 5) // laser drains
    run(shift, 6000) // the visor fades for a while; the controls cool
    const s = shift.state
    return { machines: structuredClone(m), score: s.score, grid: [...s.grid], cracks: s.cracks.length }
  }

  const base = scenario()
  const cases: [keyof Modifiers, number, MachineId, 'health' | 'cooldownMs'][] = [
    ['laserDrainMult', 0.5, 'laser', 'health'],
    ['visorGraceMult', 1.2, 'visor', 'health'],
    ['controlsCoolMult', 0.1, 'controls', 'health'],
    ['breakdownCooldownMult', 2, 'controls', 'cooldownMs'],
  ]
  for (const [name, value, machine, field] of cases) {
    it(`${name} only changes ${machine}.${field}`, () => {
      const got = scenario({ [name]: value })
      expect(got.machines[machine][field]).not.toBe(base.machines[machine][field])
      got.machines[machine][field] = base.machines[machine][field]
      expect(got).toEqual(base)
    })
  }
})
