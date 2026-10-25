// F66 — YOUR NAME (design/story.md "Your name"; TDD D20), in Playwright's own Chromium (never the user's Chrome), with
// the real dev server. Portrait only (Goops never plays sideways): 390x844, 360x780, 1100x800, 1440x900, 1920x1080.
// ?story turns the story moments on (scripted checks keep them quiet otherwise — src/game/lessons/storyMoments.ts).
//   a fresh device: rank 0's moment — WELCOME → "PLEASE SIGN HERE" with the name box (kit TextInput), Sign and Skip
//     (no Got it) → PLEASE KEEP THE TANK… → the first day's first step (A1)
//   at every size: the name box is inside the monitor's screen with room on every side, in the top half of the window
//     (a phone's keyboard opens over the bottom)
//   the game's keys leave the box alone while typing (` doesn't open the Dev Kit; ↓ / Enter don't pull the periscope)
//   sign "  Muzzy  " with Enter → saved as "Muzzy" (trimmed) → a reload: still there; saving the progress keeps it
//   the limit: 16 letters typed → the box holds 12 (content/tuning/name.json) and 12 are saved
//   spaces only + Sign = a skip · Skip → no name: the game calls you "Operator #4471" (en.json story.sign.fallback)
//   RANK SELECT 0 → the name is wiped with the save; the sign line comes again with an empty box
// Screenshots: e2e-shots/your-name/
// Run: node e2e/your-name.mjs  (own dev server on port 6366)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { checkVersion } from './start.mjs'

