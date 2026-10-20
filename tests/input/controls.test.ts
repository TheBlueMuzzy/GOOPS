// F24 (GDD §5): broken controls = a HELD spin (key held, or a held sideways drag) repeats at half speed; single
// presses and quick swipes are unchanged. Runs the real controller (src/input/controls.ts) on a stand-in element,
// with the clock, the frames and the window faked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachControls } from '../../src/input/controls'
import tank from '../../content/tuning/tank.json'

const g = globalThis as unknown as Record<string, unknown>
let detach: (() => void) | null = null
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  g.window = new EventTarget()
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16)
  g.cancelAnimationFrame = (id: number) => clearTimeout(id)
})
afterEach(() => { detach?.(); detach = null; vi.useRealTimers(); delete g.window; delete g.requestAnimationFrame; delete g.cancelAnimationFrame })

const event = (type: string, props: Record<string, unknown>) => Object.assign(new Event(type), props)
function setup(slowdown: number) {
  const el = Object.assign(new EventTarget(), {
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }),
  }) as unknown as HTMLElement
  const spins: number[] = []
  detach = attachControls(el, {
    spin: (dir) => spins.push(dir), rotate: () => {}, softDrop: () => {}, tapCell: () => false, hold: () => {}, console: () => {},
    spinSlowdown: () => slowdown,
  }, () => true)
  const key = (type: 'keydown' | 'keyup', code: string) => (window as unknown as EventTarget).dispatchEvent(event(type, { code, repeat: false }))
  const pointer = (type: string, x: number, y = 400) => el.dispatchEvent(event(type, { pointerId: 1, clientX: x, clientY: y }))
  return { spins, key, pointer }
}

describe('held spin with broken controls', () => {
  it('a held key repeats at half speed (first turn at once, same first delay)', () => {
    const counts = [1, 2].map((slowdown) => {
      const { spins, key } = setup(slowdown)
      key('keydown', 'KeyA')
      vi.advanceTimersByTime(tank.spinFirstDelayMs + 10 * tank.spinRepeatMs * 2 - 1)
      key('keyup', 'KeyA')
      vi.advanceTimersByTime(500) // let go: no more
      detach!(); detach = null
      return spins.length
    })
    // fine: 1 + ~20 repeats · broken: 1 + ~10 (a repeat waits for the next 16 ms frame, so it's a little slower than the number)
    expect(counts[0] - 1).toBeGreaterThanOrEqual(15)
    expect((counts[0] - 1) / (counts[1] - 1)).toBeGreaterThan(1.7)
    expect((counts[0] - 1) / (counts[1] - 1)).toBeLessThan(2.3)
  })

  it('a held sideways drag repeats at half speed too', () => {
    const counts = [1, 2].map((slowdown) => {
      const { spins, pointer } = setup(slowdown)
      pointer('pointerdown', 200)
      pointer('pointermove', 140) // past the lock and the dead zone, to the left
      vi.advanceTimersByTime(2000)
      pointer('pointerup', 140)
      vi.advanceTimersByTime(500)
      detach!(); detach = null
      return spins.length
    })
    expect(counts[0]).toBeGreaterThanOrEqual(15)
    expect(counts[0] / counts[1]).toBeGreaterThan(1.7)
    expect(counts[0] / counts[1]).toBeLessThan(2.3)
  })

  it('single presses and quick swipes are unchanged', () => {
    for (const slowdown of [1, 2]) {
      const { spins, key, pointer } = setup(slowdown)
      key('keydown', 'KeyD'); vi.advanceTimersByTime(60); key('keyup', 'KeyD')
      vi.advanceTimersByTime(300)
      key('keydown', 'KeyD'); vi.advanceTimersByTime(60); key('keyup', 'KeyD')
      vi.advanceTimersByTime(300)
      pointer('pointerdown', 200); vi.advanceTimersByTime(30); pointer('pointermove', 140); vi.advanceTimersByTime(40); pointer('pointerup', 140)
      vi.advanceTimersByTime(300)
      expect(spins).toEqual([1, 1, 1]) // D = the view right (+1, 2026-10-18 flip); the swipe left pulls the goop left (+1)
      detach!(); detach = null
    }
  })
})

// F59: swap unlocks by rank. Locked, holding Right Shift / R or holding still on the tank does nothing — no charging
// ring (holdProgress) and no swap.
describe('hold to swap', () => {
  function swapSetup(canSwap: boolean) {
    const el = Object.assign(new EventTarget(), {
      setPointerCapture: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }),
    }) as unknown as HTMLElement
    const seen = { holds: 0, rings: [] as (number | null)[], rotates: 0 }
    detach = attachControls(el, {
      spin: () => {}, rotate: () => { seen.rotates++ }, softDrop: () => {}, tapCell: () => false, console: () => {},
      hold: () => { seen.holds++ }, holdProgress: (p) => { seen.rings.push(p) }, canSwap: () => canSwap,
    }, () => true)
    const key = (type: 'keydown' | 'keyup', code: string) => (window as unknown as EventTarget).dispatchEvent(event(type, { code, repeat: false }))
    const pointer = (type: string) => el.dispatchEvent(event(type, { pointerId: 1, clientX: 200, clientY: 400 }))
    return { seen, key, pointer }
  }
  const holdFor = tank.holdToSwapMs + 200

  it('unlocked: Right Shift, R and holding still each swap once, with the charging ring', () => {
    const { seen, key, pointer } = swapSetup(true)
    for (const code of ['ShiftRight', 'KeyR']) { key('keydown', code); vi.advanceTimersByTime(holdFor); key('keyup', code) }
    pointer('pointerdown'); vi.advanceTimersByTime(holdFor); pointer('pointerup')
    expect(seen.holds).toBe(3)
    expect(seen.rings.some((p) => p !== null && p > 0)).toBe(true)
  })

  it('locked: none of them do anything — no swap, no ring, and a long press is not a tap either', () => {
    const { seen, key, pointer } = swapSetup(false)
    for (const code of ['ShiftRight', 'KeyR']) { key('keydown', code); vi.advanceTimersByTime(holdFor); key('keyup', code) }
    pointer('pointerdown'); vi.advanceTimersByTime(holdFor); pointer('pointerup')
    expect(seen.holds).toBe(0)
    expect(seen.rings).toEqual([])
    expect(seen.rotates).toBe(0)
  })
})
