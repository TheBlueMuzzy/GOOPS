// A WORKING DAY end to end (F21): the console → pull the periscope down (a real mouse drag) → the shift → fast-forward
// to the end → swipe up on the report (a real drag) → the console shows the new XP (saved + on the meter) → the
// periscope again, this time with a FINGER (touch events) → a second shift starts. No console errors allowed.
// Playwright's own Chromium (never the user's Chrome). Run: node e2e/day.mjs  (its own dev server on 5263, stopped after)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5263, OUT = 'e2e-shots/console'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error('dev server stopped (port busy?)')))
})

let failed = 0
const check = (what, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ' — ' + detail : ''}`); if (!ok) failed++ }
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?seed=7`)
  await page.evaluate(() => localStorage.removeItem('goops-progress'))
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  const meterText = () => page.evaluate(() => { const m = document.querySelector('.kit-level-meter'); return m && `${m.getAttribute('aria-label')} · ${m.getAttribute('aria-valuetext')}` })
  const grip = page.getByRole('button', { name: 'Start shift' })
  const stageGone = () => page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false)
  const playing = () => page.waitForFunction(() => window.__goops?.engine.state.status === 'playing', null, { timeout: 3000 }).then(() => true, () => false)

  // 1. opens on the console
  check('opens on the console', await page.locator('.kit-art-stage').count() === 1 && await grip.count() === 1)
  check('fresh player: rank 0 on the meter', (await meterText()) === 'Operator rank 0 · 0 / 3,500 XP', await meterText())
  check('the repair panels read out as unavailable', await page.getByRole('img', { name: 'Reset laser (unavailable)' }).count() === 1)

  // 2. a short drag springs back; a real drag past the threshold pulls it
  let box = await grip.boundingBox()
  const length = box.height / 0.345 // the whole periscope (the grip is its bottom 34.5%)
  const drag = async (dy, steps = 10) => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down()
    for (let i = 1; i <= steps; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + (dy * i) / steps)
    await page.mouse.up()
  }
  await drag(length * 0.566 * 0.3)
  await page.waitForTimeout(700)
  check('a short drag springs back (still on the console)', await page.locator('.kit-art-stage').count() === 1)
  await drag(length * 0.566 * 0.9)
  check('a real drag pulls the periscope → the console slides away', await stageGone())
  check('the shift starts', await playing())

  // 3. fast-forward to the end; the report
  await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
  await page.getByText(/Shift (complete|failed)/).waitFor({ timeout: 5000 })
  check('the report says "Swipe up to end the day"', await page.getByText('Swipe up to end the day').count() === 1)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress') || 'null'))
  check('the shift\'s XP is saved', saved?.totalXp >= 100, JSON.stringify(saved))

  // 4. swipe up on the report (a real drag, starting on the report's words) → the console comes back up
  const words = await page.getByText(/Swipe up to end the day/).boundingBox()
  await page.mouse.move(words.x + words.width / 2, words.y); await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(words.x + words.width / 2, words.y - 40 * i)
  await page.mouse.up()
  await page.locator('.kit-art-stage').waitFor({ timeout: 3000 })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/day-1-back.png` })
  await page.waitForTimeout(2200) // slide in + the meter filling
  const want = `Operator rank 0 · ${saved.totalXp.toLocaleString('en')} / 3,500 XP`
  check('back on the console, the meter shows the new XP', (await meterText()) === want, `${await meterText()} (want ${want})`)
  check('the monitor says what was earned', await page.getByText(`+${saved.totalXp.toLocaleString('en')} XP`).count() === 1)
  await page.screenshot({ path: `${OUT}/day-2-xp.png` })

  // 5. the gear opens Settings over the console; Esc closes it
  await page.getByRole('button', { name: 'Settings' }).click()
  check('the gear opens Settings', await page.getByRole('heading', { name: /settings/i }).count() >= 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // 6. a finger pulls the periscope (touch events through the browser's own input) → a second shift
  box = await grip.boundingBox()
  const cdp = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2, y0 = box.y + box.height / 2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] })
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (length * 0.566 * 0.9 * i) / 10 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  check('a finger drag pulls it too → the console slides away', await stageGone())
  check('a second shift starts', await playing())
  const second = await page.evaluate(() => window.__goops.engine.state.score)
  check('the second shift is a fresh one', second === 0, `score ${second}`)
  // 7. …and a finger swipes up on its report → the console again
  await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
  await page.getByText(/Shift (complete|failed)/).waitFor({ timeout: 5000 })
  const msg = await page.getByText(/Swipe up to end the day/).boundingBox()
  const tx = msg.x + msg.width / 2, ty = msg.y
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] })
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty - 40 * i }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  check('a finger swipe up on the report goes back to the console', await page.locator('.kit-art-stage').waitFor({ timeout: 3000 }).then(() => true, () => false))
  // 8. Esc / phone Back on the report also means "back to the console" — never a frozen, finished tank
  await page.waitForTimeout(800)
  await grip.click()
  check('a tap on the periscope starts a third shift', await stageGone())
  await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
  await page.getByText(/Shift (complete|failed)/).waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  check('Esc on the report goes back to the console', await page.locator('.kit-art-stage').waitFor({ timeout: 3000 }).then(() => true, () => false))
  check('no console errors', errors.length === 0, errors.join(' | '))
} finally {
  await browser.close()
  stop()
}
process.exit(failed ? 1 : 0)
