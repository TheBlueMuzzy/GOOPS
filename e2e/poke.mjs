// Poke check (Muzzy 2026-10-18: "clicking on a locked goop cluster that isn't ready to be popped should do a jiggle,
// like sending a ripple through the jello because I poked it"): in both goo styles, a real click on goop that is still
// filling makes the goo there move (its own motion reading, gooMotion), then it settles again. With the rules held
// still (no next piece falling through) and the goo left to settle first.
// Run: node e2e/poke.mjs  (own dev server on port 5268)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'

const PORT = 5268
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }
try {
  for (const style of ['Jelly', 'Particle']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/?seed=7&visor=off`)
    await startShift(page)
    await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
    // land the first piece, then hold the rules still: it stays "filling", nothing else falls; the goo keeps animating
    const cell = await page.evaluate(() => { const { engine } = window.__goops
      for (let t = 0; t < 80 && engine.state.groups.size === 0; t++) { engine.act({ type: 'softDrop', on: true }); engine.tick(100) }
      engine.act({ type: 'softDrop', on: false })
      const g = [...engine.state.groups.values()][0]
      engine.state.piece = null; engine.tick = () => {}
      return g && !g.ready ? g.cells[0] : null })
    if (cell === null) { check(`${style}: a filling group to poke`, false); await page.close(); continue }
    await page.waitForTimeout(5000) // the landing wobble settles
    const pos = await page.evaluate((c) => { const { engine, view, cellAt } = window.__goops, s = engine.state
      const x = c % s.width, y = Math.floor(c / s.width)
      let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
      const px = view.centreX + d * view.cellPx, py = view.topY + (y - s.bufferRows + 0.5) * view.cellPx
      const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
      const [cx, cy] = cellAt(px + stage.left, py + stage.top) // the click must land on this cell (curved visor)
      return { px: px + stage.left, py: py + stage.top, onCell: cy * s.width + cx === c } }, cell)
    const motion = () => page.evaluate((c) => window.__goops.gooMotion(c), cell)
    const calm = await motion()
    await page.mouse.click(pos.px, pos.py)
    let peak = 0
    for (let k = 0; k < 6; k++) { await page.waitForTimeout(40); peak = Math.max(peak, await motion()) }
    await page.waitForTimeout(2000)
    const settled = await motion()
    const popped = await page.evaluate((c) => !window.__goops.engine.state.grid[c], cell)
    check(`${style}: poking goop that is still filling jiggles it`, pos.onCell && !popped && peak > Math.max(calm * 4, 0.02),
      `motion at rest ${calm.toFixed(3)} → peak ${peak.toFixed(3)} → ${settled.toFixed(3)} after 2 s`)
    check(`${style}: …and it settles again`, settled < peak / 3)
    check(`${style}: no page errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
