// F42 task 3: the three actives from v1 — Goop Dump (rank 15), Goop Colorizer (rank 25), Crack Down (rank 35).
// Numbers from content/tuning/upgrades.json. Each one is seeded (the shift's own random numbers), runs on the rules
// clock (tick), and is refused — charge kept — when it can't act (no falling piece / a wild one / a rupture).
import { describe, expect, it } from 'vitest'
import upgradesJson from '../../content/tuning/upgrades.json'
import twistsJson from '../../content/tuning/twists.json'
import { createShift, WILD, resolveUpgrades } from '../../src/engine'
import type { ShiftConfig, ShiftEngine, ShiftEvent, ShiftOptions, TwistsConfig, UpgradeBook } from '../../src/engine'
import { mainColor, type PieceDef } from '../../src/engine/pieces'
import { dropPiece, ofType, oneShapeConfig, straightLineCracks } from './helpers'

const book = upgradesJson as UpgradeBook

// a 2×2 square, 4 colours in play, pieces hang still at the top (they only fall when a test drops them), a tank that
// never wears out
function config(): ShiftConfig {
  const c = oneShapeConfig([[0, 0], [1, 0], [0, 1], [1, 1]])
  c.colorsByRank = [{ rank: 0, count: 4 }]
  c.integrity.drainPerCrackPerSec = 0
  return c
}

function withActive(id: string, level: number, options: Partial<ShiftOptions> = {}, cfg = config()) {
  const abilities = resolveUpgrades(book, { [id]: level }, [id]).abilities
  const shift = createShift(cfg, { seed: 7, rank: 15, startGrid: new Uint8Array(30 * 24), abilities, ...options })
  shift.takeEvents()
  return { shift, cfg, s: shift.state, a: () => shift.state.abilities![0] }
}

const makeReady = (shift: ShiftEngine) => Object.assign(shift.state.abilities![0], { charge: 1, ready: true })

// tick in 1 ms steps, every event stamped with the time it came
function timed(shift: ShiftEngine, ms: number): { t: number; e: ShiftEvent }[] {
  const out: { t: number; e: ShiftEvent }[] = []
  for (let t = 1; t <= ms && shift.state.status === 'playing'; t++) {
    shift.tick(1)
    for (const e of shift.takeEvents()) out.push({ t, e })
  }
  return out
}

// a shift whose first crack ruptures the tank, ticked until it has
function ruptured(id: string, rank = 15): ShiftEngine {
  const cfg = straightLineCracks(config(), 100, 100)
  cfg.integrity.drainPerCrackPerSec = 1000
  const { shift, s } = withActive(id, 1, { rank }, cfg)
  for (let t = 0; t < 10_000 && s.phase !== 'rupture'; t += 10) shift.tick(10)
  expect(s.phase).toBe('rupture')
  shift.takeEvents()
  return shift
}

// the falling piece's main colour, as the engine sees it (its def is private: read through a snapshot)
const mainOfFalling = (shift: ShiftEngine) => mainColor(shift.snapshot().inner.piece!.def)

const goopCells =(s: ShiftEngine['state']) => s.grid.reduce((n, c) => n + (c !== 0 ? 1 : 0), 0)
const twists = (patch: (t: TwistsConfig) => void) => { const t = structuredClone(twistsJson) as TwistsConfig; patch(t); return t }

describe('the main colour a piece gives Goop Dump and Goop Colorizer (pieces.ts mainColor)', () => {
  const def = (color: number, colors?: number[]): PieceDef => ({ name: 'T', cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color, corrupted: false, noRotate: false, colors })
  it('one colour: that colour · two colours: the one most cells have, a tie the first · wild: none (never copied)', () => {
    expect(mainColor(def(3))).toBe(3)
    expect(mainColor(def(2, [2, 5, 5, 5]))).toBe(5)
    expect(mainColor(def(2, [2, 2, 2, 5]))).toBe(2)
    expect(mainColor(def(2, [2, 2, 5, 5]))).toBe(2)
    expect(mainColor(def(WILD))).toBeNull()
  })
})

