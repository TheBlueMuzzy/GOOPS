// F64 THE FINAL SHIFT (rank 50, the boss level — src/engine/finalShift.ts + shift.ts, content/tuning/finalShift.json):
// one colour for everything, the onslaught, the Veteran's drop-in and help, the 3 valve stages and the two losses.
// F75 (cooperative final shift): his seals are free, the tank's lost integrity wears him down, used up = not a loss.
import { describe, expect, it } from 'vitest'
import { createShift, resolveUpgrades, WILD, type ShiftEngine, type ShiftEvent, type ShiftOptions, type UpgradeBook, type WhiteGoopConfig } from '../../src/engine'
import upgradesJson from '../../content/tuning/upgrades.json'
import type { FinalShiftConfig } from '../../src/engine/finalShift'
import { restoreShift } from '../../src/engine/snapshot'
import finalJson from '../../content/tuning/finalShift.json'
import whiteGoopJson from '../../content/tuning/whiteGoop.json'
import twistsJson from '../../content/tuning/twists.json'
import { idx, ofType, realConfig, straightLineCracks, tickUntil } from './helpers'
import { GALAXY_SLOT } from '../../src/goo/shared/galaxyLook'

const BLACK = 7 // shift.json colors: 'black' is the 7th
const finalCfg = () => {
  const f = structuredClone(finalJson) as FinalShiftConfig
  f.rain.everySec = 0 // (tests turn the rain on when they want it)
  return f
}
const whiteGoop = () => structuredClone(whiteGoopJson) as WhiteGoopConfig
// no cracks of the shift's own (the tests place theirs), pieces hanging still at the top
function quietConfig() {
  const config = straightLineCracks(realConfig(), 1e12, 1e12)
  config.fall.msPerRow = 1e9
  return config
}
// black goop on the floor in every other column (x = 0, 2, 4 … 28): 15 separate clumps, each poppable once full
function spacedFloor(): Uint8Array {
  const grid = new Uint8Array(30 * 24)
  for (let x = 0; x < 30; x += 2) grid[idx(x, 23)] = BLACK
  return grid
}
function finalShift(extra: Partial<ShiftOptions> = {}, final = finalCfg()) {
  return createShift(quietConfig(), { seed: 1, rank: 50, finalShift: final, startGrid: spacedFloor(), ...extra })
}
// You seal a crack: one under the black clump at column x, then zap that clump
function playerSeal(shift: ShiftEngine, x: number, id: number): ShiftEvent[] {
  const s = shift.state
  s.cracks.push({ id, x, y: 23, color: BLACK, plugged: false })
  shift.tick(20) // (the engine sees it plugged on its next step)
  tickUntil(shift, () => !!s.groups.get(s.groupOf[idx(x, 23)])?.ready, 5000, 10)
  shift.act({ type: 'pop', x, y: 23 })
  const events = shift.takeEvents()
  expect(ofType(events, 'pop').at(-1)?.sealed).toEqual([id])
  return events
}
// skip the Veteran's drop-in (he lands; the shift's clock starts)
function pastIntro(shift: ShiftEngine): ShiftEvent[] {
  const events: ShiftEvent[] = []
  tickUntil(shift, () => { events.push(...shift.takeEvents()); return !shift.state.final!.intro }, 60_000, 10)
  events.push(...shift.takeEvents())
  return events
}

// The galaxy look is drawn on one colour slot (galaxyLook.ts GALAXY_SLOT, in both shaders + the next window), while the
// engine picks the final shift's colour by name (finalShift.json colour) — they must be the same slot.
it("the final shift's colour is the slot the galaxy look is drawn on", () => {
  expect(realConfig().colors.indexOf(finalJson.colour) + 1).toBe(GALAXY_SLOT)
})

