// Where cracks land, as the player sees it (F27, 2026-10-19 — Muzzy: "an actual obvious band with zero cracks above
// feels aesthetically incorrect"). A tank like Muzzy's screenshot (pressure 100%, two low stacks), the rules paused,
// then 30 cracks placed by each band setting from the live tuning, one shot each → e2e-shots/crack-spread/.
// Checks: no crack above the pop line; with 'hill', some cracks above the old band's ceiling (no flat band).
// Port 5291. Run: node e2e/crack-spread.mjs
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5291, OUT = 'e2e-shots/crack-spread'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?rank=4`)
  await startShift(page)

  for (const [name, band] of [['before-halfwayPerColumn', 'halfwayPerColumn'], ['after-hill', 'hill']]) {
    const r = await page.evaluate(async (band) => {
      const { setClockPause } = await import('/src/devkit/gameClock.ts')
      const { spawnCrack, firstPoppableRow } = await import('/src/engine/cracks.ts')
      const { createRng } = await import('/src/engine/rng.ts')
      const config = structuredClone((await import('/content/tuning/shift.json')).default)
      config.cracks.band = band
      setClockPause('half')
      const s = window.__goops.engine.state
      s.grid.fill(0)
      s.cracks.length = 0
      // two low stacks in view (like Muzzy's screenshot: top goop ~row 3-4 from the floor)
      const vis = (k) => (s.spin + k + s.width) % s.width // k-th visible column from the left edge of the view
      const put = (k, rows, colour) => { for (let row = 0; row < rows; row++) s.grid[(s.height - 1 - row) * s.width + vis(k)] = colour }
      put(5, 4, 1); put(6, 3, 1); put(7, 2, 1); put(8, 4, 4); put(9, 3, 4)
      window.__goops.engine.setPressure(1)
      const rng = createRng(7)
      for (let i = 0; i < 30; i++) {
        const c = spawnCrack(s, rng, config, 4, 9000 + i)
        if (c) s.cracks.push(c)
      }
      const lineRow = s.height - 1 - firstPoppableRow(s)
      const rows = s.cracks.map((c) => s.height - 1 - c.y)
      return { lineRow, rows, aboveLine: rows.filter((x) => x > lineRow).length, aboveOldCeiling: rows.filter((x) => x > lineRow / 2).length }
    }, band)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`${name}: line row ${r.lineRow} · crack rows ${r.rows.sort((a, b) => a - b).join(',')} · above the line ${r.aboveLine} · above row ${r.lineRow / 2} ${r.aboveOldCeiling}`)
    if (r.aboveLine > 0) { console.log('  ✗ a crack above the pop line'); failed++ }
    if (band === 'hill' && r.aboveOldCeiling === 0) { console.log('  ✗ hill: no crack above the old ceiling (still a flat band)'); failed++ }
  }
  if (errors.length) { console.log('  ✗ console errors:', errors.join(' | ')); failed++ }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `${failed} problem(s)` : 'crack-spread: all checks passed')
process.exit(failed ? 1 : 0)
