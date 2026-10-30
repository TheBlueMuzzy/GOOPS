// F22: upgrades plug into the engine as modifiers (passives) and ability hooks (actives),
// proven by the two test-only upgrades in content/tuning/upgrades.json.
import { describe, expect, it } from 'vitest'
import upgradesJson from '../../content/tuning/upgrades.json'
import en from '../../content/text/en.json'
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
      if (u.type === 'active') expect(typeof ABILITY_EFFECTS[u.ability!.effect], u.id).toBe('function')
    }
    expect(playableUpgrades(book).map((u) => u.id)).not.toContain(STURDY)
    expect(playableUpgrades(book).map((u) => u.id)).not.toContain(LOW)
  })
})

describe('the shop’s upgrades (F34: ranks 2–9, design/upgrades-map.md "F33 decisions")', () => {
  const shop = playableUpgrades(book)
  it('one upgrade for each rank 2–9, then ranks 10–38 (F42 actives + slots, F43 passives, F48 Quick Fix), in that order, with v1’s max levels', () => {
    expect(shop.map((u) => [u.id, u.rank, u.maxLevel])).toEqual([
      ['circuitStabilizer', 2, 4], ['autoPopper', 3, 4], ['capacitorEfficiency', 4, 4], ['cooldownBooster', 5, 3],
      ['gearLubrication', 6, 4], ['focusMode', 7, 2], ['denseGoop', 8, 4], ['pressureControl', 9, 8],
      ['junkUniformer', 10, 4], ['goopSwap', 12, 4], ['goopDump', 15, 3], ['sealingBonus', 18, 4], ['activeSlot', 20, 1],
      ['tougherTank', 22, 4], ['goopColorizer', 25, 3], ['quickFix', 28, 2], ['slowCracks', 30, 4], ['crackMatcher', 32, 4],
      ['crackDown', 35, 3], ['activeSlot2', 38, 1],
    ])
  })

  it('F42 actives: v1’s numbers per level and v1’s charging (15 / 25 / 30 s to full, +0.25 a seal)', () => {
    const at = (id: string, level: number) => resolveUpgrades(book, { [id]: level }, [id]).abilities[0]
    expect([1, 2, 3].map((n) => at('goopDump', n).params.waves)).toEqual([1, 2, 3])
    expect(at('goopDump', 1).params).toMatchObject({ cellsPerWave: 18, cellMs: 80, waveMs: 600 })
    expect([1, 2, 3].map((n) => at('goopColorizer', n).params.pieces)).toEqual([6, 7, 8])
    expect([1, 2, 3].map((n) => at('crackDown', n).params)).toEqual([{ cracks: 3, rows: 4 }, { cracks: 5, rows: 4 }, { cracks: 7, rows: 4 }])
    const secondsToFull = { goopDump: 15, goopColorizer: 25, crackDown: 30 }
    for (const [id, s] of Object.entries(secondsToFull)) {
      expect(1 / at(id, 1).chargePerSecond, id).toBeCloseTo(s, 1)
      expect(at(id, 1).chargePerSeal, id).toBe(0.25)
    }
    expect([at('goopDump', 1).effect, at('goopColorizer', 1).effect, at('crackDown', 1).effect]).toEqual(['goopDump', 'colorize', 'lowCracks'])
  })

  it('every modifier is a name the shift (or the game, for Focus Mode) reads, with a value for every level', () => {
    for (const u of shop) {
      for (const e of u.effects ?? []) {
        expect(isModifierName(e.modifier) || isFewerStepsName(e.modifier), `${u.id}: ${e.modifier}`).toBe(true)
        expect(e.byLevel.length, u.id).toBe(u.maxLevel)
      }
      if (u.ability) expect(u.ability.byLevel.length, u.id).toBe(u.maxLevel)
    }
  })

  it('each level helps a little more than the last (Dense Goop: pieces fall faster — the self-chosen challenge)', () => {
    const at = (level: number) => (id: string) => resolveUpgrades(book, { [id]: level })
    const grows = (id: string, read: (r: ReturnType<typeof resolveUpgrades>) => number, dir: 1 | -1) => {
      const values = Array.from({ length: shop.find((u) => u.id === id)!.maxLevel + 1 }, (_, level) => read(at(level)(id)))
      for (let i = 1; i < values.length; i++) expect(dir * (values[i] - values[i - 1]), `${id} level ${i}`).toBeGreaterThan(0)
    }
    grows('circuitStabilizer', (r) => r.modifiers.visorGraceMult, 1)
    grows('autoPopper', (r) => r.modifiers.ruptureDrainTimeMult, 1)
    grows('capacitorEfficiency', (r) => r.modifiers.laserDrainMult, -1)
    grows('gearLubrication', (r) => r.modifiers.controlsCoolMult, 1)
    grows('focusMode', (r) => r.modifiers.consoleTimeScaleMult, -1)
    grows('denseGoop', (r) => r.modifiers.fallSpeedMult, 1)
    grows('pressureControl', (r) => r.modifiers.pressureRiseTimeMult, 1)
    // F43 / F48
    grows('junkUniformer', (r) => r.modifiers.junkSameColorChance, 1)
    grows('goopSwap', (r) => r.modifiers.swapHoldTimeMult, -1)
    grows('sealingBonus', (r) => r.modifiers.abilityChargePerSealMult, 1)
    grows('tougherTank', (r) => r.modifiers.integrityDrainMult, -1)
    grows('slowCracks', (r) => r.modifiers.crackEveryMult, 1)
    grows('crackMatcher', (r) => r.modifiers.crackColorBias, 1)
    grows('quickFix', (r) => r.fewerRepairSteps.laser + r.fewerRepairSteps.visor + r.fewerRepairSteps.controls, 1)
  })

  it('F43: the per-level numbers (v1’s steps): junk 0.1 a level, crack colour 0.25 a level, ×1.15 seal charge, ×0.875 wear, ×1.15 crack time', () => {
    const m = (id: string, level: number) => resolveUpgrades(book, { [id]: level }).modifiers
    expect([1, 2, 3, 4].map((n) => m('junkUniformer', n).junkSameColorChance)).toEqual([0.1, 0.2, 0.3, 0.4])
    expect([1, 2, 3, 4].map((n) => m('crackMatcher', n).crackColorBias)).toEqual([0.25, 0.5, 0.75, 1])
    expect(m('sealingBonus', 4).abilityChargePerSealMult).toBeCloseTo(1.6, 9)
    expect(m('tougherTank', 4).integrityDrainMult).toBeCloseTo(0.5, 9)
    expect(m('slowCracks', 4).crackEveryMult).toBeCloseTo(1.6, 9)
    expect(m('goopSwap', 4).swapHoldTimeMult).toBeCloseTo(1 / 3, 3)
    // a chance adds from 0 (not from 1 like a multiplier) — owning nothing leaves it at 0
    expect(m('junkUniformer', 0).junkSameColorChance).toBe(0)
  })

  it('F48 Quick Fix: 1 / 2 steps off every repair, adding to the max-level machine fixes', () => {
    expect(resolveUpgrades(book, { quickFix: 1 }).fewerRepairSteps).toEqual({ laser: 1, visor: 1, controls: 1 })
    expect(resolveUpgrades(book, { quickFix: 2 }).fewerRepairSteps).toEqual({ laser: 2, visor: 2, controls: 2 })
    const all = resolveUpgrades(book, { quickFix: 2, circuitStabilizer: 4, capacitorEfficiency: 4, gearLubrication: 4 }).fewerRepairSteps
    expect(all).toEqual({ laser: 3, visor: 3, controls: 3 })
    expect(resolveUpgrades(book, { quickFix: 2 }).modifiers).toEqual(NEUTRAL_MODIFIERS) // steps only, no multiplier
  })

  it('max level of each machine fix = its repair takes 1 step less (and only at max)', () => {
    const fix = { circuitStabilizer: 'visor', capacitorEfficiency: 'laser', gearLubrication: 'controls' } as const
    for (const [id, machine] of Object.entries(fix)) {
      expect(resolveUpgrades(book, { [id]: 3 }).fewerRepairSteps[machine], id).toBe(0)
      expect(resolveUpgrades(book, { [id]: 4 }).fewerRepairSteps).toEqual({ ...NO_FEWER_REPAIR_STEPS, [machine]: 1 })
    }
  })

  it('Cooldown Booster: equipped, it goes into the shift with its level’s boost (+25 / 35 / 50%) and v1’s charging', () => {
    const boosts = [1, 2, 3].map((level) => resolveUpgrades(book, { cooldownBooster: level }, ['cooldownBooster']).abilities[0])
    expect(boosts.map((a) => a.params.boost)).toEqual([0.25, 0.35, 0.5])
    expect(boosts[0]).toMatchObject({ effect: 'boostCooldowns', chargePerSecond: 0.05, chargePerSeal: 0.25 })
    expect(resolveUpgrades(book, { cooldownBooster: 1 }).abilities).toEqual([]) // owned but not equipped: stays home
  })

  it('every shop upgrade has a name and a description players read (content/text/en.json upgrades.items)', () => {
    const items = en.upgrades.items as Record<string, { name: string; desc: string }>
    for (const u of shop) {
      expect(items[u.id]?.name, u.id).toBeTruthy()
      expect(items[u.id]?.desc, u.id).toBeTruthy()
    }
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
