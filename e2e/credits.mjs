// F55 — CREDITS: Settings → About → Credits opens the UI kit's Credits screen, in Playwright's own Chromium (never the
// user's Chrome), with the real dev server. Portrait only (Goops never plays sideways): 390x844, 360x780, 1100x800,
// 1440x900, 1920x1080.
//   the console's gear → Settings → the About tab → the Credits row → the Credits screen
//   the people lines first (en.json credits.people), then a line for EVERY entry in content/credits.json, in its order
//     (its own credit line, or en.json credits.asset when it has none) — read from the files, never restated here
//   it fits: the card inside the window with room at every side, every line and the header inside the card with room,
//     no line wider than its box; the list scrolls inside its card and its last line can be scrolled into view
//   ‹ goes back to Settings (still on the About tab)
//   mid-shift too: the tank's pause → Settings → About → Credits → ‹ back to Settings
//   no page errors
// Screenshots: e2e-shots/credits/ (credits-<size>.png, credits-end-<size>.png = scrolled to the end, back-<size>.png)
// Run: node e2e/credits.mjs  (own dev server on port 5385)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { skipFirstDay, startShift } from './start.mjs'

// ports: 5385 (E2E_PORT=… runs it on another)
const PORT = Number(process.env.E2E_PORT) || 5385, OUT = 'e2e-shots/credits'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]] // (portrait phones + desktop windows — never a phone on its side)
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const credits = JSON.parse(readFileSync('content/credits.json', 'utf8'))
const settings = JSON.parse(readFileSync('content/ui/settings.json', 'utf8'))
const C = en.credits
const aboutTab = settings.tabs.find((t) => t.id === 'about')
const creditsRowLabel = aboutTab.rows.find((r) => r.id === 'credits').label
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
// the line each credits.json entry should show (src/ui/CreditsScreen.tsx)
const wantLine = (e) => (e.credit ?? '').trim() ? e.credit : fill(C.asset, { source: (e.source ?? '').split(' (')[0].trim(), author: e.author ?? '', licence: e.licence ?? '' })
const ROOM = 4 // px: the least room between a line and its card's edge (nothing touches an edge)
const SCREEN_ROOM = 4 // px: the least room between the card and the window's edge

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

const creditsScreen = (page) => page.locator(`.kit-screen[aria-label="${C.words.title}"]`)
const settingsScreen = (page) => page.locator('.kit-screen[aria-label="Settings"]')
const creditsRow = (page) => page.locator('.kit-settings-page[data-current] button.kit-listrow', { hasText: creditsRowLabel })

// a device on the console (the first day and the unlock lessons already had)
async function device(width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await skipFirstDay(page)
  await page.goto(`http://localhost:${PORT}/?seed=7`)
  await page.waitForFunction(() => !!window.__goopsSeen, null, { timeout: 15000 })
  await page.evaluate(() => window.__goopsSeen(['lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades']))
  await page.reload()
  await page.locator('.kit-art-stage').waitFor()
  await sleep(600)
  return { page, errors, close: () => context.close() }
}

// Settings is open: step to the About tab (the tab bar, or a phone's ◀ Settings ▶ picker)
async function toAbout(page) {
  const tab = page.getByRole('tab', { name: aboutTab.label })
  if (await tab.isVisible()) await tab.click()
  else for (let i = 0; i < 8 && !(await creditsRow(page).isVisible()); i++) {
    await page.getByRole('button', { name: 'Next Settings' }).click(); await sleep(150)
  }
  await sleep(200)
}

// what the Credits screen shows, and where (px)
const measure = (page) => creditsScreen(page).evaluate((screen) => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }
  const card = screen.querySelector('.kit-modal'), scroll = screen.querySelector('.kit-scroll'), header = screen.querySelector('.kit-menu-header')
  const texts = [...scroll.querySelectorAll('.kit-text')].map((el) => ({ text: el.textContent.trim(), heading: el.matches('[data-kind="heading"], h2, h3') || el.closest('h2,h3') !== null,
    ...box(el), wide: el.scrollWidth > el.clientWidth + 1 }))
  return { card: box(card), scroll: { ...box(scroll), scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight }, header: box(header), texts, w: innerWidth, h: innerHeight }
})

