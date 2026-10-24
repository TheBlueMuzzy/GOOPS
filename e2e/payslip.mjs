// F41 — THE PAYSLIP on the end report (design/story.md "Credits, payday and fines"; numbers content/tuning/payslip.json,
// words content/text/en.json payslip), in Playwright's own Chromium (never the user's Chrome). Portrait only (Goops
// never plays sideways), so the sizes are 390x844, 360x780, 1100x900, 1440x900 and 1920x1080.
//   a normal shift — the report shows Gross pay, the fines (words from en.json), Net pay; gross − fines = net = the XP saved
//   a payday — a shift that ranks up: the report's button opens Payday (5 items that add up to the payment due, the
//              passage debt, the rank-up); Pay up → back to the console
//   two paydays — a shift that crosses two ranks: two Payday screens in a row, the same size
//   every card keeps its size while it shows (the kit's fixed-size watch: window.__uiGrowth stays empty)
// Screenshots: e2e-shots/payslip/
// Run: node e2e/payslip.mjs  (own dev server on port 5348)
import { chromium } from 'playwright-core'
import { skipFirstDay, startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 5348, OUT = 'e2e-shots/payslip'
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const P = en.payslip
const PAY = JSON.parse(readFileSync('content/tuning/payslip.json', 'utf8'))
const settle = () => 500 + 8 * PAY.lineMs // a card's entrance, then its rows one at a time (UI kit 0.31.0 reveal)
const xpToNext = (rank) => prog.xpBase + prog.xpPerRank * rank
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += xpToNext(r); return xp }
const KIT = readFileSync('src/ui/kit/VERSION', 'utf8').split(/\s/)[0]
const KIT_SCROLLS_STATS = KIT.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0) >= 31000 // 0.31.0
const num = (s) => Number(String(s).replace(/[^0-9]/g, ''))
const fineWords = new Set([...Object.values(P.fines), ...Object.values(P.silly)])
const billWords = new Set([...Object.values(P.payday), ...P.extras])
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

// a device with this much XP saved, its shift played to the end (score = the shift's score before the end, if given)
async function shiftEnded(totalXp, { width = 390, height = 844, score } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await skipFirstDay(page)
  await page.goto(`http://localhost:${PORT}/?seed=7`)
  await page.evaluate((xp) => localStorage.setItem('goops-progress', JSON.stringify({ v: 1, totalXp: xp, scrapsSpent: 0 })), totalXp)
  await page.reload()
  await page.getByRole('button', { name: 'Start shift' }).waitFor()
  await startShift(page)
  await page.evaluate((s) => {
    const e = window.__goops.engine
    if (s !== undefined) e.state.score = s
    for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000)
  }, score)
  await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(700 + 8 * PAY.lineMs) // (the report settles, then its rows show one at a time)
  return { page, errors, close: () => context.close() }
}
// the open card's rows: [label, value]
const rowsOf = async (page, sel) => {
  const raw = await page.locator(`${sel} .kit-stat-row`).allInnerTexts()
  return raw.map((t) => t.split('\n').map((s) => s.trim()).filter(Boolean)).map((p) => [p[0], p[p.length - 1]])
}
const growth = (page) => page.evaluate(() => window.__uiGrowth ?? [])
const cardSize = (page, sel) => page.locator(sel).first().evaluate((el) => ({ w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) }))

