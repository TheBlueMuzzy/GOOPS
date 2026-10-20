// F59 — RANK UNLOCKS (content/tuning/progression.json → unlocks: next piece 1 · swap 3 · upgrades 5), with real input
// in Playwright's own Chromium (never the user's Chrome). Each rank on a FRESH device (its own browser context), via
// ?rank=N:
//   rank 0 — no next-piece window; swap refused (Right Shift / R held: no swap, no charging bar); Upgrades grey with
//            its scraps; no unlock lesson anywhere
//   rank 1 — the window shows the next piece (its cells, in the window, with room round them), at the left of the
//            bottom panel (Muzzy's mock-up 2026-10-19); the window's unlock lesson pauses the start of the first shift,
//            its ring round the window and its bubble above it, on screen; Got it → never again on this device
//   rank 3 — one unlock lesson per shift start: the window's first, swap's at the next shift, then none; swap works
//            (held Right Shift: the falling piece and the next one trade places, with the charging bar)
//   rank 5 — Upgrades opens (the scraps, "the first upgrades arrive in the next update"); its unlock lesson is the
//            monitor's line + the button outlined, until Upgrades is opened once; Replay lessons brings it back
//   the end report — a shift that crosses rank 1 says "Rank up! 1 · New: next piece"
// Screenshots: e2e-shots/unlocks/ (390x844, 360x780, 1440x900, the short 768x343 window)
// Run: node e2e/unlocks.mjs  (own dev server on port 5344)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 5344, OUT = 'e2e-shots/unlocks'
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

// a fresh device at this rank, on the console
async function device(rank, width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://localhost:${PORT}/?seed=7${rank === null ? '' : `&rank=${rank}`}`)
  await page.getByRole('button', { name: 'Start shift' }).waitFor()
  return { page, errors, close: () => context.close() }
}
const lessonId = (page) => page.evaluate(() => window.__goops?.lessonView().lessonId ?? null)
const seen = (page) => page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips'))) ?? '{"seen":[]}').seen)
const upgradesButton = (page) => page.locator('[data-tag="upgrades"]')
// the console's own lesson (between shifts there is no __goops yet): the monitor's words
const monitorSays = (page) => page.locator('[data-tag="crt"] .crt-read').textContent()
const gotIt = async (page) => { await page.waitForTimeout(500); await page.getByRole('button', { name: 'Got it' }).click() } // (it works once armed)
// a lesson pointing at the next-piece window: its ring round the window, its bubble above it (the window sits at the
// bottom of the screen, F59 task 13) and on screen
const pointsAtWindow = (page) => page.evaluate(() => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null }
  const win = box('.next-window'), ring = box('.kit-callout-ring'), bubble = box('.kit-callout'), dock = box('.kit-hud-dock')
  if (!win || !ring || !bubble) return { ok: false, why: `window ${!!win} ring ${!!ring} bubble ${!!bubble}` }
  const f = (r) => `${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`
  const round = ring.left <= win.left + 1 && ring.right >= win.right - 1 && ring.top <= win.top + 1 && ring.bottom >= win.bottom - 1
  const above = bubble.bottom <= win.top + 1
  const onScreen = bubble.left >= -0.5 && bubble.top >= -0.5 && bubble.right <= innerWidth + 0.5 && bubble.bottom <= innerHeight + 0.5
  const inPanel = !!dock && win.left >= dock.left && win.right <= dock.right && win.top >= dock.top && win.bottom <= dock.bottom
  return { ok: round && above && onScreen && inPanel, why: `window ${f(win)} ring ${f(ring)} bubble ${f(bubble)}${inPanel ? '' : ' (window not in the panel)'}` }
})
// back to the console and straight into a new shift (a new shift start), as a player would: pause → End shift
async function nextShift(page) {
  await page.getByRole('button', { name: en.hud.pause }).click()
  await page.getByRole('button', { name: en.pause.quit }).click()
  await page.locator('.kit-ask').getByRole('button').last().click() // "Clock out early?" → yes
  await page.getByRole('button', { name: 'Start shift' }).waitFor()
  await page.waitForTimeout(300)
  await startShift(page, { unlockLessons: true })
  await page.waitForTimeout(600)
}
// hold a key for the swap time and say what changed (swaps = the engine's 'hold' events — two pieces can look alike)
async function holdSwap(page, key = 'ShiftRight') {
  await page.evaluate(() => {
    const e = window.__goops.engine
    if (e.__spied) return
    e.__spied = true; window.__swaps = 0
    const take = e.takeEvents.bind(e)
    e.takeEvents = () => { const events = take(); window.__swaps += events.filter((x) => x.type === 'hold').length; return events }
  })
  const before = await page.evaluate(() => { const s = window.__goops.engine.state; return { piece: s.piece.colors.join(), next: s.next.join(), swaps: window.__swaps } })
  await page.keyboard.down(key)
  await page.waitForTimeout(900)
  const bar = await page.getByRole('progressbar', { name: en.hud.swap }).count()
  await page.waitForTimeout(900)
  await page.keyboard.up(key)
  await page.waitForTimeout(150)
  const after = await page.evaluate(() => { const s = window.__goops.engine.state; return { piece: s.piece.colors.join(), next: s.next.join(), swaps: window.__swaps } })
  return { before, after, bar, swapped: after.swaps - before.swaps }
}

