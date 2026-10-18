// Controls check with real input: drag sideways spins, tap empty space rotates, tap a ready blob pops it,
// and every key in the GDD §4 table does its one job (hold-to-swap uses the same 1.5 s as touch).
// Run: node e2e/controls.mjs  (own dev server on port 5251)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
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
  await startShift(page)
  await page.waitForTimeout(200)
  const get = (f, arg) => page.evaluate(f, arg)

  // drag left 80 px and hold: the tank keeps spinning (+1 per 100 ms, v1 sign: drag left = +1)
  const spin0 = await get(() => window.__goops.engine.state.spin)
  const dragT0 = Date.now()
  await page.mouse.move(195, 420); await page.mouse.down(); await page.mouse.move(150, 420, { steps: 5 }); await page.mouse.move(115, 420, { steps: 5 })
  await page.waitForTimeout(450); await page.mouse.up()
  const dragMs = Date.now() - dragT0
  const spin1 = await get(() => window.__goops.engine.state.spin)
  const turned = ((spin1 - spin0) % 30 + 30) % 30
  check('drag left spins the tank', turned >= 2 && turned <= Math.ceil(dragMs / 100) + 1, `spin ${spin0} → ${spin1} in ${dragMs} ms (expect ~1 per 100 ms)`)

  // tap empty space on the right half: rotates clockwise
  const rot0 = await get(() => window.__goops.engine.state.piece?.rotation)
  await page.mouse.click(300, 300)
  await page.waitForTimeout(100)
  const rot1 = await get(() => window.__goops.engine.state.piece?.rotation)
  check('tap right half rotates', rot1 !== rot0, `rotation ${rot0} → ${rot1}`)

  // keys — one job each (GDD §4 table)
  const st = () => get(() => { const s = window.__goops.engine.state; return { spin: s.spin, rot: s.piece?.rotation, held: JSON.stringify(s.held), next: JSON.stringify(s.next) } })
  const turn = (a, b) => ((b - a) % 30 + 30) % 30
  for (const [key, want] of [['KeyA', 29], ['ArrowLeft', 29], ['KeyD', 1], ['ArrowRight', 1]] /* keys move the view (2026-10-18) */) {
    const a = await st(); await page.keyboard.press(key); await page.waitForTimeout(60); const b = await st()
    check(`${key} spins`, turn(a.spin, b.spin) === want, `spin ${a.spin} → ${b.spin}`)
  }
  for (const [key, want] of [['KeyQ', 3], ['ControlRight', 3], ['KeyE', 1], ['Numpad0', 1]]) {
    const a = await st(); await page.keyboard.press(key); await page.waitForTimeout(60); const b = await st()
    check(`${key} rotates ${want === 1 ? 'clockwise' : 'counter-clockwise'}`, ((b.rot - a.rot) % 4 + 4) % 4 === want, `rotation ${a.rot} → ${b.rot}`)
  }
  for (const key of ['Space']) {
    const a = await st(); await page.keyboard.press(key); await page.waitForTimeout(60); const b = await st()
    check(`${key} does nothing`, a.spin === b.spin && a.rot === b.rot && a.held === b.held, '')
  }
  // count swap actions (a swap between two identical pieces looks like nothing happened)
  await get(() => { const e = window.__goops.engine, act = e.act.bind(e); window.__swaps = 0; e.act = (a) => { if (a.type === 'hold') window.__swaps++; return act(a) } })
  const swaps = () => get(() => window.__swaps)
  for (const key of ['KeyR', 'ShiftRight']) {
    const a = await swaps()
    await page.keyboard.down(key); await page.waitForTimeout(600); await page.keyboard.up(key)
    const b = await swaps()
    check(`${key} tapped (0.6 s) does not swap`, a === b, '')
    await page.keyboard.down(key); await page.waitForTimeout(1700); await page.keyboard.up(key)
    const c = await swaps()
    check(`${key} held 1.5 s swaps`, c === b + 1, `swaps ${b} → ${c}`)
  }
  // W / ↑ = the real console slides over the tank mid-shift (F23/F24); the periscope (tapped) goes back to the shift
  const toConsole = async (key) => {
    await page.keyboard.press(key)
    return page.waitForFunction(() => { const c = document.querySelector('.kit-screen[aria-label="Console"]'); return c && !c.hasAttribute('data-slide') }, null, { timeout: 3000 }).then(() => true, () => false)
  }
  const backToTank = async () => {
    await page.getByRole('button', { name: 'Back to the tank' }).click()
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
  }
  for (const key of ['KeyW', 'ArrowUp']) {
    check(`${key} opens the console mid-shift`, await toConsole(key))
    await backToTank()
    check(`${key}: the periscope goes back to the shift`, await get(() => window.__goops.engine.state.status === 'playing'))
  }

  // build some goop, wait for a ready group at/below the line, then tap it on screen
  const target = await get(() => {
    const { engine } = window.__goops
    // fast-drop six pieces side by side (re-press every tick: the engine turns fast drop off at each lock)
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 3; k++) engine.act({ type: 'spin', dir: 1 })
      let lastY = -99
      for (let t = 0; t < 60; t++) {
        engine.act({ type: 'softDrop', on: true }); engine.tick(100)
        const p = engine.state.piece, y = p ? Math.min(...p.cells.map((c) => c[1])) : -99
        if (y < lastY) break // a new piece spawned at the top
        lastY = y
      }
    }
    engine.act({ type: 'softDrop', on: false })
    for (let t = 0; t < 400; t++) {
      engine.tick(50)
      const s = engine.state
      for (const g of s.groups.values()) if (g.ready) {
        // turn the tank (shortest way) so the blob is in the middle of the 12 visible columns
        const cell = g.cells[0], x = cell % s.width
        let d = ((x - s.spin) % s.width + s.width) % s.width; if (d > s.width / 2) d -= s.width
        for (let k = 0; k < Math.abs(d); k++) engine.act({ type: 'spin', dir: d > 0 ? 1 : -1 })
        return { cell, size: g.cells.length, score: engine.state.score, facing: engine.state.spin === x }
      }
    }
    return null
  })
  if (!target) check('a group became ready', false)
  else if (!target.facing) check('turned the tank to face the blob', false)
  else {
    await page.waitForTimeout(1500) // let the camera glide to the spin (it turned 18 columns)
    const pos = await get((cell) => {
      const { engine, view } = window.__goops, s = engine.state
      const x = cell % s.width, y = Math.floor(cell / s.width)
      let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
      return { px: view.centreX + d * view.cellPx, py: view.topY + (y - s.bufferRows + 0.5) * view.cellPx }
    }, target.cell)
    await page.screenshot({ path: 'e2e-shots/controls-before-pop.png' })
    await page.mouse.click(pos.px, pos.py)
    await page.waitForTimeout(100)
    const after = await get(() => window.__goops.engine.state.score)
    check('tap a ready blob pops it', after > target.score, `score ${target.score} → ${after} (group of ${target.size})`)
  }
  // typing in the Dev Kit never reaches the game's hotkeys (Muzzy 2026-10-18: "curve" in Search came out "cuv" — R and E
  // went to the game). Dev Kit 0.17.1 keeps its keys inside; the game also ignores keys typed into any text box.
  {
    await page.keyboard.press('Backquote'); await page.waitForTimeout(300)
    const search = page.locator('#devkit-root input[type="search"], #devkit-root input[aria-label^="Search"]').first()
    await search.click()
    const before = await get(() => { const s = window.__goops.engine.state; return { spin: s.spin, rot: s.piece?.rotation } })
    await page.keyboard.type('curve wasd qe', { delay: 30 })
    const typed = await search.inputValue()
    const after = await get(() => { const s = window.__goops.engine.state; return { spin: s.spin, rot: s.piece?.rotation } })
    check('typing in the Dev Kit search stays in the box', typed === 'curve wasd qe', JSON.stringify(typed))
    check('…and never turns, rotates or opens the console', after.spin === before.spin && after.rot === before.rot && !(await page.locator('[data-testid="console"]').count()),
      `${JSON.stringify(before)} → ${JSON.stringify(after)}`)
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  }
  // Settings → Gameplay → Wall kick reaches the game mid-shift, and a new shift starts with the saved choice
  const kick = () => get(() => window.__goops.engine.wallKick)
  check('wall kick starts as Rotate vat', (await kick()) === 'rotateVat')
  await toConsole('KeyW')
  await page.getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(300) // the gear: the pause menu
  await page.getByRole('dialog').getByRole('button', { name: 'Settings' }).click(); await page.waitForTimeout(300)
  await page.getByRole('tab', { name: 'Gameplay' }).click(); await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Next Wall kick' }).click(); await page.waitForTimeout(200)
  check('Settings switch → Shunt piece mid-shift', (await kick()) === 'shuntPiece', String(await kick()))
  await page.reload(); await startShift(page)
  check('a new shift keeps Shunt piece', (await kick()) === 'shuntPiece', String(await kick()))
  await page.evaluate(() => localStorage.clear())
  check('no page errors', errors.length === 0, errors.join(' | '))
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
