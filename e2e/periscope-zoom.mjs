// F56 — PERISCOPE ZOOM (Muzzy's sketch S13, look B): in Playwright's own Chromium (never the user's Chrome), with the
// real dev server, at every portrait size (390x844, 360x780, 1100x800, 1440x900, 1920x1080 — never sideways).
// Each size, a fresh device that has had its first day (and the rank's unlock lessons), a seeded rank-3 shift:
//   1. at the console between shifts the goggles show the tank: inside the dark blue inner glass the pixels are NOT the
//      painted glass colour (art.json periscopeGlass.inner) — the old console painted it solid
//   2. the pull: the zoom runs (data-zoom="in"), a mid-zoom shot; its last frame (held at 1) has the stage exactly where
//      the shift draws it (no transform) and the console faded out — and the tank there = the tank once the shift
//      shows (pixels compared); a control answers right after the switch (← spins the tank)
//   3. mid-shift W: the zoom out (data-zoom="out", a mid shot), the console still, the goggles showing the live tank;
//      the periscope pulled again: the zoom in, back in the tank, a control answers
//   4. the end of the shift (Esc on the report): the zoom out, then the next shift's tank in the goggles
//   and no console errors in the whole run (the Dev Kit never opened).
// Then reduce motion (the device's setting): no zoom at all — the switch is instant both ways.
// Screenshots: e2e-shots/periscope-zoom/<size>-*.png
// Run: node e2e/periscope-zoom.mjs  (own dev server on port 5378; E2E_PORT=… runs it on another)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { checkVersion, skipFirstDay } from './start.mjs'

const PORT = Number(process.env.E2E_PORT) || 5378, OUT = 'e2e-shots/periscope-zoom'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
const art = JSON.parse(readFileSync('content/ui/art.json', 'utf8'))
const GLASS = art.console.periscopeGlass
const URL_ = `http://localhost:${PORT}/?seed=7&rank=3`
const SEEN = ['lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades']
mkdirSync(OUT, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error(`dev server stopped (port ${PORT} busy?)`)))
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0, count = 0
const check = (name, ok, detail = '') => {
  count++
  if (ok) console.log(`ok   ${name}${detail && detail.length < 80 ? ` (${detail})` : ''}`)
  else { failed++; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

// A screenshot of a box, decoded in the page (no image package): its pixels' RGB, row by row
async function pixels(page, box) {
  const png = await page.screenshot({ clip: box, animations: 'allow' })
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height), ctx = c.getContext('2d')
    ctx.drawImage(bmp, 0, 0)
    return { w: bmp.width, h: bmp.height, data: Array.from(ctx.getImageData(0, 0, bmp.width, bmp.height).data) }
  }, png.toString('base64'))
}
// share of pixels further than `tol` (per channel, max) from a colour
const offShare = (p, rgb, tol = 14) => {
  let off = 0
  for (let i = 0; i < p.data.length; i += 4) if (Math.max(...[0, 1, 2].map((k) => Math.abs(p.data[i + k] - rgb[k]))) > tol) off++
  return off / (p.data.length / 4)
}
// how much the brightness varies across the box (a plain painted or empty glass ≈ 0; the tank's floor, grid, goop > it)
const spread = (p) => {
  const l = []
  for (let i = 0; i < p.data.length; i += 4) l.push(0.3 * p.data[i] + 0.59 * p.data[i + 1] + 0.11 * p.data[i + 2])
  const mean = l.reduce((a, b) => a + b, 0) / l.length
  return Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length)
}
// the goggles show a tank: hardly any pixel is the painted glass colour, and the picture isn't one flat colour
async function showsTank(page, box) {
  const p = await pixels(page, box)
  const off = offShare(p, hex(GLASS.inner.colour)), sd = spread(p)
  return { ok: off > 0.6 && sd > 4, detail: `${(off * 100).toFixed(0)}% off ${GLASS.inner.colour}, brightness spread ${sd.toFixed(1)}` }
}
const meanDiff = (a, b) => {
  let d = 0
  for (let i = 0; i < a.data.length; i += 4) for (let k = 0; k < 3; k++) d += Math.abs(a.data[i + k] - b.data[i + k])
  return d / (a.data.length / 4 * 3)
}
// the dark blue inner glass on screen now: the middle of it (clear of the ring's soft edge and the nose)
async function innerGlass(page) {
  const g = await page.locator('.periscope-glass').boundingBox()
  if (!g) return null
  const [rx, ry, rw, rh] = GLASS.ring.box, [ix, iy, iw, ih] = GLASS.inner.box, u = g.width / rw
  const x = g.x + (ix - rx) * u, y = g.y + (iy - ry) * u
  // (the left lobe's lower half: the tank's floor shows there, the nose doesn't)
  return { x: Math.round(x + iw * u * 0.1), y: Math.round(y + ih * u * 0.4), width: Math.round(iw * u * 0.3), height: Math.round(ih * u * 0.5) }
}
// The tank pinned in the inner glass (mid-zoom too): its width on screen = the glass's, its floor floorLift above the
// glass's bottom edge (the stage's transform × where the shift lays the tank out, vs the glass layer's box)
const pinned = (page) => page.evaluate(([ring, inner, lift]) => {
  const v = window.__goops.view, s = window.__goops.engine.state
  // (the stage's box on screen, zoom included — whatever its transform and origin): screen = r + stage px × k
  const st = document.querySelector('[data-testid="stage"]'), r = st.getBoundingClientRect(), k = r.width / st.offsetWidth
  const left = v.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * v.cellPx, floor = v.topY + (s.height - s.bufferRows) * v.cellPx
  const g = document.querySelector('.periscope-glass').getBoundingClientRect(), u = g.width / ring[2]
  return { tankLeft: r.left + left * k, tankW: s.visibleWidth * v.cellPx * k, floor: r.top + floor * k,
    glassLeft: g.left + (inner[0] - ring[0]) * u, glassW: inner[2] * u, glassFloor: g.top + (inner[1] + inner[3] - ring[1] - lift) * u }
}, [GLASS.ring.box, GLASS.inner.box, JSON.parse(readFileSync('content/tuning/periscope.json', 'utf8')).floorLift])
const pinnedOk = (p) => Math.abs(p.tankLeft - p.glassLeft) < 1.5 && Math.abs(p.tankW - p.glassW) < 1.5 && Math.abs(p.floor - p.glassFloor) < 1.5
const zoomAttr =(page) => page.evaluate(() => document.querySelector('.periscope-zoom')?.getAttribute('data-zoom') ?? null)
const consoleStill = (page) => page.waitForFunction(() => { const c = document.querySelector('.kit-screen[aria-label="Console"]'); return c && !c.closest('[data-zoom], [data-lift]') }, null, { timeout: 5000 }).then(() => true, () => false)
const inTank = (page) => page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false)
// ← spins the tank (a control answering)
async function controlAnswers(page) {
  const before = await page.evaluate(() => window.__goops.engine.state.spin)
  await page.keyboard.press('ArrowLeft')
  return page.waitForFunction((b) => window.__goops.engine.state.spin !== b, before, { timeout: 1500 }).then(() => true, () => false)
}
const hold = (page, sw) => page.evaluate((v) => window.__periscopeZoom.hold(v), sw)
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f) }), n)

