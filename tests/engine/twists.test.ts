// F39 rank twists (src/engine/twists.ts, content/tuning/twists.json): two-colour pieces from rank 20, growing cracks
// from grow.fromRank (30; one crack over many cells — Muzzy 2026-10-25), wild goop from 40.
import { describe, expect, it } from 'vitest'
import { createShift, WILD, type Crack, type ShiftEngine, type TwistsConfig, type WhiteGoopConfig } from '../../src/engine'
import { restoreShift } from '../../src/engine/snapshot'
import { randomPiece } from '../../src/engine/pieces'
import { shapeSet } from '../../src/engine/config'
import { createRng } from '../../src/engine/rng'
import { bestSplit, crackSize, isConnected } from '../../src/engine/twists'
import { sealMs } from '../../src/engine/whiteGoop'
import twistsJson from '../../content/tuning/twists.json'
import whiteGoopJson from '../../content/tuning/whiteGoop.json'
import { dropPiece, idx, ofType, oneShapeConfig, realConfig, straightLineCracks, tank, tickUntil } from './helpers'

const twists = () => structuredClone(twistsJson) as TwistsConfig
const GROW = twistsJson.grow.fromRank // growing cracks start here (30)
// no cracks of the shift's own (the tests place theirs), pieces hanging still at the top
function quietConfig(colours = 4) {
  const config = straightLineCracks(realConfig(), 1e12, 1e12)
  config.fall.msPerRow = 1e9
  config.colorsByRank = [{ rank: 0, count: colours }]
  return config
}
// growth every 100 ms, always succeeding (so a test sees it at once)
function fastGrowth(): TwistsConfig {
  const t = twists()
  Object.assign(t.grow, { everyMsMin: 100, everyMsMax: 100, baseChance: 1, leafMult: 1, hopFalloff: 0, minFalloff: 1 })
  return t
}
const crack = (id: number, cells: [number, number][], color = 1): Crack =>
  ({ id, x: cells[0][0], y: cells[0][1], color, plugged: false, ...(cells.length > 1 ? { cells } : {}) })
function addCrack(shift: ShiftEngine, c: Crack) {
  shift.state.cracks.push(c)
  shift.tick(1) // (plugs update as it steps)
}
function popWhenReady(shift: ShiftEngine, x: number, y: number) {
  const s = shift.state
  tickUntil(shift, () => !!s.groups.get(s.groupOf[idx(x, y)])?.ready)
  shift.takeEvents()
  shift.act({ type: 'pop', x, y })
  return shift.takeEvents()
}

