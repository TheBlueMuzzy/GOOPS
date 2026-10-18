// F25 visor glitch check: the overlay canvas is off at amount 0 + pixel filter off, on with ?visor=0.8, on from the
// visor's real health, no console errors. It covers ONLY the tank's rectangle (Muzzy, 2026-10-18), and the canvases
// under it stay visible, so outside the tank the screen is unchanged by the effect: at 390x844, 844x390 and 1440x900,
// ?visor=0.6 vs off, pixels well outside the tank are the same and pixels inside it are not (shots tank-only-<size>).
// Screenshots with the real Jelly + Particle goo at amount 0 / 0.5 / 1, pixel filter on/off, phone + desktop →
// e2e-shots/visor/; then fps at 390x844@3x with ?visor=1 for both goo styles (and the plain game for comparison).
// Run: node e2e/visor.mjs  (own dev server on port 5265)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5265, OUT = 'e2e-shots/visor'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const fail = (msg) => { console.log('FAIL', msg); failed++ }

// the visible tank's rectangle (CSS px), as src/view/geometry.ts tankRect works it out
const TANK_RECT = () => { const { view, engine } = window.__goops, s = engine.state
  const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx
  return { left, top: view.topY, right: left + s.visibleWidth * view.cellPx, bottom: view.topY + (s.height - s.bufferRows) * view.cellPx } }
// what the stage looks like right now: is the overlay showing, does it sit exactly on the tank, are the canvases under it
// still visible (they must be: the overlay only covers the tank)?
const layers = (page) => page.evaluate((tankRectSrc) => {
  const tankRect = new Function(`return (${tankRectSrc})()`)
  const o = document.querySelector('canvas[data-visor]'), [tank] = document.querySelectorAll('.stage > canvas'), goo = document.querySelector('canvas[data-goo]')
  const overlay = !!o && getComputedStyle(o).display !== 'none'
  const r = o.getBoundingClientRect(), t = tankRect()
  const onTank = Math.abs(r.left - t.left) <= 1 && Math.abs(r.right - t.right) <= 1 && Math.abs(r.top - t.top) <= 1 && Math.abs(r.bottom - t.bottom) <= 1
  return { overlay, onTank: overlay ? onTank : null, tankHidden: getComputedStyle(tank).visibility === 'hidden', gooHidden: getComputedStyle(goo).visibility === 'hidden' }
}, TANK_RECT.toString())
// two screenshots compared in the page: the biggest colour change at grid points well OUTSIDE the tank (margin px away
// from it), and the average change INSIDE it
const compare = (page, a, b, margin) => page.evaluate(async ({ a, b, margin, tankRectSrc }) => {
  const t = new Function(`return (${tankRectSrc})()`)()
  const load = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height) }
  const A = await load(a), B = await load(b)
  let outMax = 0, outN = 0, inSum = 0, inN = 0
  for (let y = 2; y < A.height; y += 6) for (let x = 2; x < A.width; x += 6) {
    const i = (y * A.width + x) * 4
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]))
    const inside = x > t.left && x < t.right && y > t.top && y < t.bottom
    const far = x < t.left - margin || x > t.right + margin || y < t.top - margin || y > t.bottom + margin
    if (inside) { inSum += d; inN++ } else if (far) { outMax = Math.max(outMax, d); outN++ }
  }
  return { outMax, outN, inMean: Math.round((inSum / inN) * 10) / 10 }
}, { a: a.toString('base64'), b: b.toString('base64'), margin, tankRectSrc: TANK_RECT.toString() })
const fillTank = (page) => page.evaluate(() => { const { engine } = window.__goops
  for (let i = 0; i < 30 && engine.state.phase === 'playing' && engine.state.integrity > 0.6; i++) { for (let k = 0; k < (i * 7) % 11; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'softDrop', on: true }); engine.tick(2500) } })