describe('the final shift (rank 50)', () => {
  it('is rank 50 only: not 49, never in a lesson, not without its tuning', () => {
    expect(createShift(realConfig(), { seed: 1, rank: 50, finalShift: finalCfg() }).state.final).toBeTruthy()
    expect(createShift(realConfig(), { seed: 1, rank: 49, finalShift: finalCfg() }).state.final ?? null).toBeNull()
    expect(createShift(realConfig(), { seed: 1, rank: 50, finalShift: finalCfg(), training: {} }).state.final ?? null).toBeNull()
    expect(createShift(realConfig(), { seed: 1, rank: 50 }).state.final ?? null).toBeNull()
    const s = createShift(realConfig(), { seed: 1, rank: 50, finalShift: finalCfg() }).state
    expect(s.final).toMatchObject({ stage: 0, stages: 3, seals: 0, need: 6, waiting: false, outcome: null, vetAlive: false }) // (no white goop handed in: he isn't there)
    expect(s.cracksNeeded).toBe(24) // 6 + 8 + 10
  })

  it('everything is black: every piece (wild and two-colour too), the junk and every crack', () => {
    const config = realConfig()
    config.cracks.everyMsAtEmpty = 200 // lots of cracks, quickly
    config.cracks.everyMsAtFull = 200
    const shift = createShift(config, { seed: 7, rank: 50, finalShift: finalCfg(), twists: structuredClone(twistsJson) })
    const s = shift.state
    const colours = new Set<number>()
    for (let t = 0; t < 60_000 && s.status === 'playing'; t += 20) {
      shift.tick(20)
      shift.act({ type: 'softDrop', on: true })
      for (const c of s.piece?.colors ?? []) colours.add(c)
      for (const c of s.next ?? []) colours.add(c)
      for (const c of s.grid) if (c) colours.add(c)
      for (const k of s.cracks) colours.add(k.color)
    }
    expect(s.cracks.length + (s.sealedCracks?.length ?? 0)).toBeGreaterThan(5)
    expect([...colours]).toEqual([BLACK])
  })

  it('any goop merges with any and seals any crack (one colour: a clump covering two cracks seals both)', () => {
    const grid = new Uint8Array(30 * 24)
    grid[idx(3, 23)] = BLACK
    grid[idx(4, 23)] = BLACK
    grid[idx(5, 23)] = BLACK
    const shift = finalShift({ startGrid: grid })
    const s = shift.state
    expect(s.groups.size).toBe(1)
    s.cracks.push({ id: 801, x: 3, y: 23, color: BLACK, plugged: false }, { id: 802, x: 5, y: 23, color: BLACK, plugged: false })
    tickUntil(shift, () => !!s.groups.get(s.groupOf[idx(4, 23)])?.ready, 5000, 10)
    expect(s.cracks.every((c) => c.plugged)).toBe(true)
    shift.act({ type: 'pop', x: 4, y: 23 })
    expect(ofType(shift.takeEvents(), 'pop')[0].sealed.sort()).toEqual([801, 802])
    expect(s.final!.seals).toBe(2)
  })

  it('the onslaught: pressure climbs × pressureRiseMult, pieces fall × fallSpeedMult, cracks come × crackRateMult, goop rains in', () => {
    const final = finalCfg()
    const at = (rank: number) => createShift(realConfig(), { seed: 3, rank, finalShift: final, startGrid: new Uint8Array(30 * 24) })
    const normal = at(49), boss = at(50)
    normal.tick(10_000)
    boss.tick(10_000)
    expect(boss.state.pressure / normal.state.pressure).toBeCloseTo(final.pressureRiseMult, 1)
    // fall speed: rows fallen in 2 s (both from the top; the boss shift's first piece comes after its intro — none here)
    const fall = (rank: number) => {
      const config = straightLineCracks(realConfig(), 1e12, 1e12)
      const sh = createShift(config, { seed: 4, rank, finalShift: final, startGrid: new Uint8Array(30 * 24) })
      const y0 = Math.min(...sh.state.piece!.cells.map((c) => c[1]))
      sh.tick(2000)
      return Math.min(...sh.state.piece!.cells.map((c) => c[1])) - y0
    }
    expect(fall(50) / fall(49)).toBeGreaterThan(final.fallSpeedMult * 0.8)
    // cracks: with no other differences, more of them in the same time
    const cracks = (rank: number) => {
      const config = straightLineCracks(realConfig(), 2000, 2000)
      const sh = createShift(config, { seed: 5, rank, finalShift: final, startGrid: new Uint8Array(30 * 24) })
      let n = 0
      for (let t = 0; t < 20_000; t += 50) { sh.tick(50); n += ofType(sh.takeEvents(), 'crack').length }
      return n
    }
    expect(cracks(50) / cracks(49)).toBeCloseTo(final.crackRateMult, 0)
    // rain: rain.cells cells every rain.everySec
    final.rain = { everySec: 2, cells: 3 }
    const rain = finalShift({}, final)
    rain.tick(6_100)
    const dumps = ofType(rain.takeEvents(), 'dump')
    expect(dumps).toHaveLength(9)
    expect(dumps.every((d) => d.color === BLACK)).toBe(true)
  })

  it('seals count toward the valve; a full stage waits at the console and seals stop counting until it opens', () => {
    const shift = finalShift()
    const s = shift.state
    const ready: ShiftEvent[] = []
    for (let k = 0; k < 6; k++) ready.push(...playerSeal(shift, 2 * k, 100 + k))
    expect(ofType(ready, 'valveReady')).toEqual([{ type: 'valveReady', stage: 1 }])
    expect(s.final).toMatchObject({ stage: 0, seals: 6, waiting: true })
    // waiting: seals don't count
    const meanwhile = [...playerSeal(shift, 14, 200), ...playerSeal(shift, 16, 201)]
    expect(s.final!.seals).toBe(6)
    expect(ofType(meanwhile, 'valveReady')).toHaveLength(0) // (still the same stage waiting)
    expect(s.cracksSealed).toBe(8) // (every seal is still a seal on the report)
    // the console's panel opens it: stage 2 needs 8, counting from 0
    expect(shift.openValveStage()).toBe(true)
    expect(ofType(shift.takeEvents(), 'valveOpen')).toEqual([{ type: 'valveOpen', stage: 1 }])
    expect(s.final).toMatchObject({ stage: 1, seals: 0, need: 8, waiting: false })
    expect(shift.openValveStage()).toBe(false) // nothing waiting
    playerSeal(shift, 18, 300)
    expect(s.final!.seals).toBe(1)
    expect(s.status).toBe('playing')
    expect(s.quotaMet).toBe(false) // (the final shift has no quota: the valve is the goal)
  })

  it('the third stage opened = the win', () => {
    const final = finalCfg()
    final.valve.stages = [1, 1, 2]
    const shift = finalShift({}, final)
    const s = shift.state
    playerSeal(shift, 0, 1)
    expect(shift.openValveStage()).toBe(true)
    playerSeal(shift, 2, 2)
    expect(shift.openValveStage()).toBe(true)
    playerSeal(shift, 4, 3)
    expect(s.final!.waiting).toBe(false) // 1 of 2
    playerSeal(shift, 6, 4)
    expect(s.final!.waiting).toBe(true)
    expect(s.status).toBe('playing')
    expect(shift.openValveStage()).toBe(true)
    expect(s.status).toBe('won')
    expect(s.final!.outcome).toBe('won')
    expect(ofType(shift.takeEvents(), 'end')).toEqual([{ type: 'end', status: 'won' }])
    expect(shift.openValveStage()).toBe(false) // (over)
  })

  it('a valve stage opens only in the final shift', () => {
    expect(createShift(quietConfig(), { seed: 1, rank: 49, finalShift: finalCfg() }).openValveStage()).toBe(false)
  })

  it('loses at once when integrity hits 0 (no rupture drain)', () => {
    const config = quietConfig()
    config.integrity.drainPerCrackPerSec = 1
    const shift = createShift(config, { seed: 1, rank: 50, finalShift: finalCfg(), startGrid: spacedFloor() })
    const s = shift.state
    s.cracks.push({ id: 1, x: 1, y: 23, color: BLACK, plugged: false })
    tickUntil(shift, () => s.status !== 'playing', 3000, 10)
    expect(s.status).toBe('lost')
    expect(s.final!.outcome).toBe('integrity')
    const events = shift.takeEvents()
    expect(ofType(events, 'rupture')).toEqual([{ type: 'rupture', reason: 'integrity' }])
    expect(ofType(events, 'end')).toEqual([{ type: 'end', status: 'lost' }])
  })

  it('loses at once when the goop goes over the top', () => {
    const config = quietConfig()
    config.fall.msPerRow = 5
    const shift = createShift(config, { seed: 1, rank: 50, finalShift: finalCfg(), startGrid: new Uint8Array(30 * 24) })
    const s = shift.state
    tickUntil(shift, () => s.status !== 'playing', 120_000, 20) // (nobody zaps: the centre column fills to the top)
    expect(s.status).toBe('lost')
    expect(s.final!.outcome).toBe('overflow')
  })

  it('the Veteran drops in FIRST: his lines, then he falls, lands ("…oof."), and only then the first piece and the clock', () => {
    const final = finalCfg()
    const shift = createShift(quietConfig(), { seed: 2, rank: 50, finalShift: final, whiteGoop: whiteGoop(), startGrid: new Uint8Array(30 * 24) })
    const s = shift.state
    expect(s.final!.intro).toBe(true)
    expect(s.piece).toBeNull()
    expect(s.vet!.size).toBe(1)
    const y0 = s.vet!.y
    shift.tick(final.intro.fallSec * 1000 - 50)
    expect(s.vet!.y).toBe(y0) // still at the top, talking
    const says = ofType(shift.takeEvents(), 'vetSay').map((e) => e.line)
    expect(says).toEqual(['hi', 'itsMe'])
    const events = pastIntro(shift)
    expect(ofType(events, 'vetSay').map((e) => e.line)).toEqual(['oof', 'help'])
    expect(ofType(events, 'vetLand')).toHaveLength(1)
    expect(events.findIndex((e) => e.type === 'vetLand')).toBeLessThan(events.findIndex((e) => e.type === 'spawn'))
    expect(s.vet!.y).toBe(23) // he fell to the floor of an empty tank
    expect(s.pressure).toBe(0) // the clock waited for him
    expect(s.piece).not.toBeNull()
    shift.tick(1000)
    expect(s.pressure).toBeGreaterThan(0)
  })

  it('he goes for the crack you can\'t reach (high above the goop), not the one you can; his seals are free (F75) and count', () => {
    const final = finalCfg()
    const config = quietConfig()
    config.integrity.drainPerCrackPerSec = 0 // (the tank loses nothing: whatever he loses would be the seal's)
    const shift = createShift(config, { seed: 5, rank: 50, finalShift: final, whiteGoop: whiteGoop(), startGrid: new Uint8Array(30 * 24) })
    const s = shift.state
    pastIntro(shift)
    const easy = { id: 901, x: 26, y: 23, color: BLACK, plugged: false } // on the floor beside him: you can reach it
    const high = { id: 902, x: 22, y: 16, color: BLACK, plugged: false } // 7 rows up in the air
    s.cracks.push(easy, high)
    tickUntil(shift, () => s.vet!.targetId !== null, 2000, 5)
    expect(s.vet!.targetId).toBe(902)
    tickUntil(shift, () => !s.cracks.some((c) => c.id === 902), 60_000, 10)
    expect(s.vet!.size).toBe(1) // (F75: sealing costs him nothing)
    expect(s.final!.seals).toBe(1)
    // the reachable one is left for you: he waits (resting, then looking)
    shift.tick(5000)
    expect(s.cracks.some((c) => c.id === 901)).toBe(true)
    expect(s.vet!.mode === 'wait' || s.vet!.mode === 'rest').toBe(true)
  })

  // F75: a shift with a draining tank and him in it, past his intro
  function wearing(wear: number, drainPerSec = 0.05, stages?: number[]) {
    const final = finalCfg()
    final.vet.wearPerIntegrity = wear
    if (stages) final.valve.stages = stages
    const config = quietConfig()
    config.integrity.drainPerCrackPerSec = drainPerSec
    const shift = createShift(config, { seed: 6, rank: 50, finalShift: final, whiteGoop: whiteGoop(), startGrid: spacedFloor() })
    pastIntro(shift)
    return { shift, s: shift.state, final }
  }
  // an open crack high up, and him kept busy elsewhere (these tests are about his wear, not his seals)
  function hurtTank(s: ShiftEngine['state']) {
    s.cracks.push({ id: 1, x: 10, y: 10, color: BLACK, plugged: false })
    s.vet!.mode = 'wait'
    s.vet!.waitMs = 1e12
  }

  it('F75: he wears down by the integrity the tank LOSES (wearPerIntegrity × lost); a patched-up tank doesn\'t give it back', () => {
    const { shift, s } = wearing(2)
    expect(s.final!.vetAlive).toBe(true)
    hurtTank(s)
    shift.tick(2000)
    const lost = 1 - s.integrity
    expect(lost).toBeGreaterThan(0.05)
    expect(s.vet!.size).toBeCloseTo(1 - 2 * lost, 6)
    // the tank patched back up: he stays as worn as he was
    const worn = s.vet!.size
    s.cracks = []
    s.integrity = 1
    shift.tick(2000)
    expect(s.vet!.size).toBe(worn)
  })

  it('F75: used up = NOT a loss — vetGone once (where he was), he leaves the tank, the shift goes on; a win without him says so', () => {
    const { shift, s } = wearing(4, 0.5, [1, 1, 1]) // (a quarter of a tank lost and he's gone)
    hurtTank(s)
    const where = { x: s.vet!.px + 0.5, y: s.vet!.py }
    const events: ShiftEvent[] = []
    tickUntil(shift, () => { events.push(...shift.takeEvents()); return !s.vet }, 20_000, 10)
    expect(s.status).toBe('playing')
    expect(s.final).toMatchObject({ vetAlive: false, outcome: null })
    expect(s.vet).toBeNull()
    expect(ofType(events, 'vetGone')).toEqual([{ type: 'vetGone', at: where }])
    expect(s.integrity).toBeGreaterThan(0.7) // (the tank's still fine: this isn't the integrity loss)
    shift.tick(1000) // the tank keeps draining: no second goodbye, no loss from him
    expect(ofType(shift.takeEvents(), 'vetGone')).toHaveLength(0)
    expect(s.status).toBe('playing')
    // play on without him: the valve still opens; the win says he didn't make it
    s.cracks = []
    s.integrity = 1
    for (let k = 0; k < 3; k++) {
      playerSeal(shift, 2 * k, 50 + k)
      expect(shift.openValveStage()).toBe(true)
    }
    expect(s.status).toBe('won')
    expect(s.final).toMatchObject({ outcome: 'won', vetAlive: false })
  })

  it('F75: a win with him still in the tank says he made it', () => {
    const final = finalCfg()
    final.valve.stages = [1, 1, 1]
    const config = quietConfig()
    config.integrity.drainPerCrackPerSec = 0
    const shift = createShift(config, { seed: 6, rank: 50, finalShift: final, whiteGoop: whiteGoop(), startGrid: spacedFloor() })
    pastIntro(shift)
    for (let k = 0; k < 3; k++) {
      playerSeal(shift, 2 * k, 50 + k)
      expect(shift.openValveStage()).toBe(true)
    }
    expect(shift.state.final).toMatchObject({ outcome: 'won', vetAlive: true })
  })

  it('F75: the only losses are the tank breaking — there is no "vetGone" outcome', () => {
    const { shift, s } = wearing(4, 2)
    hurtTank(s)
    tickUntil(shift, () => s.status !== 'playing', 20_000, 10)
    expect(s.status).toBe('lost')
    expect(s.final!.outcome).toBe('integrity')
    expect(s.final!.vetAlive).toBe(false)
  })

  it('F75: a snapshot keeps whether he made it (worn, and gone)', () => {
    const { shift, s } = wearing(4, 0.5)
    hurtTank(s)
    shift.tick(200)
    const worn = restoreShift(quietConfig(), shift.snapshot(), undefined, whiteGoop(), undefined, finalCfg())
    expect(worn.state.vet!.size).toBe(s.vet!.size)
    expect(worn.state.final!.vetAlive).toBe(true)
    tickUntil(shift, () => !s.vet, 20_000, 10)
    const gone = restoreShift(quietConfig(), shift.snapshot(), undefined, whiteGoop(), undefined, finalCfg())
    expect(gone.state.vet ?? null).toBeNull()
    expect(gone.state.final!.vetAlive).toBe(false)
    // (a snapshot from before F75 has no vetAlive: he's alive if he's in the tank — here he isn't)
    const old = shift.snapshot()
    delete (old.state.final as { vetAlive?: boolean }).vetAlive
    expect(restoreShift(quietConfig(), old, undefined, whiteGoop(), undefined, finalCfg()).state.final!.vetAlive).toBe(false)
  })

  it('a snapshot keeps the valve and the intro: a restored shift plays on exactly as the original', () => {
    const final = finalCfg()
    final.rain.everySec = 3
    const opts = { seed: 9, rank: 50, finalShift: final, whiteGoop: whiteGoop() }
    const a = createShift(realConfig(), opts)
    a.tick(2000) // mid-intro
    const snap = a.snapshot()
    const b = restoreShift(realConfig(), snap, undefined, whiteGoop(), undefined, final)
    for (let t = 0; t < 30_000; t += 50) { a.tick(50); b.tick(50) }
    expect(b.state.final).toEqual(a.state.final)
    expect(Array.from(b.state.grid)).toEqual(Array.from(a.state.grid))
    expect(b.state.vet).toEqual(a.state.vet)
  })
})