describe('two-colour pieces (rank 20)', () => {
  it('splits every piece shape into two joined-up halves, as even as the shape allows', () => {
    const config = realConfig()
    for (const zone of config.pieces.zones) {
      for (const shape of shapeSet(config, zone).normal) {
        // (shift.json's P_P, P_W and H_W aren't joined up themselves (found by F39): split only if both halves can be
        // joined up (P_W, H_W: the loose cell vs the rest), else they stay one colour (P_P: null))
        if (!isConnected(shape.cells)) {
          const inA = bestSplit(shape.cells)
          if (inA) expect(isConnected(shape.cells.filter((_, i) => inA[i])) && isConnected(shape.cells.filter((_, i) => !inA[i]))).toBe(true)
          continue
        }
        const inA = bestSplit(shape.cells)!
        expect(inA, shape.name).toBeTruthy()
        const a = shape.cells.filter((_, i) => inA[i]), b = shape.cells.filter((_, i) => !inA[i])
        expect(a.length > 0 && b.length > 0, shape.name).toBe(true)
        expect(isConnected(a) && isConnected(b), shape.name).toBe(true)
        // (the T's best is 3 + 1 and the plus's 4 + 1: every other cut leaves a half in pieces)
        expect(Math.abs(a.length - b.length), shape.name).toBeLessThanOrEqual(shape.name === 'P_X' ? 3 : 2)
      }
    }
    // the I and the square split 2 + 2
    expect(bestSplit([[0, -1], [0, 0], [0, 1], [0, 2]])!.filter(Boolean)).toHaveLength(2)
    expect(bestSplit([[0, 0], [0, 1], [1, 0], [1, 1]])!.filter(Boolean)).toHaveLength(2)
  })

  it('a two-colour piece keeps a colour per cell through falling, turning, swapping and the next window, and locks as two clumps', () => {
    const config = oneShapeConfig([[0, -1], [0, 0], [0, 1], [0, 2]])
    config.colorsByRank = [{ rank: 0, count: 4 }]
    const t = twists()
    t.split.chance = 1
    const shift = createShift(config, { seed: 5, rank: 20, twists: t, startGrid: new Uint8Array(30 * 24) })
    const s = shift.state
    const colours = [...s.piece!.colors]
    expect(new Set(colours).size).toBe(2)
    expect(new Set(s.next!).size).toBe(2) // the next window gets one colour per cell too
    shift.act({ type: 'rotate', dir: 1 })
    expect(s.piece!.colors).toEqual(colours) // (turning keeps each cell's colour: same order)
    const next = [...s.next!]
    shift.act({ type: 'hold' })
    expect(s.piece!.colors).toEqual(next)
    expect(s.next).toEqual(colours)
    shift.act({ type: 'hold' }) // back again
    const events = dropPiece(shift, config)
    const lock = ofType(events, 'lock')[0]
    expect(lock.colors).toEqual(lock.cells.map((i) => s.grid[i]))
    expect(new Set(lock.colors).size).toBe(2)
    const groups = new Set(lock.cells.map((i) => s.groupOf[i]))
    expect(groups.size).toBe(2) // two clumps
  })

  it('starts at rank 20, not 19 — and below it the pieces are exactly as before F39', () => {
    const config = realConfig()
    const t = twists()
    t.split.chance = 1
    const roll = (rank: number, tw?: TwistsConfig) => {
      const rng = createRng(77)
      return Array.from({ length: 40 }, () => randomPiece(rng, config, 'tetra', 4, tw ? { config: tw, rank } : undefined))
    }
    expect(roll(19, t)).toEqual(roll(19)) // same rolls, same pieces
    expect(roll(19, t).some((p) => p.colors)).toBe(false)
    expect(roll(20, t).filter((p) => !p.corrupted).every((p) => p.colors && new Set(p.colors).size === 2)).toBe(true)
  })
})

describe('corrupt and wild pieces never split', () => {
  it('a corrupt piece is never two-colour or wild; a wild piece is never two-colour', () => {
    const config = realConfig()
    const t = twists()
    t.split.chance = 1
    t.wild.chance = 1
    config.pieces.corruptChance = 1
    const rng = createRng(3)
    for (let i = 0; i < 30; i++) {
      const p = randomPiece(rng, config, 'tetra', 6, { config: t, rank: 50 })
      expect(p.corrupted && !p.colors && p.color !== WILD).toBe(true)
    }
    config.pieces.corruptChance = 0
    for (let i = 0; i < 30; i++) {
      const p = randomPiece(rng, config, 'tetra', 6, { config: t, rank: 50 })
      expect(p.color).toBe(WILD)
      expect(p.colors).toBeUndefined()
    }
  })
})