try {
  // ---------------- rank 0: nothing unlocked ----------------
  {
    const { page, errors, close } = await device(0)
    const btn = upgradesButton(page)
    check('rank 0: the Upgrades button is there, grey, with the scraps count (0)', await btn.isDisabled() && (await btn.textContent()).includes('0'), await btn.textContent())
    check('rank 0: the monitor says to pull the periscope (no unlock lesson)', (await monitorSays(page)) === en.console.hint)
    await page.screenshot({ path: `${OUT}/rank0-console-390x844.png` })
    await startShift(page, { unlockLessons: true })
    await page.waitForTimeout(500)
    check('rank 0: no unlock lesson at the shift start', (await lessonId(page)) === null)
    check('rank 0: no next-piece window', await page.locator('.next-window').count() === 0)
    check('rank 0: the crack count sits in the top row, not the bottom panel', await page.locator('.kit-hud-slot').getByText(/CRACKS/).count() === 1
      && await page.locator('.kit-hud-dock').getByText(/CRACKS/).count() === 0)
    const swap = await holdSwap(page)
    check('rank 0: Right Shift held does nothing (no swap, no charging bar)', swap.swapped === 0 && swap.bar === 0, JSON.stringify(swap))
    const r = await holdSwap(page, 'KeyR')
    check('rank 0: R held does nothing', r.swapped === 0 && r.bar === 0)
    check('rank 0: the engine refuses swap', await page.evaluate(() => !window.__goops.engine.allows('hold')))
    // holding still on the tank (a mouse here; a phone's finger is the same pointer path)
    const before = await page.evaluate(() => window.__goops.engine.state.next.join())
    await page.mouse.move(300, 400); await page.mouse.down(); await page.waitForTimeout(1800); await page.mouse.up()
    check('rank 0: holding still on the tank does nothing', before === await page.evaluate(() => window.__goops.engine.state.next.join()))
    await page.screenshot({ path: `${OUT}/rank0-shift-390x844.png` })
    check('rank 0: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- rank 1: the next-piece window ----------------
  {
    const { page, errors, close } = await device(1)
    check('rank 1: Upgrades still grey', await upgradesButton(page).isDisabled())
    await startShift(page, { unlockLessons: true })
    await page.waitForTimeout(600)
    check('rank 1: the window\'s unlock lesson starts the first shift', (await lessonId(page)) === 'unlock-window', String(await lessonId(page)))
    check('rank 1: it says what the window is', await page.getByText(en.lessons['unlock-window'].window).count() === 1)
    const paused = await page.evaluate(async () => { const s = window.__goops.engine.state, y = JSON.stringify(s.piece); await new Promise((r) => setTimeout(r, 700)); return y === JSON.stringify(s.piece) })
    check('rank 1: the shift waits under it', paused)
    const cells = await page.evaluate(() => ({ drawn: document.querySelectorAll('.next-window rect').length, piece: window.__goops.engine.state.nextCells.length }))
    check('rank 1: the window shows the next piece', cells.drawn === cells.piece && cells.drawn > 0, JSON.stringify(cells))
    const at = await pointsAtWindow(page)
    check('rank 1: the lesson rings the window in the bottom panel, its bubble above it', at.ok, at.why)
    await page.screenshot({ path: `${OUT}/rank1-lesson-390x844.png` })
    await gotIt(page)
    await page.waitForTimeout(300)
    check('rank 1: Got it → the lesson is done, seen on this device', (await lessonId(page)) === null && (await seen(page)).includes('lesson:unlock-window'))
    check('rank 1: swap still refused', await page.evaluate(() => !window.__goops.engine.allows('hold')))
    await nextShift(page)
    check('rank 1: the next shift starts with no lesson', (await lessonId(page)) === null)
    check('rank 1: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- rank 3: one unlock lesson per shift start; swap works ----------------
  {
    const { page, errors, close } = await device(3)
    await page.evaluate(() => window.__goopsSeen(['lesson:visor'])) // (the visor can break at rank 3: its own lesson isn't this check)
    check('rank 3: Upgrades still grey', await upgradesButton(page).isDisabled())
    await startShift(page, { unlockLessons: true })
    await page.waitForTimeout(600)
    check('rank 3, fresh device, shift 1: the window\'s lesson (the earliest), not both', (await lessonId(page)) === 'unlock-window', String(await lessonId(page)))
    await gotIt(page)
    await page.waitForTimeout(400)
    check('rank 3, shift 1: no second lesson straight after', (await lessonId(page)) === null)
    await nextShift(page)
    check('rank 3, shift 2: swap\'s lesson', (await lessonId(page)) === 'unlock-swap', String(await lessonId(page)))
    check('rank 3: it points at the next-piece window', await page.evaluate(() => JSON.stringify(window.__goops.lessonView().message?.pointer)) === '{"tag":"next-window"}')
    await page.screenshot({ path: `${OUT}/rank3-swap-lesson-390x844.png` })
    await page.keyboard.press('Enter') // (Enter closes it too, once armed)
    await page.waitForTimeout(300)
    if (await lessonId(page)) await gotIt(page)
    check('rank 3: swap\'s lesson seen', (await seen(page)).includes('lesson:unlock-swap'))
    const swap = await holdSwap(page)
    check('rank 3: Right Shift held swaps — the falling piece and the next one trade places, with the charging bar',
      swap.swapped === 1 && swap.after.piece === swap.before.next && swap.after.next === swap.before.piece && swap.bar === 1, JSON.stringify(swap))
    const back = await holdSwap(page, 'KeyR')
    check('rank 3: swapping again (R) trades them back', back.swapped === 1 && back.after.piece === back.before.next && back.after.next === back.before.piece)
    await nextShift(page)
    check('rank 3, shift 3: no lesson', (await lessonId(page)) === null)
    check('rank 3: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- F28 task 7: on a phone (a touch screen, started by a tap) the swap lesson says it in fingers ----------------
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/?seed=7&rank=3`)
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await page.evaluate(() => window.__goopsSeen(['lesson:unlock-window', 'lesson:visor']))
    await page.getByRole('button', { name: 'Start shift' }).tap() // (a touch: the lesson words follow it)
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    await page.waitForTimeout(800)
    check('phone: the swap lesson starts the shift', (await lessonId(page)) === 'unlock-swap', String(await lessonId(page)))
    const said = await page.locator('.kit-callout').textContent()
    check('phone: it says the phone wording (hold your finger still), not the keys\' or the mouse\'s',
      said.includes(en.lessons['unlock-swap'].swap.phone) && !said.includes('Right Shift'), said)
    await page.screenshot({ path: `${OUT}/rank3-swap-lesson-phone-390x844.png` })
    check('phone swap lesson: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ---------------- rank 5: upgrading opens ----------------
  {
    const { page, errors, close } = await device(5)
    const btn = upgradesButton(page)
    await page.waitForTimeout(600)
    check('rank 5: the Upgrades button works, with the scraps (5)', !(await btn.isDisabled()) && (await btn.textContent()).includes('5'), await btn.textContent())
    check('rank 5: the monitor says upgrades are unlocked', (await monitorSays(page)) === en.lessons['unlock-upgrades'].upgrades, await monitorSays(page))
    await page.screenshot({ path: `${OUT}/rank5-console-lesson-390x844.png` })
    // the lesson's pink ring goes round the button (and nothing dims the console: no Got it, nothing paused)
    const outline = await page.evaluate(() => {
      const ring = document.querySelector('.lesson-spot .kit-callout-ring')?.getBoundingClientRect()
      const b = document.querySelector('[data-tag="upgrades"]').getBoundingClientRect()
      return { around: !!ring && ring.width > 0 && ring.left <= b.left + 1 && ring.right >= b.right - 1 && ring.top <= b.top + 1 && ring.bottom >= b.bottom - 1,
        dim: !!document.querySelector('.lesson-spot[data-dim]') }
    })
    check('rank 5: the pink outline goes round the Upgrades button, no dim', outline.around && !outline.dim, JSON.stringify(outline))
    await btn.click()
    const modal = page.getByRole('dialog', { name: en.upgrades.title })
    await modal.waitFor({ timeout: 3000 })
    check('rank 5: Upgrades opens: the scraps and the "next update" line',
      await modal.getByText(en.upgrades.scraps.replace('{n}', '5')).count() === 1 && await modal.getByText(en.upgrades.soon).count() === 1)
    await page.screenshot({ path: `${OUT}/rank5-upgrades-390x844.png` })
    check('rank 5: opening it finishes the lesson (seen)', (await seen(page)).includes('lesson:unlock-upgrades'))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    check('rank 5: back on the console the monitor says to pull the periscope again', (await monitorSays(page)) === en.console.hint, await monitorSays(page))
    await page.reload()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await page.waitForTimeout(600)
    check('rank 5: not again on this device', (await monitorSays(page)) === en.console.hint)
    // Settings → Replay lessons: it comes back
    await page.getByRole('button', { name: 'Settings' }).click()
    // (a phone: the ◀ ▶ picker instead of the tab bar — step to Gameplay, as e2e/controls.mjs does)
    const gameplayTab = page.getByRole('tab', { name: 'Gameplay' })
    if (await gameplayTab.isVisible()) await gameplayTab.click()
    else for (let i = 0; i < 6 && !(await page.getByRole('button', { name: 'Replay lessons' }).isVisible()); i++) {
      await page.getByRole('button', { name: 'Next Settings' }).click(); await page.waitForTimeout(150)
    }
    await page.getByRole('button', { name: 'Replay lessons' }).click()
    await page.locator('.kit-ask').getByRole('button', { name: 'Replay lessons' }).click({ timeout: 3000 })
    for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('.kit-layer') !== null); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300) }
    await page.reload()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await page.waitForTimeout(600)
    check('rank 5: after Replay lessons it plays again', (await monitorSays(page)) === en.lessons['unlock-upgrades'].upgrades)
    check('rank 5: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- the end report names what the rank-up unlocked ----------------
  {
    const { page, errors, close } = await device(null)
    await page.evaluate(() => localStorage.setItem('goops-progress', JSON.stringify({ v: 1, totalXp: 3400, scrapsSpent: 0 })))
    await page.reload()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await startShift(page, { unlockLessons: true })
    await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
    await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
    const line = await page.getByText(/Rank up! 1 · New: next piece/).count()
    await page.screenshot({ path: `${OUT}/report-rank-up-390x844.png` })
    check('the report: "Rank up! 1 · New: next piece"', line === 1)
    check('report: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- shots at the other sizes (looked at by hand) ----------------
  for (const [w, h] of [[360, 780], [1440, 900], [768, 343]]) {
    const { page, close } = await device(5, w, h)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/rank5-console-lesson-${w}x${h}.png` })
    await page.evaluate(() => window.__goopsSeen(['lesson:unlock-window']))
    await startShift(page, { unlockLessons: true })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/rank5-swap-lesson-${w}x${h}.png` })
    check(`${w}x${h}: the swap lesson shows`, (await lessonId(page)) === 'unlock-swap')
    const at = await pointsAtWindow(page)
    check(`${w}x${h}: it rings the next-piece window, its bubble above it`, at.ok, at.why)
    await close()
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
console.log(failed ? `\nFAIL ${failed} check(s)` : '\nok — every unlock at its rank')
process.exit(failed ? 1 : 0)
