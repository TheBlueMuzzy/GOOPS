// F30 the lesson runner, in a real browser with the real dev server (Playwright's own Chromium, never the user's Chrome):
//   plays content/lessons/sample.json start to finish by REAL input — "Got it" clicks, holding S, clicking the goop —
//   checks a paused message really pauses the shift, a hint shows after waiting, the Dev Kit's ⏸ full pause stops the
//   lesson's timers (no hint while frozen), and the shift carries on as normal play after the last step.
//   Screenshots at 1440x900 and 390x844 → e2e-shots/lessons/
// Run: node e2e/lessons.mjs  (own dev server on port 5341)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5341, OUT = 'e2e-shots/lessons'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

const lesson = (page) => page.evaluate(() => { const v = window.__goops.lessonView(); return { step: v.stepId, kind: v.message?.kind ?? null, armed: !!v.message?.armed, done: v.done } })
const stepIs = (page, id, timeout = 15000) => page.waitForFunction((want) => window.__goops.lessonView().stepId === want, id, { timeout })
const bubble = (page) => page.locator('.kit-callout')
const gotIt = (page) => page.getByRole('button', { name: 'Got it' })
const pieceRow = (page) => page.evaluate(() => { const p = window.__goops.engine.state.piece; return p ? Math.max(...p.cells.map(([, y]) => y)) + p.fall : null })
const markCentre = async (page) => { const b = await page.locator('.lesson-mark').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2] }
const pauseBtn = (page, which) => page.locator(`aside.devkit .devkit-pause-btn[data-pause="${which}"]`)

async function open(w, h, url) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('Lesson'))) errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/${url}`)
  await startShift(page)
  return { page, errors }
}

try {
  // ---------------- desktop: the whole sample lesson, by real input ----------------
  {
    const { page, errors } = await open(1440, 900, '?seed=7&lesson=sample')
    await stepIs(page, 'welcome')
    await bubble(page).waitFor()
    await page.waitForTimeout(400)
    const y0 = await pieceRow(page)
    await page.waitForTimeout(800)
    const y1 = await pieceRow(page)
    check('welcome: the message shows and the shift is paused under it', (await bubble(page).textContent()).includes('Goop drops') && y0 === y1, `piece row ${y0} → ${y1}`)
    await page.screenshot({ path: `${OUT}/1-welcome-1440x900.png` })
    await gotIt(page).click()
    await stepIs(page, 'falls')
    check('Got it (a click) moves on; the piece falls on its own', true)
    await stepIs(page, 'fastDrop', 15000)
    check('position gate: the piece reached row 5 → the fast-drop step', true)

    // wait-then-hint: do nothing for longer than the hint's 4 s
    await page.waitForTimeout(4500)
    const hint = await lesson(page)
    check('wait-then-hint: after waiting, the hint replaces the message', hint.kind === 'hint' && (await bubble(page).textContent()).includes('Hold S'))
    await page.screenshot({ path: `${OUT}/2-hint-1440x900.png` })
    await page.keyboard.down('KeyS')
    await stepIs(page, 'zap', 10000)
    await page.keyboard.up('KeyS')
    check('holding S fast-drops the piece; it lands → the zap step', true)

    // the Dev Kit's full pause stops the lesson's timers: frozen for longer than the 5 s hint → no hint
    await page.waitForTimeout(600)
    await page.keyboard.press('Backquote'); await page.waitForTimeout(300)
    await pauseBtn(page, 'full').click()
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    await page.waitForTimeout(6000)
    const frozen = await lesson(page)
    check('Dev Kit full pause: the lesson\'s hint timer stands still (no hint after 6 s frozen)', frozen.kind === 'step', JSON.stringify(frozen))
    await page.locator('.devkit-pause-badge').click()
    await page.waitForTimeout(5000)
    check('…and after resuming it runs on: the hint comes', (await lesson(page)).kind === 'hint')
    await page.screenshot({ path: `${OUT}/3-zap-hint-1440x900.png` })
    const [cx, cy] = await markCentre(page)
    await page.mouse.click(cx, cy)
    await stepIs(page, 'pressure', 5000)
    check('clicking the green goop zaps it → the pressure step', true)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/4-pressure-1440x900.png` })
    await stepIs(page, 'done', 15000)
    check('pressure gate: 30% → the last step', (await page.evaluate(() => window.__goops.engine.state.pressure)) >= 0.3)
    await page.waitForTimeout(600)
    await gotIt(page).click()
    await page.waitForFunction(() => window.__goops.lessonView().done)
    const p0 = await page.evaluate(() => window.__goops.engine.state.pressure)
    await page.waitForTimeout(1500)
    const after = await page.evaluate(() => ({ p: window.__goops.engine.state.pressure, piece: !!window.__goops.engine.state.piece }))
    check('finished: no message, the shift carries on as normal play (a piece, pressure rising)',
      (await bubble(page).count()) === 0 && after.piece && after.p > p0, `pressure ${p0.toFixed(3)} → ${after.p.toFixed(3)}`)
    check('desktop: no page errors or lesson set-up warnings', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- phone: the look at 390x844; jump straight to a step (the dev hook) ----------------
  {
    const { page, errors } = await open(390, 844, '?seed=7&lesson=sample')
    await stepIs(page, 'welcome')
    await gotIt(page).waitFor()
    await page.screenshot({ path: `${OUT}/1-welcome-390x844.png` })
    await page.evaluate(() => window.__goops.lesson('sample', 4))
    await stepIs(page, 'zap')
    await bubble(page).waitFor()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/3-zap-390x844.png` })
    const box = await bubble(page).boundingBox()
    check('phone: the message fits on screen', box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, JSON.stringify(box))
    await page.evaluate(() => window.__goops.lesson('sample', 'pressure'))
    await stepIs(page, 'pressure')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/4-pressure-390x844.png` })
    check('phone: jumping to steps works; no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
process.exit(failed ? 1 : 0)