const PORT = 6366, OUT = 'e2e-shots/your-name'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]] // (portrait phones + desktop windows — never a phone on its side)
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const nameTuning = JSON.parse(readFileSync('content/tuning/name.json', 'utf8'))
const S = en.story.sign, L = en.story.lines
const FD = en.lessons['first-day']
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error(`dev server stopped (port ${PORT} busy?)`)))
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0, count = 0
const check = (name, ok, detail = '') => { count++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const crt = (page) => page.locator('[data-tag="crt"]')
const monitorSays = async (page) => (await crt(page).locator('.crt-read').textContent()).trim()
const nameBox = (page) => crt(page).getByLabel(S.label)
const signButton = (page) => crt(page).getByRole('button', { name: S.sign, exact: true })
const skipButton = (page) => crt(page).getByRole('button', { name: S.skip, exact: true })
const gotIt = (page) => crt(page).getByRole('button', { name: en.lessons.gotIt })
const savedName = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress') ?? 'null')?.name ?? null)

// a brand-new device on the console (nothing seen, no save), story moments on
async function device(width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?seed=7&story`)
  await checkVersion(page)
  await page.locator('.kit-art-stage').waitFor()
  return { page, errors, close: () => context.close() }
}
// rank 0's moment up to the sign line: WELCOME (Got it) → PLEASE SIGN HERE with the box
async function toSignLine(page) {
  await gotIt(page).waitFor({ timeout: 5000 })
  const first = await monitorSays(page)
  await sleep(200)
  await gotIt(page).click()
  await nameBox(page).waitFor({ timeout: 4000 })
  await sleep(300)
  return first
}
// after signing / skipping: PLEASE KEEP THE TANK FROM EXPLODING (Got it) → the first day's A1
async function finishMoment(page) {
  await gotIt(page).waitFor({ timeout: 4000 })
  const last = await monitorSays(page)
  await sleep(200)
  await gotIt(page).click()
  const a1 = await page.waitForFunction((lines) => lines.includes(document.querySelector('[data-tag="crt"] .crt-read')?.textContent),
    Object.values(FD.pull), { timeout: 5000 }).then(() => true, () => false)
  return { last, a1 }
}
// the box and its buttons vs the monitor's screen and the window (px)
const layout = (page) => page.evaluate((label) => {
  const screen = document.querySelector('[data-tag="crt"]')
  const input = [...screen.querySelectorAll('input')].find((i) => i.closest('label')?.textContent.includes(label))
  const form = screen.querySelector('form')
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
  return { screen: box(screen), input: box(input), form: box(form), buttons: [...form.querySelectorAll('button')].map(box), vh: innerHeight, vw: innerWidth }
}, S.label)

try {
  // ════════════ 1. the sign line at every portrait size: the box on the monitor, room round it, in the top half ════════════
  for (const [w, h] of SIZES) {
    const { page, errors, close } = await device(w, h)
    const first = await toSignLine(page)
    if (w === 390) check('rank 0 starts with WELCOME', first === L.r0a, first)
    const says = await monitorSays(page)
    check(`${w}x${h}: the monitor says PLEASE SIGN HERE`, says === L.r0sign, says)
    check(`${w}x${h}: Sign and Skip, no Got it`, (await signButton(page).isVisible()) && (await skipButton(page).isVisible()) && !(await gotIt(page).count()))
    check(`${w}x${h}: the periscope waits`, await page.locator('.kit-pull-grip').first().isDisabled())
    await sleep(1000) // (the screen slides down to fit the box: its height eases over the kit's motion time)
    const at = await layout(page)
    // (the box and the buttons themselves — the form's own box includes its bottom padding)
    const parts = [at.input, ...at.buttons]
    const room = Math.min(...parts.map((p) => Math.min(p.left - at.screen.left, at.screen.right - p.right, p.top - at.screen.top, at.screen.bottom - p.bottom)))
    check(`${w}x${h}: the box and buttons sit inside the monitor's screen with room on every side`, room >= 8, JSON.stringify({ room, at }))
    check(`${w}x${h}: inside the window`, at.screen.left >= 0 && at.screen.right <= at.vw && at.form.bottom <= at.vh, JSON.stringify(at.screen))
    check(`${w}x${h}: the name box is in the top half (a phone keyboard covers the bottom)`, at.input.bottom <= at.vh / 2, `box bottom ${Math.round(at.input.bottom)} of ${at.vh}`)
    check(`${w}x${h}: the box is wide enough for 12 letters`, at.input.right - at.input.left >= 150, `${Math.round(at.input.right - at.input.left)} px`)
    await page.screenshot({ path: `${OUT}/sign-${w}x${h}.png` })
    await nameBox(page).click()
    await page.keyboard.type('Muzzy')
    await sleep(200)
    await page.screenshot({ path: `${OUT}/typed-${w}x${h}.png` })
    check(`${w}x${h}: no page errors`, !errors.length, errors.join(' | '))
    await close()
  }

  // ════════════ 2. sign → kept (trimmed), through a reload; the game's keys leave the box alone ════════════
  {
    const { page, errors, close } = await device()
    await toSignLine(page)
    await nameBox(page).click()
    await page.keyboard.type('  Muz')
    await page.keyboard.press('Backquote') // the Dev Kit's key
    await page.keyboard.press('ArrowDown') // the periscope's keys
    await page.keyboard.press('Backspace')
    await page.keyboard.type('zy  ')
    await sleep(300)
    check('typing ` in the box doesn\'t open the Dev Kit', !(await page.locator('.devkit').isVisible().catch(() => false)))
    check('…and ↓ doesn\'t move on or pull the periscope (the box is still there)', await nameBox(page).isVisible())
    check('the box holds what was typed', (await nameBox(page).inputValue()) === '  Muzzy  ', JSON.stringify(await nameBox(page).inputValue()))
    await page.keyboard.press('Enter') // Enter in the box signs
    const { last, a1 } = await finishMoment(page)
    check('Enter signs → PLEASE KEEP THE TANK FROM EXPLODING', last === L.r0b, last)
    check('…then the first day\'s first step (A1)', a1)
    check('signed "  Muzzy  " → saved as "Muzzy" (trimmed)', (await savedName(page)) === 'Muzzy', await savedName(page))
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await sleep(800)
    check('a reload: the name is still there', (await savedName(page)) === 'Muzzy', await savedName(page))
    check('…and the moment doesn\'t ask again', !(await nameBox(page).count()))
    // the first day's shift ends → the progress is saved again: the name stays
    await page.evaluate(() => window.__goopsSeen?.(['lesson:first-day']))
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await sleep(600)
    await page.getByRole('button', { name: 'Start shift' }).click()
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing')
    await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
    await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
    await sleep(800)
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress') ?? 'null'))
    check('a shift\'s progress saved → the name kept beside it', after?.name === 'Muzzy' && after?.totalXp > 0, JSON.stringify(after))
    check('sign: no page errors', !errors.length, errors.join(' | '))
    await close()
  }

  // ════════════ 3. the limit: 12 letters (content/tuning/name.json) ════════════
  {
    const { page, errors, close } = await device()
    await toSignLine(page)
    await nameBox(page).click()
    await page.keyboard.type('ABCDEFGHIJKLMNOP')
    const value = await nameBox(page).inputValue()
    check(`the limit comes from content (${nameTuning.maxLength}, Muzzy 2026-10-25)`, nameTuning.maxLength === 12)
    check('16 letters typed → the box holds 12', value === 'ABCDEFGHIJKL', value)
    await page.screenshot({ path: `${OUT}/limit-390x844.png` })
    await signButton(page).click()
    await finishMoment(page)
    check('…and 12 are saved', (await savedName(page)) === 'ABCDEFGHIJKL', await savedName(page))
    check('limit: no page errors', !errors.length, errors.join(' | '))
    await close()
  }

  // ════════════ 4. skip → Operator #4471; spaces only = a skip ════════════
  {
    const { page, errors, close } = await device()
    await toSignLine(page)
    await skipButton(page).click()
    const { last, a1 } = await finishMoment(page)
    check('Skip → PLEASE KEEP THE TANK FROM EXPLODING, then A1', last === L.r0b && a1, last)
    check('Skip → no name saved', (await savedName(page)) === null, await savedName(page))
    check('…so the game calls you Operator #4471 (en.json story.sign.fallback)', S.fallback === 'Operator #4471', S.fallback)
    check('skip: no page errors', !errors.length, errors.join(' | '))
    await close()
  }
  {
    const { page, close } = await device()
    await toSignLine(page)
    await nameBox(page).click()
    await page.keyboard.type('     ')
    await signButton(page).click()
    await finishMoment(page)
    check('spaces only + Sign = a skip (no name)', (await savedName(page)) === null, await savedName(page))
    await close()
  }

  // ════════════ 5. RANK SELECT 0 wipes the name ════════════
  {
    const { page, errors, close } = await device()
    await toSignLine(page)
    await nameBox(page).fill('Muzzy')
    await signButton(page).click()
    await finishMoment(page)
    check('before: signed "Muzzy"', (await savedName(page)) === 'Muzzy')
    // (RANK SELECT hides under a lesson's line on the console: the first day had)
    await page.evaluate(() => window.__goopsSeen?.(['lesson:first-day']))
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await sleep(600)
    await page.getByRole('button', { name: en.console.rankSelect.open, exact: true }).click()
    await page.locator(`.kit-screen[aria-label="${en.console.rankSelect.title}"]`).waitFor()
    await page.locator(`.kit-screen[aria-label="${en.console.rankSelect.title}"] .kit-listrow`).nth(0).click()
    await page.waitForEvent('load', { timeout: 10000 }).catch(() => {})
    await page.locator('.kit-art-stage').waitFor()
    await sleep(600)
    check('RANK SELECT 0 → the name is gone', (await savedName(page)) === null, await savedName(page))
    await toSignLine(page)
    check('…a brand-new device: PLEASE SIGN HERE again, the box empty', (await monitorSays(page)) === L.r0sign && (await nameBox(page).inputValue()) === '')
    await page.screenshot({ path: `${OUT}/after-wipe-390x844.png` })
    check('wipe: no page errors', !errors.length, errors.join(' | '))
    await close()
  }
} catch (e) {
  check('the run finished', false, e.message)
} finally {
  await browser.close()
  server.kill()
}
console.log(`\n${failed ? `FAILED ${failed} of ${count}` : `ALL PASS (${count})`}`)
process.exit(failed ? 1 : 0)
