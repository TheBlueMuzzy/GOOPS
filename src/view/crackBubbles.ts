// F36 (Muzzy, 2026-10-18): an open crack lets out "a slightly unsteady stream of bubbles into the tank, as if air is
// getting in" — and it makes the crack easy to spot. Looks only: reads the engine's state, never writes it.
// The bubbles live in TANK space (column, row), so they turn with the tank; they rise, sway, fade, and pop when they
// reach goop. One fixed pool (no garbage per frame — cheap on a phone), drawn on the tank canvas under the goo.
// Moves on the looks clock: the frame loop's dt (keeps going in the Dev Kit's half pause, stops in the full pause).
// Knobs: content/tuning/cracks-look.json → bubbles (read live, every frame).
import type { ShiftState } from '../engine/types'
import type { GooView } from '../goo/types'
import { screenColumn } from '../goo/types'
import look from '../../content/tuning/cracks-look.json'

const POOL = 400 // the most the "max" knob can ask for

export interface CrackBubbles {
  // advance by dt seconds (looks clock); still = the reduce-motion setting (a calmer stream, no sway)
  step(s: ShiftState, dt: number, still: boolean): void
  // draw the bubbles in view (call inside the tank's clip); left/right = the visible tank's edges (CSS px)
  draw(ctx: CanvasRenderingContext2D, s: ShiftState, view: GooView, left: number, right: number): void
  count(): number // (dev + tests) bubbles alive right now
  from(crackId: number): number // (dev + tests) live bubbles from this crack
}

// An open crack: nothing on it (no goop of any colour). A covered one (any colour on it) gets the x-ray box and leaks
// at bubbles.covered × the rate, its bubbles rising up through the goop (Muzzy, 2026-10-19: "bubbles always leak from
// open cracks, but half as much from covered cracks, and not at all from sealed cracks" — sealed ones leave s.cracks).
export const crackIsOpen = (s: ShiftState, c: { x: number; y: number }) => s.grid[c.y * s.width + c.x] === 0

export function createCrackBubbles(): CrackBubbles {
  const live = new Uint8Array(POOL)
  const x = new Float32Array(POOL) // tank column (float; the cell's centre = its whole number)
  const y = new Float32Array(POOL) // tank row (float; the cell's top edge = its whole number)
  const age = new Float32Array(POOL)
  const life = new Float32Array(POOL)
  const size = new Float32Array(POOL)
  const rise = new Float32Array(POOL) // this bubble's own speed share
  const phase = new Float32Array(POOL)
  const crackOf = new Int32Array(POOL) // the crack id it came from
  const through = new Uint8Array(POOL) // came from a covered crack: rises through goop instead of popping on it
  const due = new Map<number, number>() // crack id → bubbles owed (grows with time, one comes out per whole number)
  let alive = 0, t = 0, calmNow = false // calmNow: reduce motion was on at the last step (no sway)

  const spawn = (c: { id: number; x: number; y: number }, B: typeof look.bubbles, covered: boolean) => {
    if (alive >= Math.min(POOL, B.max)) return
    let i = 0
    while (live[i]) i++
    live[i] = 1; alive++
    x[i] = c.x + (Math.random() - 0.5) * 0.3
    y[i] = c.y + 0.5 + (Math.random() - 0.5) * 0.6 // somewhere along the crack's length
    age[i] = 0
    life[i] = B.lifeSec * (0.7 + 0.6 * Math.random())
    size[i] = B.size * (1 + B.sizeJitter * (Math.random() * 2 - 1))
    rise[i] = 0.75 + 0.5 * Math.random()
    phase[i] = Math.random() * Math.PI * 2
    crackOf[i] = c.id
    through[i] = covered ? 1 : 0
  }

  return {
    step(s, dt, still) {
      if (dt <= 0) return
      t += dt
      calmNow = still
      const B = look.bubbles
      const calm = still ? B.calm : 1
      // the stream: each open crack owes perSec bubbles a second (a covered one × covered), swelling and fading in
      // gusts (two slow waves of its own, so neighbouring cracks don't puff in step) — "slightly unsteady"
      const seen = new Set<number>()
      for (const c of s.cracks) {
        seen.add(c.id)
        const covered = !crackIsOpen(s, c)
        const wave = 0.5 * Math.sin(t * 1.7 + c.id * 2.1) + 0.5 * Math.sin(t * 0.63 + c.id * 4.7) // −1..1
        const rate = Math.max(0, B.perSec * (covered ? B.covered : 1) * calm * (1 + B.gust * wave))
        let owed = (due.get(c.id) ?? Math.random()) + rate * dt
        while (owed >= 1) { spawn(c, B, covered); owed -= 1 }
        due.set(c.id, owed)
      }
      for (const id of due.keys()) if (!seen.has(id)) due.delete(id)
      // rise, age, pop
      const speed = B.speed * (still ? 0.6 : 1)
      for (let i = 0; i < POOL; i++) {
        if (!live[i]) continue
        age[i] += dt
        y[i] -= speed * rise[i] * dt * (0.6 + 0.4 * Math.min(1, age[i] / 0.4)) // a little push off the wall first
        const col = ((Math.round(x[i]) % s.width) + s.width) % s.width
        const row = Math.floor(y[i])
        const inGoop = row >= 0 && row < s.height && s.grid[row * s.width + col] !== 0
        if (age[i] >= life[i] || y[i] < s.bufferRows || (inGoop && !through[i] && age[i] > 0.15)) { live[i] = 0; alive-- }
      }
    },

    draw(ctx, s, view, left, right) {
      if (!alive) return
      const B = look.bubbles
      const cp = view.cellPx
      ctx.save()
      ctx.strokeStyle = B.color
      ctx.fillStyle = B.color
      ctx.lineWidth = Math.max(1, cp * 0.025)
      for (let i = 0; i < POOL; i++) {
        if (!live[i]) continue
        const sway = (calmNow ? 0 : B.wobble) * Math.sin(phase[i] + age[i] * B.wobbleHz * Math.PI * 2) * Math.min(1, age[i] / 0.5)
        const sx = view.centreX + screenColumn(x[i] + sway, view.camera, s.width) * cp
        const r = Math.max(0.6, size[i] * cp)
        if (sx < left - r || sx > right + r) continue
        const sy = view.topY + (y[i] - s.bufferRows) * cp
        const k = age[i] / life[i]
        const fade = Math.min(1, k / 0.12) * Math.min(1, (1 - k) / 0.35)
        ctx.globalAlpha = B.alpha * fade
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke()
        // a tiny shine, up-left
        ctx.globalAlpha = B.alpha * fade * 0.8
        ctx.beginPath(); ctx.arc(sx - r * 0.35, sy - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore()
    },

    count: () => alive,
    from(crackId) {
      let n = 0
      for (let i = 0; i < POOL; i++) if (live[i] && crackOf[i] === crackId) n++
      return n
    },
  }
}