try {
  for (const [width, height] of SIZES) {
    const size = `${width}x${height}`
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(String(e)))
    await skipFirstDay(page)
    await page.goto(URL_)
    await checkVersion(page)
    await page.evaluate((ids) => window.__goopsSeen?.(ids), SEEN)
    await page.reload()
    await page.locator('.kit-art-stage').waitFor()
    await page.waitForTimeout(800)

    // 1. the goggles show the tank between shifts
    const glassBox = await innerGlass(page)
    check(`${size}: at the console the goggles' glass layer is up`, !!glassBox)
    if (glassBox) {
      const t = await showsTank(page, glassBox)
      check(`${size}: between shifts the inner glass shows the tank, not its painted colour`, t.ok, t.detail)
    }
    await page.screenshot({ path: `${OUT}/${size}-1-console.png` })
    const g = await page.locator('.periscope-glass').boundingBox()
    if (g) await page.screenshot({ path: `${OUT}/${size}-1-goggles.png`, clip: { x: g.x - 8, y: g.y - 8, width: g.width + 16, height: g.height + 16 } })

    // 2. the pull → the zoom in
    await hold(page, 0.5)
    await page.locator('.kit-pull-grip').click()
    const zoomIn = await page.waitForFunction(() => document.querySelector('.periscope-zoom')?.getAttribute('data-zoom') === 'in', null, { timeout: 3000 }).then(() => true, () => false)
    check(`${size}: the pull starts the zoom in`, zoomIn)
    await frames(page)
    await page.screenshot({ path: `${OUT}/${size}-2-zoom-in-mid.png` })
    const pinIn = await pinned(page)
    check(`${size}: mid-zoom in, the tank is pinned to the inner glass (width + floor)`, pinnedOk(pinIn), JSON.stringify(pinIn))
    await hold(page, 1)
    await frames(page)
    const last = await page.evaluate(() => ({ stage: getComputedStyle(document.querySelector('[data-testid="stage"]')).transform,
      opacity: getComputedStyle(document.querySelector('.periscope-zoom')).opacity }))
    check(`${size}: the zoom's last frame: the stage where the shift draws it, the console gone`, last.stage === 'none' && Number(last.opacity) < 0.01, JSON.stringify(last))
    // the tank in the zoom's last frame vs once the shift shows it: a strip across the tank's lower middle
    const tank = await page.evaluate(() => { const v = window.__goops.view, s = window.__goops.engine.state
      return { x: Math.round(v.centreX - 4 * v.cellPx), y: Math.round(v.topY + (s.height - s.bufferRows - 4) * v.cellPx), width: Math.round(8 * v.cellPx), height: Math.round(3 * v.cellPx) } })
    const lastFrame = await pixels(page, tank)
    await page.screenshot({ path: `${OUT}/${size}-2-zoom-in-last.png` })
    await hold(page, null)
    check(`${size}: the zoom ends in the tank`, await inTank(page))
    const shiftFrame = await pixels(page, tank)
    const diff = meanDiff(lastFrame, shiftFrame)
    // (the same picture; what differs is what moves in the tank as the shift starts — the crack pulses, the drop guide's
    // wave: 2–9 measured. The exact proof is the transform check above; a tank off by a cell differs far more)
    check(`${size}: the last zoom frame lines up with the tank (mean difference ${diff.toFixed(1)} of 255)`, diff < 14)
    check(`${size}: a control answers right after the switch`, await controlAnswers(page))
    await page.screenshot({ path: `${OUT}/${size}-2-tank.png` })

    // 3. mid-shift: W → the zoom out, then the periscope back to the tank
    await hold(page, 0.5)
    await page.keyboard.press('w')
    const out = await page.waitForFunction(() => document.querySelector('.periscope-zoom')?.getAttribute('data-zoom') === 'out', null, { timeout: 3000 }).then(() => true, () => false)
    check(`${size}: W mid-shift starts the zoom out`, out)
    await frames(page)
    await page.screenshot({ path: `${OUT}/${size}-3-zoom-out-mid.png` })
    const pinOut = await pinned(page)
    check(`${size}: mid-zoom out, the tank is pinned to the inner glass (width + floor)`, pinnedOk(pinOut), JSON.stringify(pinOut))
    await hold(page, null)
    check(`${size}: the console settles (zoom out + the periscope's lift)`, await consoleStill(page))
    const peekGlass = await innerGlass(page)
    const tPeek = peekGlass && await showsTank(page, peekGlass)
    check(`${size}: mid-shift the goggles show the live tank`, !!tPeek?.ok, tPeek?.detail)
    await page.screenshot({ path: `${OUT}/${size}-3-peek.png` })
    const pinPeek = await pinned(page)
    check(`${size}: at the console mid-shift, the tank is pinned to the inner glass`, pinnedOk(pinPeek), JSON.stringify(pinPeek))
    await page.locator('.kit-pull-grip').click()
    check(`${size}: the periscope mid-shift zooms back into the tank`, await page.waitForFunction(() => document.querySelector('.periscope-zoom')?.getAttribute('data-zoom') === 'in', null, { timeout: 3000 }).then(() => true, () => false) && await inTank(page))
    check(`${size}: a control answers right after the switch back`, await controlAnswers(page))

    // 4. the end of the shift → the report → Esc: the zoom out, then the next shift in the goggles
    await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
    await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
    await page.keyboard.press('Escape')
    check(`${size}: the end of the shift zooms out`, await page.waitForFunction(() => !!document.querySelector('.periscope-zoom[data-zoom="out"]'), null, { timeout: 3000 }).then(() => true, () => false))
    check(`${size}: back on the console`, await consoleStill(page))
    await page.waitForTimeout(300)
    const nextGlass = await innerGlass(page)
    const tNext = nextGlass && await showsTank(page, nextGlass)
    check(`${size}: the goggles show the next shift's tank`, !!tNext?.ok, tNext?.detail)
    await page.screenshot({ path: `${OUT}/${size}-4-back.png` })
    check(`${size}: no console errors`, !errors.length, errors.join(' | '))
    await context.close()
  }

  // reduce motion: no zoom, the switch is instant both ways
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await skipFirstDay(page)
    await page.goto(URL_)
    await page.evaluate((ids) => window.__goopsSeen?.(ids), SEEN)
    await page.reload()
    await page.locator('.kit-art-stage').waitFor()
    await page.evaluate(() => { window.__zooms = 0; new MutationObserver((ms) => { for (const m of ms) if (m.target.getAttribute('data-zoom')) window.__zooms++ })
      .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-zoom'] }) })
    const t0 = Date.now()
    await page.locator('.kit-pull-grip').click()
    const instantIn = await inTank(page), msIn = Date.now() - t0
    check(`reduce motion: the pull goes straight to the tank (${msIn} ms, no zoom)`, instantIn && await page.evaluate(() => window.__zooms) === 0 && msIn < 1000)
    await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing')
    const t1 = Date.now()
    await page.keyboard.press('w')
    const back = await page.locator('.kit-art-stage').waitFor({ timeout: 3000 }).then(() => true, () => false)
    check(`reduce motion: W shows the console at once (${Date.now() - t1} ms, no zoom)`, back && await page.evaluate(() => window.__zooms) === 0 && await consoleStill(page))
    await page.screenshot({ path: `${OUT}/reduce-motion-console.png` })
    await context.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `${failed} of ${count} checks FAILED` : `ALL PASS (${count} checks)`)
process.exit(failed ? 1 : 0)
