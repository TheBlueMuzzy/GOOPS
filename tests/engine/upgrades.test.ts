// F22: upgrades plug into the engine as modifiers (passives) and ability hooks (actives),
// proven by the two test-only upgrades in content/tuning/upgrades.json.
import { describe, expect, it } from 'vitest'
import upgradesJson from '../../content/tuning/upgrades.json'
import { NEUTRAL_MODIFIERS, NO_FEWER_REPAIR_STEPS, clampModifiers, createShift, playableUpgrades, resolveUpgrades } from '../../src/engine'
import type { AbilitySpec, ShiftConfig, ShiftEngine, ShiftEvent, ShiftOptions, UpgradeBook } from '../../src/engine'
import { ABILITY_EFFECTS } from '../../src/engine/abilities'
import { isFewerStepsName, isModifierName } from '../../src/engine/upgrades'
import { createRng } from '../../src/engine/rng'
import { dropPiece, idx, ofType, oneShapeConfig, realConfig, sealACrack, straightLineCracks, tank, tickUntil } from './helpers'

const book = upgradesJson as UpgradeBook
const STURDY = 'sturdyTankTest'
const LOW = 'lowCracksTest'

// The same busy bot as fullShift.test.ts: spins, turns, fast-drops, pops anything ready.
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
    else if (roll < 0.34) shift.act({ type: 'hold' })
    for (const g of shift.state.groups.values()) {
      if (g.ready) {
        const i = g.cells[0]
        shift.act({ type: 'pop', x: i % shift.state.width, y: Math.floor(i / shift.state.width) })
        break
      }
    }
    shift.tick(50)
    ms += 50
    const events = shift.takeEvents()
    log.push(...events)
    if (events.some((e) => e.type === 'spawn') && bot.chance(0.7)) shift.act({ type: 'softDrop', on: true })
  }
  const s = shift.state
  return { log, ms, score: s.score, integrity: s.integrity, sealed: s.cracksSealed, grid: [...s.grid] }
}

// One-cell colour-1 pieces hanging at the top; integrity drain as given (0 = the tank never ruptures).
function calmConfig(drain = 0): ShiftConfig {
  const config = oneShapeConfig([[0, 0]])
  config.integrity.drainPerCrackPerSec = drain
  return config
}

function run(shift: ShiftEngine, ms: number): ShiftEvent[] {
  const events: ShiftEvent[] = []
  for (let t = 0; t < ms && shift.state.status === 'playing'; t += 10) {
    shift.tick(10)
    events.push(...shift.takeEvents())
  }
  return events
}

describe('no upgrades = the shift plays exactly as before', () => {
  for (const [seed, rank] of [[1, 1], [2, 12], [42, 5]]) {
    it(`seed ${seed}, rank ${rank}: same events, score and tank with or without an empty upgrade set`, () => {
      const plain = playShift(seed, rank)
      const none = resolveUpgrades(book, {})
      expect(playShift(seed, rank, { modifiers: {} })).toEqual(plain)
      expect(playShift(seed, rank, { modifiers: { ...NEUTRAL_MODIFIERS }, abilities: [] })).toEqual(plain)
      expect(playShift(seed, rank, { modifiers: none.modifiers, abilities: none.abilities })).toEqual(plain)
      expect(plain.log.some((e) => e.type === 'end')).toBe(true)
    }, 60000)
  }

  it('a shift without upgrades has no abilities and no running effects', () => {
    const shift = createShift(realConfig(), { seed: 1, rank: 0 })
    expect(shift.state.abilities).toEqual([])
    expect(shift.state.effects).toEqual({})
  })
})

