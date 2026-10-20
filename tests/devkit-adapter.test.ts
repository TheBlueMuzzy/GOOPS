// Goops' Dev Kit adapter (src/devkit-game/goopsAdapter.ts): snapshots go through App, junk is refused plainly,
// the bug-capture log gets short lines, and the one-line summary reads well.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeShift, eventLine, goopsAdapter } from '../src/devkit-game/goopsAdapter'
import { createShift } from '../src/engine'
import { session } from '../src/game/session'
import breakdowns from '../content/tuning/breakdowns.json'
import shift from '../content/tuning/shift.json'

afterEach(() => { session.engine = null; session.inShift = false; session.restore = null })

describe('goopsAdapter', () => {
  it('getState: the running shift as plain JSON, or no shift on the console', () => {
    expect(goopsAdapter.getState()).toEqual({ shift: null })
    session.engine = createShift(shift, { seed: 7, rank: 6, breakdowns })
    session.inShift = true
    const moment = goopsAdapter.getState() as { shift: { kind: string } }
    expect(moment.shift.kind).toBe('goops-shift')
    expect(JSON.parse(JSON.stringify(moment))).toEqual(moment)
    expect(goopsAdapter.describe!(moment)).toMatch(/^rank 6 · score 0 · cracks 0\/\d+ · pressure 0% · integrity 100%$/)
    expect(goopsAdapter.describe!({ shift: null })).toMatch(/console/)
  })
  it('setState hands a checked snapshot to App; junk is refused with a plain reason', () => {
    const restore = vi.fn()
    session.restore = restore
    session.engine = createShift(shift, { seed: 7, rank: 2 })
    session.inShift = true
    const moment = JSON.parse(JSON.stringify(goopsAdapter.getState()))
    goopsAdapter.setState(moment)
    expect(restore).toHaveBeenCalledWith(moment.shift)
    goopsAdapter.setState({ shift: null })
    expect(restore).toHaveBeenLastCalledWith(null)
    expect(() => goopsAdapter.setState(42)).toThrow(/isn't a Goops moment/)
    expect(() => goopsAdapter.setState({ shift: { kind: 'nope' } })).toThrow(/isn't a Goops shift snapshot/)
    expect(restore).toHaveBeenCalledTimes(2)
  })
  it('onEvent sends short lines for the moments that matter, nothing for every frame', () => {
    const send = vi.fn()
    const stop = goopsAdapter.onEvent!(send)
    session.emit([{ type: 'step' }, { type: 'breakdown', machine: 'laser' }, { type: 'rupture', reason: 'overflow' }])
    stop()
    session.emit([{ type: 'quotaMet' }])
    expect(send.mock.calls.map((c) => c[0])).toEqual(['laser BROKE', 'RUPTURE (no room for the next piece)'])
    expect(eventLine({ type: 'pop', cells: [1, 2, 3], color: 2, sealed: [4] })).toBe('zapped 3 cells of colour 2 — sealed 1 crack')
  })
  it('can pause both ways, offline', () => {
    expect(goopsAdapter.canRestore()).toBe(true)
    expect(goopsAdapter.pauseModes).toEqual(['full', 'half'])
    expect(describeShift({ rank: 1, score: 5, cracksSealed: 1, cracksNeeded: 4, pressure: 0.536, integrity: 0.8, phase: 'rupture', status: 'playing' }))
      .toBe('rank 1 · score 5 · cracks 1/4 · pressure 54% · integrity 80% · RUPTURE')
  })
})