// F75: the upgrades reach the final shift — Goop Dump rains wild goop into the cracks' columns, Slow Cracks slows only
// the spreading
describe('upgrades in the final shift (F75)', () => {
  const abilities = (id: string, level: number) => resolveUpgrades(upgradesJson as UpgradeBook, { [id]: level }, [id]).abilities
  // a ready Goop Dump at rank `rank`, two open cracks high up in columns 5 and 17, fired; the columns it rained into
  function dumpColumns(rank: number, cracks = true): number[] {
    const shift = createShift(quietConfig(), { seed: 3, rank, finalShift: finalCfg(), startGrid: new Uint8Array(30 * 24), abilities: abilities('goopDump', 1) }) // (one wave: too few cells to plug them)
    const s = shift.state
    if (cracks) s.cracks.push({ id: 1, x: 5, y: 12, color: BLACK, plugged: false }, { id: 2, x: 17, y: 14, color: BLACK, plugged: false })
    Object.assign(s.abilities![0], { charge: 1, ready: true })
    shift.act({ type: 'ability', id: 'goopDump' })
    const xs: number[] = []
    for (let t = 0; t < 8000; t += 10) {
      shift.tick(10)
      for (const e of shift.takeEvents()) if (e.type === 'dump') { expect(e.color).toBe(WILD); xs.push(e.x) }
    }
    expect(xs.length).toBeGreaterThan(5)
    return xs
  }

  it('Goop Dump rains wild goop into the columns with an open crack (none: anywhere); at rank 49 anywhere', () => {
    expect(new Set(dumpColumns(50))).toEqual(new Set([5, 17]))
    expect(new Set(dumpColumns(50, false)).size).toBeGreaterThan(5)
    expect(new Set(dumpColumns(49)).size).toBeGreaterThan(5)
  })

  it('Slow Cracks: in the final shift new cracks come as often as without it, but they spread slower; at rank 49 both slow', () => {
    const slow = { crackEveryMult: 1.6 }
    // new cracks in 20 s (cracks every 2 s at any pressure; empty tank, none of them growing: no twists)
    const cracks = (rank: number, modifiers = {}) => {
      const sh = createShift(straightLineCracks(realConfig(), 2000, 2000), { seed: 5, rank, finalShift: finalCfg(), startGrid: new Uint8Array(30 * 24), modifiers })
      let n = 0
      for (let t = 0; t < 20_000; t += 50) { sh.tick(50); n += ofType(sh.takeEvents(), 'crack').length }
      return n
    }
    expect(cracks(50, slow)).toBe(cracks(50))
    expect(cracks(49, slow)).toBeLessThan(cracks(49) * 0.75)
    // spreading: cells one crack grows in 30 s (no new cracks; every growth roll a hit)
    const grown = (rank: number, modifiers = {}) => {
      const t = structuredClone(twistsJson)
      t.grow.baseChance = 1
      const sh = createShift(quietConfig(), { seed: 5, rank, finalShift: finalCfg(), startGrid: new Uint8Array(30 * 24), modifiers, twists: t })
      sh.state.cracks.push({ id: 1, x: 10, y: 20, color: BLACK, plugged: false })
      sh.tick(30_000)
      return sh.state.cracks[0].cells?.length ?? 1
    }
    expect(grown(50, slow)).toBeLessThan(grown(50))
    expect(grown(49, slow)).toBeLessThan(grown(49))
  })
})
