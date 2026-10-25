// The white goop (F63): the Veteran, gooped — in a real shift from rank 31. Checks:
//   rank 30: no white goop · rank 31: he drops in at the start and lands · a laser tap on him gives the "ow" bubble
//   (the whisper bubble) and he stays (nothing pops) · he oozes to a crack and seals it (a ring while he does; the crack
//   is gone and mended) · goop over him: he's behind it (x-ray outline) · the Dev Kit's full pause stops him dead, and
//   he carries on after · Particle style draws him too.
// To keep it readable the shift's own cracks are turned off and the falling piece hangs (both through the dev hook's
// engine), and the test places the crack he goes for. Shots at every portrait size into e2e-shots/white-goop/.
// He's read through __goops.white() (dev only).
// Run: node e2e/white-goop.mjs  (own dev server on port 6400)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 6400
const SHOTS = 'e2e-shots/white-goop'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
mkdirSync(SHOTS, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }
const white = (page) => page.evaluate(() => window.__goops.white())
// wait (every frame) until white() passes `test` (a function body over `V`), or time out → false
// waits up to `ms` of time the ENGINE has actually played (its tick()s, counted here) — not the wall clock or the rules
// clock: under check:full's load each frame's step is capped at 0.1 s, so the game plays slower than both, and a
// wall-clock wait failed at 1920 while he was still oozing (Sprint 18). A wall-clock ceiling of 8× stops a stuck page.
const until = (page, test, ms = 20000) => page.evaluate(([t, ms]) => {
  const e = window.__goops.engine
  if (!e.__played) { const tick = e.tick; e.__played = 0; e.tick = (d) => { e.__played += d; return tick.call(e, d) } }
  const f = new Function('V', `return (${t})`)
  const start = e.__played, wallEnd = performance.now() + ms * 8
  return new Promise((ok) => {
    const step = () => {
      if (f(window.__goops.white())) return ok(true)
      if (e.__played - start > ms || performance.now() > wallEnd) return ok(false)
      requestAnimationFrame(step)
    }
    step()
  })
}, [test, ms])
const sendWhite = (page, data) => page.evaluate((d) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'whiteGoop', data: d } })), data)

