// Ported from v1 tests/gameLogic.test.ts (findContiguousGroup, getFloatingBlocks) against the new engine.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import { dropLoose, regroup } from '../../src/engine/groups'
import { idx, oneShapeConfig, tank } from './helpers'

const config = oneShapeConfig([[0, 0]])
const start = (grid: Uint8Array) => createShift(config, { seed: 1, rank: 0, startGrid: grid }).state

describe('groups', () => {
  it('joins same-colour cells that touch on a side', () => {
    const s = start(tank(['11.1', '1...'], 5))
    expect(s.groups.size).toBe(2)
    expect(s.groups.get(s.groupOf[idx(5, 23)])!.cells).toHaveLength(3)
  })

  it('keeps different colours apart, and corners do not join', () => {
    const s = start(tank(['12', '21'], 5))
    expect(s.groups.size).toBe(4)
  })

  it('wraps round the tank: column 29 touches column 0', () => {
    const s = start(tank(['1', '1'], 29).map((c, i) => c || (i === idx(0, 23) ? 1 : 0)))
    expect(s.groups.size).toBe(1)
    const g = [...s.groups.values()][0]
    expect(g.cells).toEqual([idx(29, 22), idx(0, 23), idx(29, 23)].sort((a, b) => a - b))
  })

  it('a group that does not change keeps its id', () => {
    const s = start(tank(['11'], 5))
    const id = s.groupOf[idx(5, 23)]
    regroup(s, { fillMs: new Map(), nextId: 100 })
    expect(s.groupOf[idx(6, 23)]).toBe(id)
  })
})

describe('sticky gravity (v1)', () => {
  it('nothing falls when everything rests on the floor', () => {
    const s = start(tank(['2', '1'], 5))
    expect(dropLoose(s, new Set())).toEqual([])
  })

  it('goop resting on a different group that rests on the floor stays up', () => {
    // Colour 2 overhangs empty space but sits on colour 1, which is on the floor.
    const s = start(tank(['22', '1.'], 5))
    expect(dropLoose(s, new Set())).toEqual([])
  })

  it('a floating cell falls to the floor', () => {
    const grid = tank(['1', '.', '.'], 5)
    const s = start(grid) // a start grid is taken as given until the first tick
    const moves = dropLoose(s, new Set())
    expect(moves).toEqual([[idx(5, 21), idx(5, 23)]])
    expect(s.grid[idx(5, 23)]).toBe(1)
  })

  it('cells of a loose group each drop straight down their own column (v1 loose goop)', () => {
    // An L of colour 1 hanging in the air; column 6 has a colour-2 stump under it.
    const s = start(tank(['11', '1.', '..', '.2'], 5))
    dropLoose(s, new Set())
    expect(s.grid[idx(5, 23)]).toBe(1)
    expect(s.grid[idx(5, 22)]).toBe(1)
    expect(s.grid[idx(6, 22)]).toBe(1) // stopped on the stump
  })

  it('goop does not fall through the falling piece', () => {
    const s = start(tank(['1', '.', '.'], 5))
    expect(dropLoose(s, new Set([idx(5, 22)]))).toEqual([])
  })
})
