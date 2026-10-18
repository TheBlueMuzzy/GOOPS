// Goo lab (dev server only: /goo-lab.html). A fake engine + a plain 2D tank + the goo overlay, to try both goo
// renderers before the real engine and tank view exist. Not part of the production build.
import type { ShiftEvent } from '../../engine/types'
import { screenColumn, type GooRenderer, type GooView } from '../types'
import { createJellyRenderer } from '../jelly'
import { createParticleRenderer } from '../particle'
import { cellToScreen, inWindow, tankWindow, wrapNear } from '../shared/tank'
import { FakeEngine, LAB_COLOR_NAMES } from './fakeEngine'

const $ = (id: string) => document.getElementById(id)!
const tank = $('tank') as HTMLCanvasElement
const gooCanvas = $('goo') as HTMLCanvasElement
const debug = $('debug') as HTMLCanvasElement
const t2d = tank.getContext('2d')!
const d2d = debug.getContext('2d')!

const engine = new FakeEngine(7)
let style: 'jelly' | 'particle' = new URLSearchParams(location.search).get('style') === 'particle' ? 'particle' : 'jelly'
let renderer: GooRenderer | null = null
let showCells = false
let paused = false
let camera = engine.state.spin
const view: GooView = { cellPx: 30, centreX: 0, topY: 0, camera, width: 1, height: 1, dpr: 1 }

function makeRenderer() {
  renderer?.dispose()
  const make = style === 'jelly' ? createJellyRenderer : createParticleRenderer
  try {
    renderer = make(gooCanvas, { colorNames: LAB_COLOR_NAMES })
  } catch (e) {
    renderer = null
    $('msg').textContent = 'Goo failed: ' + (e as Error).message
  }
  $('bStyle').textContent = style === 'jelly' ? 'Jelly' : 'Particle'
}

function layout() {
  const S = engine.state
  const W = innerWidth
  const H = innerHeight
  const dpr = window.devicePixelRatio || 1
  for (const c of [tank, debug]) {
    c.width = Math.round(W * dpr)
    c.height = Math.round(H * dpr)
  }
  const top = $('bar').getBoundingClientRect().bottom + 4
  const rows = S.height // buffer rows + visible rows
  view.cellPx = Math.floor(Math.min((W - 32) / S.visibleWidth, (H - top - 30) / rows))
  const [l, r] = tankWindow(S.visibleWidth)
  view.centreX = W / 2 - ((l + r) / 2) * view.cellPx // the tank window is centred on screen
  view.topY = top + S.bufferRows * view.cellPx
  view.width = W
  view.height = H
  view.dpr = dpr
}

// The lead's tank view does this for real; here just enough to see the goo sit on cells
function drawTank() {
  const S = engine.state
  const dpr = view.dpr
  const c = view.cellPx
  const [l, r] = tankWindow(S.visibleWidth)
  const left = view.centreX + l * c
  const right = view.centreX + r * c
  const bottom = view.topY + (S.height - S.bufferRows) * c
  t2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  t2d.fillStyle = '#05070d'
  t2d.fillRect(0, 0, view.width, view.height)
  t2d.fillStyle = '#0a1226'
  t2d.fillRect(left, view.topY, right - left, bottom - view.topY)
  t2d.strokeStyle = 'rgba(120,150,220,0.10)'
  t2d.lineWidth = 1
  t2d.beginPath()
  for (let x = 0; x < S.width; x++) {
    const s = screenColumn(x, camera, S.width)
    const lx = view.centreX + (s - 0.5) * c
    if (lx > left + 0.5 && lx < right - 0.5) {
      t2d.moveTo(lx, view.topY)
      t2d.lineTo(lx, bottom)
    }
  }
  for (let y = S.bufferRows; y <= S.height; y++) {
    const ly = view.topY + (y - S.bufferRows) * c
    t2d.moveTo(left, ly)
    t2d.lineTo(right, ly)
  }
  t2d.stroke()
  t2d.strokeStyle = 'rgba(80,140,255,0.45)'
  t2d.strokeRect(left, view.topY, right - left, bottom - view.topY)
  // column numbers under the tank (tank space), to check the wrap
  t2d.fillStyle = '#475569'
  t2d.font = `${Math.max(9, c * 0.32)}px ui-monospace, monospace`
  t2d.textAlign = 'center'
  for (let x = 0; x < S.width; x++) {
    const s = screenColumn(x, camera, S.width)
    if (inWindow(s, S.visibleWidth, 0)) t2d.fillText(String(x), view.centreX + s * c, bottom + c * 0.45)
  }
}

