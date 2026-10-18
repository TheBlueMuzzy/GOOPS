// The playing field: the tank canvas (2D, under), the goo canvas (WebGL, over), the controls, and the frame loop that
// ticks the engine and hands its state + events to both. React only renders this once; per-frame work uses refs.
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ShiftEngine, ShiftEvent, ShiftStatus, ShiftPhase } from '../engine'
import type { GooRenderer, GooView } from '../goo/types'
import { colorOf, makeGoo } from './gooFactory'
import { drawTank } from '../view/tankView'
import { layoutTank, screenToCell, stepCamera } from '../view/geometry'
import { attachControls } from '../input/controls'
import { gooStyle } from './gooStyle'
import { wallKick } from './wallKick'
import { createVisorFx, type VisorFx } from '../view/visorFx'
import tank from '../../content/tuning/tank.json'
import './game.css'

const HUD_SIDE_ROOM = 16 // CSS px the HUD may reach past each side of the tank
const HUD_MIN_WIDTH = 360 // the HUD needs a narrow phone's width even when the tank is smaller (a phone on its side)

export interface HudSnapshot {
  pressure: number
  score: number
  cracksSealed: number
  cracksNeeded: number
  integrity: number
  phase: ShiftPhase
  holdProgress: number | null
}

interface Props {
  engine: ShiftEngine
  paused: boolean
  reserveTop: number // CSS px the HUD needs above the tank
  onHud(h: HudSnapshot): void
  onEnd(status: ShiftStatus): void
  onAlert(kind: 'quotaMet' | 'rupture'): void // one-off moments the HUD announces
  onConsole(): void
}

export function ShiftStage({ engine, paused, reserveTop, onHud, onEnd, onAlert, onConsole }: Props) {
  const style = useSyncExternalStore(gooStyle.subscribe, gooStyle.get)
  const host = useRef<HTMLDivElement>(null)
  const tankCanvas = useRef<HTMLCanvasElement>(null)
  const gooCanvas = useRef<HTMLCanvasElement>(null)
  const live = useRef({ paused, onHud, onEnd, onAlert, onConsole })
  useEffect(() => { live.current = { paused, onHud, onEnd, onAlert, onConsole } })

  // the Settings "Wall kick" row: applied now and whenever it changes
  useEffect(() => {
    engine.setWallKick(wallKick.get())
    return wallKick.subscribe(() => engine.setWallKick(wallKick.get()))
  }, [engine])
  const viewRef = useRef<GooView | null>(null)
  const reserveTopRef = useRef(reserveTop)
  useEffect(() => { reserveTopRef.current = reserveTop }, [reserveTop])

  // the goo renderer: rebuilt when the style changes (a fresh canvas each time — see key below)
  const gooRef = useRef<GooRenderer | null>(null)
  useEffect(() => {
    const g = makeGoo[style](gooCanvas.current!)
    gooRef.current = g
    return () => { g.dispose(); if (gooRef.current === g) gooRef.current = null }
  }, [style])

  // F25: the visor glitch + pixel filter, a canvas over both (src/view/visorFx.ts); the frame loop feeds it
  const visorFx = useRef<VisorFx | null>(null)
  useEffect(() => {
    const fx = createVisorFx(host.current!, tankCanvas.current!, () => gooCanvas.current)
    visorFx.current = fx
    return () => { fx.dispose(); visorFx.current = null }
  }, [])

  // frame loop + controls
  useEffect(() => {
    const el = host.current!, tc = tankCanvas.current!, ctx = tc.getContext('2d')!
    const s = engine.state
    let camera = s.spin, last = performance.now(), hudAt = 0, raf = 0, ended = false
    let holdProgress: number | null = null
    let softHeld = false // the engine turns fast-drop off at every lock; a held drag keeps it on for the next piece
    const view: GooView = { cellPx: 0, centreX: 0, topY: 0, camera, width: 0, height: 0, dpr: 1 }
    viewRef.current = view

    const resize = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const L = layoutTank({ screenW: r.width, screenH: r.height, visibleWidth: s.visibleWidth, visibleRows: s.height - s.bufferRows,
        reserveTop: reserveTopRef.current, reserveBottom: 12, gutter: 16 })
      Object.assign(view, { cellPx: L.cellPx, centreX: L.centreX, topY: L.topY, width: r.width, height: r.height, dpr })
      // the HUD's corners sit over the tank, not at the far window edges (kit --kit-hud-w; menus keep the whole window)
      document.documentElement.style.setProperty('--kit-hud-w', `${Math.min(r.width, Math.max(HUD_MIN_WIDTH, L.widthPx + 2 * HUD_SIDE_ROOM))}px`)
      tc.width = Math.round(r.width * dpr); tc.height = Math.round(r.height * dpr)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const active = !live.current.paused && s.status === 'playing'
      if (active) engine.tick(dt * 1000)
      const events: ShiftEvent[] = engine.takeEvents()
      camera = stepCamera(camera, s.spin, s.width, dt, tank.cameraSpeed)
      view.camera = camera
      drawTank(ctx, s, view, colorOf, now / 1000)
      gooRef.current?.frame(s, events, view, active ? dt : 0)
      // the spawn rows above the tank stay hidden (v1): pieces slide in from the tank's top edge, never over the HUD
      const gc = gooCanvas.current, clip = `inset(${view.topY}px 0 0 0)`
      if (gc && gc.style.clipPath !== clip) gc.style.clipPath = clip
      visorFx.current?.frame(s, view, now / 1000)
      if (now - hudAt > 100) {
        hudAt = now
        live.current.onHud({ pressure: s.pressure, score: s.score, cracksSealed: s.cracksSealed, cracksNeeded: s.cracksNeeded,
          integrity: s.integrity, phase: s.phase, holdProgress })
      }
      for (const e of events) {
        if (e.type === 'spawn' && softHeld) engine.act({ type: 'softDrop', on: true })
        if (e.type === 'quotaMet' || e.type === 'rupture') live.current.onAlert(e.type)
        if (e.type === 'end' && !ended) { ended = true; live.current.onEnd(e.status) }
      }
    }
    raf = requestAnimationFrame(frame)
    // dev + tests only: lets a Playwright check reach the engine (fast-forward a shift, read the grid)
    if (import.meta.env.DEV) (window as unknown as { __goops?: unknown }).__goops = { engine, view, gooStyle }

    const detach = attachControls(el, {
      spin: (dir) => engine.act({ type: 'spin', dir }),
      rotate: (dir) => engine.act({ type: 'rotate', dir }),
      softDrop: (on) => { softHeld = on; engine.act({ type: 'softDrop', on }) },
      hold: () => engine.act({ type: 'hold' }),
      console: () => live.current.onConsole(),
      holdProgress: (p) => { holdProgress = p },
      tapCell: (px, py) => {
        const r = el.getBoundingClientRect()
        const [x, y] = screenToCell(px - r.left, py - r.top, view, s.width, s.bufferRows)
        if (y < 0 || y >= s.height || !s.grid[y * s.width + x]) return false
        engine.act({ type: 'pop', x, y })
        return true
      },
    }, () => !live.current.paused && s.status === 'playing')

    return () => { cancelAnimationFrame(raf); ro.disconnect(); detach(); document.documentElement.style.removeProperty('--kit-hud-w') }
  }, [engine])

  return (
    <div className="stage" ref={host} data-testid="stage">
      <canvas className="stage-layer" ref={tankCanvas} />
      <canvas className="stage-layer" ref={gooCanvas} key={style} data-goo={style} />
    </div>
  )
}
