// F31 (the Sprint 10 spike): the Goops side of day one — the new gates and tank pointers (goopsGates.ts) on a real
// training shift, and the new set-up words (goopsLessons.ts) going through the real adapter into the engine.
import { afterEach, describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import { pointerCells, tankGate } from '../../src/game/lessons/goopsGates'
import { lessonPlay, runner } from '../../src/game/lessons/goopsLessons'
import type { Lesson } from '../../src/game/lessons/lessonTypes'
import breakdowns from '../../content/tuning/breakdowns.json'
import dayFile from '../../content/lessons/first-day.json'

const day = dayFile as unknown as Lesson
import { dropPiece, idx, realConfig } from '../engine/helpers'

const BLUE = 2, GREEN = 3, YELLOW = 4 // (content/tuning/shift.json colors: red, blue, green, yellow…)

const training = () => {
  const config = realConfig()
  return { config, shift: createShift(config, { seed: 1, rank: 0, breakdowns, training: {} }) }
}

describe('Goops gates for day one (goopsGates.ts)', () => {
  it('ready / full / underLine by colour: C1 "the line passes the top of the yellow"', () => {
    const { shift } = training()
    const s = shift.state
    shift.train({ type: 'goop', cells: [[0, 23, BLUE], [1, 23, BLUE], [0, 22, YELLOW], [0, 21, YELLOW]] })
    expect(tankGate(s, 'full:yellow')).toBe(1) // placed goop is already full…
    expect(tankGate(s, 'underLine:yellow')).toBe(0) // …but its top (row 3 from the floor) is above the line at 0%
    expect(tankGate(s, 'ready:yellow')).toBe(0)
    expect(tankGate(s, 'ready:blue')).toBe(1) // on the floor: at the line even at 0%
    shift.train({ type: 'pressure', value: 0.15 }) // the line on row 4
    expect(tankGate(s, 'underLine:yellow')).toBe(1)
    expect(tankGate(s, 'ready:yellow')).toBe(1)
    expect(tankGate(s, 'ready:nope')).toBeNull() // (a typo: not a gate)
  })

  it('plugged / openCracks / wrongCover', () => {
    const { shift } = training()
    const s = shift.state
    shift.train({ type: 'crack', x: 0, y: 23, color: GREEN })
    shift.train({ type: 'crack', x: 3, y: 23, color: GREEN })
    expect([tankGate(s, 'plugged'), tankGate(s, 'openCracks'), tankGate(s, 'wrongCover')]).toEqual([0, 2, 0])
    shift.train({ type: 'goop', cells: [[0, 23, GREEN], [3, 23, BLUE]] })
    expect([tankGate(s, 'plugged'), tankGate(s, 'openCracks'), tankGate(s, 'wrongCover')]).toEqual([1, 1, 1])
  })

  it('pointers: the nearest crack of a kind; an out-of-view crack = the edge cell where its arrow is; the biggest group of a colour', () => {
    const { shift } = training()
    const s = shift.state
    shift.train({ type: 'crack', x: 4, y: 23, color: GREEN })
    shift.train({ type: 'crack', x: 2, y: 23, color: GREEN })
    expect(pointerCells(s, { crack: 'open' })).toEqual([[2, 23]])
    shift.train({ type: 'crack', x: 20, y: 20, color: GREEN }) // out of view, the short way round is left
    expect(pointerCells(s, { crack: 'outOfView' })).toEqual([[25, 20]]) // the view's left edge: spin - 5
    shift.train({ type: 'goop', cells: [[10, 23, BLUE], [11, 23, BLUE], [14, 23, BLUE]] })
    expect(pointerCells(s, { goop: 'blue' })).toEqual([[10, 23], [11, 23]])
    expect(pointerCells(s, { crack: 'wrongCover' })).toEqual([])
    expect(pointerCells(s, {})).toBeNull()
  })
})

describe('content/lessons/first-day.json (F31)', () => {
  const ids = day.steps.map((s) => s.id)
  it('one step per id; a checkpoint at the start of every phase A–F (leaving mid-day restarts there)', () => {
    expect(new Set(ids).size).toBe(ids.length)
    expect(day.steps.filter((s) => s.checkpoint).map((s) => s.id)).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1'])
  })
  it('never stuck: every retry has a most-tries, every interrupt range names real steps', () => {
    for (const s of day.steps) if (s.retry) expect(s.retry.max, s.id).toBeGreaterThan(0)
    for (const it of day.interrupts ?? []) for (const at of [it.from, it.to]) if (at) expect(ids, it.id).toContain(at)
  })
  it('only free play (F) lets the console in; the pause button (the way out) works in every step in the tank', () => {
    let allow: string[] | null = null
    for (const s of day.steps.slice(1)) {
      const rules = (s.setup?.rules ?? {}) as { allow?: string[] | null }
      if (s.setup?.play === 'normal') allow = null
      if (rules.allow !== undefined) allow = rules.allow
      expect(allow === null || allow.includes('pause'), s.id).toBe(true)
      const consoleOn = allow === null || allow.includes('console')
      expect(consoleOn, s.id).toBe(s.id.startsWith('F'))
    }
  })
})

describe('day one set-up words through the real adapter (goopsLessons.ts)', () => {
  afterEach(() => lessonPlay.stop())

  it('free play with rails in ONE set-up, a crack just out of view, and E1\'s fallback pieces', () => {
    const { shift, config } = training()
    const engine = lessonPlay.attach(shift)
    const lesson: Lesson = { id: 'f31-test', steps: [{ id: 'f1', message: 'x', setup: {
      play: 'normal', rules: { zone: 'tetra', pressureCap: 0.9, integrityFloor: 0.2, rupture: false },
      cracks: [['outOfView', 0, 'green'], ['inView', 0, 'green']],
      pieces: [], then: { pieces: [{ shape: 'T_O', color: 'green' }], buildUp: { cell: [0, 4], piece: { shape: 'T_I', color: 'blue' } } },
      spawn: true,
    } }] }
    runner.start(() => lesson)
    const rules = engine.snapshot().options.training!
    // "play": "normal" first, then the rails on top (before F31 the rails were overwritten by normal play)
    expect([rules.cracks, rules.integrity, rules.zone, rules.pressureCap, rules.integrityFloor, rules.rupture]).toEqual([true, true, 'tetra', 0.9, 0.2, false])
    const s = engine.state
    expect(tankGate(s, 'cracksOutOfView')).toBe(1)
    expect(s.cracks.map((c) => c.x)).toEqual([7, 0]) // just past the right edge · where pieces fall
    expect(s.piece!.colors[0]).toBe(BLUE) // column 0 is empty: an O can't reach row 4, so a blue I first
    dropPiece(engine, config)
    expect(s.grid[idx(0, 23)]).toBe(BLUE)
    expect(s.piece!.colors[0]).toBe(GREEN) // built up: now the green O
  })
})
