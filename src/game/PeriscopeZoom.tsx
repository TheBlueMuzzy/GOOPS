// F56 — PERISCOPE ZOOM (Muzzy's sketch S13 v4, look B: .planning/research/sketches/periscope-zoom.html, picks.json).
// The console wears this. At the console the periscope's goggles show the tank: the shift's stage (ShiftStage — the
// SAME render as in the shift, so whatever is drawn over the tank later shows here too) stays full-screen UNDER the
// console, the console has a hole where the goggles' glass is (a CSS mask), and the stage is moved + scaled so the
// tank's whole width is the dark blue inner glass's width, its floor just above the glass's bottom edge. The black
// ring round the inner glass shows the same tank blurred, with some of its black over it (a backdrop blur shaped like
// the ring — it sits between the stage and the console, outside the console: a mask or a fade on the console would cut
// a blur inside it off from the stage). The inner glass has a light tint of its colour.
// The zoom (the sketch's draw(), style B): once the periscope has landed (phase 'leaving') the console scales up — the
// size growing steadily (log), the glass's centre gliding to where it lands — until the inner glass IS the full-screen
// tank: the stage is then exactly where the shift draws it, so the switch is exact (no jump). The console and the
// ring fade out over the last frameFade of it. The way back ('arriving') is the mirror; then the periscope lifts as
// its glide played backwards (Goops' CSS, periscope.css). Numbers: content/tuning/periscope.json, read every frame;
// the zoom runs on the looks clock (the Dev Kit's full pause holds it). Reduce motion: no zoom, the switch is instant.
// Its frame loop only moves and fades three elements (no drawing): the tank itself draws in ShiftStage's loop.
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import periscope from '../../content/tuning/periscope.json'
import { art } from '../ui/art'
import { motionTime, reduceMotion } from '../ui/kit'
import { clockPause, looksClock } from '../devkit/gameClock'
import { tankWindow } from './periscopeView'
import { SOUNDS } from './shiftSounds'
import { playUiSound } from './sound'
import './periscope.css'

type Phase = 'idle' | 'leaving' | 'arriving'
type Props = {
  phase: Phase // idle = the console · leaving = the periscope landed: zoom in · arriving = zoom out (then it lifts)
  onDone(): void // the zoom (in or out) finished — or, with nothing to zoom, at once
  see?: boolean // false = the goggles look at nothing (the ending): their painted glass, and no zoom
  live?: boolean // a shift is going (mid-shift at the console): the goggles stay on. Between shifts they're off (their
  // painted glass) until the periscope starts down — then they flicker on like an old CRT (Muzzy 2026-11-01)
  backdrop?: string // F77: the console's backdrop picture — drawn here, under the console's Screen, so the hole is cut in it
  // alone (the Screen's own backdrop would take the hole into everything inside it, the monitor too)
  children: ReactNode // the console's Screen
}