describe('resolveUpgrades (upgrades.json → modifiers, abilities, features)', () => {
  it('owning nothing = neutral modifiers, no abilities, no features', () => {
    expect(resolveUpgrades(book, {})).toEqual({ modifiers: NEUTRAL_MODIFIERS, abilities: [], features: {}, fewerRepairSteps: NO_FEWER_REPAIR_STEPS })
  })

  it('Sturdy tank halves the integrity drain modifier; levels above max are capped', () => {
    expect(resolveUpgrades(book, { [STURDY]: 1 }).modifiers).toEqual({ ...NEUTRAL_MODIFIERS, integrityDrainMult: 0.5 })
    expect(resolveUpgrades(book, { [STURDY]: 9 }).modifiers.integrityDrainMult).toBe(0.5)
    expect(resolveUpgrades(book, { [STURDY]: 0 }).modifiers).toEqual(NEUTRAL_MODIFIERS)
  })

  it('an active only comes along when owned AND equipped', () => {
    expect(resolveUpgrades(book, { [LOW]: 1 }).abilities).toEqual([])
    expect(resolveUpgrades(book, {}, [LOW]).abilities).toEqual([])
    expect(resolveUpgrades(book, { [LOW]: 1 }, [LOW, LOW, 'nope']).abilities).toEqual([
      { id: LOW, effect: 'lowCracks', chargePerSecond: 0, chargePerSeal: 0.5, params: { cracks: 3, rows: 4 } },
    ])
  })

  it('passives multiply ("mul") or add ("add"), then get clamped', () => {
    const test: UpgradeBook = {
      upgrades: [
        { id: 'a', name: 'a', type: 'passive', rank: 0, maxLevel: 3, effects: [{ modifier: 'fallSpeedMult', op: 'mul', byLevel: [1.1, 1.2, 1.5] }] },
        { id: 'b', name: 'b', type: 'passive', rank: 0, maxLevel: 2, effects: [{ modifier: 'fallSpeedMult', op: 'add', byLevel: [0.5] }] },
        { id: 'c', name: 'c', type: 'passive', rank: 0, maxLevel: 1, effects: [{ modifier: 'crackEveryMult', op: 'mul', byLevel: [-4] }] },
        { id: 'w', name: 'w', type: 'feature', rank: 0, maxLevel: 1, feature: 'nextWindow' },
      ],
    }
    const r = resolveUpgrades(test, { a: 2, b: 2, c: 1, w: 1 })
    expect(r.modifiers.fallSpeedMult).toBeCloseTo((1 + 0.5) * 1.2, 9) // (1 + adds) × muls; b's short list keeps its last value at level 2
    expect(r.modifiers.crackEveryMult).toBe(0.1) // never negative: clamped to the safety floor
    expect(r.features).toEqual({ nextWindow: 1 })
  })

  it('repair shortcuts ("Quick Fix" hook): whole steps off a repair, summed per machine, rounded down, never negative', () => {
    const test: UpgradeBook = {
      upgrades: [
        { id: 'q', name: 'q', type: 'passive', rank: 0, maxLevel: 2, effects: [{ modifier: 'laserRepairFewerSteps', op: 'add', byLevel: [1, 2] }] },
        { id: 'v', name: 'v', type: 'passive', rank: 0, maxLevel: 1, effects: [{ modifier: 'visorRepairFewerSteps', op: 'add', byLevel: [1.7] }] },
        { id: 'x', name: 'x', type: 'passive', rank: 0, maxLevel: 1, effects: [{ modifier: 'controlsRepairFewerSteps', op: 'add', byLevel: [-3] }] },
      ],
    }
    expect(resolveUpgrades(test, { q: 1 }).fewerRepairSteps).toEqual({ laser: 1, visor: 0, controls: 0 })
    expect(resolveUpgrades(test, { q: 2, v: 1, x: 1 }).fewerRepairSteps).toEqual({ laser: 2, visor: 1, controls: 0 })
    expect(resolveUpgrades(test, { q: 2 }).modifiers).toEqual(NEUTRAL_MODIFIERS) // not a multiplier: no modifier changes
  })

  it('upgrades.json is valid: known modifiers and effects, and the game never lists test-only upgrades', () => {
    for (const u of book.upgrades) {
      expect(['passive', 'active', 'feature']).toContain(u.type)
      for (const e of u.effects ?? []) {
        expect(isModifierName(e.modifier) || isFewerStepsName(e.modifier), `${u.id}: ${e.modifier}`).toBe(true)
        expect(['mul', 'add']).toContain(e.op)
        expect(e.byLevel.length).toBeGreaterThan(0)
      }
      if (u.type === 'active') expect(ABILITY_EFFECTS[u.ability!.effect], u.id).toBeTypeOf('function')
    }
    expect(playableUpgrades(book).map((u) => u.id)).not.toContain(STURDY)
    expect(playableUpgrades(book).map((u) => u.id)).not.toContain(LOW)
  })
})

