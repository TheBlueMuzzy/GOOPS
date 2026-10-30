// F34 task 6: Cooldown Booster — the first real active. Charges 0.05 a second (full in 20 s) + 0.25 a seal (v1),
// only while the shift is playing; fired when full, every machine whose calm time (cooldown after a repair) is running
// gets boost × what's left on top (+25 / 35 / 50 %). Refused (charge kept) when not full or nothing is running.
import { describe, expect, it } from 'vitest'
import upgradesJson from '../../content/tuning/upgrades.json'
import breakdownsJson from '../../content/tuning/breakdowns.json'
import { createShift, resolveUpgrades } from '../../src/engine'
import type { BreakdownConfig, MachineId, ShiftConfig, ShiftEngine, UpgradeBook } from '../../src/engine'
import { ofType, oneShapeConfig, tank, tickUntil } from './helpers'

const book = upgradesJson as UpgradeBook
const ID = 'cooldownBooster'

// one-cell pieces, a tank that never wears out: nothing ends the shift while we wait for the charge
function calmConfig(): ShiftConfig {
  const config = oneShapeConfig([[0, 0]])
  config.integrity.drainPerCrackPerSec = 0
  return config
}

function boosterShift(level: number, rank = 9) {
  const abilities = resolveUpgrades(book, { [ID]: level }, [ID]).abilities
  const shift = createShift(calmConfig(), { seed: 3, rank, breakdowns: structuredClone(breakdownsJson) as BreakdownConfig,
    startGrid: tank(['12'.repeat(15)]), abilities })
  return { shift, m: shift.state.machines!, a: () => shift.state.abilities![0] }
}

// break a machine and repair it at once: its calm time (cooldown) starts running
function breakAndRepair(shift: ShiftEngine, id: MachineId) {
  Object.assign(shift.state.machines![id], { broken: true, health: 0, cooldownMs: 0 })
  shift.act({ type: 'repair', machine: id })
  shift.takeEvents()
}

function chargeFull(shift: ShiftEngine) {
  for (let t = 0; t < 21_000 && !shift.state.abilities![0].ready; t += 100) shift.tick(100)
}

describe('Cooldown Booster (F34)', () => {
  it('charges with play time at 0.05 a second: half after 10 s, ready at 20 s (with an abilityReady event)', () => {
    const { shift, a } = boosterShift(1)
    shift.tick(10_000)
    expect(a().charge).toBeCloseTo(0.5, 6)
    expect(a().ready).toBe(false)
    shift.takeEvents()
    shift.tick(10_000)
    expect(a()).toMatchObject({ charge: 1, ready: true })
    expect(ofType(shift.takeEvents(), 'abilityReady')).toEqual([{ type: 'abilityReady', id: ID }])
  })

  it('fired when full: every running calm time grows by the level’s boost × what was left; the others stay', () => {
    for (const [level, boost] of [[1, 0.25], [2, 0.35], [3, 0.5]]) {
      const { shift, m, a } = boosterShift(level)
      chargeFull(shift)
      breakAndRepair(shift, 'visor')
      breakAndRepair(shift, 'laser')
      shift.tick(1000) // some of it runs down first
      const visorLeft = m.visor.cooldownMs, laserLeft = m.laser.cooldownMs
      expect(visorLeft).toBeGreaterThan(0)
      expect(m.controls.cooldownMs).toBe(0)
      shift.act({ type: 'ability', id: ID })
      expect(m.visor.cooldownMs, `level ${level}`).toBeCloseTo(visorLeft * (1 + boost), 6)
      expect(m.laser.cooldownMs, `level ${level}`).toBeCloseTo(laserLeft * (1 + boost), 6)
      expect(m.controls.cooldownMs).toBe(0) // not running: not started by the boost
      expect(a()).toMatchObject({ charge: 0, ready: false })
      expect(ofType(shift.takeEvents(), 'ability')).toEqual([{ type: 'ability', id: ID }])
    }
  })

  it('refused when not full: a reject, the calm time and the charge stay as they were', () => {
    const { shift, m, a } = boosterShift(3)
    breakAndRepair(shift, 'visor')
    shift.tick(5000)
    const before = m.visor.cooldownMs, charge = a().charge
    shift.act({ type: 'ability', id: ID })
    expect(m.visor.cooldownMs).toBe(before)
    expect(a().charge).toBe(charge)
    expect(ofType(shift.takeEvents(), 'reject')).toEqual([{ type: 'reject', action: 'ability' }])
  })

  it('refused when no calm time is running (nothing to boost): the full charge is kept for later', () => {
    const { shift, a } = boosterShift(2)
    chargeFull(shift)
    shift.takeEvents()
    shift.act({ type: 'ability', id: ID })
    expect(a()).toMatchObject({ charge: 1, ready: true })
    expect(ofType(shift.takeEvents(), 'reject')).toHaveLength(1)
  })

  it('a locked machine is never boosted (rank 2: only the visor works)', () => {
    const { shift, m } = boosterShift(1, 2)
    chargeFull(shift)
    breakAndRepair(shift, 'visor')
    m.laser.cooldownMs = 5000 // (can't happen in play: a locked machine never gets a cooldown)
    shift.act({ type: 'ability', id: ID })
    expect(m.laser.cooldownMs).toBe(5000)
  })

  it('stops charging during a rupture, and can’t fire then (the charge is kept)', () => {
    const config = calmConfig()
    config.integrity.drainPerCrackPerSec = 1000 // the first crack ruptures the tank
    const abilities = resolveUpgrades(book, { [ID]: 3 }, [ID]).abilities
    const shift = createShift(config, { seed: 1, rank: 9, breakdowns: structuredClone(breakdownsJson) as BreakdownConfig, abilities })
    const s = shift.state
    tickUntil(shift, () => s.phase === 'rupture', 60000, 10)
    const charge = s.abilities![0].charge
    expect(charge).toBeGreaterThan(0)
    shift.tick(1000)
    expect(s.abilities![0].charge).toBe(charge)
    // full during a rupture (put there by hand) still can't fire: the machines are frozen then
    Object.assign(s.abilities![0], { charge: 1, ready: true })
    breakAndRepair(shift, 'visor')
    const left = s.machines!.visor.cooldownMs
    shift.act({ type: 'ability', id: ID })
    expect(s.machines!.visor.cooldownMs).toBe(left)
    expect(s.abilities![0].ready).toBe(true)
  })
})