async function open(w, h, rank, style = 'Jelly') {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?rank=${rank}&seed=7`)
  await startShift(page)
  if (style !== 'Jelly') await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
  // no cracks of the shift's own, the piece hangs where it is (the board stays readable), and the machines don't wear
  // down (their first breakdown's lesson would stop the shift)
  await page.evaluate(() => {
    const e = window.__goops.engine
    e.growCracks = () => {}
    e.fallPiece = () => {}
    e.machines.tick = () => {}
    e.state.cracks.length = 0
  })
  return { page, errors }
}

// a crack about `dx` columns from him, in an empty cell on his row or just above (so it reads in the shots); the shift's
// own cracks are off, so it's the only one
const placeCrack = (page, dx) => page.evaluate((dx) => {
  const s = window.__goops.engine.state, v = s.vet
  for (const [ddx, dy] of [[dx, 0], [dx + Math.sign(dx), 0], [dx, -1], [dx + Math.sign(dx), -1], [dx, -2]]) {
    const x = (v.x + ddx + s.width) % s.width, y = v.y + dy
    if (s.grid[y * s.width + x]) continue
    s.cracks.push({ id: 9000 + dx, x, y, color: 1, plugged: false })
    return 9000 + dx
  }
  return null
}, dx)

try {
  {
    const { page, errors } = await open(1440, 900, 30)
    check('rank 30: no white goop', (await white(page)) === null)
    check('rank 30: no errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  const rawFile = (await import('node:fs')).readFileSync('content/tuning/whiteGoop.json', 'utf8')
  const FILE = JSON.parse(rawFile)
  for (const [w, h] of SIZES) {
    const main = w === 1440
    const { page, errors } = await open(w, h, 31)
    const tag = `${w}x${h}`
    const first = await white(page)
    check(`${tag}: rank 31 — he's in the tank, dropping in`, !!first && first.mode === 'drop', first?.mode)
    check(`${tag}: he lands`, await until(page, "V.mode !== 'drop'", 15000))
    const landed = await white(page)
    check(`${tag}: he's on the screen (in the visible tank)`, landed.screen[0] > 0 && landed.screen[0] < w && landed.screen[1] > 0 && landed.screen[1] < h, String(landed.screen))

    // the laser goes through him: "ow", he stays, nothing pops
    const before = await page.evaluate(() => ({ score: window.__goops.engine.state.score, cells: window.__goops.engine.state.grid.filter((c) => c).length }))
    const goopThere = await page.evaluate(() => { const s = window.__goops.engine.state; return s.grid[s.vet.y * s.width + s.vet.x] !== 0 })
    await page.mouse.click(landed.screen[0], landed.screen[1])
    const owShown = await page.locator('.kit-talk-layer').filter({ hasText: 'ow' }).first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false)
    check(`${tag}: a laser tap on him shows the "ow" bubble`, owShown)
    const afterTap = await white(page)
    check(`${tag}: he squeezes his eyes shut and stays`, !!afterTap && afterTap.look.ouch)
    if (!goopThere) {
      const after = await page.evaluate(() => ({ score: window.__goops.engine.state.score, cells: window.__goops.engine.state.grid.filter((c) => c).length }))
      check(`${tag}: nothing popped`, after.score === before.score && after.cells === before.cells)
    }
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${SHOTS}/ow-${tag}.png` })
    check(`${tag}: the bubble goes again by itself`, await page.locator('.kit-talk-layer').waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false))

    // he oozes to a crack and seals it (the real 6 s at 1440; quicker elsewhere, sent the way the Dev Kit sends an edit)
    if (!main) await sendWhite(page, { ...FILE, sealTime: 1.5 })
    const id = await placeCrack(page, 2)
    check(`${tag}: he heads for the crack`, await until(page, `V.targetId === ${id}`, 5000))
    if (main) {
      // ⏸ the Dev Kit's full pause stops him dead mid-ooze; on resume he carries on
      await until(page, "V.mode === 'move'", 3000)
      await page.keyboard.press('Backquote')
      await page.locator('aside.devkit .devkit-pause-btn[data-pause="full"]').click()
      const a = await white(page)
      await page.waitForTimeout(900)
      const b = await white(page)
      check('full pause: he stands still (position, move, mode)', a.px === b.px && a.py === b.py && a.t === b.t && a.mode === b.mode, `${a.px},${a.py},${a.t} → ${b.px},${b.py},${b.t}`)
      await page.locator('aside.devkit .devkit-pause-btn[data-pause="full"]').click()
      await page.keyboard.press('Escape')
      check('resume: he carries on', await until(page, `V.px !== ${b.px} || V.t !== ${b.t} || V.mode !== '${b.mode}'`, 5000))
    }
    check(`${tag}: he reaches the crack and starts sealing`, await until(page, "V.mode === 'seal'", 15000))
    await until(page, 'V.seal > 0.5', 10000)
    await page.screenshot({ path: `${SHOTS}/sealing-${tag}.png` })
    const sealMs = main ? 9000 : 4000
    check(`${tag}: he seals it — the crack is gone and mended`, await page.waitForFunction((id) => {
      const s = window.__goops.engine.state
      return !s.cracks.some((c) => c.id === id) && s.sealedCracks.some((c) => c.id === id)
    }, id, { polling: 'raf', timeout: sealMs }).then(() => true, () => false))

    // goop over him: he's behind it (the x-ray outline)
    await page.evaluate(async () => {
      const { regroup } = await import('/src/engine/groups.ts')
      const e = window.__goops.engine, s = e.state, v = s.vet
      for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) {
        const i = (v.y + dy) * s.width + ((v.x + dx) % s.width)
        if (!s.grid[i]) s.grid[i] = 2
      }
      regroup(s, e.book)
      for (const g of s.groups.values()) { g.fill = 1; e.book.fillMs.set(g.id, 1e9) }
    })
    check(`${tag}: under goop he's behind it`, await until(page, 'V.behind', 3000))
    await page.waitForTimeout(400) // (the outline fades in)
    await page.screenshot({ path: `${SHOTS}/behind-${tag}.png` })
    check(`${tag}: no errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // Particle style draws him too (his look is on the tank canvas under either goo)
  {
    const { page, errors } = await open(390, 844, 31, 'Particle')
    await until(page, "V.mode !== 'drop'", 15000)
    const style = await page.evaluate(() => document.querySelector('canvas[data-goo]')?.getAttribute('data-goo'))
    check('Particle: the goo style is particle', style === 'particle', style)
    const id = await placeCrack(page, -2)
    await sendWhite(page, { ...FILE, sealTime: 1.5 })
    check('Particle: he seals a crack too', await page.waitForFunction((id) => !window.__goops.engine.state.cracks.some((c) => c.id === id), id, { polling: 'raf', timeout: 15000 }).then(() => true, () => false))
    await page.screenshot({ path: `${SHOTS}/particle-390x844.png` })
    check('Particle: no errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }
} catch (e) {
  console.log('✗ crashed:', e.message)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS')
process.exit(failed ? 1 : 0)