describe('modifiers are clamped and validated', () => {
  it('no negative or zero speeds, broken numbers back to neutral, unknown names dropped', () => {
    const m = clampModifiers({ fallSpeedMult: -3, ruptureDrainTimeMult: 0, crackEveryMult: NaN, pressureRiseTimeMult: Infinity, integrityDrainMult: 1e9, made_up: 5 } as never)
    expect(m.fallSpeedMult).toBe(0.1)
    expect(m.ruptureDrainTimeMult).toBe(0.1)
    expect(m.crackEveryMult).toBe(1)
    expect(m.pressureRiseTimeMult).toBe(1)
    expect(m.integrityDrainMult).toBe(10)
    expect(Object.keys(m).sort()).toEqual(Object.keys(NEUTRAL_MODIFIERS).sort())
    expect(clampModifiers({ leftoverPenaltyMult: '2' } as never).leftoverPenaltyMult).toBe(1)
  })

  it('a shift given silly modifiers still plays: the piece falls down, numbers stay in range', () => {
    const config = oneShapeConfig([[0, 0]], { msPerRow: 780 })
    const shift = createShift(config, { seed: 3, rank: 0, modifiers: { fallSpeedMult: -5, pressureRiseTimeMult: -1, crackEveryMult: 0 } })
    const events = run(shift, 9000) // clamped to 0.1× speed: one row per 7.8 s
    expect(ofType(events, 'step').length).toBeGreaterThan(0)
    expect(shift.state.pressure).toBeGreaterThanOrEqual(0)
    expect(shift.state.pressure).toBeLessThanOrEqual(1)
    expect(Number.isFinite(shift.state.integrity)).toBe(true)
  })
})

describe('each modifier changes exactly its own tuning value', () => {
  it('integrityDrainMult (Sturdy tank, test): open cracks wear the tank half as fast', () => {
    const config = calmConfig(0.004)
    const sturdy = resolveUpgrades(book, { [STURDY]: 1 }).modifiers
    const a = createShift(config, { seed: 5, rank: 0 })
    const b = createShift(config, { seed: 5, rank: 0, modifiers: sturdy })
    const ea = run(a, 20000)
    const eb = run(b, 20000)
    expect(ofType(eb, 'crack')).toEqual(ofType(ea, 'crack')) // same cracks at the same times…
    expect(a.state.cracks.length).toBeGreaterThan(0)
    expect(1 - b.state.integrity).toBeCloseTo((1 - a.state.integrity) * 0.5, 9) // …half the wear
  })

  it('pressureRiseTimeMult: 2 = pressure rises half as fast', () => {
    const shift = createShift(calmConfig(), { seed: 1, rank: 0, modifiers: { pressureRiseTimeMult: 2 } })
    shift.tick(7500)
    expect(shift.state.pressure).toBeCloseTo(0.05, 6)
  })

  it('crackEveryMult: 2 = the first crack comes twice as late', () => {
    const config = straightLineCracks(calmConfig(), 5000) // 5 s between cracks at 0% pressure
    config.pressure.riseMsToFull = 1e12 // pressure stays ~0, so the crack interval stays 5 s
    const first = (mult: number) => {
      const shift = createShift(config, { seed: 1, rank: 0, modifiers: { crackEveryMult: mult } })
      let t = 0
      while (shift.state.cracks.length === 0 && t < 30000) {
        shift.tick(10)
        t += 10
      }
      return t
    }
    expect(first(1)).toBeCloseTo(5000, -2)
    expect(first(2)).toBeCloseTo(10000, -2)
  })

  it('sealVentMult: 2 = each seal vents twice as much pressure', () => {
    const vent = (mult: number) => {
      const config = calmConfig()
      config.pressure.riseMsToFull = 75000
      config.pop.refundMsPerCell = 0 // only the seal vents: no per-cell or size-tier refund
      config.pop.refundTierMs = 0
      config.cracks.sealRefundMs = 1000
      const floor = '2'.repeat(30)
      const shift = createShift(config, { seed: 4, rank: 0, startGrid: tank([floor, floor]), modifiers: { sealVentMult: mult } })
      const s = shift.state
      tickUntil(shift, () => s.cracks.length > 0)
      const crack = s.cracks[0]
      while (s.spin !== crack.x) shift.act({ type: 'spin', dir: 1 })
      dropPiece(shift, config)
      tickUntil(shift, () => !!s.groups.get(s.groupOf[idx(crack.x, crack.y)])?.ready)
      shift.takeEvents()
      const before = s.pressure
      shift.act({ type: 'pop', x: crack.x, y: crack.y })
      expect(ofType(shift.takeEvents(), 'pop')[0].sealed).toEqual([crack.id])
      return before - s.pressure
    }
    expect(vent(1)).toBeCloseTo(1000 / 75000, 9)
    expect(vent(2)).toBeCloseTo(2000 / 75000, 9)
  })

  it('fallSpeedMult: 2 = the piece steps down twice as often', () => {
    const steps = (mult: number) => {
      const shift = createShift(oneShapeConfig([[0, 0]], { msPerRow: 780 }), { seed: 1, rank: 0, modifiers: { fallSpeedMult: mult } })
      return ofType(run(shift, 4000), 'step').length
    }
    expect(steps(1)).toBe(5)
    expect(steps(2)).toBe(10)
  })

  it('ruptureDrainTimeMult (Muzzy: slower depressurise): 2 = pressure drains half as fast after a rupture', () => {
    const drop = (mult: number) => {
      const config = calmConfig(1000) // the first crack ruptures the tank at once
      config.pressure.riseMsToFull = 10000
      const shift = createShift(config, { seed: 1, rank: 0, modifiers: { ruptureDrainTimeMult: mult } })
      tickUntil(shift, () => shift.state.phase === 'rupture')
      const before = shift.state.pressure
      shift.tick(500)
      return before - shift.state.pressure
    }
    expect(drop(1)).toBeCloseTo(500 / 5000, 6)
    expect(drop(2)).toBeCloseTo(500 / 10000, 6)
  })

  it('leftoverPenaltyMult: 0.5 = leftover goop costs half', () => {
    const config = calmConfig(1000)
    config.pressure.riseMsToFull = 10000
    const shift = createShift(config, { seed: 1, rank: 0, startGrid: tank(['2.2.2.2']), modifiers: { leftoverPenaltyMult: 0.5 } })
    tickUntil(shift, () => shift.state.status !== 'playing')
    const left = shift.state.grid.reduce((n, c) => n + (c !== 0 ? 1 : 0), 0)
    expect(left).toBeGreaterThan(0)
    expect(shift.state.leftoverPenalty).toBe(Math.floor(left * config.score.leftoverPerCell * 0.5))
  })
})

