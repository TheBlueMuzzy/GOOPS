// F56 — PERISCOPE ZOOM (Muzzy's sketch S13, look B): in Playwright's own Chromium (never the user's Chrome), with the
// real dev server, at every portrait size (390x844, 360x780, 1100x800, 1440x900, 1920x1080 — never sideways).
// Each size, a fresh device that has had its first day (and the rank's unlock lessons), a seeded shift at the ladder's swap:
//   1. at the console between shifts the goggles are OFF: their painted glass colour (art.json periscopeGlass.inner);
//      a short drag down → they flicker on (data-power="flicker" → "on") and show the next shift's tank (the pixels are
//      NOT the painted colour); let go short → the periscope springs back and they're off again
//   2. the pull: the zoom runs (data-zoom="in"), a mid-zoom shot; its last frame (held at 1) has the stage exactly where
//      the shift draws it (no transform) and the console faded out — and the tank there = the tank once the shift
//      shows (pixels compared); a control answers right after the switch (← spins the tank)
//   3. mid-shift W: the zoom out (data-zoom="out", a mid shot), the console still, the goggles showing the live tank;
//      the periscope pulled again: the zoom in, back in the tank, a control answers
//   4. the end of the shift (Esc on the report): the zoom out, then the goggles off again (no shift going)
//   and no console errors in the whole run (the Dev Kit never opened).
// Then reduce motion (the device's setting): no zoom at all — the switch is instant both ways.
// Screenshots: e2e-shots/periscope-zoom/<size>-*.png
// Run: node e2e/periscope-zoom.mjs  (own dev server on port 5378; E2E_PORT=… runs it on another)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { checkVersion, skipFirstDay } from './start.mjs'
import { rankOf } from './ladder-ranks.mjs'