describe('growing cracks (grow.fromRank)', () => {
  it('starts at its rank, not the one before', () => {
    for (const [rank, grows] of [[GROW - 1, false], [GROW, true]] as const) {
      const shift = createShift(quietConfig(), { seed: 1, rank, twists: fastGrowth(), startGrid: new Uint8Array(30 * 24) })
      addCrack(shift, crack(500, [[10, 23]]))
      shift.tick(1000)
      expect(crackSize(shift.state.cracks[0]) > 1, `rank ${rank}`).toBe(grows)
      if (grows) expect(ofType(shift.takeEvents(), 'crackGrow').length).toBeGreaterThan(0)
    }
  })

  it('grows only into empty cells, never above the pressure line — and goop covering a cell stops it growing', () => {
    // covered: goop on the crack's only cell → it never grows
    const covered = createShift(quietConfig(), { seed: 2, rank: GROW, twists: fastGrowth(), startGrid: tank(['1'], 10) })
    addCrack(covered, crack(500, [[10, 23]]))
    covered.tick(3000)
    expect(crackSize(covered.state.cracks[0])).toBe(1)
    // open, with goop beside it on one side: it grows along the floor (the pressure line is on the floor at 0 pressure)
    const open = createShift(quietConfig(), { seed: 2, rank: GROW, twists: fastGrowth(), startGrid: tank(['1'], 9) })
    addCrack(open, crack(500, [[10, 23]]))
    open.tick(500)
    const c = open.state.cracks[0]
    expect(crackSize(c)).toBeGreaterThan(1)
    for (const [x, y] of c.cells!) {
      expect(y).toBeGreaterThanOrEqual(open.state.pressureRow)
      expect(open.state.grid[idx(x, y)]).toBe(0)
    }
    expect(c.cells!.some(([x]) => x === 9)).toBe(false) // never into the goop
  })

  it('a grown crack is plugged only when EVERY cell has its colour on it; sealing it counts its size toward the quota', () => {
    // half covered: goop on 1 of its 2 cells → popping it seals nothing
    const half = createShift(quietConfig(), { seed: 3, rank: 0, startGrid: tank(['1'], 5) })
    addCrack(half, crack(500, [[5, 23], [6, 23]]))
    expect(half.state.cracks[0].plugged).toBe(false)
    expect(ofType(popWhenReady(half, 5, 23), 'pop')[0].sealed).toEqual([])
    expect(half.state.cracksSealed).toBe(0)
    // all covered → plugged → popping seals the whole crack, counting 2
    const full = createShift(quietConfig(), { seed: 3, rank: 0, startGrid: tank(['11'], 5) })
    addCrack(full, crack(500, [[5, 23], [6, 23]]))
    expect(full.state.cracks[0].plugged).toBe(true)
    expect(ofType(popWhenReady(full, 5, 23), 'pop')[0].sealed).toEqual([500])
    expect(full.state.cracksSealed).toBe(2)
    expect(full.state.cracks).toHaveLength(0)
    expect(full.state.sealedCracks!.filter((p) => p.id === 500).map((p) => [p.x, p.y])).toEqual([[5, 23], [6, 23]]) // every cell mended
  })

  it('an open crack drains integrity per cell', () => {
    const drained = (cells: [number, number][]) => {
      const shift = createShift(quietConfig(), { seed: 4, rank: 0, startGrid: new Uint8Array(30 * 24) })
      addCrack(shift, crack(500, cells))
      const before = shift.state.integrity
      shift.tick(2000)
      return before - shift.state.integrity
    }
    const one = drained([[5, 23]])
    expect(one).toBeGreaterThan(0)
    expect(drained([[5, 23], [6, 23], [7, 23]])).toBeCloseTo(one * 3, 6)
  })

  it('the white goop seals a grown crack whole, in sealTime × its size', () => {
    const cfg = structuredClone(whiteGoopJson) as WhiteGoopConfig
    expect(sealMs(cfg, crack(1, [[0, 23]]))).toBe(cfg.sealTime * 1000)
    expect(sealMs(cfg, crack(1, [[0, 23], [1, 23], [2, 23]]))).toBe(cfg.sealTime * 3000)
    cfg.sealTimePerExtraCell = 0.5
    expect(sealMs(cfg, crack(1, [[0, 23], [1, 23], [2, 23]]))).toBe(cfg.sealTime * 2000)

    // in a shift: he sits on one cell of a 2-cell crack and seals it all, counting 2
    const sealing = whiteGoopJson.sealTime * 1000
    const white = { ...structuredClone(whiteGoopJson), countsForQuota: true } as WhiteGoopConfig // (counting on, to see the 2)
    const shift = createShift(quietConfig(), { seed: 6, rank: 31, whiteGoop: white, startGrid: new Uint8Array(30 * 24) })
    tickUntil(shift, () => shift.state.vet!.mode !== 'drop', 10_000, 5)
    const v = shift.state.vet!
    addCrack(shift, crack(500, [[v.x, v.y], [(v.x + 1) % 30, v.y]]))
    tickUntil(shift, () => shift.state.vet!.mode === 'seal', 5000, 5)
    shift.tick(sealing * 1.5) // one sealTime and a half: not done yet
    expect(shift.state.cracks.some((c) => c.id === 500)).toBe(true)
    shift.tick(sealing)
    expect(shift.state.cracks.some((c) => c.id === 500)).toBe(false)
    expect(shift.state.cracksSealed).toBe(2)
  })

  it('a snapshot keeps a grown crack (and one from before F39 still loads)', () => {
    const config = quietConfig()
    const shift = createShift(config, { seed: 8, rank: GROW, twists: fastGrowth(), startGrid: new Uint8Array(30 * 24) })
    addCrack(shift, crack(500, [[10, 23]]))
    shift.tick(450)
    const snap = shift.snapshot()
    expect(snap.state.cracks[0].cells!.length).toBeGreaterThan(1)
    const back = restoreShift(config, snap, undefined, undefined, fastGrowth())
    expect(back.state.cracks).toEqual(shift.state.cracks)
    shift.tick(1000); back.tick(1000)
    expect(back.state.cracks).toEqual(shift.state.cracks) // (and grows on the same)
    const old = structuredClone(snap)
    for (const c of old.state.cracks) { delete c.cells; delete c.parent; delete c.growMs }
    expect(crackSize(restoreShift(config, old).state.cracks[0])).toBe(1)
  })
})