describe('Low cracks (test): an active ability', () => {
  const abilities = resolveUpgrades(book, { [LOW]: 1 }, [LOW]).abilities

  it('charges from seals (2 seals = full), can not fire before ready, fires once, puts the next 3 cracks low, then back to normal', () => {
    const config = calmConfig()
    const shift = createShift(config, { seed: 2, rank: 0, abilities })
    const s = shift.state
    const ability = () => s.abilities![0]
    expect(ability()).toEqual({ id: LOW, effect: 'lowCracks', charge: 0, ready: false })

    shift.takeEvents() // the first spawn
    // Not ready: rejected, nothing fires.
    shift.act({ type: 'ability', id: LOW })
    expect(shift.takeEvents()).toEqual([{ type: 'reject', action: 'ability' }])

    // Time alone doesn't charge it (chargePerSecond 0); one seal = half.
    run(shift, 2000)
    expect(ability().charge).toBe(0)
    let events = sealACrack(shift, config)
    expect(ability()).toMatchObject({ charge: 0.5, ready: false })
    expect(ofType(events, 'abilityReady')).toEqual([])
    shift.act({ type: 'ability', id: LOW })
    expect(ofType(shift.takeEvents(), 'reject')).toHaveLength(1)

    // Second seal = ready (one 'abilityReady').
    events = sealACrack(shift, config)
    expect(ability()).toMatchObject({ charge: 1, ready: true })
    expect(ofType(events, 'abilityReady')).toEqual([{ type: 'abilityReady', id: LOW }])

    // Fire: charge back to 0, the effect starts. Firing again straight away is rejected.
    shift.act({ type: 'ability', id: LOW })
    expect(shift.takeEvents()).toEqual([{ type: 'ability', id: LOW }])
    expect(ability()).toMatchObject({ charge: 0, ready: false })
    expect(s.effects!.lowCracks).toEqual({ id: LOW, left: 3, rows: 4 })
    shift.act({ type: 'ability', id: LOW })
    expect(shift.takeEvents()).toEqual([{ type: 'reject', action: 'ability' }])

    // The next 3 cracks form in the bottom 4 rows; the effect ends right after the 3rd.
    const log: ShiftEvent[] = []
    while (ofType(log, 'crack').length < 3) log.push(...run(shift, 100))
    const low = ofType(log, 'crack').slice(0, 3)
    for (const { crack } of low) expect(crack.y).toBeGreaterThanOrEqual(s.height - 4)
    const end = log.findIndex((e) => e.type === 'abilityEnd')
    expect(log[end]).toEqual({ type: 'abilityEnd', id: LOW })
    expect(end).toBe(log.indexOf(low[2]) + 1)
    expect(s.effects!.lowCracks).toBeUndefined()

    // Back to normal: later cracks form anywhere at or below the pop line again (pressure is high by now).
    const later: ShiftEvent[] = []
    while (ofType(later, 'crack').length < 12) later.push(...run(shift, 100))
    expect(ofType(later, 'crack').some(({ crack }) => crack.y < s.height - 4)).toBe(true)
    expect(ofType(later, 'abilityEnd')).toEqual([])
  }, 30000)

  it('charge from time pauses during a rupture, and a ready ability can not fire then (charge kept)', () => {
    const timed: AbilitySpec[] = [{ ...abilities[0], chargePerSecond: 0.1 }]
    const config = calmConfig(1000) // the first crack ruptures the tank
    const shift = createShift(config, { seed: 1, rank: 0, abilities: timed })
    const s = shift.state
    tickUntil(shift, () => s.phase === 'rupture', 60000, 10)
    const charge = s.abilities![0].charge
    expect(charge).toBeGreaterThan(0.3) // the first crack came after ~5 s of charging
    shift.tick(1000)
    expect(s.abilities![0].charge).toBe(charge)

    const ready = createShift(config, { seed: 1, rank: 0, abilities: [{ ...abilities[0], chargePerSecond: 1 }] })
    tickUntil(ready, () => ready.state.phase === 'rupture', 60000, 10)
    expect(ready.state.abilities![0].ready).toBe(true)
    ready.takeEvents()
    ready.act({ type: 'ability', id: LOW })
    expect(ofType(ready.takeEvents(), 'reject')).toHaveLength(1)
    expect(ready.state.abilities![0]).toMatchObject({ charge: 1, ready: true })
  })

  it('broken charge rates from content are treated as 0 (never negative)', () => {
    const shift = createShift(calmConfig(), { seed: 1, rank: 0, abilities: [{ ...abilities[0], chargePerSecond: -1, chargePerSeal: NaN }] })
    run(shift, 3000)
    expect(shift.state.abilities![0].charge).toBe(0)
  })
})

