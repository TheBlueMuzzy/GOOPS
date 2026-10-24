// The zap look (F67): a real tap on ready goop zaps it the way Muzzy approved in the sketch (research/sketches/zap-look.html,
// values content/tuning/zap.json). Checks: the pop event carries the exact tap point (`at`, inside the tapped cell);
// mid-zap the beam starts at the visible tank's top centre and ends at the tap, the goop is white-hot; the droplets
// spray; Particle zaps too; reduce motion has no spray (the beam and the suck-in stay); the goop is gone at the end.
// Mid-zap shots at every portrait size (the game is portrait only) into e2e-shots/zap/. The shift's rules are held still
// (no piece falls) so the board stays as set up; each moment is caught by freezing the game (the Dev Kit's full pause)
// when the beam's own clock reaches it.
// Run: node e2e/zap.mjs  (own dev server on port 5355)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5355
const SHOTS = 'e2e-shots/zap'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
mkdirSync(SHOTS, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }

// A board of ready goop on the floor in the middle of the view (colour 2 = a 3×2 block in visible columns 4–6, colour 3
// = a 2×2 block in 8–9), the rules held still, pressure high enough that it can pop. Returns the page px of a spot in the
// block's top-left cell (up-left of its centre, so the laser point is off the goop's middle) and that cell.
const setup = (page) => page.evaluate(async () => {
  const { regroup } = await import('/src/engine/groups.ts')
  const engine = window.__goops.engine, s = engine.state, view = window.__goops.view
  engine.tick = () => {}
  s.piece = null
  s.grid.fill(0)
  s.cracks.length = 0
  const vis = (k) => (s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k + s.width) % s.width
  const yOf = (row) => s.height - 1 - row
  for (const k of [4, 5, 6]) for (const row of [0, 1]) s.grid[yOf(row) * s.width + vis(k)] = 2
  for (const k of [8, 9]) for (const row of [0, 1]) s.grid[yOf(row) * s.width + vis(k)] = 3
  regroup(s, engine.book)
  for (const g of s.groups.values()) { g.fill = 1; g.ready = true; engine.book.fillMs.set(g.id, 1e9) }
  engine.setPressure(0.9)
  const x = vis(4), y = yOf(1)
  let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
  const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
  const px = view.centreX + (d - 0.2) * view.cellPx, py = view.topY + (y - s.bufferRows + 0.3) * view.cellPx
  return { px: px + stage.left, py: py + stage.top, cell: y * s.width + x, x, y }
})