describe('Goop Dump (F42, rank 15)', () => {
  it('charges in 15 s of play (with an abilityReady event)', () => {
    const { shift, a } = withActive('goopDump', 1)
    shift.tick(14_000)
    expect(a().ready).toBe(false)
    shift.tick(1_100)
    expect(a().ready).toBe(true)
    expect(ofType(shift.takeEvents(), 'abilityReady')).toEqual([{ type: 'abilityReady', id: 'goopDump' }])
  })

  it('level 3: 3 waves of 18 single cells in the falling piece’s colour, 80 ms apart, 600 ms between waves; then it ends', () => {
    const { shift, s, a } = withActive('goopDump', 3)
    const color = mainOfFalling(shift)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopDump' })
    expect(shift.takeEvents()).toEqual([{ type: 'ability', id: 'goopDump' }])
    expect(a()).toMatchObject({ charge: 0, ready: false })
    const log = timed(shift, 6000)
    const dumps = log.filter((x) => x.e.type === 'dump')
    expect(dumps).toHaveLength(54)
    for (const { e } of dumps) expect(e).toMatchObject({ type: 'dump', color })
    // cell k of wave w comes at w × (17 × 80 + 600) + k × 80 ms after firing (the first on the very first tick)
    const want = dumps.map((_, i) => Math.max(1, Math.floor(i / 18) * (17 * 80 + 600) + (i % 18) * 80))
    expect(dumps.map((d) => d.t)).toEqual(want)
    // all 54 are goop in the tank, in that colour (nothing else was there), none wild
    expect(goopCells(s)).toBe(54)
    expect([...s.grid].every((c) => c === 0 || c === color)).toBe(true)
    // the effect ends right after the last cell
    const end = log.find((x) => x.e.type === 'abilityEnd')!
    expect(end.e).toEqual({ type: 'abilityEnd', id: 'goopDump' })
    expect(end.t).toBe(dumps[53].t)
    expect(s.effects!.dump).toBeUndefined()
  })

  it('level 1: one wave of 18; each cell drops to the floor (a fall event), in random columns', () => {
    const { shift, s } = withActive('goopDump', 1)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopDump' })
    const events = timed(shift, 3000).map((x) => x.e)
    const dumps = ofType(events, 'dump')
    expect(dumps).toHaveLength(18)
    expect(ofType(events, 'fall').length).toBeGreaterThanOrEqual(18)
    expect(new Set(dumps.map((d) => d.x)).size).toBeGreaterThan(5)
    // nothing rests in the hidden rows at the top
    for (let i = 0; i < (s.bufferRows + 1) * s.width; i++) expect(s.grid[i]).toBe(0)
  })

  it('seeded: the same seed rains the same columns; another seed, others', () => {
    const rain = (seed: number) => {
      const { shift, s } = withActive('goopDump', 2, { seed })
      makeReady(shift)
      shift.act({ type: 'ability', id: 'goopDump' })
      const xs = ofType(timed(shift, 4000).map((x) => x.e), 'dump').map((d) => d.x)
      return { xs, grid: [...s.grid] }
    }
    expect(rain(11)).toEqual(rain(11))
    expect(rain(11).xs).not.toEqual(rain(12).xs)
  })

  it('runs on the rules clock: nothing falls while the shift isn’t ticked (both Dev Kit pauses)', () => {
    const { shift } = withActive('goopDump', 1)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopDump' })
    shift.takeEvents()
    expect(ofType(shift.takeEvents(), 'dump')).toEqual([]) // fired, but no time has passed
    shift.tick(1)
    expect(ofType(shift.takeEvents(), 'dump')).toHaveLength(1)
    shift.tick(80 * 4)
    expect(ofType(shift.takeEvents(), 'dump')).toHaveLength(4)
  })

  it('a snapshot mid-rain carries on exactly (the rain is in state.effects)', () => {
    const { shift, cfg } = withActive('goopDump', 2)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopDump' })
    shift.tick(500)
    shift.takeEvents()
    const snap = shift.snapshot()
    const copy = createShift(cfg, { ...snap.options, startGrid: new Uint8Array(30 * 24) })
    copy.restore(snap)
    const rest = (e: ShiftEngine) => { e.tick(3000); return ofType(e.takeEvents(), 'dump') }
    const a = rest(shift), b = rest(copy)
    expect(a.length).toBeGreaterThan(20)
    expect(b).toEqual(a)
  })

  it('refused (charge kept) with no falling piece, with a wild one, during a rupture, and while the last dump still rains', () => {
    const refused = (shift: ShiftEngine) => {
      makeReady(shift)
      shift.act({ type: 'ability', id: 'goopDump' })
      expect(ofType(shift.takeEvents(), 'reject')).toEqual([{ type: 'reject', action: 'ability' }])
      expect(shift.state.abilities![0]).toMatchObject({ charge: 1, ready: true })
      expect(shift.state.effects!.dump).toBeUndefined()
    }
    // no falling piece: a lesson-style shift brings none until told to
    refused(withActive('goopDump', 1, { training: {} }).shift)
    // a wild falling piece (rank 40, every piece wild): no colour to copy
    const wild = withActive('goopDump', 1, { rank: 40, twists: twists((t) => { t.wild.chance = 1 }) })
    expect(wild.s.piece!.colors[0]).toBe(WILD)
    refused(wild.shift)
    // a rupture
    refused(ruptured('goopDump'))
    // still raining from the last fire
    const busy = withActive('goopDump', 1)
    makeReady(busy.shift)
    busy.shift.act({ type: 'ability', id: 'goopDump' })
    busy.shift.tick(200)
    busy.shift.takeEvents()
    const rain = { ...busy.s.effects!.dump! }
    makeReady(busy.shift)
    busy.shift.act({ type: 'ability', id: 'goopDump' })
    expect(ofType(busy.shift.takeEvents(), 'reject')).toHaveLength(1)
    expect(busy.s.abilities![0].ready).toBe(true)
    expect(busy.s.effects!.dump).toEqual(rain)
  })

  it('a rupture mid-rain stops it (abilityEnd), no more cells after', () => {
    const { shift, s, cfg } = withActive('goopDump', 3)
    cfg.integrity.drainPerCrackPerSec = 1000
    straightLineCracks(cfg, 100, 100)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopDump' })
    const log: ShiftEvent[] = []
    for (let t = 0; t < 10_000 && s.phase !== 'rupture'; t += 10) { shift.tick(10); log.push(...shift.takeEvents()) }
    expect(s.phase).toBe('rupture')
    const at = log.findIndex((e) => e.type === 'rupture')
    expect(log.slice(at)).toContainEqual({ type: 'abilityEnd', id: 'goopDump' })
    expect(s.effects!.dump).toBeUndefined()
    shift.tick(3000)
    expect(ofType(shift.takeEvents(), 'dump')).toEqual([])
  })
})

