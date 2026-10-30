// F34 task 5: what the player owns reaches the shift — the save's levels + equipped actives → upgradesForShift →
// createShift's modifiers + abilities, the console's fewer repair steps, Focus Mode's console speed.
import { describe, expect, it } from 'vitest'
import upgradesJson from '../content/tuning/upgrades.json'
import breakdowns from '../content/tuning/breakdowns.json'
import { NEUTRAL_MODIFIERS, createShift, type UpgradeBook } from '../src/engine'
import { freshProgress, type Progress } from '../src/progress/progression'
import { upgradesForShift } from '../src/progress/upgradeShop'
import { repairSteps } from '../src/game/repairs'
import { realConfig } from './engine/helpers'

const book = upgradesJson as UpgradeBook
const owning = (owned: Record<string, number>, equipped: string[] = []): Progress => ({ ...freshProgress(), owned, equipped })
const shiftWith = (p: Progress, training = false) => {
  const up = upgradesForShift(p, training)
  return { up, shift: createShift(realConfig(), { seed: 5, rank: 9, modifiers: up.modifiers, abilities: up.abilities }) }
}

describe('upgrades reach the shift (F34 task 5)', () => {
  it('owning nothing: the shift plays exactly as without upgrades', () => {
    const { up, shift } = shiftWith(freshProgress())
    expect(up.modifiers).toEqual(NEUTRAL_MODIFIERS)
    expect(up.abilities).toEqual([])
    expect(up.fewerRepairSteps).toEqual({ laser: 0, visor: 0, controls: 0 })
    expect(shift.state.abilities).toEqual([])
  })

  it('every passive at every level: its modifier reaches createShift at that level’s number', () => {
    for (const def of book.upgrades.filter((u) => u.type === 'passive' && !u.testOnly)) {
      for (let level = 1; level <= def.maxLevel; level++) {
        const { shift } = shiftWith(owning({ [def.id]: level }))
        const mods = shift.snapshot().options.modifiers
        for (const effect of def.effects!) {
          if (effect.modifier.endsWith('RepairFewerSteps')) continue
          expect(mods[effect.modifier as keyof typeof mods], `${def.id} level ${level}`).toBeCloseTo(effect.byLevel[level - 1], 9)
        }
      }
    }
  })

  it('Pressure Control level 2: pressure really rises 10% slower in the shift', () => {
    const plain = shiftWith(freshProgress()).shift
    const pc = shiftWith(owning({ pressureControl: 2 })).shift
    plain.tick(4000); pc.tick(4000)
    expect(plain.state.pressure / pc.state.pressure).toBeCloseTo(1.1, 6)
  })

  it('Focus Mode: the console runs at 75%, then 50% / 25% with its 2 levels (Muzzy 2026-10-29)', () => {
    expect(upgradesForShift(freshProgress()).modifiers.consoleTimeScaleMult).toBe(1)
    expect(breakdowns.consoleTimeScale).toBe(0.75)
    for (const [level, speed] of [[1, 0.5], [2, 0.25]]) {
      const m = upgradesForShift(owning({ focusMode: level })).modifiers.consoleTimeScaleMult
      expect(breakdowns.consoleTimeScale * m).toBeCloseTo(speed, 3)
    }
  })

  it('a machine fix at max level: that repair is one step shorter (and only at max)', () => {
    const pairs = [['circuitStabilizer', 'visor'], ['capacitorEfficiency', 'laser'], ['gearLubrication', 'controls']] as const
    for (const [id, machine] of pairs) {
      const base = repairSteps(machine)
      expect(repairSteps(machine, upgradesForShift(owning({ [id]: 3 })).fewerRepairSteps[machine]), id).toBe(base)
      expect(repairSteps(machine, upgradesForShift(owning({ [id]: 4 })).fewerRepairSteps[machine]), id).toBe(base - 1)
      // the other machines' repairs stay as they are
      for (const other of ['visor', 'laser', 'controls'] as const) if (other !== machine) {
        expect(upgradesForShift(owning({ [id]: 4 })).fewerRepairSteps[other]).toBe(0)
      }
    }
  })

  it('an active goes in only when equipped, at its owned level', () => {
    expect(upgradesForShift(owning({ cooldownBooster: 2 })).abilities).toEqual([])
    const { up, shift } = shiftWith(owning({ cooldownBooster: 2 }, ['cooldownBooster']))
    expect(up.abilities).toHaveLength(1)
    expect(up.abilities[0]).toMatchObject({ id: 'cooldownBooster', effect: 'boostCooldowns', params: { boost: 0.35 } })
    expect(shift.state.abilities).toEqual([{ id: 'cooldownBooster', effect: 'boostCooldowns', charge: 0, ready: false }])
  })

  it('a lesson’s training shift gets no upgrades, whatever is owned', () => {
    const up = upgradesForShift(owning({ pressureControl: 8, focusMode: 4, circuitStabilizer: 4, cooldownBooster: 3 }, ['cooldownBooster']), true)
    expect(up.modifiers).toEqual(NEUTRAL_MODIFIERS)
    expect(up.abilities).toEqual([])
    expect(up.fewerRepairSteps).toEqual({ laser: 0, visor: 0, controls: 0 })
  })

  it('test-only upgrades never count, even in a hand-edited save', () => {
    const up = upgradesForShift(owning({ sturdyTankTest: 1, lowCracksTest: 1 }, ['lowCracksTest']))
    expect(up.modifiers.integrityDrainMult).toBe(1)
    expect(up.abilities).toEqual([])
  })

  it('live tuning: the numbers are read when the shift starts (a changed book counts from the next shift)', () => {
    const edited: UpgradeBook = structuredClone(book)
    edited.upgrades.find((u) => u.id === 'denseGoop')!.effects![0].byLevel[0] = 2
    expect(upgradesForShift(owning({ denseGoop: 1 }), false, edited).modifiers.fallSpeedMult).toBe(2)
    expect(upgradesForShift(owning({ denseGoop: 1 })).modifiers.fallSpeedMult).toBe(1.125)
  })

  it('never more actives than slots reach the shift (a hand-edited save): the newest equipped one is kept', () => {
    const second = { ...structuredClone(book.upgrades.find((u) => u.id === 'cooldownBooster')!), id: 'secondActive' }
    const twoActives: UpgradeBook = { upgrades: [...book.upgrades, second] }
    const up = upgradesForShift(owning({ cooldownBooster: 1, secondActive: 1 }, ['cooldownBooster', 'secondActive']), false, twoActives)
    expect(up.abilities.map((a) => a.id)).toEqual(['secondActive'])
  })
})
