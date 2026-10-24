// F70 — RANK SELECT + THE VERSION LABEL (the console's bottom row: version · RANK SELECT · MuzzyMade © 2026), in
// Playwright's own Chromium (never the user's Chrome), with the real dev server (a Dev Kit build, so RANK SELECT shows).
// Portrait only (Goops never plays sideways): 390x844, 360x780, 1100x800, 1440x900, 1920x1080.
//   the version label on the console = version.json (the framework version module's label, "vX.Y.Z.B")
//   the bottom row: the three in order left → right, none overlapping, each inside the window and its words inside its box
//   SELECT RANK: every rank 0…maxRank (progression.json), 0 with the red "Wipe save" badge, yours with the green "You"
//   pick 7 (from a rank-18 save with upgrades bought) → the console shows rank 7 at its start, every scrap back, no
//     upgrades, and ?rank is gone from the address (it would override the save)
//   pick 0 → a brand-new device: the first day's first line on the monitor (A1), the pull starts it at B1 with the
//     lesson's blue goop falling
//   during the first day's lesson (Muzzy 2026-10-24: "I should be able to click the rank selector even during
//     tutorial"): RANK SELECT is there under the lesson's dim, a real tap opens it, and picking 7 leaves the day
//   mid-shift (the console over a running shift) it isn't there
// Screenshots: e2e-shots/rank-select/ (console-<size>.png, list-<size>.png)
// Run: node e2e/rank-select.mjs  (own dev server on port 5351)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { checkVersion, expectedVersion, skipFirstDay, startShift } from './start.mjs'

const PORT = 5351, OUT = 'e2e-shots/rank-select'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]] // (portrait phones + desktop windows — never a phone on its side)
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const R = en.console.rankSelect
const FD = en.lessons['first-day']
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += prog.xpBase + prog.xpPerRank * r; return xp }
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

const rankButton = (page) => page.getByRole('button', { name: R.open, exact: true })
const consoleRank = (page) => page.locator('.kit-level-meter-level').first().textContent().then((t) => Number(t))
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress') ?? 'null'))
const list = (page) => page.locator('.kit-screen[aria-label="' + R.title + '"]')

// a device with this save, on the console. The lessons in `seen` are marked seen once (the upgrades unlock lesson would
// be on the console at rank 5+, and RANK SELECT hides under a lesson). skipFirstDay = the day had, on EVERY load (an
// init script) — so never for a pick-0 check, which needs the reload after the pick to be a brand-new device.
const HAD = ['lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades']
async function device(width, height, { progress = null, query = '?seed=7', skipDay = true, seen = HAD } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  if (skipDay) await skipFirstDay(page)
  await page.goto(`http://localhost:${PORT}/${query}`)
  await page.waitForFunction(() => !!window.__goopsSeen, null, { timeout: 15000 })
  await page.evaluate((ids) => window.__goopsSeen(ids), seen)
  if (progress) await page.evaluate((p) => localStorage.setItem('goops-progress', JSON.stringify({ v: 2, ...p })), progress)
  await page.reload()
  await page.locator('.kit-art-stage').waitFor()
  await sleep(600)
  return { page, errors, close: () => context.close() }
}

// the bottom row's three boxes (px): version, RANK SELECT's button, the credit
const bottomRow = (page) => page.evaluate(([open, credits]) => {
  const layers = [...document.querySelectorAll('.kit-art-layer[data-text]')]
  const version = layers.find((l) => /^v\d|^dev$/.test(l.textContent.trim()))
  const credit = layers.find((l) => credits.includes(l.textContent.trim()))
  const stage = document.querySelector('.kit-art-stage').getBoundingClientRect()
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === open)
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: el.textContent.trim(), fits: el.scrollWidth <= el.clientWidth + 1 } }
  // the words themselves (a Range round the text), so a box wider than its words still counts as fitting
  const words = (el) => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom } }
  return { version: box(version), versionWords: words(version), credit: box(credit), creditWords: words(credit), button: box(button), buttonWords: words(button?.querySelector('span') ?? button), w: innerWidth, h: innerHeight,
    stage: { left: stage.left, width: stage.width } }
}, [R.open, [en.console.credit, en.console.creditShort]])
// the console's dark bottom strip narrows toward the bottom: on the row's line its sides are at ~48 and ~598 of the
// art's 648 units (measured from the art, 2026-10-24 — Muzzy: "too wide" when the words hung off it)
const STRIP = [48, 598], ART_W = 648