describe('Goop Colorizer (F42, rank 25)', () => {
  // drop the falling piece and note the colours of every piece that falls after it
  function nextColours(shift: ShiftEngine, cfg: ShiftConfig, count: number): number[][] {
    const out: number[][] = []
    for (let i = 0; i < count; i++) {
      dropPiece(shift, cfg)
      out.push([...shift.state.piece!.colors])
      shift.state.grid.fill(0) // (keep the tank empty, so there's always room)
      shift.state.groupOf.fill(-1)
      shift.state.groups.clear()
    }
    return out
  }

  it('charges in 25 s', () => {
    const { shift, a } = withActive('goopColorizer', 1)
    shift.tick(24_000)
    expect(a().ready).toBe(false)
    shift.tick(1_100)
    expect(a().ready).toBe(true)
  })

  it('level 1: the next 6 pieces take the falling piece’s colour — the one in the next window at once — then it ends', () => {
    const { shift, s, cfg } = withActive('goopColorizer', 1, { seed: 3 })
    const color = s.piece!.colors[0]
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(shift.takeEvents()).toEqual([{ type: 'ability', id: 'goopColorizer' }])
    expect(s.next!.every((c) => c === color)).toBe(true) // the next window shows it straight away
    expect(s.effects!.colorize).toEqual({ id: 'goopColorizer', color, left: 5 })
    const log: ShiftEvent[] = []
    const colours: number[][] = []
    for (let i = 0; i < 6; i++) {
      log.push(...dropPiece(shift, cfg))
      colours.push([...s.piece!.colors])
      s.grid.fill(0); s.groupOf.fill(-1); s.groups.clear()
    }
    expect(colours.every((p) => p.every((c) => c === color))).toBe(true)
    // the 6th came into the next window as the 5th fell: the effect ended then, and the pieces after are random again
    expect(ofType(log, 'abilityEnd')).toEqual([{ type: 'abilityEnd', id: 'goopColorizer' }])
    expect(s.effects!.colorize).toBeUndefined()
    const later = nextColours(shift, cfg, 12).map((p) => p[0])
    expect(later.some((c) => c !== color)).toBe(true)
  })

  it('level 3: 8 pieces', () => {
    const { shift, s, cfg } = withActive('goopColorizer', 3, { seed: 4 })
    const color = s.piece!.colors[0]
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(nextColours(shift, cfg, 8).every((p) => p.every((c) => c === color))).toBe(true)
    expect(s.effects!.colorize).toBeUndefined()
  })

  it('a two-colour falling piece gives its main colour; two-colour pieces coming next turn all one colour; never wild', () => {
    const { shift, s, cfg } = withActive('goopColorizer', 1, { rank: 20, seed: 5, twists: twists((t) => { t.split.chance = 1 }) })
    const colors = s.piece!.colors
    expect(new Set(colors).size).toBe(2) // (every piece splits here)
    const main = mainOfFalling(shift)!
    expect(colors).toContain(main)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(s.effects!.colorize!.color).toBe(main)
    expect(s.next).toEqual([main, main, main, main])
    for (const p of nextColours(shift, cfg, 6)) expect(p).toEqual([main, main, main, main])
  })

  it('wild pieces coming next are coloured too (wild only from rank 40)', () => {
    // a coloured falling piece first, then every piece after it wild: the colorizer turns them coloured
    const t = twists((x) => { x.wild.chance = 0 })
    const { shift, cfg } = withActive('goopColorizer', 1, { rank: 40, twists: t })
    const color = mainOfFalling(shift)
    t.wild.chance = 1 // (read live: from now on every new piece is wild)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'goopColorizer' })
    for (const p of nextColours(shift, cfg, 6)) expect(p.every((c) => c === color && c !== WILD)).toBe(true)
  })

  it('seeded: the same seed gives the same pieces with the colorizer on', () => {
    const play = () => {
      const { shift, cfg } = withActive('goopColorizer', 2, { seed: 9 })
      makeReady(shift)
      shift.act({ type: 'ability', id: 'goopColorizer' })
      return nextColours(shift, cfg, 10)
    }
    expect(play()).toEqual(play())
  })

  it('refused (charge kept) with no falling piece, or a wild one; firing again starts the count again', () => {
    const none = withActive('goopColorizer', 1, { training: {} })
    makeReady(none.shift)
    none.shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(ofType(none.shift.takeEvents(), 'reject')).toHaveLength(1)
    expect(none.a()).toMatchObject({ charge: 1, ready: true })

    const wild = withActive('goopColorizer', 1, { rank: 40, twists: twists((t) => { t.wild.chance = 1 }) })
    const next = [...wild.s.next!]
    makeReady(wild.shift)
    wild.shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(ofType(wild.shift.takeEvents(), 'reject')).toHaveLength(1)
    expect(wild.a().ready).toBe(true)
    expect(wild.s.next).toEqual(next) // nothing recoloured

    const again = withActive('goopColorizer', 1)
    makeReady(again.shift)
    again.shift.act({ type: 'ability', id: 'goopColorizer' })
    nextColours(again.shift, again.cfg, 2)
    expect(again.s.effects!.colorize!.left).toBe(3)
    makeReady(again.shift)
    again.shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(again.s.effects!.colorize!.left).toBe(5)
  })
})

