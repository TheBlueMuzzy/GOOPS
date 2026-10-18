// A whole seeded shift played by a simple scripted bot, with the rules' invariants checked every tick,
// and the same seed + same actions giving the exact same result.
import { describe, expect, it } from 'vitest'
import { createShift } from '../../src/engine'
import type { ShiftEngine, ShiftEvent, ShiftState } from '../../src/engine'
import { createRng } from '../../src/engine/rng'
import { neighbours } from '../../src/engine/tank'
import { realConfig } from './helpers'

// Plain checks (not expect) so thousands of ticks stay fast; the first broken rule throws with a reason.
function checkInvariants(s: ShiftState): void {
  const { grid, groupOf, groups, width, height } = s
  const fail = (why: string) => {
    throw new Error(`invariant broken: ${why}`)
  }
  // The falling piece never overlaps goop.
  if (s.piece) for (const [x, y] of s.piece.cells) if (y >= 0 && grid[y * width + x] !== 0) fail(`piece overlaps goop at ${x},${y}`)

  // Every goop cell is in exactly one group, of its own colour.
  let filled = 0
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) {
      if (groupOf[i] !== -1) fail(`empty cell ${i} has a group`)
      continue
    }
    filled++
    const g = groups.get(groupOf[i])
    if (!g) fail(`cell ${i} has no group`)
    else if (g.color !== grid[i]) fail(`cell ${i} colour ${grid[i]} in group of colour ${g.color}`)
  }
  let inGroups = 0
  for (const g of groups.values()) {
    inGroups += g.cells.length
    for (const i of g.cells) if (groupOf[i] !== g.id) fail(`group ${g.id} lists cell ${i} that belongs elsewhere`)
    if (g.fill < 0 || g.fill > 1) fail(`group ${g.id} fill ${g.fill}`)
  }
  if (inGroups !== filled) fail(`${filled} goop cells but ${inGroups} in groups`)

  // Groups are whole: touching cells of the same colour are always the same group.
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0) continue
    for (const n of neighbours(i, width, height)) if (grid[n] === grid[i] && groupOf[n] !== groupOf[i]) fail(`cells ${i} and ${n} touch but are split`)
  }

  // A crack is plugged exactly when goop of its colour covers it.
  for (const c of s.cracks) if (c.plugged !== (grid[c.y * width + c.x] === c.color)) fail(`crack ${c.id} plug state wrong`)
  if (s.pressure < 0 || s.pressure > 1) fail(`pressure ${s.pressure}`)
  if (s.integrity < 0 || s.integrity > 1) fail(`integrity ${s.integrity}`)}

// A dumb but busy player: spins, turns, drops, and pops anything ready. Returns the event log.
function playShift(seed: number, rank: number, check: boolean): { shift: ShiftEngine; log: ShiftEvent[]; ms: number } {
  const shift = createShift(realConfig(), { seed, rank })
  const bot = createRng(seed * 7 + 1)
  const log: ShiftEvent[] = []
  let lastPressure = shift.state.pressure
  let ms = 0
  while (shift.state.status === 'playing' && ms < 20 * 60 * 1000) {
    const roll = bot.next()
    if (roll < 0.25) shift.act({ type: 'spin', dir: bot.chance(0.5) ? 1 : -1 })
    else if (roll < 0.3) shift.act({ type: 'rotate', dir: bot.chance(0.5) ? 1 : -1 })
    else if (roll < 0.33) shift.act({ type: 'softDrop', on: bot.chance(0.8) }) // mostly fast-drops (no hard drop)
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
    // Like a player holding fast drop: most new pieces get dropped quickly (there's no hard drop).
    if (events.some((e) => e.type === 'spawn') && bot.chance(0.7)) shift.act({ type: 'softDrop', on: true })
    if (check) {
      checkInvariants(shift.state)
      // Before a rupture, pressure only ever goes down when something popped.
      const falling = shift.state.pressure < lastPressure - 1e-12
      if (falling && shift.state.phase === 'playing' && !events.some((e) => e.type === 'pop')) throw new Error('pressure fell without a pop')
      lastPressure = shift.state.pressure
    }
  }
  return { shift, log, ms }
}

describe('a whole shift', () => {
  for (const [seed, rank] of [[1, 1], [2, 12], [3, 35]]) {
    it(`seed ${seed}, rank ${rank}: plays to the end with every invariant holding`, () => {
      const { shift, log } = playShift(seed, rank, true)
      expect(shift.state.status).not.toBe('playing')
      expect(log.filter((e) => e.type === 'lock').length).toBeGreaterThan(10)
      expect(log.filter((e) => e.type === 'pop').length).toBeGreaterThan(0)
      expect(log.filter((e) => e.type === 'crack').length).toBeGreaterThan(0)
      expect(log.at(-1)).toEqual({ type: 'end', status: shift.state.status })
      // The shift ended through the loop: exactly one rupture, before the end.
      const ruptures = log.filter((e) => e.type === 'rupture')
      expect(ruptures).toHaveLength(1)
      expect(log.indexOf(ruptures[0])).toBeLessThan(log.length - 1)
      expect(shift.state.phase).toBe('rupture')
      expect(shift.state.status).toBe(shift.state.cracksSealed >= shift.state.cracksNeeded ? 'won' : 'lost')
      const quota = log.filter((e) => e.type === 'quotaMet').length
      expect(quota).toBe(shift.state.quotaMet ? 1 : 0)
    }, 60000)
  }

  it('same seed + same actions → the exact same shift', () => {
    const a = playShift(42, 5, false)
    const b = playShift(42, 5, false)
    expect(b.log).toEqual(a.log)
    expect(b.ms).toBe(a.ms)
    const snapshot = (s: ShiftState) => ({ ...s, grid: [...s.grid], groupOf: [...s.groupOf], groups: [...s.groups.values()] })
    expect(snapshot(b.shift.state)).toEqual(snapshot(a.shift.state))
    const c = playShift(43, 5, false)
    expect(c.log).not.toEqual(a.log)
  }, 60000)
})