const P = art.console.periscope, G = art.console.periscopeGlass
const [RX, RY, RW, RH] = G.ring.box
// A glass path, moved so the ring's box corner is 0,0 (the overlay's own units). The art's paths start with one
// absolute M and are relative after it (tests/periscopeGlass.test.ts checks), so only that M moves.
const local = (d: string) => d.replace(/^M\s*([-\d.]+)[,\s]+([-\d.]+)/, (_, x, y) => `M${+(x - RX).toFixed(3)},${+(y - RY).toFixed(3)}`)
const RING_CLIP = `path(evenodd, "${local(G.ring.d)} ${local(G.inner.d)}")` // the ring = the outer glass minus the inner
const INNER_CLIP = `path("${local(G.inner.d)}")`
// the hole in the console: the outer glass's shape, as a picture the mask places over the goggles
const LENS_MASK = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${RX} ${RY} ${RW} ${RH}" preserveAspectRatio="none"><path d="${G.ring.d}"/></svg>`)}")`
const SOLID = 'linear-gradient(#000 0 0)'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
// ease-in-out power k: 1 = steady; higher = a softer start and landing, a quicker middle (the sketch's easeIO)
const easeIO = (t: number, k: number) => (t < 0.5 ? 0.5 * Math.pow(2 * t, k) : 1 - 0.5 * Math.pow(2 - 2 * t, k))
// the periscope's lift = its glide down played backwards: the style's --ease curve mirrored (a cubic-bezier's reverse
// is (1-x2, 1-y2, 1-x1, 1-y1)); a curve that isn't a cubic-bezier → ease-in
function reversedEase(): string {
  const m = getComputedStyle(document.documentElement).getPropertyValue('--ease').match(/cubic-bezier\(([^)]+)\)/)
  const v = m?.[1].split(',').map(Number)
  if (!v || v.length !== 4 || v.some(Number.isNaN)) return 'ease-in'
  return `cubic-bezier(${1 - v[2]}, ${1 - v[3]}, ${1 - v[0]}, ${1 - v[1]})`
}

type Box = { x: number; y: number; w: number; h: number }
// Where things are with the console at rest (no zoom on it), in screen px
type Geo = {
  u: number; ox: number; oy: number // px per mock-up unit, and the screen px of the mock-up's 0,0 — for the periscope (with its pull)
  // F77: what the hole is cut in — the backdrop and the console's layers up to the periscope (.console-under): their
  // boxes at rest, so the hole sits in each one's own place. The monitor and its screen come after, never cut.
  cut: { el: HTMLElement; box: Box }[]
  stage: HTMLElement; k0: number; sx: number; sy: number // the stage pinned to the inner glass: x → k0·x + sx
}

// Measure the console at rest (its zoom off): the periscope picture's box gives the mock-up's scale and the pull
function measure(wrap: HTMLElement): Geo | null {
  const stage = tankWindow.stage, tank = tankWindow.box
  const img = wrap.querySelector('.kit-pull img')
  if (!stage || !tank || !img || tank.width <= 0) return null
  const r = img.getBoundingClientRect()
  if (r.width <= 0) return null
  const u = r.width / P.at[2], ox = r.left - P.at[0] * u, oy = r.top - P.at[1] * u
  const cut = [...wrap.querySelectorAll<HTMLElement>('.periscope-backdrop, .console-under')].map((el) => {
    const b = el.getBoundingClientRect()
    return { el, box: { x: b.left, y: b.top, w: b.width, h: b.height } }
  })
  const [ix, iy, iw, ih] = G.inner.box
  const k0 = (iw * u) / tank.width
  return { u, ox, oy, cut, stage, k0, sx: ox + ix * u - k0 * tank.left, sy: oy + (iy + ih - periscope.floorLift) * u - k0 * tank.floor }
}

// (dev + tests: window.__periscopeZoom.hold(sw) keeps every zoom at that share until hold(null) — kept here, not in a
// console, because the console coming back is a new one)
let testHold: number | null = null
const matrix = (s: number, x: number, y: number) => `matrix(${s}, 0, 0, ${s}, ${x}, ${y})`
// the stage back where the shift draws it (no zoom on it)
const release = (stage: HTMLElement) => { stage.style.transform = ''; stage.style.transformOrigin = '' }

// Is the periscope on its way down? (a finger on it, its glide, or held down) — the kit PullHandle's own marks
const pulling = (w: HTMLElement) => {
  const pull = w.querySelector<HTMLElement>('.kit-pull')
  return !!pull && (pull.hasAttribute('data-dragging') || pull.hasAttribute('data-pulled') || parseFloat(pull.style.getPropertyValue('--kit-pull')) > 0)
}

export function PeriscopeZoom({ phase, onDone, see = true, live = false, backdrop, children }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const seeing = useRef(see)
  useLayoutEffect(() => { seeing.current = see })
  const isLive = useRef(live)
  useLayoutEffect(() => { isLive.current = live })
  // the goggles' power: off = their painted glass over the tank (a cover, periscope.css); on = the tank. A console
  // that opens mid-zoom (a shift going, or just ended) opens on.
  const power = useRef<'off' | 'on'>(live || phase !== 'idle' ? 'on' : 'off')
  const glass = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  // the zoom now: its direction (null = none), when it started (looks ms), the console measured at its start,
  // and `held` (the 'in' zoom finished: its last frame stays until the console goes)
  const zoom = useRef<{ dir: 'in' | 'out' | null; t0: number; geo: Geo | null; held: boolean }>({ dir: null, t0: 0, geo: null, held: false })
  const written = useRef(new Map<string, string>()) // what each style was last set to (only changes are written)
  const lastStage = useRef<HTMLElement | null>(null)

  // Put everything where `geo` and the zoom share sw (0 = the console … 1 = the tank) say
  const apply = useRef((geo: Geo | null, sw: number) => {
    const w = wrap.current, g = glass.current, rg = ring.current, ig = inner.current
    if (!w || !g || !rg || !ig) return
    const set = (el: HTMLElement, key: string, prop: string, value: string) => {
      const id = `${key}:${prop}`
      if (written.current.get(id) === value) return
      written.current.set(id, value)
      el.style.setProperty(prop, value)
    }
    // (a new stage under the console: let go of the old one)
    if (lastStage.current && lastStage.current !== geo?.stage) {
      release(lastStage.current)
      written.current.delete('stage:transform'); written.current.delete('stage:transform-origin')
    }
    lastStage.current = geo?.stage ?? null
    if (!geo) { // nothing to look at (no tank, or the ending): the goggles' painted glass, as drawn
      for (const prop of ['transform', 'opacity']) set(w, 'wrap', prop, '')
      w.querySelectorAll<HTMLElement>('.periscope-backdrop, .console-under').forEach((el, i) => set(el, `cut${i}`, 'mask-image', ''))
      set(g, 'glass', 'display', 'none')
      return
    }
    const { u, ox, oy, k0, sx, sy } = geo
    // the zoom: the console's scale z grows steadily from 1 to z1 (where the pinned tank IS the full-screen tank),
    // and the glass's centre glides from where it is to where it lands (the sketch's draw(), style B)
    const z1 = 1 / k0, z = Math.pow(z1, sw)
    const cx = ox + (RX + RW / 2) * u, cy = oy + (RY + RH / 2) * u
    const lerp = z1 === 1 ? 1 : (z - 1) / (z1 - 1)
    const px = cx + (z1 * cx - sx / k0 - cx) * lerp, py = cy + (z1 * cy - sy / k0 - cy) * lerp
    const zx = px - z * cx, zy = py - z * cy
    const fade = clamp01((1 - sw) / Math.max(0.01, periscope.frameFade))
    set(w, 'wrap', 'transform', sw > 0 ? matrix(z, zx, zy) : '')
    set(w, 'wrap', 'opacity', fade < 1 ? String(fade) : '')
    // the hole: the outer glass's shape, cut in the backdrop and the console's layers up to the periscope — each at the
    // goggles' place in its own box (F77: the monitor and its screen are after them, so nothing here can cut them)
    const hole = { x: ox + RX * u, y: oy + RY * u, w: RW * u, h: RH * u }
    geo.cut.forEach(({ el, box }, i) => {
      set(el, `cut${i}`, 'mask-image', `${LENS_MASK}, ${SOLID}`)
      set(el, `cut${i}`, 'mask-size', `${hole.w}px ${hole.h}px, 100% 100%`)
      set(el, `cut${i}`, 'mask-position', `${hole.x - box.x}px ${hole.y - box.y}px, 0 0`)
      set(el, `cut${i}`, 'mask-repeat', 'no-repeat')
      set(el, `cut${i}`, 'mask-composite', 'exclude')
    })
    // the stage: pinned to the glass, then zoomed with the console (at sw 1: no transform at all — the shift's own place)
    const k = z * k0, tx = z * sx + zx, ty = z * sy + zy
    set(geo.stage, 'stage', 'transform-origin', '0 0')
    set(geo.stage, 'stage', 'transform', sw >= 1 ? '' : matrix(k, tx, ty))
    // the glass over the stage, in the ring's box (mock-up units → screen): the blurry ring, the inner glass's tint
    set(g, 'glass', 'display', 'block')
    set(g, 'glass', 'transform', matrix(z * u, z * hole.x + zx, z * hole.y + zy))
    set(rg, 'ring', 'opacity', String(fade))
    set(rg, 'ring', 'backdrop-filter', periscope.ringBlur > 0 ? `blur(${periscope.ringBlur}px)` : 'none') // (in the ring's units: it scales with it)
    set(rg, 'ring', 'background-color', `color-mix(in srgb, ${G.ring.colour} ${clamp01(periscope.ringDark) * 100}%, transparent)`)
    set(ig, 'inner', 'opacity', String(clamp01(periscope.tint) * (1 - sw)))
  })

  // A zoom starts: measure the console at rest (no zoom on it yet), then run it — or, with nothing to show or reduce
  // motion on, finish at once
  const begin = useRef((dir: 'in' | 'out') => {
    const z = zoom.current, w = wrap.current
    if (!w) return
    w.style.transform = ''; written.current.delete('wrap:transform') // (at rest, for the measuring)
    const geo = seeing.current ? measure(w) : null
    z.geo = geo
    const ms = dir === 'in' ? periscope.zoomMs : periscope.backMs
    if (!geo || reduceMotion() || ms <= 0) {
      apply.current(dir === 'in' ? null : geo, 0)
      z.dir = null; z.held = dir === 'in'
      w.toggleAttribute('data-zoom', false)
      done.current()
      return
    }
    z.dir = dir; z.t0 = looksClock.now(); z.held = false
    w.setAttribute('data-zoom', dir) // (tests wait for it to go: e2e/periscope-zoom.mjs and the console's other scripts)
    playUiSound(dir === 'in' ? SOUNDS.zoomIn : SOUNDS.zoomOut) // (only a zoom that runs: none with reduce motion)
    apply.current(geo, dir === 'in' ? 0 : 1)
  })

  // each phase: leaving zooms in, arriving zooms out (a fresh console: before its first paint, so it opens zoomed in)
  useLayoutEffect(() => {
    if (phase === 'leaving') begin.current('in')
    else if (phase === 'arriving') begin.current('out')
  }, [phase])

  useLayoutEffect(() => {
    const w = wrap.current!, styles = written.current
    glass.current?.setAttribute('data-power', power.current) // (the power it opens with: no flicker for that)
    w.style.setProperty('--periscope-lift-ease', reversedEase())
    let raf = 0, liftOff: (() => void) | null = null
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const z = zoom.current
      if (z.dir) {
        const ms = z.dir === 'in' ? periscope.zoomMs : periscope.backMs
        const t = ms > 0 ? clamp01((looksClock.now() - z.t0) / ms) : 1
        const e = easeIO(t, periscope.ease)
        apply.current(z.geo, testHold ?? (z.dir === 'in' ? e : 1 - e))
        if (t < 1 || testHold !== null) return
        const dir = z.dir
        z.dir = null; z.held = dir === 'in'
        w.removeAttribute('data-zoom')
        if (dir === 'out') {
          // the periscope lifts next (the console's phase goes idle): its glide played backwards — periscope.css,
          // for one glide's time
          w.setAttribute('data-lift', '')
          liftOff?.()
          liftOff = looksClock.after(Math.max(1, motionTime('motion-normal')), () => w.removeAttribute('data-lift'))
        }
        done.current()
      } else if (!z.held) {
        // between shifts the goggles are off until the periscope starts down, then flicker on; back up (a short drag
        // springing back, the lift after a shift) with no shift going → off again, at once
        const on = isLive.current || pulling(w)
        if (on !== (power.current === 'on')) {
          power.current = on ? 'on' : 'off'
          const g = glass.current
          if (g) g.setAttribute('data-power', on ? 'flicker' : 'off')
          if (on) playUiSound(SOUNDS.gogglesOn)
        }
        apply.current(seeing.current ? measure(w) : null, 0) // at the console: follow the periscope (a drag, its glide, the lift)
      }
      // (the flicker's length, live from periscope.json; the Dev Kit's full pause holds it, like the monitor's)
      const g = glass.current
      if (g) {
        g.style.setProperty('--periscope-flicker', `${Math.max(0, periscope.flickerMs)}ms`)
        g.toggleAttribute('data-paused', clockPause() === 'full')
      }
    }
    raf = requestAnimationFrame(frame)
    // (dev + tests: hold the zoom at a share — e2e/periscope-zoom.mjs shoots mid-zoom and the last frame; null = let go)
    if (import.meta.env.DEV) (window as unknown as { __periscopeZoom?: unknown }).__periscopeZoom = {
      hold: (sw: number | null) => { testHold = sw },
      state: () => ({ dir: zoom.current.dir, held: zoom.current.held }),
    }
    return () => {
      cancelAnimationFrame(raf)
      liftOff?.()
      // the console goes: the stage is the shift's again, where it draws itself
      if (lastStage.current) release(lastStage.current)
      lastStage.current = null
      styles.clear() // (all of it is written again if this comes back — React's dev double start does that)
    }
  }, [])

  return (
    <>
      {/* the goggles' glass over the stage (under the console, which has a hole there): the blurry ring + the tint */}
      <div className="periscope-glass" ref={glass} aria-hidden /* data-power: set by the effects, never by a render */
        onAnimationEnd={(e) => { if (e.animationName === 'periscope-power-on') e.currentTarget.setAttribute('data-power', 'on') }}
        style={{ '--glass-w': `${RW}px`, '--glass-h': `${RH}px` } as CSSProperties}>
        <div className="periscope-ring" ref={ring} style={{ clipPath: RING_CLIP }} />
        <div className="periscope-inner" ref={inner} style={{ clipPath: INNER_CLIP, backgroundColor: G.inner.colour }} />
        {/* the power: the goggles' painted glass, over the tank while they're off (and stuttering away as they come on) */}
        <div className="periscope-power">
          <div style={{ clipPath: `path("${local(G.ring.d)}")`, backgroundColor: G.ring.colour }} />
          <div style={{ clipPath: INNER_CLIP, backgroundColor: G.inner.colour }} />
        </div>
      </div>
      <div className="periscope-zoom" ref={wrap}>
        {/* (F77: the console's backdrop, here instead of on its Screen — the hole is cut in it, not in the Screen) */}
        {backdrop && <div className="periscope-backdrop" style={{ '--periscope-backdrop': `url("${encodeURI(backdrop)}")` } as CSSProperties} />}
        {children}
      </div>
    </>
  )
}
