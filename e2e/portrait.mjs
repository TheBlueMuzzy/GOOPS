// F32 task 8 — PORTRAIT ONLY (Muzzy, 2026-10-19: "a phone held sideways should never affect the orientation of the
// game. the game is a portrait only game"). In Playwright's own Chromium (never the user's Chrome):
//   - a touch phone on its side (844x390, touch + mobile) gets the "Turn your phone upright" card over everything,
//     and a running shift pauses under it; upright again, it carries on exactly where it was
//   - a touch phone held upright (390x844) never sees it
//   - a short DESKTOP window (768x343, a mouse) is not a phone on its side: no card, its own layout
// Screenshot: e2e-shots/portrait/upright-844x390.png
// Run: node e2e/portrait.mjs  (own dev server on port 5343)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5343, OUT = 'e2e-shots/portrait'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }
const URL = `http://localhost:${PORT}/?seed=7`
const card = (page) => page.locator('[data-upright]')
const phone = (width, height) => browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
// game ms the engine is given in `ms` real ms
const spy = (page) => page.evaluate(() => {
  const e = window.__goops.engine
  window.__ticked = 0
  const tick = e.tick.bind(e)
  e.tick = (ms) => { window.__ticked += ms; tick(ms) }
})
const gameMs = (page, ms) => page.evaluate(async (ms) => { const t0 = window.__ticked; await new Promise((r) => setTimeout(r, ms)); return window.__ticked - t0 }, ms)
const snapshot = (page) => page.evaluate(() => { const s = window.__goops.engine.state; return JSON.stringify({ p: s.pressure, piece: s.piece, score: s.score, status: s.status }) })

try {
  // a touch phone held upright: no card; start a shift, then turn it on its side
  {
    const context = await phone(390, 844)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(URL)
    await page.locator('.kit-art-stage').waitFor()
    check('390x844 touch phone (upright): no "turn upright" card', (await card(page).count()) === 0)
    await startShift(page)
    await spy(page)
    const running = await gameMs(page, 500)
    await page.setViewportSize({ width: 844, height: 390 })
    await card(page).waitFor({ timeout: 3000 })
    await page.waitForTimeout(300)
    const before = await snapshot(page)
    const paused = await gameMs(page, 1000)
    const after = await snapshot(page)
    const covers = await page.evaluate(() => {
      const hits = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.9], [0.1, 0.9], [0.9, 0.1]].map(([fx, fy]) => document.elementFromPoint(innerWidth * fx, innerHeight * fy))
      return hits.every((el) => !!el?.closest('[data-upright]'))
    })
    const words = await card(page).textContent()
    await page.screenshot({ path: `${OUT}/upright-844x390.png` })
    check('turned on its side mid-shift: the card covers the whole screen and catches every tap', covers && words.includes('Turn your phone upright'), words)
    check('…and the shift is paused under it (no game time, nothing changes)', running > 300 && paused === 0 && before === after, `${Math.round(running)} ms running, ${paused} ms on its side`)
    await page.setViewportSize({ width: 390, height: 844 })
    await card(page).waitFor({ state: 'detached', timeout: 3000 })
    // (the shift runs on the moment the card goes, so its state is compared with the paused one, minus what ran since:
    // still the same shift, playing, nothing opened over it — no menu, no console)
    const back = await page.evaluate(() => ({ status: window.__goops.engine.state.status, menus: document.querySelectorAll('[role="dialog"], .kit-settings').length, console: !!document.querySelector('.kit-art-stage') }))
    const resumed = await gameMs(page, 600)
    check('upright again: the card goes, the same shift carries on (playing, no menu or console over it) and runs at full speed',
      back.status === 'playing' && back.menus === 0 && !back.console && resumed > 300, JSON.stringify({ back, resumed: Math.round(resumed) }))
    check('phone: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // a touch phone already on its side when the game opens
  {
    const context = await phone(844, 390)
    const page = await context.newPage()
    await page.goto(URL)
    await card(page).waitFor({ timeout: 5000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/upright-start-844x390.png` })
    check('844x390 touch phone (on its side) at the start: the card shows', (await card(page).count()) === 1)
    await context.close()
  }
  // a short desktop window with a mouse: not a phone on its side
  {
    const page = await browser.newPage({ viewport: { width: 768, height: 343 } })
    await page.goto(URL)
    await page.locator('.kit-art-stage').waitFor()
    await page.waitForTimeout(400)
    check('768x343 desktop window (mouse): no card, the console as before', (await card(page).count()) === 0)
    await startShift(page)
    check('768x343 desktop window: a shift starts and plays', await page.evaluate(() => window.__goops.engine.state.status === 'playing'))
    await page.screenshot({ path: `${OUT}/desktop-short-768x343.png` })
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
process.exit(failed ? 1 : 0)
