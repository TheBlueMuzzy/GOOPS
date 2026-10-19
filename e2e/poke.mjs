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
  // both reasons a zap is refused (Muzzy 2026-10-18: "it should jiggle in both instances"): above the pressure line
  // (pressure 0 — the line sits at the floor) and below it but still filling (pressure 90%)
  for (const style of ['Jelly', 'Particle']) for (const [where, pressure] of [['above the line', 0], ['below the line, still filling', 0.9]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/?seed=7&visor=off`)
    await startShift(page)
    await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
    // land the first piece, then hold the rules still: it stays "filling", nothing else falls; the goo keeps animating
    const got = await page.evaluate((pressure) => { const { engine } = window.__goops, s = engine.state
      for (let t = 0; t < 80 && s.groups.size === 0; t++) { engine.act({ type: 'softDrop', on: true }); engine.tick(100) }
      engine.act({ type: 'softDrop', on: false })
      engine.setPressure(pressure)
      const g = [...s.groups.values()][0]
      s.piece = null; engine.tick = () => {}
      const top = Math.min(...g.cells.map((c) => Math.floor(c / s.width)))
      return g && !g.ready ? { cell: g.cells[0], above: top < s.pressureRow } : null }, pressure)
    const name = `${style}, ${where}`
    if (!got || got.above !== (pressure === 0)) { check(`${name}: a group that can't pop yet to poke`, false, JSON.stringify(got)); await page.close(); continue }
    const { cell } = got
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
    check(`${name}: poking goop that can't pop yet jiggles it`, pos.onCell && !popped && peak > Math.max(calm * 4, 0.02),
      `motion at rest ${calm.toFixed(3)} → peak ${peak.toFixed(3)} → ${settled.toFixed(3)} after 2 s`)
    check(`${name}: …and it settles again`, settled < peak / 3)
    check(`${name}: no page errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