describe('resolveUpgrades — review fixes', () => {
  const passive = (id: string, op: 'add' | 'mul', v: number) =>
    ({ id, name: id, type: 'passive', rank: 0, maxLevel: 1, effects: [{ modifier: 'integrityDrainMult', op, byLevel: [v] }] })

  it('mixing add and mul gives the same answer whatever the JSON order: (1 + adds) × muls', () => {
    const a = { upgrades: [passive('A', 'add', 0.2), passive('B', 'mul', 0.5)] } as unknown as UpgradeBook
    const b = { upgrades: [passive('B', 'mul', 0.5), passive('A', 'add', 0.2)] } as unknown as UpgradeBook
    const owned = { A: 1, B: 1 }
    expect(resolveUpgrades(a, owned).modifiers.integrityDrainMult).toBeCloseTo(0.6)
    expect(resolveUpgrades(b, owned).modifiers.integrityDrainMult).toBeCloseTo(0.6)
  })

  it('a typo in the file (no maxLevel, no byLevel) is survived, never NaN or a crash', () => {
    const book = { upgrades: [
      { id: 'noMax', name: 'x', type: 'feature', rank: 0 },
      { id: 'noLevels', name: 'y', type: 'passive', rank: 0, maxLevel: 2, effects: [{ modifier: 'integrityDrainMult', op: 'mul' }] },
    ] } as unknown as UpgradeBook
    const r = resolveUpgrades(book, { noMax: 3, noLevels: 1 })
    expect(r.features.noMax).toBe(1)
    expect(r.modifiers.integrityDrainMult).toBe(1)
  })
})