describe('Crack Down (F42, rank 35) — the lowCracks effect, made real', () => {
  it('charges in 30 s; level 2: the next 5 cracks form in the bottom 4 rows, then it ends', () => {
    const cfg = straightLineCracks(config(), 300, 300)
    const { shift, s, a } = withActive('crackDown', 2, { rank: 35 }, cfg)
    shift.tick(29_000)
    expect(a().ready).toBe(false)
    s.cracks = [] // (cracks made while charging: out of the way)
    shift.tick(1_100)
    expect(a().ready).toBe(true)
    shift.takeEvents()
    shift.act({ type: 'ability', id: 'crackDown' })
    expect(shift.takeEvents()).toEqual([{ type: 'ability', id: 'crackDown' }])
    expect(s.effects!.lowCracks).toEqual({ id: 'crackDown', left: 5, rows: 4 })
    const log: ShiftEvent[] = []
    while (ofType(log, 'crack').length < 5) { shift.tick(50); log.push(...shift.takeEvents()) }
    for (const { crack } of ofType(log, 'crack').slice(0, 5)) expect(crack.y).toBeGreaterThanOrEqual(s.height - 4)
    expect(ofType(log, 'abilityEnd')).toEqual([{ type: 'abilityEnd', id: 'crackDown' }])
    expect(s.effects!.lowCracks).toBeUndefined()
  })

  it('level 1 / 3: 3 / 7 cracks', () => {
    for (const [level, cracks] of [[1, 3], [3, 7]]) {
      const { shift, s } = withActive('crackDown', level, { rank: 35 })
      makeReady(shift)
      shift.act({ type: 'ability', id: 'crackDown' })
      expect(s.effects!.lowCracks!.left).toBe(cracks)
    }
  })

  it('refused during a rupture (charge kept)', () => {
    const shift = ruptured('crackDown', 35)
    makeReady(shift)
    shift.act({ type: 'ability', id: 'crackDown' })
    expect(ofType(shift.takeEvents(), 'reject')).toHaveLength(1)
    expect(shift.state.abilities![0]).toMatchObject({ charge: 1, ready: true })
    expect(shift.state.effects!.lowCracks).toBeUndefined()
  })
})

