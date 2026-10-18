// F19 screenshots: Muzzy's art on the console (the main menu since F21) and the end-of-shift report, at every screen size.
// Uses Playwright's own Chromium (never the user's Chrome). Starts its own dev server on port 5262 and stops it.
// Run: node e2e/art-shots.mjs → e2e-shots/art/<size>-1-menu.png, -1b-settings.png (390 wide), -3-end.png
// (the console itself is checked closely by e2e/console-shots.mjs)
// Checks per shot: no sideways overflow, every art picture drawn at its own shape (not stretched),
// the end report not scrolling inside its frame, and no console errors.
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5262, OUT = 'e2e-shots/art'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})

const sizes = [[390, 844], [360, 780], [844, 390], [768, 343], [1100, 800], [1440, 900], [1920, 1080]]

// In the page: anything wrong with the art or the layout
function problems() {
  const found = []
  if (document.documentElement.scrollWidth > innerWidth) found.push(`page wider than the screen (${document.documentElement.scrollWidth} > ${innerWidth})`)
  for (const img of document.querySelectorAll('img')) {
    const box = img.getBoundingClientRect()
    if (!box.width || !img.naturalWidth || getComputedStyle(img).visibility === 'hidden') continue
    const drawn = box.width / box.height, own = img.naturalWidth / img.naturalHeight
    if (Math.abs(drawn / own - 1) > 0.02 && getComputedStyle(img).objectFit !== 'contain') found.push(`stretched picture ${img.getAttribute('src')} (${drawn.toFixed(2)} vs ${own.toFixed(2)})`)
  }
  for (const b of document.querySelectorAll('button')) {
    const box = b.getBoundingClientRect()
    if (box.width && (box.width < 43.5 || box.height < 43.5)) found.push(`small target ${Math.round(box.width)}×${Math.round(box.height)} ${b.textContent}`)
  }
  const frame = document.querySelector('.kit-panel[data-frame]')
  if (frame && frame.scrollHeight > frame.clientHeight + 1) found.push(`end report scrolls inside its frame (${frame.scrollHeight} > ${frame.clientHeight})`)
  return found
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
    await page.goto(`http://localhost:${PORT}/?seed=7`)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${name}-1-menu.png` })
    const menuProblems = await page.evaluate(problems)
    if (w === 390) { // Settings over the console still opens on top, then Back
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/${name}-1b-settings.png` })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
    }
    await startShift(page)
    await page.waitForTimeout(300)
    // fast-forward to the end of the shift through the dev hook (the engine is changing in parallel, so keep ticking)
    let ticks = 0
    for (; ticks < 60; ticks++) {
      if (await page.getByText(/Shift (complete|failed)/).count()) break
      await page.evaluate(() => window.__goops.engine.tick(600000))
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(900) // entrance animation
    await page.screenshot({ path: `${OUT}/${name}-3-end.png` })
    const endShown = await page.getByText(/Shift (complete|failed)/).count()
    if (w === 390) { // hold Next shift on the report: its pushed-in picture shows
      const box = await page.getByRole('button', { name: 'Next shift' }).boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(150)
      await page.screenshot({ path: `${OUT}/${name}-2-pressed.png` })
      const downShows = await page.evaluate(() => getComputedStyle(document.querySelector('.kit-art-down')).visibility === 'visible')
      if (!downShows) menuProblems.push('Next shift held, but its down picture is not showing')
      await page.mouse.move(w - 2, box.y + box.height / 2) // slide off sideways: no press (and not a swipe up)
      await page.mouse.up()
    }
    const endProblems = await page.evaluate(problems)
    const all = [...menuProblems.map((p) => `menu: ${p}`), ...endProblems.map((p) => `end: ${p}`), ...errors.map((e) => `error: ${e}`)]
    if (!endShown) all.push(`end screen did not show after ${ticks} ticks`)
    console.log(name, `end after ${ticks} tick(s)`, all.length ? `PROBLEMS:\n  ${all.join('\n  ')}` : 'ok')
    if (all.length) failed++
    await page.close()
  }
} finally {
  await browser.close()
  stop()
}
process.exit(failed ? 1 : 0)