async function open(url, w, h, dpr = 1) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/${url}`)
  await startShift(page)
  return { page, errors }
}

try {
  // 1. off / on / from real health
  {
    const { page, errors } = await open('?seed=7&visor=off&pixel=off', 390, 844)
    await page.waitForTimeout(300)
    const L = await layers(page)
    console.log('amount 0 + pixel off:', JSON.stringify(L))
    if (L.overlay || L.tankHidden || L.gooHidden) fail('overlay should be off and the canvases visible')
    // the real path: an unlocked visor whose signal fades → the overlay comes on; healthy again → off
    await page.evaluate(() => { window.__goopsVisor.set({ amount: null }); const v = window.__goops.engine.state.machines.visor; v.unlocked = true; v.health = 0.5 })
    await page.waitForTimeout(200)
    const fading = await layers(page)
    await page.evaluate(() => { window.__goops.engine.state.machines.visor.health = 1 })
    await page.waitForTimeout(200)
    const healthy = await layers(page)
    console.log('visor health 0.5:', JSON.stringify(fading), '→ health 1:', JSON.stringify(healthy))
    if (!fading.overlay || !fading.onTank || fading.tankHidden || fading.gooHidden) fail('a fading visor should show the overlay, on the tank only')
    if (healthy.overlay || healthy.tankHidden) fail('a healthy visor (pixel off) should hide the overlay')
    if (errors.length) fail('errors: ' + errors.join(' | '))
    await page.close()
  }
  {
    const { page, errors } = await open('?seed=7&visor=0.8', 390, 844)
    await page.waitForTimeout(300)
    const L = await layers(page)
    console.log('?visor=0.8:', JSON.stringify(L))
    if (!L.overlay || !L.onTank || L.tankHidden || L.gooHidden) fail('?visor=0.8 should show the overlay over the tank only (canvases under it visible)')
    if (errors.length) fail('errors: ' + errors.join(' | '))
    await page.close()
  }

  // 1b. only over the tank: ?visor=0.6 vs off, the tank's time stopped (only the effect changes between the two shots)
  for (const [w, h] of [[390, 844], [844, 390], [1440, 900]]) {
    const { page, errors } = await open('?seed=7&visor=off&pixel=off', w, h)
    await fillTank(page)
    await page.evaluate(() => { window.__goops.engine.tick = () => {}; window.__goopsVisor.freeze(12.34) })
    await page.waitForTimeout(1500) // the goo settles
    const before = await page.screenshot()
    await page.evaluate(() => window.__goopsVisor.set({ amount: 0.6 }))
    await page.waitForTimeout(200)
    const after = await page.screenshot({ path: `${OUT}/tank-only-${w}x${h}.png` })
    const L = await layers(page)
    const c = await compare(page, before, after, 24)
    console.log(`${w}x${h} ?visor=0.6 vs off:`, JSON.stringify(L), JSON.stringify(c))
    if (!L.overlay || !L.onTank) fail(`${w}x${h}: the overlay should sit exactly on the tank`)
    if (c.outN < 50 || c.outMax > 3) fail(`${w}x${h}: outside the tank the screen should be unchanged (max change ${c.outMax} over ${c.outN} points)`)
    if (c.inMean < 5) fail(`${w}x${h}: inside the tank the glitch should show (mean change ${c.inMean})`)
    if (errors.length) fail(`${w}x${h} errors: ` + errors.join(' | '))
    await page.close()
  }

  // 2. screenshots: real goo, both styles, amount 0 / 0.5 / 1, pixel on / off, phone + desktop
  for (const [name, w, h] of [['phone', 390, 844], ['desktop', 1440, 900]]) {
    const { page, errors } = await open('?seed=7', w, h)
    await fillTank(page)
    await page.evaluate(() => window.__goopsVisor.freeze(12.34)) // the glitch clock stands still: repeatable shots
    for (const style of ['Jelly', 'Particle']) {
      await page.evaluate((s) => window.__goops.gooStyle.setFromSetting(s), style)
      await page.waitForTimeout(900)
      for (const pixel of [false, true]) for (const amount of [0, 0.5, 1]) {
        await page.evaluate((o) => window.__goopsVisor.set(o), { amount, pixelate: pixel })
        await page.waitForTimeout(150)
        await page.screenshot({ path: `${OUT}/${name}-${style.toLowerCase()}-a${amount}-pix${pixel ? 'on' : 'off'}.png` })
      }
    }
    if (errors.length) fail(name + ' errors: ' + errors.join(' | '))
    await page.close()
  }

  // 3. fps at 390x844@3x: ?visor=1 (glitch + pixel filter as in content) vs the plain game
  for (const url of ['?seed=7&visor=off&pixel=off', '?seed=7&visor=1']) {
    const { page, errors } = await open(url, 390, 844, 3)
    await fillTank(page)
    for (const style of ['Jelly', 'Particle']) {
      await page.evaluate((s) => window.__goops.gooStyle.setFromSetting(s), style)
      await page.waitForTimeout(1500)
      const r = await page.evaluate(() => new Promise((res) => {
        const { engine } = window.__goops; let n = 0, worst = 0, last = performance.now(); const t0 = last
        const f = (now) => { worst = Math.max(worst, now - last); last = now; n++
          if (n % 20 === 0) engine.act({ type: 'spin', dir: 1 }) // keep the goo moving
          if (now - t0 < 3000) requestAnimationFrame(f); else res({ fps: Math.round(n / ((now - t0) / 1000)), worstMs: Math.round(worst) }) }
        requestAnimationFrame(f) }))
      console.log('fps 390x844@3x', url.padEnd(28), style.padEnd(8), JSON.stringify(r))
    }
    if (errors.length) fail('fps run errors: ' + errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `${failed} problem(s)` : 'visor: all good')
process.exit(failed ? 1 : 0)
