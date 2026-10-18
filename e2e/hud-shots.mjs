// HUD screenshots: pressure + tank bars, quota met, a real rupture (its toast + status). Port 5254.
// Run: node e2e/hud-shots.mjs → e2e-shots/hud/
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5254, OUT = 'e2e-shots/hud'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const sizes = [['phone', 390, 844], ['small', 360, 780], ['landscape', 844, 390], ['short', 768, 343], ['desktop', 1440, 900], ['wide', 2000, 1121]]
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
try {
  for (const [name, w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/?seed=7`)
    await page.getByRole('button', { name: 'Start shift' }).click()
    await page.waitForTimeout(400)
    // a few pieces + some cracks open (nobody seals) → integrity falling
    await page.evaluate(() => { const { engine } = window.__goops
      for (let i = 0; i < 10; i++) { for (let k = 0; k < (i * 5) % 7; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'softDrop', on: true }); engine.tick(2500) } })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/${name}-1-playing.png` })
    // every HUD part sits over the tank (± 16 px), not out at the window edges
    const hud = await page.evaluate(() => {
      const { view, engine } = window.__goops, s = engine.state
      const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx, right = left + s.visibleWidth * view.cellPx
      const parts = [...document.querySelectorAll('.kit-hud-slot > *')].map((e) => e.getBoundingClientRect()) // the slot itself has no box (display: contents)
      // allowed room: the tank ± 16 px, or a 360 px column when the tank is narrower (phone on its side)
      const mid = (left + right) / 2, half = Math.max((right - left) / 2 + 17, 181)
      const out = parts.filter((r) => r.width && (r.left < mid - half || r.right > mid + half))
      const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
      const overlaps = parts.flatMap((a, i) => parts.slice(i + 1).filter((b) => hit(a, b)).map(() => i))
      return { parts: parts.length, out: out.map((r) => `${Math.round(r.left)}–${Math.round(r.right)}`), overlaps: overlaps.length, tank: `${Math.round(left)}–${Math.round(right)}` }
    })
    if (!hud.parts || hud.out.length || hud.overlaps) { console.log(name, 'HUD outside the tank', JSON.stringify(hud)); failed++ } else console.log(name, 'HUD', hud.parts, 'parts inside tank', hud.tank)
    // a crack out of view gets an arrow at the tank edge: turn the tank away from one and look for its colour there
    const arrow = await page.evaluate(async () => {
      const { engine, view } = window.__goops, s = engine.state
      const c = s.cracks[0]; if (!c) return 'no crack'
      for (let k = 0; k < 15; k++) engine.act({ type: 'spin', dir: 1 }) // half way round: the crack is behind the tank
      await new Promise((r) => setTimeout(r, 1200)) // the camera glides there
      const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx, right = left + s.visibleWidth * view.cellPx
      const y = view.topY + (c.y - s.bufferRows + 0.5) * view.cellPx
      const ctx = document.querySelector('canvas').getContext('2d'), d = view.dpr
      const px = (x) => [...ctx.getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data]
      return { leftEdge: px(left + 6), rightEdge: px(right - 6) }
    })
    await page.screenshot({ path: `${OUT}/${name}-1b-offscreen-crack.png` })
    const lit = (p) => Array.isArray(p) && Math.max(p[0], p[1], p[2]) > 120
    if (typeof arrow === 'string' || !(lit(arrow.leftEdge) || lit(arrow.rightEdge))) { console.log(name, 'no off-screen arrow', JSON.stringify(arrow)); failed++ }
    // run on until the tank ruptures for real
    const ruptured = await page.evaluate(() => { const { engine } = window.__goops
      for (let t = 0; t < 400 && engine.state.phase === 'playing'; t++) engine.tick(250)
      return engine.state.phase === 'rupture' })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}-2-rupture.png` })
    const toastShown = await page.getByText(/The tank ruptured/).count()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    console.log(name, 'rupture:', ruptured, 'toast:', toastShown ? 'yes' : 'NO', overflow ? 'SIDEWAYS OVERFLOW' : '', errors.length ? 'ERRORS ' + errors.join(' | ') : 'no errors')
    if (!ruptured || !toastShown || overflow || errors.length) failed++
    await page.close()
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
