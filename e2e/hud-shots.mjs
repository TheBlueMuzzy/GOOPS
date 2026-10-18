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
const sizes = [['phone', 390, 844], ['small', 360, 780], ['landscape', 844, 390], ['short', 768, 343], ['desktop', 1440, 900]]
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
