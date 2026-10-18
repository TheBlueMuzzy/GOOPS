// Smoke check: menu → start a shift → play with real inputs → switch goo style → fast-forward to the end screen.
// Screenshots at phone + desktop sizes into e2e-shots/smoke/. Uses Playwright's own Chromium (never the user's Chrome).
// Run: node e2e/shift-smoke.mjs  (starts its own dev server on port 5250 and stops it)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5250, OUT = 'e2e-shots/smoke'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})

const sizes = [['phone', 390, 844], ['desktop', 1280, 800], ['landscape', 844, 390]]
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
try {
  for (const [name, w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(`http://localhost:${PORT}/?seed=7`)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/${name}-1-menu.png` })
    await page.getByRole('button', { name: 'Start shift' }).click()
    await page.waitForTimeout(800)
    // play: spin both ways, rotate, fast drop, a few pieces
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
      await page.keyboard.press('KeyE')
      await page.keyboard.down('KeyS'); await page.waitForTimeout(700); await page.keyboard.up('KeyS')
    }
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}-2-playing.png` })
    // fast-forward most of the shift through the dev hook, dropping pieces as it goes
    await page.evaluate(async () => {
      const { engine } = window.__goops
      // stop while the shift is still running (no sealing → the tank ruptures ~47 s in)
      for (let i = 0; i < 30 && engine.state.phase === 'playing' && engine.state.integrity > 0.3; i++) { for (let k = 0; k < (i * 7) % 11; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'softDrop', on: true }); engine.tick(2500) }
    })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/${name}-3-busy-jelly.png` })
    // switch the goo style mid-shift: the game state must not change
    const before = await page.evaluate(() => Array.from(window.__goops.engine.state.grid).join(''))
    await page.evaluate(() => { const g = window.__goops; g.engine.tick(0); g.gooStyle.setFromSetting('Particle') })
    await page.waitForTimeout(900)
    const after = await page.evaluate(() => Array.from(window.__goops.engine.state.grid).join(''))
    if (before !== after) { console.log(name, 'grid changed while only switching goo style?'); }
    await page.screenshot({ path: `${OUT}/${name}-3-busy-particle.png` })
    await page.evaluate(() => window.__goops.gooStyle.setFromSetting('Jelly'))
    const state = await page.evaluate(() => { const s = window.__goops.engine.state; return { pressure: +s.pressure.toFixed(2), integrity: +s.integrity.toFixed(2), score: s.score, status: s.status } })
    if (state.status !== 'playing') { console.log(name, 'shift ended before the goo-style switch'); failed++ }
    await page.evaluate(() => { const e = window.__goops.engine; for (let t = 0; t < 600000 && e.state.status === 'playing'; t += 1000) e.tick(1000) }) // to the rupture and the end
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/${name}-4-end.png` })
    const endShown = await page.getByText(/Shift (complete|failed)/).count()
    console.log(name, JSON.stringify(state), 'end screen:', endShown ? 'yes' : 'NO', errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no errors')
    if (!endShown || errors.length) failed++
    await page.close()
  }
} finally {
  await browser.close()
  stop()
}
process.exit(failed ? 1 : 0)