const PORT = Number(process.env.E2E_PORT) || 5378, OUT = 'e2e-shots/periscope-zoom'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
const art = JSON.parse(readFileSync('content/ui/art.json', 'utf8'))
const GLASS = art.console.periscopeGlass
const URL_ = `http://localhost:${PORT}/?seed=7&rank=${rankOf('swap')}` // (an early rank with its unlock lessons: the ladder's beat)
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
// F77 (B010): a grown screen (a long line slides it down like a toaster) over the goggles. ONE orange frame: the grown
// frame's sides on the monitor art's frame (within 1 px) and no art frame showing just outside it; and nothing of the
// goggles over the frame — its bottom band is all bezel colour. (The line is put on the screen by hand: the screen grows
// the same way for any long line.)
async function grownScreen(page) {
  const geo = await page.evaluate(async () => {
    const words = document.querySelector('.crt .lesson-words')
    words.textContent = 'A LONG LINE THAT SLIDES THE SCREEN DOWN OVER THE PERISCOPE. '.repeat(2)
    await new Promise((ok) => setTimeout(ok, 900))
    const crt = document.querySelector('.crt'), c = crt.getBoundingClientRect(), mon = document.querySelector('.console-monitor').getBoundingClientRect()
    const u = parseFloat(crt.style.getPropertyValue('--u')), b = parseFloat(crt.style.getPropertyValue('--crt-bezel-w')) * u
    return { grown: crt.hasAttribute('data-grown'), frameL: c.left - b, frameR: c.right + b, artL: mon.left, artR: mon.right,
      top: c.top, artBottom: mon.bottom, bottom: c.bottom, b }
  })
  const bez = hex(art.console.crt.bezel)
  // just outside the grown frame's right side, from the screen's top to the art's bottom: no orange there
  const out = await pixels(page, { x: Math.round(geo.frameR + 2), y: Math.round(geo.top + geo.b * 3), width: 3, height: Math.max(4, Math.round(geo.artBottom - geo.top - geo.b * 4)) })
  const outside = 1 - offShare(out, bez, 30)
  // the frame's bottom band across its middle (over the goggles): bezel colour, not glass
  const band = await pixels(page, { x: Math.round(geo.frameL + geo.b * 4), y: Math.round(geo.bottom + geo.b * 0.3), width: Math.round(geo.frameR - geo.frameL - geo.b * 8), height: Math.max(2, Math.round(geo.b * 0.4)) })
  const bandOff = offShare(band, bez, 30)
  return { geo, outside, bandOff }
}
// the goggles are off: nearly every pixel is the painted inner glass colour
async function showsPainted(page, box) {
  const p = await pixels(page, box)
  const off = offShare(p, hex(GLASS.inner.colour))
  return { ok: off < 0.1, detail: `${(off * 100).toFixed(0)}% off ${GLASS.inner.colour}` }
}
const FLICKER_MS = JSON.parse(readFileSync('content/tuning/periscope.json', 'utf8')).flickerMs
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
  if (!window.__goops || !document.querySelector('.periscope-glass') || !document.querySelector('[data-testid="stage"]')) return null
  const v = window.__goops.view, s = window.__goops.engine.state
  // (the stage's box on screen, zoom included — whatever its transform and origin): screen = r + stage px × k
  const st = document.querySelector('[data-testid="stage"]'), r = st.getBoundingClientRect(), k = r.width / st.offsetWidth
  const left = v.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * v.cellPx, floor = v.topY + (s.height - s.bufferRows) * v.cellPx
  const g = document.querySelector('.periscope-glass').getBoundingClientRect(), u = g.width / ring[2]
  return { tankLeft: r.left + left * k, tankW: s.visibleWidth * v.cellPx * k, floor: r.top + floor * k,
    glassLeft: g.left + (inner[0] - ring[0]) * u, glassW: inner[2] * u, glassFloor: g.top + (inner[1] + inner[3] - ring[1] - lift) * u }
}, [GLASS.ring.box, GLASS.inner.box, JSON.parse(readFileSync('content/tuning/periscope.json', 'utf8')).floorLift])
const pinnedOk = (p) => !!p && Math.abs(p.tankLeft - p.glassLeft) < 1.5 && Math.abs(p.tankW - p.glassW) < 1.5 && Math.abs(p.floor - p.glassFloor) < 1.5
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
    try { // (a step that can't run — e.g. no zoom at all — fails its size and the run goes on)
    await skipFirstDay(page)
    await page.goto(URL_)
    await checkVersion(page)
    await page.evaluate((ids) => window.__goopsSeen?.(ids), SEEN)
    await page.reload()
    await page.locator('.kit-art-stage').waitFor()
    await page.waitForTimeout(800)

    // 1. between shifts the goggles are OFF — their painted glass (Muzzy 2026-11-01: "When there is no game going, it
    // should not be on. the moment you drag down to start a new shift, it should flicker on like an old CRT")
    const glassBox = await innerGlass(page)
    check(`${size}: at the console the goggles' glass layer is up`, !!glassBox)
    if (glassBox) {
      const t = await showsPainted(page, glassBox)
      check(`${size}: between shifts the goggles are off (their painted glass)`, t.ok, t.detail)
    }
    await page.screenshot({ path: `${OUT}/${size}-1-console.png` })
    const g = await page.locator('.periscope-glass').boundingBox()
    if (g) await page.screenshot({ path: `${OUT}/${size}-1-goggles-off.png`, clip: { x: g.x - 8, y: g.y - 8, width: g.width + 16, height: g.height + 16 } })
    // a short drag down: they flicker on, then show the tank; let go short → it springs back and they're off again
    const grip = await page.locator('.kit-pull-grip').boundingBox()
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 6 * i)
    const flickering = await page.waitForFunction(() => document.querySelector('.periscope-glass')?.getAttribute('data-power') === 'flicker', null, { timeout: 1500 }).then(() => true, () => false)
    check(`${size}: the moment the periscope starts down the goggles flicker on`, flickering)
    const on = await page.waitForFunction(() => document.querySelector('.periscope-glass')?.getAttribute('data-power') === 'on', null, { timeout: FLICKER_MS + 1500 }).then(() => true, () => false)
    const dragGlass = await innerGlass(page)
    const tDrag = dragGlass && await showsTank(page, dragGlass)
    check(`${size}: once on, the goggles show the next shift's tank`, on && !!tDrag?.ok, tDrag?.detail)
    const g2 = await page.locator('.periscope-glass').boundingBox()
    if (g2) await page.screenshot({ path: `${OUT}/${size}-1-goggles.png`, clip: { x: g2.x - 8, y: g2.y - 8, width: g2.width + 16, height: g2.height + 16 } })
    await page.mouse.up()
    const offAgain = await page.waitForFunction(() => document.querySelector('.periscope-glass')?.getAttribute('data-power') === 'off', null, { timeout: 2000 }).then(() => true, () => false)
    check(`${size}: a short drag springs back and the goggles go off again`, offAgain)
    await page.mouse.click(5, 5) // (a neutral spot: the drag's own click is spent)
    // 1b. F77 (B010): a grown screen over the goggles — one frame, never cut by the goggles' hole
    const gs = await grownScreen(page)
    check(`${size}: a long line grows the screen`, gs.geo.grown)
    check(`${size}: the grown frame lines up with the monitor art's frame (within 1 px)`, Math.abs(gs.geo.frameL - gs.geo.artL) <= 1 && Math.abs(gs.geo.frameR - gs.geo.artR) <= 1,
      `left ${gs.geo.frameL.toFixed(1)} vs ${gs.geo.artL.toFixed(1)} · right ${gs.geo.frameR.toFixed(1)} vs ${gs.geo.artR.toFixed(1)}`)
    check(`${size}: no second frame shows beside the grown one`, gs.outside < 0.05, `${(gs.outside * 100).toFixed(0)}% bezel colour just outside`)
    check(`${size}: the goggles never cut the grown frame (its bottom band is all bezel)`, gs.bandOff < 0.05, `${(gs.bandOff * 100).toFixed(0)}% of the band isn't bezel`)
    await page.screenshot({ path: `${OUT}/${size}-1-grown.png` })
    await page.reload()
    await page.locator('.kit-art-stage').waitFor()
    await page.waitForTimeout(800)

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
    const tNext = nextGlass && await showsPainted(page, nextGlass)
    check(`${size}: the shift over, the goggles are off again`, !!tNext?.ok, tNext?.detail)
    await page.screenshot({ path: `${OUT}/${size}-4-back.png` })
    } catch (e) { check(`${size}: the steps ran to the end`, false, String(e.message ?? e).split('\n')[0]) }
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