describe('three actives in one shift (F42: up to 3 slots)', () => {
  it('each charges on its own and fires on its own id', () => {
    const owned = { goopDump: 1, goopColorizer: 1, crackDown: 1 }
    const abilities = resolveUpgrades(book, owned, ['goopDump', 'goopColorizer', 'crackDown']).abilities
    const shift = createShift(config(), { seed: 2, rank: 35, startGrid: new Uint8Array(30 * 24), abilities })
    const s = shift.state
    shift.tick(15_100)
    expect(s.abilities!.map((x) => x.ready)).toEqual([true, false, false])
    shift.tick(15_000)
    expect(s.abilities!.map((x) => x.ready)).toEqual([true, true, true])
    shift.takeEvents()
    shift.act({ type: 'ability', id: 'goopColorizer' })
    expect(shift.takeEvents()).toEqual([{ type: 'ability', id: 'goopColorizer' }])
    expect(s.abilities!.map((x) => x.ready)).toEqual([true, false, true])
    shift.act({ type: 'ability', id: 'goopDump' })
    shift.act({ type: 'ability', id: 'crackDown' })
    expect(ofType(shift.takeEvents(), 'ability').map((e) => e.id)).toEqual(['goopDump', 'crackDown'])
    expect(Object.keys(s.effects!).sort()).toEqual(['colorize', 'dump', 'lowCracks'])
  })
})
