// The console at every screen size (F21): idle → the periscope pulled halfway → sliding into the tank → the shift →
// the report → swipe up → the console back with the shift's XP in the meter (a rank-up on the way).
// Checks each size: nothing wider than the window, art never stretched, words never spilling out of their box,
// the title / gear / console not overlapping or touching the window edge, targets ≥ 44 px.
// Shots: e2e-shots/console/<size>-<n>-<step>.png. Playwright's own Chromium (never the user's Chrome).
// Run: node e2e/console-shots.mjs   (its own dev server on port 5264; only that server is stopped)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { skipFirstDay } from './start.mjs'

const PORT = 5264, OUT = 'e2e-shots/console'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error('dev server stopped (port busy?)')))
})

const sizes = [[360, 780], [390, 844], [844, 390], [768, 343], [654, 900], [1100, 800], [1440, 900], [1920, 1080], [2560, 1440]]
// a save just short of rank 1, so the shift's XP (at least 100) ranks up on the way back
const SAVE = JSON.stringify({ v: 1, totalXp: 3450, scrapsSpent: 0 })

// Layout checks on the console, run in the page
function consoleProblems() {
  const problems = []
  const W = innerWidth, H = innerHeight
  if (document.documentElement.scrollWidth > W) problems.push(`page wider than the window (${document.documentElement.scrollWidth} > ${W})`)
  const box = (el) => el.getBoundingClientRect()
  const view = document.querySelector('.kit-art-view')
  if (!view) return ['no console on screen']
  const v = box(view)
  const parts = { console: v, title: box(document.querySelector('.kit-title-art')), gear: box(document.querySelector('[data-slot="bottom-right"] button')) }
  for (const [name, r] of Object.entries(parts)) {
    if (r.left < 4 || r.top < 4 || r.right > W - 4 || r.bottom > H - 4) problems.push(`${name} touches / leaves the window (${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)})`)
  }
  const overlap = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  if (overlap(parts.console, parts.title)) problems.push('title overlaps the console')
  if (overlap(parts.console, parts.gear)) problems.push('gear overlaps the console')
  if (overlap(parts.title, parts.gear)) problems.push('title overlaps the gear')
  // art keeps its shape (a sized layer's box has its picture's shape)
  for (const img of document.querySelectorAll('.kit-art-layer[data-sized] > img, .kit-pull > img')) {
    const r = box(img), want = img.naturalWidth / img.naturalHeight, got = r.width / r.height
    if (img.naturalWidth && Math.abs(got / want - 1) > 0.01) problems.push(`stretched art ${img.src.split('/').pop()} (${got.toFixed(3)} vs ${want.toFixed(3)})`)
  }
  // words never spill out of their box (one line each), and the meter's words stay above its bar
  for (const el of document.querySelectorAll('.kit-art-layer[data-text]:not(:has(.kit-level-meter)):not(:has(.crt))')) {
    if (el.scrollWidth > el.clientWidth + 1) problems.push(`words spill: "${el.textContent}" (${el.scrollWidth} > ${el.clientWidth})`)
  }
  // (F32: the monitor's screen is drawn by the game, wider than its words box on purpose — its words must stay on it)
  for (const screen of document.querySelectorAll('.crt')) {
    const s = box(screen), w = box(screen.querySelector('.lesson-words'))
    if (w.left < s.left || w.right > s.right) problems.push(`monitor words spill off the screen: "${screen.textContent}"`)
  }
  const words = document.querySelector('.kit-level-meter-words'), bar = document.querySelector('.kit-level-meter-bar')
  if (words.scrollWidth > words.clientWidth + 1) problems.push(`meter words spill (${words.scrollWidth} > ${words.clientWidth})`)
  const label = box(document.querySelector('.kit-level-meter-label')), value = box(document.querySelector('.kit-level-meter-value'))
  if (label.right > value.left - 2) problems.push('meter label runs into its XP numbers')
  if (Math.max(label.bottom, value.bottom) > box(bar).top + 1) problems.push('meter words overlap its bar')
  if (parseFloat(getComputedStyle(words).fontSize) < 9.5) problems.push(`meter words too small (${getComputedStyle(words).fontSize})`)
  for (const b of document.querySelectorAll('.kit-screen button')) {
    const r = box(b)
    if (r.width && (r.width < 43.5 || r.height < 43.5)) problems.push(`small target ${Math.round(r.width)}×${Math.round(r.height)}: ${b.getAttribute('aria-label') ?? b.textContent}`)
  }
  return problems
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
try {
  for (const [w, h] of sizes) {
    const name = `${w}x${h}`
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.addInitScript((save) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('goops-progress', save); sessionStorage.setItem('seeded', '1') } }, SAVE)
    await skipFirstDay(page) // (F31: rank 0 with the first day had — its line would be on the monitor, its shift a lesson)
    await page.goto(`http://localhost:${PORT}/?seed=7`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const report = async (step) => {
      const problems = await page.evaluate(consoleProblems)
      console.log(name, step, problems.length ? 'PROBLEMS: ' + problems.join(' | ') : 'ok')
      if (problems.length) failed++
    }
    await page.screenshot({ path: `${OUT}/${name}-1-console.png` })
    await report('console')
    // pull the periscope halfway with the mouse, look, then all the way
    const scope = await page.getByRole('button', { name: 'Start shift' }).boundingBox()
    const gx = scope.x + scope.width / 2, gy = scope.y + scope.height * 0.4 // the goggles (the grip = goggles, bar, arrow)
    const length = scope.height / 0.345 // the whole periscope (the grip is its bottom 34.5%)
    await page.mouse.move(gx, gy); await page.mouse.down()
    for (let i = 1; i <= 5; i++) await page.mouse.move(gx, gy + (length * 0.566 * 0.5 * i) / 5)
    await page.screenshot({ path: `${OUT}/${name}-2-pull-half.png` })
    for (let i = 1; i <= 5; i++) await page.mouse.move(gx, gy + length * 0.566 * (0.5 + 0.1 * i))
    await page.mouse.up()
    await page.waitForTimeout(700) // the glide (450 ms), then the slide starts
    await page.screenshot({ path: `${OUT}/${name}-3-sliding.png` })
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/${name}-4-shift.png` })
    const playing = await page.evaluate(() => window.__goops?.engine.state.status)
    if (playing !== 'playing') { console.log(name, 'shift did not start:', playing); failed++ }
    // fast-forward to the end, then swipe up on the report
    await page.evaluate(() => { const e = window.__goops.engine; for (let t = 0; t < 600000 && e.state.status === 'playing'; t += 1000) e.tick(1000) })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${OUT}/${name}-5-report.png` })
    const sx = w / 2, sy = h * 0.8
    await page.mouse.move(sx, sy); await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(sx, sy - (h * 0.4 * i) / 8)
    await page.mouse.up()
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/${name}-6-arriving.png` })
    await page.waitForTimeout(1250) // slide in + the first step: the rank-up moment
    await page.screenshot({ path: `${OUT}/${name}-7-rank-up.png` })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${OUT}/${name}-8-console-after.png` })
    await report('console after the shift')
    const meter = await page.evaluate(() => document.querySelector('.kit-level-meter').getAttribute('aria-label') + ' · ' + document.querySelector('.kit-level-meter').getAttribute('aria-valuetext'))
    console.log(name, 'meter:', meter, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'no errors')
    if (errors.length) failed++
    await page.close()
  }
} finally {
  await browser.close()
  stop()
}
process.exit(failed ? 1 : 0)