// Tap, and freeze the whole game once the beam's clock reaches `t` seconds. Returns the pop event the frame loop saw.
async function zapAndFreeze(page, at, t) {
  await page.evaluate(async ({ t }) => {
    const { setClockPause } = await import('/src/devkit/gameClock.ts')
    const G = window.__goops
    window.__zapSeen = null
    if (!G.engine.__zapSpy) {
      const take = G.engine.takeEvents.bind(G.engine)
      G.engine.takeEvents = () => { const ev = take(); for (const e of ev) if (e.type === 'pop') window.__zapSeen = e; return ev }
      G.engine.__zapSpy = true
    }
    let since = 0
    const watch = () => {
      const b = G.zapBeam()[0]
      if (b && b.t >= t) { setClockPause('full'); return }
      if (++since < 600) requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  }, { t })
  await page.mouse.click(at.px, at.py)
  await page.waitForFunction(async () => (await import('/src/devkit/gameClock.ts')).clockPause() === 'full', null, { timeout: 5000 })
  await page.waitForTimeout(150) // a few frames drawn while frozen
  return page.evaluate(() => window.__zapSeen)
}
const unfreeze = (page) => page.evaluate(async () => (await import('/src/devkit/gameClock.ts')).setClockPause(null))

// Let the zap run on (from a freeze, or from the start) until the beam has gone, then ~0.15 s more — the droplets are
// in the air (Muzzy's sprayAt 0.6 → they leave at 0.23 s of the 0.39 s zap) — and freeze again
// Freezes at a GOO-clock moment (0.45 s into the zap), never after wall-clock ms: under check:full's load the goo's
// frames are capped at 0.1 s, so wall time runs ahead of goo time and the droplets hadn't left the block yet.
// While the beam is up its own t is the goo time; after it ends, add the looks clock's frames with the game's cap.
async function freezeAfterBeam(page, at) {
  await page.evaluate(async () => {
    const { setClockPause, clockTimes } = await import('/src/devkit/gameClock.ts')
    let gooT = -1, last = 0
    const watch = () => {
      const b = window.__goops.zapBeam()[0], now = clockTimes().looks
      if (b) gooT = b.t
      else if (gooT >= 0) gooT += Math.min(now - last, 100) / 1000
      last = now
      if (gooT >= 0.45) setClockPause('full')
      else requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  })
  if (at) await page.mouse.click(at.px, at.py)
  else await unfreeze(page)
  await page.waitForFunction(async () => (await import('/src/devkit/gameClock.ts')).clockPause() === 'full', null, { timeout: 5000 })
  await page.waitForTimeout(150)
}
// The air above the zapped block (from just over its top edge, 3 cells up, a little wider): only droplets get there
const skyAbove = (want) => ({ x: want.tap[0] - want.cellPx * 1.5, y: want.tap[1] - want.cellPx * 4, w: want.cellPx * 4.5, h: want.cellPx * 3.1 })

// Where it should be: the tap as a flat tank point (the visor's curve undone, like the game's own tap) and the visible
// tank's top centre — both in stage px / tank cells, worked out from the view
const expected = (page, at) => page.evaluate(async ({ px, py }) => {
  const { tankRect } = await import('/src/view/geometry.ts')
  const { flatPoint } = await import('/src/view/visorFx.ts')
  const G = window.__goops, s = G.engine.state, view = G.view
  const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
  const rect = tankRect(view, s.visibleWidth, s.height - s.bufferRows)
  const [fx, fy] = flatPoint(px - stage.left, py - stage.top, rect, G.curve())
  const x = view.camera + (fx - view.centreX) / view.cellPx + 0.5
  return { top: [rect.left + rect.width / 2, rect.top], tap: [px - stage.left, py - stage.top],
    at: { x: ((x % s.width) + s.width) % s.width, y: (fy - view.topY) / view.cellPx + s.bufferRows }, cellPx: view.cellPx }
}, at)

// Pixels of one of the stage's canvases in a box (stage CSS px), read just after the game draws a frame (the goo is
// WebGL: its picture is only readable in the frame it was drawn). Counts goo-ish pixels and bright white ones.
const pixels = (page, which, box) => page.evaluate(({ which, box }) => new Promise((done) => requestAnimationFrame(() => {
  const c = document.querySelector(which)
  const g = document.createElement('canvas'); g.width = c.width; g.height = c.height
  const ctx = g.getContext('2d'); ctx.drawImage(c, 0, 0)
  const k = c.width / c.getBoundingClientRect().width
  const x0 = Math.max(0, Math.round(box.x * k)), y0 = Math.max(0, Math.round(box.y * k))
  const w = Math.max(1, Math.min(c.width - x0, Math.round(box.w * k))), h = Math.max(1, Math.min(c.height - y0, Math.round(box.h * k)))
  const d = ctx.getImageData(x0, y0, w, h).data
  let white = 0, any = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 20) continue
    any++
    if (Math.min(d[i], d[i + 1], d[i + 2]) > 170) white++
  }
  done({ white, any })
})), { which, box })
const around = ([x, y], r) => ({ x: x - r, y: y - r, w: 2 * r, h: 2 * r })

async function openShift(w, h, style, reduce = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://localhost:${PORT}/?seed=7&visor=off`)
  await startShift(page)
  await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
  await page.waitForTimeout(400)
  const at = await setup(page)
  await page.waitForTimeout(1500) // the new board's goo springs into place
  return { page, errors, at }
}