try {
  // ════════════ 1. THE BOTTOM ROW + THE LIST AT EVERY PORTRAIT SIZE ════════════
  for (const [width, height] of SIZES) {
    const size = `${width}x${height}`
    const { page, errors, close } = await device(width, height, { progress: { totalXp: xpFor(12) + 1000, scrapsSpent: 0, owned: {}, equipped: [] } })
    if (width === 390) {
      const want = expectedVersion()
      check('the page is version.json\'s build (meta app-version, the version module)', (await checkVersion(page).catch((e) => e.message)) === want, want)
    }
    const row = await bottomRow(page)
    check(`${size}: the version label = version.json (${expectedVersion()})`, row.version?.text === expectedVersion(), row.version?.text)
    check(`${size}: RANK SELECT is on the bottom row`, !!row.button, JSON.stringify(row.button))
    check(`${size}: the credit is there (short beside RANK SELECT)`, row.credit?.text === en.console.creditShort, row.credit?.text)
    if (row.version && row.button && row.credit) {
      const v = row.versionWords, b = row.button, c = row.creditWords
      const bw = row.buttonWords
      check(`${size}: left → right: version · RANK SELECT · credit — words 8 px+ apart, the button's tap area clear of both`,
        v.right + 8 <= bw.left && bw.right + 8 <= c.left && v.right <= b.left && b.right <= c.left,
        JSON.stringify({ v: [v.left, v.right], b: [b.left, b.right], bw: [bw.left, bw.right], c: [c.left, c.right] }))
      // the console's dark strip (the container) — the words never touch its sides
      const px = (u) => row.stage.left + (u * row.stage.width) / ART_W
      check(`${size}: the row sits inside the console's dark strip with room at both sides`, v.left >= px(STRIP[0]) + 4 && c.right <= px(STRIP[1]) - 4, JSON.stringify({ strip: STRIP.map(px), v: v.left, c: c.right }))
      check(`${size}: all three inside the window (with room at the sides)`, v.left >= 4 && c.right <= row.w - 4 && b.bottom <= row.h && v.bottom <= row.h, JSON.stringify({ vl: v.left, cr: c.right, bb: b.bottom, w: row.w, h: row.h }))
      check(`${size}: each one's words fit on one line in its box`, row.version.fits && row.credit.fits && row.button.fits && (v.bottom - v.top) < 2.2 * (row.buttonWords.bottom - row.buttonWords.top) + 1 && (c.bottom - c.top) < 2.2 * (row.buttonWords.bottom - row.buttonWords.top) + 1)
      const mid = (r) => (r.top + r.bottom) / 2
      check(`${size}: on one row (their middles within a few px)`, Math.abs(mid(v) - mid(row.buttonWords)) < 6 && Math.abs(mid(c) - mid(row.buttonWords)) < 6, JSON.stringify([mid(v), mid(row.buttonWords), mid(c)]))
    }
    await page.screenshot({ path: `${OUT}/console-${size}.png` })
    // the list
    await rankButton(page).click()
    await list(page).waitFor()
    await sleep(500)
    const rows = list(page).locator('.kit-listrow')
    check(`${size}: SELECT RANK lists every rank 0…${prog.maxRank}`, (await rows.count()) === prog.maxRank + 1, String(await rows.count()))
    if (width === 390) {
      check('rank 0 carries the red "Wipe save" badge', (await rows.nth(0).locator('.kit-badge[data-variant="danger"]').textContent()) === R.wipe)
      check('your rank (12) carries the green "You" badge — and only it', (await rows.nth(12).locator('.kit-badge[data-variant="success"]').textContent()) === R.yours
        && (await list(page).locator('.kit-badge[data-variant="success"]').count()) === 1)
      check('the rows read "Rank N"', (await rows.nth(7).locator('.kit-listrow-text > span').first().textContent()) === R.row.replace('{n}', '7'))
    }
    const yours = await rows.nth(12).boundingBox(), card = await list(page).locator('.kit-modal').boundingBox()
    check(`${size}: the list opens at your rank (its row on screen inside the card)`, !!yours && yours.y >= card.y && yours.y + yours.height <= card.y + card.height, JSON.stringify({ yours, card }))
    // nothing touches the card's edge: rows and badges inside it with room
    const edges = await list(page).evaluate((screen) => {
      const card = screen.querySelector('.kit-modal').getBoundingClientRect()
      const bad = []
      for (const el of screen.querySelectorAll('.kit-listrow, .kit-badge, .kit-menu-header, .kit-text')) {
        const r = el.getBoundingClientRect()
        if (!r.width) continue
        if (r.left < card.left + 4 || r.right > card.right - 4) bad.push(`${el.className} ${Math.round(r.left - card.left)}/${Math.round(card.right - r.right)}`)
      }
      return bad
    })
    check(`${size}: nothing in the list touches the card's sides`, !edges.length, edges.slice(0, 4).join(', '))
    await page.screenshot({ path: `${OUT}/list-${size}.png` })
    if (width === 390) { await rows.nth(0).scrollIntoViewIfNeeded(); await sleep(400); await page.screenshot({ path: `${OUT}/list-top-${size}.png` }) }
    check(`${size}: no page errors`, !errors.length, errors.join(' | '))
    await close()
  }

  // ════════════ 2. PICK 7: the start of rank 7, upgrades refunded, ?rank gone ════════════
  {
    const { page, errors, close } = await device(390, 844, {
      query: '?seed=7&rank=18', progress: { totalXp: xpFor(18) + 2500, scrapsSpent: 9, owned: { focusMode: 2, denseGoop: 1 }, equipped: ['cooldownBooster'] },
    })
    check('before: the console shows rank 18', (await consoleRank(page)) === 18)
    await rankButton(page).click()
    await list(page).waitFor()
    await list(page).locator('.kit-listrow').nth(7).click()
    await page.waitForURL((u) => !u.searchParams.has('rank'), { timeout: 10000 }).catch(() => {})
    await page.locator('.kit-art-stage').waitFor()
    await sleep(800)
    const p = await saved(page)
    check('pick 7 → the save is the START of rank 7 (all the XP to reach it, 0 into it)', p?.totalXp === xpFor(7), JSON.stringify(p))
    check('…every upgrade refunded (nothing owned or equipped, no scraps spent)', p && p.scrapsSpent === 0 && !Object.keys(p.owned).length && !p.equipped.length)
    check('…?rank is gone from the address (it would override the save)', !new URL(page.url()).searchParams.has('rank'), page.url())
    check('…the console shows rank 7', (await consoleRank(page)) === 7, String(await consoleRank(page)))
    const upgrades = await page.locator('[data-tag="upgrades"] .kit-badge').textContent()
    check('…with all 7 scraps in hand on the Upgrades button', upgrades === String(7 * prog.scrapsPerRank), upgrades)
    check('…and the version label still = version.json', (await bottomRow(page)).version?.text === expectedVersion())
    // mid-shift: the console over a running shift has no RANK SELECT
    await startShift(page)
    await page.keyboard.press('KeyW')
    await page.locator('.kit-art-stage').waitFor({ timeout: 5000 })
    await sleep(900)
    check('mid-shift: the console has no RANK SELECT', !(await rankButton(page).count()))
    check('pick 7: no page errors', !errors.length, errors.join(' | '))
    await close()
  }

  // ════════════ 3. PICK 0: a brand-new device → the first day from its first step ════════════
  {
    // a player who has had the day, the story moments and the unlock lessons, at rank 9 with upgrades
    const { page, errors, close } = await device(390, 844, { skipDay: false, seen: [...HAD, 'story:0', 'story:1', 'story:5'],
      progress: { totalXp: xpFor(9) + 100, scrapsSpent: 3, owned: { focusMode: 1 }, equipped: [] } })
    const settings = await page.evaluate(() => { const k = Object.keys(localStorage).find((k) => k.startsWith('kit-settings')) ?? 'kit-settings:'; const v = localStorage.getItem(k) ?? '{"masterVolume":40}'; localStorage.setItem(k, v); return [k, v] })
    check('before: rank 9, the console\'s own words (no lesson)', (await consoleRank(page)) === 9 && (await rankButton(page).count()) === 1)
    await rankButton(page).click()
    await list(page).waitFor()
    await list(page).locator('.kit-listrow').nth(0).click()
    await page.waitForEvent('load', { timeout: 10000 }).catch(() => {})
    await page.locator('.kit-art-stage').waitFor()
    const a1 = await page.waitForFunction((lines) => lines.includes(document.querySelector('[data-tag="crt"] .crt-read')?.textContent), Object.values(FD.pull), { timeout: 5000 }).then(() => true, () => false)
    await sleep(400)
    const memory = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))
    const tipsKey = Object.keys(memory).find((k) => k.startsWith('kit-tips'))
    const seen = tipsKey ? JSON.parse(memory[tipsKey]).seen ?? [] : []
    check('pick 0 → the progress save is gone (a fresh start)', !memory['goops-progress'] || JSON.parse(memory['goops-progress']).totalXp === 0, memory['goops-progress'])
    check('…the device has seen nothing (lessons, story moments, the first day)', seen.length === 0, JSON.stringify(seen))
    check('…no first-day checkpoint or replay left', !memory['goops-first-day'], memory['goops-first-day'])
    check('…Settings are kept', memory[settings[0]] === settings[1], `${settings[0]}: ${memory[settings[0]]}`)
    check('…the console shows rank 0', (await consoleRank(page)) === 0)
    const monitor = await page.locator('[data-tag="crt"] .crt-read').textContent()
    check('…the first day\'s first line is on the monitor (A1)', a1 && Object.values(FD.pull).includes(monitor), monitor)
    await page.screenshot({ path: `${OUT}/fresh-A1-390x844.png` })
    // the pull starts the day at B1, the lesson's goop falling
    await page.getByRole('button', { name: 'Start shift' }).click()
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    const b1 = await page.waitForFunction(() => window.__goops?.lessonView().stepId === 'B1', null, { timeout: 15000 }).then(() => true, () => false)
    check('…the pull starts the first day at B1', b1)
    const piece = await page.waitForFunction(() => { const p = window.__goops?.engine.state.piece; return p ? { cells: p.cells.length, colour: p.colors[0] } : null }, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => null)
    check('…with the lesson\'s goop falling (B1 sets up one blue piece)', !!piece && piece.cells > 0 && piece.colour === 2, JSON.stringify(piece))
    await sleep(700)
    await page.screenshot({ path: `${OUT}/fresh-B1-390x844.png` })
    check('pick 0: no page errors', !errors.length, errors.join(' | '))
    await close()
  }
  {
    // a brand-new device at the first day's first step (A1, the lesson's dim over the console)
    const { page, errors, close } = await device(390, 844, { skipDay: false, seen: [] })
    const atA1 = await page.waitForFunction((lines) => lines.includes(document.querySelector('[data-tag="crt"] .crt-read')?.textContent), Object.values(FD.pull), { timeout: 8000 }).then(() => true, () => false)
    check('during the first day (A1): RANK SELECT is on the console', atA1 && (await rankButton(page).count()) === 1)
    await page.screenshot({ path: `${OUT}/lesson-A1-390x844.png` })
    await rankButton(page).click({ timeout: 3000 }).catch(() => {}) // (a real tap: Playwright refuses while the lesson's tap blocker is on top)
    const opened = await list(page).waitFor({ timeout: 3000 }).then(() => true, () => false)
    check('…a tap on it opens SELECT RANK (the lesson\'s dim lets it through)', opened)
    if (opened) {
      await sleep(400)
      await page.screenshot({ path: `${OUT}/lesson-list-390x844.png` })
      await list(page).locator('.kit-listrow').nth(7).click()
      await page.waitForEvent('load', { timeout: 10000 }).catch(() => {})
      await page.locator('.kit-art-stage').waitFor()
      await sleep(600)
      check('…picking 7 leaves the day: the console shows rank 7', (await consoleRank(page)) === 7)
    }
    check('during the first day: no page errors', !errors.length, errors.join(' | '))
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