describe('wild goop (rank 40)', () => {
  it('starts at rank 40, not 39', () => {
    const config = realConfig()
    config.pieces.corruptChance = 0
    const t = twists()
    t.wild.chance = 1
    const rng = createRng(9)
    expect(randomPiece(rng, config, 'tetra', 6, { config: t, rank: 39 }).color).not.toBe(WILD)
    expect(randomPiece(rng, config, 'tetra', 6, { config: t, rank: 40 }).color).toBe(WILD)
  })

  it('plugs and seals a crack of any colour', () => {
    const grid = new Uint8Array(30 * 24)
    grid[idx(5, 23)] = WILD
    grid[idx(6, 23)] = WILD
    const shift = createShift(quietConfig(), { seed: 10, rank: 0, startGrid: grid })
    addCrack(shift, crack(500, [[5, 23]], 3))
    addCrack(shift, crack(501, [[6, 23]], 2))
    expect(shift.state.cracks.every((c) => c.plugged)).toBe(true)
    expect(ofType(popWhenReady(shift, 5, 23), 'pop')[0].sealed.sort()).toEqual([500, 501])
    expect(shift.state.cracksSealed).toBe(2)
  })

  it('a normal piece landing next to a wild clump turns the whole clump its colour; a wild piece changes nothing', () => {
    const config = oneShapeConfig([[0, 0]]) // one cell, colour 1, straight down column 0
    const grid = new Uint8Array(30 * 24)
    for (const i of [idx(1, 23), idx(2, 23), idx(2, 22)]) grid[i] = WILD
    grid[idx(5, 23)] = 2
    const shift = createShift(config, { seed: 11, rank: 0, startGrid: grid })
    const events = dropPiece(shift, config)
    const turn = ofType(events, 'wildTurn')
    expect(turn).toHaveLength(1)
    expect(turn[0]).toMatchObject({ color: 1, cells: [idx(2, 22), idx(1, 23), idx(2, 23)] })
    const s = shift.state
    expect([idx(0, 23), idx(1, 23), idx(2, 23), idx(2, 22)].map((i) => s.grid[i])).toEqual([1, 1, 1, 1])
    expect(new Set([idx(0, 23), idx(1, 23), idx(2, 23), idx(2, 22)].map((i) => s.groupOf[i])).size).toBe(1) // one clump now

    // a wild piece landing beside coloured goop: the goop keeps its colour, the wild stays wild
    const t = twists()
    t.wild.chance = 1
    const wildConfig = oneShapeConfig([[0, 0]])
    const wildShift = createShift(wildConfig, { seed: 12, rank: 40, twists: t, startGrid: tank(['.2'], 0) })
    expect(wildShift.state.piece!.colors).toEqual([WILD])
    dropPiece(wildShift, wildConfig)
    expect(wildShift.state.grid[idx(0, 23)]).toBe(WILD)
    expect(wildShift.state.grid[idx(1, 23)]).toBe(2)
  })
})