try {
  // Jelly at every portrait size + Particle on a phone: mid-zap (beam at 0.2 s of its 0.3 s: the goop is white-hot and
  // the suck-in has begun), then the spray (0.33 s), then gone
  const runs = [...SIZES.map(([w, h]) => ['Jelly', w, h]), ['Particle', 390, 844]]
  for (const [style, w, h] of runs) {
    const name = `${style} ${w}x${h}`
    const { page, errors, at } = await openShift(w, h, style)
    const want = await expected(page, at)
    const pop = await zapAndFreeze(page, at, 0.2)
    check(`${name}: the tap zapped the goop`, !!pop && pop.cells.includes(at.cell), pop ? `${pop.cells.length} cells` : 'no pop event')
    const a = pop?.at
    check(`${name}: the pop event carries the exact tap point (at), inside the tapped cell`,
      !!a && Math.floor(a.x) === at.x && Math.floor(a.y) === at.y && Math.abs(a.x - want.at.x) < 0.01 && Math.abs(a.y - want.at.y) < 0.01,
      `at ${a ? `${a.x.toFixed(3)}, ${a.y.toFixed(3)}` : '—'} · cell ${at.x}, ${at.y}`)
    const shot = (await page.evaluate(() => window.__goops.zapBeam()))[0]
    const near = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1
    check(`${name}: the beam starts at the visible tank's top centre`, !!shot && near(shot.from, want.top), shot ? `from ${shot.from.map(Math.round)} · top centre ${want.top.map(Math.round)}` : 'no beam')
    check(`${name}: …and ends on the tap`, !!shot && near(shot.to, want.tap), shot ? `to ${shot.to.map(Math.round)} · tap ${want.tap.map(Math.round)}` : '')
    const beamAtTop = await pixels(page, 'canvas.stage-zap', around([want.top[0], want.top[1] + 6], 6))
    const beamAtTap = await pixels(page, 'canvas.stage-zap', around(want.tap, 6))
    check(`${name}: the beam is drawn at both ends`, beamAtTop.white > 5 && beamAtTap.white > 10, `white px: top ${beamAtTop.white}, tap ${beamAtTap.white}`)
    const hot = await pixels(page, 'canvas[data-goo]', around(want.tap, want.cellPx * 1.2))
    check(`${name}: mid-zap the goop is white-hot`, hot.white > hot.any * 0.15 && hot.any > 20, `${hot.white} white of ${hot.any} goo px round the tap`)
    await page.screenshot({ path: `${SHOTS}/${style.toLowerCase()}-${w}x${h}.png` })
    // the spray: goo above the zapped block, where nothing was (droplets fly up and out)
    if (w === 390) {
      await freezeAfterBeam(page)
      const spray = await pixels(page, 'canvas[data-goo]', skyAbove(want))
      check(`${name}: droplets spray out`, spray.any > 15, `${spray.any} goo px above the block`)
      await page.screenshot({ path: `${SHOTS}/${style.toLowerCase()}-spray-${w}x${h}.png` })
    }
    await unfreeze(page)
    // the zap ends, the droplets fade (they live up to 1.8 s on the goo's clock, which runs slow when frames take over
    // 50 ms — big headless windows)
    await page.waitForTimeout(4000)
    const left = await pixels(page, 'canvas[data-goo]', around(want.tap, want.cellPx * 0.4))
    if (left.any >= 10) await page.screenshot({ path: `${SHOTS}/after-${style.toLowerCase()}-${w}x${h}.png` })
    const beams = await page.evaluate(() => window.__goops.zapBeam().length)
    check(`${name}: …the goop and the beam are gone once it's over`, left.any < 10 && beams === 0, `${left.any} goo px at the tap, ${beams} beams`)
    check(`${name}: no page errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // Reduce motion: no swell, no spray — the beam and the suck-in stay
  for (const style of ['Jelly', 'Particle']) {
    const name = `${style} reduce motion`
    const { page, errors, at } = await openShift(390, 844, style, true)
    const want = await expected(page, at)
    await zapAndFreeze(page, at, 0.2)
    const shot = (await page.evaluate(() => window.__goops.zapBeam()))[0]
    check(`${name}: the zap still has its beam`, !!shot && Math.hypot(shot.to[0] - want.tap[0], shot.to[1] - want.tap[1]) < 1)
    await freezeAfterBeam(page)
    const spray = await pixels(page, 'canvas[data-goo]', skyAbove(want))
    check(`${name}: no spray`, spray.any < 5, `${spray.any} goo px above the block`)
    await page.screenshot({ path: `${SHOTS}/${style.toLowerCase()}-reduce-motion-390x844.png` })
    await unfreeze(page)
    await page.waitForTimeout(1500)
    const left = await pixels(page, 'canvas[data-goo]', around(want.tap, want.cellPx * 0.4))
    check(`${name}: …and the goop is still sucked in and gone`, left.any < 10, `${left.any} goo px at the tap`)
    check(`${name}: no page errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