try {
  // ---------------- a normal shift: gross − fines = net = the XP ----------------
  {
    const before = xpFor(3) + 10
    const { page, errors, close } = await shiftEnded(before)
    const r = await rowsOf(page, '.kit-end')
    const gross = r.find(([l]) => l === P.gross), net = r.find(([l]) => l === P.net)
    const fines = r.filter(([l]) => fineWords.has(l))
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress')))
    const earned = saved.totalXp - before
    check('report: Gross pay, Net pay and the fines are there', !!gross && !!net && fines.length >= 1, JSON.stringify(r))
    check(`report: ${fines.length} fine lines (at most ${JSON.parse(readFileSync('content/tuning/payslip.json', 'utf8')).fineLines})`, fines.length <= 3)
    check('report: gross − fines = net', num(gross?.[1]) - fines.reduce((a, [, v]) => a + num(v), 0) === num(net?.[1]), JSON.stringify({ gross, fines, net }))
    check('report: net = the XP saved', num(net?.[1]) === earned, `${net?.[1]} vs ${earned}`)
    await page.screenshot({ path: `${OUT}/report-390x844.png` })
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.locator('.kit-art-stage').waitFor({ timeout: 4000 })
    check('report → the console (no payday screen)', await page.getByRole('heading', { name: P.paydayTitle }).count() === 0)
    check('report: the card never grew', (await growth(page)).length === 0, JSON.stringify(await growth(page)))
    check('report: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- a payday: one rank-up ----------------
  {
    const before = xpFor(3) + xpToNext(3) - 50 // 50 short of rank 4: any shift crosses it
    const { page, errors, close } = await shiftEnded(before)
    check('payday: the report says the rank-up', await page.getByText(/Rank up! 4/).count() === 1)
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: P.paydayTitle }).waitFor({ timeout: 3000 })
    await page.waitForTimeout(settle())
    const r = await rowsOf(page, '.kit-modal')
    const bill = r.filter(([l]) => billWords.has(l))
    check('payday: 5 items on the bill', bill.length === 5, JSON.stringify(r))
    check(`payday: they add up to the payment due (${xpToNext(3)})`, bill.reduce((a, [, v]) => a + num(v), 0) === xpToNext(3))
    check('payday: the passage debt line', r.some(([l]) => l === P.debt))
    check('payday: the rank-up line (rank 4)', r.some(([l, v]) => l === P.rankUp && v.includes('4')), JSON.stringify(r))
    await page.screenshot({ path: `${OUT}/payday-390x844.png` })
    await page.getByRole('button', { name: P.pay }).click()
    await page.locator('.kit-art-stage').waitFor({ timeout: 4000 })
    check('Pay up → the console', await page.locator('.kit-art-stage').count() === 1)
    check('payday: no card grew', (await growth(page)).length === 0, JSON.stringify(await growth(page)))
    check('payday: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- two paydays in a row (Next shift after them starts a shift) ----------------
  {
    const { page, errors, close } = await shiftEnded(xpToNext(0) - 50, { score: xpToNext(1) + 4000 })
    await page.getByRole('button', { name: en.end.again }).click()
    await page.getByRole('heading', { name: P.paydayTitle }).waitFor({ timeout: 3000 })
    await page.waitForTimeout(settle())
    const first = await rowsOf(page, '.kit-modal'), size1 = await cardSize(page, '.kit-modal')
    await page.screenshot({ path: `${OUT}/payday-double-1-390x844.png` })
    await page.getByRole('button', { name: P.pay }).click()
    await page.waitForTimeout(settle())
    const second = await rowsOf(page, '.kit-modal'), size2 = await cardSize(page, '.kit-modal')
    await page.screenshot({ path: `${OUT}/payday-double-2-390x844.png` })
    check('two paydays: rank 1, then rank 2', first.some(([l, v]) => l === P.rankUp && v.includes('1')) && second.some(([l, v]) => l === P.rankUp && v.includes('2')), JSON.stringify([first.at(-1), second.at(-1)]))
    check('two paydays: the same size', Math.abs(size1.w - size2.w) <= 1 && Math.abs(size1.h - size2.h) <= 2, JSON.stringify([size1, size2]))
    await page.getByRole('button', { name: P.pay }).click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${OUT}/payday-double-after-390x844.png` })
    const after = await page.evaluate(() => ({ status: window.__goops?.engine.state.status, rank: window.__goops?.engine.state.rank, screens: document.querySelectorAll('.kit-modal, .kit-end').length }))
    check('Next shift → after the paydays, a new shift starts (rank 2, nothing on top)', after.status === 'playing' && after.rank === 2 && after.screens === 0, JSON.stringify(after))
    check('two paydays: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- every portrait size: the report and a payday (looked at by hand) ----------------
  for (const [w, h] of [[390, 844], [360, 780], [1100, 900], [1440, 900], [1920, 1080]]) {
    const { page, errors, close } = await shiftEnded(xpFor(5) + xpToNext(5) - 50, { width: w, height: h })
    await page.screenshot({ path: `${OUT}/report-${w}x${h}.png` })
    // the card is on screen, only its rows scroll (the kit's ScrollArea: no scroll bar, the edge fades — Muzzy: "just
    // obviously hangs off screen"), and every button can be pressed (what's under its centre is it)
    const fits = (sel) => page.locator(sel).first().evaluate((el) => {
      const r = el.getBoundingClientRect()
      const onScreen = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5
      const scrolls = [el, ...el.querySelectorAll('*')].filter((x) => !x.classList.contains('kit-scroll') && x.scrollHeight > x.clientHeight + 1 && getComputedStyle(x).overflowY !== 'visible')
        .map((x) => `${x.className} ${x.scrollHeight}>${x.clientHeight}`)
      const blocked = [...el.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return !b.contains(document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2)) }).map((b) => b.textContent)
      return { ok: onScreen && !scrolls.length && !blocked.length, why: JSON.stringify({ onScreen, scrolls, blocked }) }
    })
    // (the report's rows scroll from UI kit 0.31.0 — framework F113, asked for 2026-10-23; until then a phone's report
    // panel scrolls as a whole and its last button sits below the fold, so this check waits for that kit)
    const report = await fits('.kit-end')
    if (KIT_SCROLLS_STATS) check(`${w}x${h}: the report fits the window (only its rows scroll, every button pressable)`, report.ok, report.why)
    else console.log(`WAIT ${w}x${h}: the report fits the window — needs UI kit 0.31.0 (now ${KIT}) · ${report.ok ? 'fits already' : report.why}`)
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: P.paydayTitle }).waitFor({ timeout: 3000 })
    await page.waitForTimeout(settle())
    await page.screenshot({ path: `${OUT}/payday-${w}x${h}.png` })
    const payday = await fits('.kit-modal')
    check(`${w}x${h}: the payday fits the window (no scrolling, every button pressable)`, payday.ok, payday.why)
    check(`${w}x${h}: no card grew, no page errors`, (await growth(page)).length === 0 && errors.length === 0, JSON.stringify(await growth(page)) + errors.join(' | '))
    await close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS')
process.exit(failed ? 1 : 0)