try {
  for (const [width, height] of SIZES) {
    const size = `${width}x${height}`
    const { page, errors, close } = await device(width, height)
    // ── open: the gear → Settings → About → Credits ──
    await page.getByRole('button', { name: 'Settings' }).click()
    await settingsScreen(page).waitFor()
    await toAbout(page)
    check(`${size}: Settings → About shows the Credits row`, await creditsRow(page).isVisible())
    await creditsRow(page).click()
    await creditsScreen(page).waitFor({ timeout: 3000 }).catch(() => {})
    await sleep(500)
    check(`${size}: the Credits row opens the Credits screen`, await creditsScreen(page).isVisible())

    // ── what it lists: the people first, then every credits.json entry in order ──
    const m = await measure(page)
    const lines = m.texts.map((t) => t.text)
    const peopleWords = C.people.flatMap((g) => [g.role, ...g.names])
    check(`${size}: the people lines come first (${peopleWords.join(' · ')})`, peopleWords.every((t, i) => lines[i] === t), lines.slice(0, peopleWords.length).join(' · '))
    const assetsAt = lines.indexOf(C.words.assets)
    check(`${size}: then the "${C.words.assets}" heading`, assetsAt === peopleWords.length, `at ${assetsAt}`)
    const shown = lines.slice(assetsAt + 1, assetsAt + 1 + credits.length)
    const missing = credits.map(wantLine).filter((line, i) => shown[i] !== line)
    check(`${size}: every one of the ${credits.length} credits.json entries is listed, in order`, assetsAt >= 0 && !missing.length, missing.slice(0, 3).join(' | '))
    check(`${size}: no blank line`, m.texts.every((t) => t.text.length > 0), String(m.texts.filter((t) => !t.text).length))

    // ── it fits: the card in the window, everything in the card, nothing too wide ──
    const c = m.card
    check(`${size}: the card is inside the window with room at every side`, c.left >= SCREEN_ROOM && c.right <= m.w - SCREEN_ROOM && c.top >= SCREEN_ROOM && c.bottom <= m.h - SCREEN_ROOM, JSON.stringify({ c, w: m.w, h: m.h }))
    check(`${size}: the header (‹ + title) is inside the card with room`, m.header.left >= c.left + ROOM && m.header.right <= c.right - ROOM && m.header.top >= c.top + ROOM, JSON.stringify({ header: m.header, c }))
    check(`${size}: the list is inside the card with room below`, m.scroll.left >= c.left + ROOM && m.scroll.right <= c.right - ROOM && m.scroll.bottom <= c.bottom - ROOM, JSON.stringify({ scroll: m.scroll, c }))
    const touching = m.texts.filter((t) => t.left < c.left + ROOM || t.right > c.right - ROOM).map((t) => `${t.text.slice(0, 24)} ${Math.round(t.left - c.left)}/${Math.round(c.right - t.right)}`)
    check(`${size}: no line touches the card's sides`, !touching.length, touching.slice(0, 3).join(', '))
    const wide = m.texts.filter((t) => t.wide).map((t) => t.text.slice(0, 30))
    check(`${size}: every line fits its box (wraps, never cut off)`, !wide.length, wide.slice(0, 3).join(', '))
    await page.screenshot({ path: `${OUT}/credits-${size}.png` })

    // ── the list scrolls inside its card: its last line can be brought into view, inside the list ──
    const scrolls = m.scroll.scrollHeight > m.scroll.clientHeight + 1
    if (scrolls) await creditsScreen(page).locator('.kit-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight })
    await sleep(300)
    const end = await measure(page)
    const last = end.texts[end.texts.length - 1]
    check(`${size}: the last line ${scrolls ? 'scrolls into view' : 'shows'} inside the list (${scrolls ? 'it scrolls' : 'it all fits'})`,
      last.top >= end.scroll.top - 1 && last.bottom <= end.scroll.bottom + 1 && end.card.top === m.card.top, JSON.stringify({ last, scroll: end.scroll }))
    if (width === 390 || width === 360) check(`${size}: on a phone the list is taller than the card, so it scrolls`, scrolls, `${m.scroll.scrollHeight} / ${m.scroll.clientHeight}`)
    await page.screenshot({ path: `${OUT}/credits-end-${size}.png` })

    // ── ‹ back to Settings, still on About ──
    await creditsScreen(page).locator('.kit-menu-header').getByRole('button', { name: C.words.back }).click()
    await sleep(500)
    check(`${size}: ‹ closes Credits`, (await creditsScreen(page).count()) === 0)
    check(`${size}: …back on Settings, the About tab (the Credits row there)`, (await settingsScreen(page).isVisible()) && (await creditsRow(page).isVisible()))
    await page.screenshot({ path: `${OUT}/back-${size}.png` })

    // ── mid-shift (one size): the tank's pause → Settings → About → Credits → ‹ ──
    if (width === 390) {
      await page.keyboard.press('Escape'); await sleep(400)
      await startShift(page)
      await page.getByRole('button', { name: en.hud.pause }).click(); await sleep(300)
      await page.getByRole('dialog').getByRole('button', { name: 'Settings' }).click()
      await settingsScreen(page).waitFor()
      await toAbout(page)
      await creditsRow(page).click(); await sleep(400)
      check('mid-shift: pause → Settings → About → Credits opens it too', await creditsScreen(page).isVisible())
      await creditsScreen(page).locator('.kit-menu-header').getByRole('button', { name: C.words.back }).click(); await sleep(400)
      check('mid-shift: ‹ goes back to Settings', (await creditsScreen(page).count()) === 0 && (await settingsScreen(page).isVisible()))
    }
    check(`${size}: no page errors`, !errors.length, errors.join(' | '))
    await close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(`\n${count - failed}/${count} checks passed${failed ? ` — ${failed} FAILED` : ''}`)
process.exit(failed ? 1 : 0)