function drawDebug() {
  const dpr = view.dpr
  d2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  d2d.clearRect(0, 0, view.width, view.height)
  if (!showCells) return
  const S = engine.state
  const c = view.cellPx
  d2d.lineWidth = 1
  d2d.strokeStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < S.grid.length; i++) {
    if (!S.grid[i]) continue
    const [sx, sy] = cellToScreen(i % S.width, Math.floor(i / S.width), view, S)
    if (!inWindow(screenColumn(i % S.width, camera, S.width), S.visibleWidth, 0)) continue
    d2d.strokeRect(sx - c / 2 + 0.5, sy - c / 2 + 0.5, c - 1, c - 1)
  }
  if (S.piece) {
    d2d.strokeStyle = 'rgba(255,255,0,0.7)'
    for (const [x, y] of S.piece.cells) {
      const [sx, sy] = cellToScreen(x, y + S.piece.fall, { ...view, camera: S.spin }, S)
      d2d.strokeRect(sx - c / 2 + 0.5, sy - c / 2 + 0.5, c - 1, c - 1)
    }
  }
}

// ---- input ----
addEventListener('keydown', (e) => {
  const k: Record<string, () => void> = {
    ArrowLeft: () => engine.act({ type: 'spin', dir: -1 }),
    ArrowRight: () => engine.act({ type: 'spin', dir: 1 }),
    ArrowUp: () => engine.act({ type: 'rotate', dir: 1 }),
    z: () => engine.act({ type: 'rotate', dir: -1 }),
    ArrowDown: () => engine.act({ type: 'softDrop', on: true }),
    ' ': () => engine.act({ type: 'softDrop', on: true }), // no hard drop in Goops: space = fast drop too
  }
  if (k[e.key]) {
    k[e.key]()
    e.preventDefault()
  }
})
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown' || e.key === ' ') engine.act({ type: 'softDrop', on: false })
})
let drag: { x: number; y: number; acc: number; moved: boolean } | null = null
tank.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, acc: 0, moved: false }
  tank.setPointerCapture(e.pointerId)
})
tank.addEventListener('pointermove', (e) => {
  if (!drag) return
  const dx = e.clientX - drag.x
  drag.x = e.clientX
  drag.acc += dx
  while (Math.abs(drag.acc) >= view.cellPx) {
    const dir = drag.acc > 0 ? -1 : 1 // drag the tank right = it turns to show the columns on the left
    engine.act({ type: 'spin', dir })
    drag.acc += dir * view.cellPx
    drag.moved = true
  }
  if (Math.abs(e.clientY - drag.y) > view.cellPx * 2 && !drag.moved) {
    engine.act({ type: 'softDrop', on: true }) // fast drop until the finger lifts
    drag.moved = true
  }
})
tank.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) tap(e.clientX, e.clientY)
  engine.act({ type: 'softDrop', on: false })
  drag = null
})
function tap(px: number, py: number) {
  const S = engine.state
  const x = (((Math.round(camera + (px - view.centreX) / view.cellPx) % S.width) + S.width) % S.width)
  const y = Math.floor((py - view.topY) / view.cellPx) + S.bufferRows
  if (y >= 0 && y < S.height && S.grid[y * S.width + x]) engine.act({ type: 'pop', x, y })
  else engine.act({ type: 'rotate', dir: px < view.centreX ? -1 : 1 })
}
$('bStyle').onclick = () => {
  style = style === 'jelly' ? 'particle' : 'jelly'
  makeRenderer()
}
$('bFill').onclick = () => engine.fillTank()
$('bReset').onclick = () => engine.reset()
$('bCells').onclick = () => {
  showCells = !showCells
  $('bCells').classList.toggle('on', showCells)
}
$('bPause').onclick = () => {
  paused = !paused
  $('bPause').classList.toggle('on', paused)
}
addEventListener('resize', layout)

// ---- loop ----
let last = performance.now()
let frames = 0
let fpsT = last
let fps = 0
let gooMs = 0
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1)
  last = now
  let events: ShiftEvent[] = []
  if (!paused) {
    engine.tick(dt * 1000)
    events = engine.takeEvents()
    camera += wrapNear(engine.state.spin - camera, engine.state.width) * Math.min(1, dt * 14) // the view eases to the spin
    camera = ((camera % engine.state.width) + engine.state.width) % engine.state.width
    view.camera = camera
  }
  drawTank()
  const t0 = performance.now()
  if (renderer) renderer.frame(engine.state, events, view, paused ? 0 : dt)
  gooMs += (performance.now() - t0 - gooMs) * 0.05 // CPU time of the goo per frame (sim + draw calls)
  drawDebug()
  frames++
  if (now - fpsT >= 1000) {
    fps = (frames * 1000) / (now - fpsT)
    frames = 0
    fpsT = now
    $('fps').textContent = fps.toFixed(0) + ' fps · goo ' + gooMs.toFixed(1) + ' ms'
  }
  requestAnimationFrame(frame)
}

layout()
makeRenderer()
requestAnimationFrame(frame)

// for Playwright checks
;(window as unknown as { lab: unknown }).lab = {
  engine,
  view,
  fps: () => fps,
  gooMs: () => gooMs,
  style: () => style,
  setStyle: (s: 'jelly' | 'particle') => {
    style = s
    makeRenderer()
  },
  fill: () => engine.fillTank(),
  reset: () => engine.reset(),
  spin: (dir: 1 | -1) => engine.act({ type: 'spin', dir }),
  setPaused: (p: boolean) => {
    paused = p
  },
  cells: (on: boolean) => {
    showCells = on
  },
}
