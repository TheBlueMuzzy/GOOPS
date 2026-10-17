// Controls check with real pointer input: drag sideways spins, tap empty space rotates, tap a ready blob pops it.
// Run: node e2e/controls.mjs  (own dev server on port 5251)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'

const PORT = 5251
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: false })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://localhost:${PORT}/?seed=11`)
  await page.getByRole('button', { name: 'Start shift' }).click()
  await page.waitForTimeout(500)
  const get = (f, arg) => page.evaluate(f, arg)

  // drag left 80 px and hold: the tank keeps spinning (+1 per 100 ms, v1 sign: drag left = +1)
  const spin0 = await get(() => window.__goops.engine.state.spin)
  await page.mouse.move(195, 420); await page.mouse.down(); await page.mouse.move(150, 420, { steps: 5 }); await page.mouse.move(115, 420, { steps: 5 })
  await page.waitForTimeout(450); await page.mouse.up()
  const spin1 = await get(() => window.__goops.engine.state.spin)
  const turned = ((spin1 - spin0) % 30 + 30) % 30
  check('drag left spins the tank', turned >= 2 && turned < 15, `spin ${spin0} → ${spin1}`)

  // tap empty space on the right half: rotates clockwise
  const rot0 = await get(() => window.__goops.engine.state.piece?.rotation)
  await page.mouse.click(300, 300)
  await page.waitForTimeout(100)
  const rot1 = await get(() => window.__goops.engine.state.piece?.rotation)
  check('tap right half rotates', rot1 !== rot0, `rotation ${rot0} → ${rot1}`)

  // build some goop, wait for a ready group at/below the line, then tap it on screen
  const target = await get(() => {
    const { engine } = window.__goops
    for (let i = 0; i < 6; i++) { engine.act({ type: 'hardDrop' }); engine.tick(50) }
    for (let t = 0; t < 400; t++) {
      engine.tick(50)
      const s = engine.state
      for (const g of s.groups.values()) if (g.ready) return { cell: g.cells[0], size: g.cells.length, score: s.score }
    }
    return null
  })
  if (!target) check('a group became ready', false)
  else {
    await page.waitForTimeout(300) // let the camera settle
    const pos = await get((cell) => {
      const { engine, view } = window.__goops, s = engine.state
      const x = cell % s.width, y = Math.floor(cell / s.width)
      let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
      return { px: view.centreX + d * view.cellPx, py: view.topY + (y - s.bufferRows + 0.5) * view.cellPx }
    }, target.cell)
    await page.mouse.click(pos.px, pos.py)
    await page.waitForTimeout(100)
    const after = await get(() => window.__goops.engine.state.score)
    check('tap a ready blob pops it', after > target.score, `score ${target.score} → ${after} (group of ${target.size})`)
  }
  check('no page errors', errors.length === 0, errors.join(' | '))
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
