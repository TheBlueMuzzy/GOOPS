// F74 — THE RANK LOCK (TDD D31): a rank-up needs the XP goal AND a crack quota met during that rank. In Playwright's
// own Chromium (never the user's Chrome). Portrait only (Goops never plays sideways): 390x844, 360x780, 1100x900,
// 1440x900, 1920x1080.
//   locked — 200 XP short of rank 4, a shift that misses its quota: the report's quota row says "Rank locked: meet a
//            quota", no payday, the console's meter fills to full and says QUOTA NEEDED, the save holds it (xpHeld);
//            Management explains the lock on the monitor the first time (moments.json events.rankLock), once
//   unlocked — the next shift meets its quota: its XP doubled (progression.json quotaXpMult), "Quota met — rank
//            unlocked", the rank-up and its payday, the meter at rank 4
//   carried — a quota met early in a rank stays met: a later shift that misses still ranks up ("Met earlier")
//   every portrait size — the moment, the full meter and the report's quota row on screen, no card grew, no page errors
// The shift's end is driven through the engine (window.__goops.engine: its score, its quota) like e2e/payslip.mjs.
// Screenshots: e2e-shots/rank-lock/
// Run: node e2e/rank-lock.mjs  (own dev server on port 6474)
import { chromium } from 'playwright-core'
import { skipFirstDay, startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = Number(process.env.E2E_PORT) || 6474, OUT = 'e2e-shots/rank-lock'
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const story = JSON.parse(readFileSync('content/story/moments.json', 'utf8'))
const Q = en.end.quota
const xpToNext = (rank) => prog.xpBase + prog.xpPerRank * rank
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += xpToNext(r); return xp }
const fmt = (n) => n.toLocaleString('en')
const num = (s) => Number(String(s).split('·')[0].replace(/[^0-9]/g, ''))
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
const LOCK_LINES = story.events.rankLock.lines.map((l) => en.story.lines[l.words])
// a device that has had everything up to here: every rank's story moment, the first day, the unlock + machine lessons
const HAD = [...Array.from({ length: 51 }, (_, i) => `story:${i}`), 'lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap',
  'lesson:unlock-upgrades', 'lesson:visor', 'lesson:laser', 'lesson:controls', ...Array.from({ length: 10 }, (_, i) => `consoleNote:${i + 1}`)]
const save = (fields) => ({ v: 5, totalXp: 0, scrapsSpent: 0, owned: {}, equipped: [], badge: null, quotaMet: false, xpHeld: false, name: null, careers: 0, ...fields })

mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

// a device with this save, at the console (?story: the story moments play, as in a player's game)
async function device(progress, { width = 390, height = 844, seen = HAD } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await skipFirstDay(page)
  await page.goto(`http://localhost:${PORT}/?seed=7&story`)
  await page.waitForFunction(() => !!window.__goopsSeen, null, { timeout: 15000 })
  await page.evaluate(([ids, p]) => { window.__goopsSeen(ids); localStorage.setItem('goops-progress', JSON.stringify(p)) }, [seen, progress])
  await page.reload()
  await page.locator('.kit-art-stage').waitFor()
  return { page, errors, close: () => context.close() }
}
// play the shift to its end: its score set first, its crack quota met or not; → the report, its rows shown
// returns the shift's final score (its XP before the floor and the quota bonus)
async function playShift(page, { score, meet }) {
  await startShift(page)
  const final = await page.evaluate(([s, m]) => {
    const e = window.__goops.engine
    e.state.score = s
    if (m) { e.state.cracksSealed = Math.max(e.state.cracksSealed, e.state.cracksNeeded); e.state.quotaMet = true }
    for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000)
    return { score: e.state.score, quotaMet: e.state.quotaMet, rank: e.state.rank }
  }, [score, meet])
  await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
  // (the rows show one at a time: wait for Net pay to be there and every row's entrance to have finished)
  await page.waitForFunction((net) => [...document.querySelectorAll('.kit-end .kit-stat-row')].some((r) => r.textContent.includes(net))
    && document.getAnimations().filter((a) => a.effect?.target?.closest?.('.kit-end .kit-stats')).every((a) => a.playState === 'finished'), en.payslip.net, { timeout: 10000 })
  return final
}
const rowsOf = async (page, sel) => (await page.locator(`${sel} .kit-stat-row`).allInnerTexts())
  .map((t) => t.split('\n').map((s) => s.trim()).filter(Boolean)).map((p) => [p[0], p[p.length - 1]])
const row = (rows, label) => rows.find(([l]) => l === label)?.[1]
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress')))
const meterText = (page) => page.locator('.kit-level-meter').getAttribute('aria-valuetext')
const meterLevel = (page) => page.locator('.kit-level-meter').getAttribute('aria-label')
const growth = (page) => page.evaluate(() => window.__uiGrowth ?? [])
const monitorSays = (page) => page.locator('[data-tag="crt"] .crt-read').textContent().then((t) => t.trim(), () => '')
// back to the console from the report (no payday) and the meter played to its end
async function backToConsole(page) {
  await page.getByRole('button', { name: en.end.quit }).click()
  await page.locator('.kit-art-stage').waitFor({ timeout: 5000 })
}
const meterSays = (page, words) => page.waitForFunction((w) => document.querySelector('.kit-level-meter')?.getAttribute('aria-valuetext') === w, words, { timeout: 8000 }).then(() => true, () => false)
// the rank lock's moment: each Management line on the monitor, Got it to move on (shot = a picture of its first line)
async function playLockMoment(page, shot) {
  const said = []
  for (const [i, words] of LOCK_LINES.entries()) {
    const typed = await page.waitForFunction((w) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === w, words, { timeout: 8000 }).then(() => true, () => false)
    said.push(typed)
    const gotIt = page.locator('[data-tag="crt"]').getByRole('button', { name: en.lessons.gotIt })
    await gotIt.waitFor({ timeout: 8000 }) // (Got it comes once the line has typed out)
    if (i === 1 && shot) { // (the line that says the rule, typed out: nothing left in the CRT's untyped rest)
      await page.waitForFunction(() => !document.querySelector('[data-tag="crt"] .crt-rest')?.textContent, null, { timeout: 15000 })
      await page.screenshot({ path: `${OUT}/${shot}.png` })
    }
    await gotIt.click()
  }
  return said
}
// a picture of the console once the monitor's hint has typed out (a picture only — no check waits on it)
async function consoleShot(page, name) {
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}
// the card is on screen (only its rows scroll) and every button can be pressed
const fits = (page, sel) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect()
  const onScreen = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5
  const blocked = [...el.querySelectorAll('button')].filter((b) => { const q = b.getBoundingClientRect(); return !b.contains(document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2)) }).map((b) => b.textContent)
  return { ok: onScreen && !blocked.length, why: JSON.stringify({ onScreen, blocked }) }
})
// QUOTA NEEDED fits its line on the meter: not cut off, inside the meter's art
const meterWordsFit = (page) => page.locator('.kit-level-meter-value').evaluate((el) => {
  const m = el.closest('.kit-art-layer').getBoundingClientRect(), r = el.getBoundingClientRect()
  return { ok: el.scrollWidth <= el.clientWidth + 1 && r.left >= m.left - 0.5 && r.right <= m.right + 0.5 && el.textContent.length > 0, why: JSON.stringify({ sw: el.scrollWidth, cw: el.clientWidth, r: [r.left, r.right], m: [m.left, m.right], text: el.textContent }) }
})

try {
  // ---------------- locked: the meter fills to full, the rank waits; the next shift meets the quota → rank-up ----------------
  {
    const start = xpFor(3) + xpToNext(3) - 200 // 200 short of rank 4, no quota met at rank 3
    const { page, errors, close } = await device(save({ totalXp: start }))
    const s1 = await playShift(page, { score: 1000, meet: false })
    check('locked: the shift missed its quota (rank 3)', !s1.quotaMet && s1.rank === 3, JSON.stringify(s1))
    const r1 = await rowsOf(page, '.kit-end')
    check(`locked: the report's quota row says "${Q.locked}"`, row(r1, Q.label) === Q.locked, JSON.stringify(r1))
    check('locked: the quota row is right under Cracks sealed', r1.findIndex(([l]) => l === Q.label) === r1.findIndex(([l]) => l === en.end.cracks) + 1, JSON.stringify(r1.map(([l]) => l)))
    check('locked: no rank-up on the report', !r1.some(([, v]) => v.includes('Rank up')), JSON.stringify(r1))
    await page.screenshot({ path: `${OUT}/report-locked-390x844.png` })
    await backToConsole(page)
    check('locked: no payday', await page.getByRole('heading', { name: en.payslip.paydayTitle }).count() === 0)
    check('locked: the meter fills to full and says QUOTA NEEDED', await meterSays(page, en.console.quotaNeeded), await meterText(page))
    check('locked: still rank 3', (await meterLevel(page)) === `${en.console.rank} 3`, await meterLevel(page))
    const p1 = await saved(page)
    check('locked: saved — the XP stopped at the goal (rank 4\'s start), held, no quota', p1.totalXp === xpFor(4) && p1.xpHeld === true && p1.quotaMet === false && p1.v === 5, JSON.stringify(p1))
    // Management explains it, the first time (the meter outlined)
    const said = await playLockMoment(page, 'moment-390x844')
    check('locked: Management explains the lock on the monitor, line by line (Got it)', said.every(Boolean), JSON.stringify(said))
    await consoleShot(page, 'console-locked-390x844')
    check('locked: the moment is remembered (story:rankLock)', await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))).seen.includes('story:rankLock')))
    await page.reload()
    await page.locator('.kit-art-stage').waitFor()
    await page.waitForFunction((w) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === w, en.console.hint, { timeout: 8000 }).catch(() => {})
    check('locked: once only — after a reload the monitor says what to do, not the lock', (await monitorSays(page)) === en.console.hint, await monitorSays(page))
    check('locked: after a reload the meter still says QUOTA NEEDED', await meterSays(page, en.console.quotaNeeded), await meterText(page))
    // another missed shift: still locked, nothing goes in
    await playShift(page, { score: 800, meet: false })
    check('still locked: the report says it again', row(await rowsOf(page, '.kit-end'), Q.label) === Q.locked)
    await backToConsole(page)
    check('still locked: the XP didn\'t move', (await saved(page)).totalXp === xpFor(4))
    // the next shift meets its quota: XP × quotaXpMult, the rank-up, its payday
    const s2 = await playShift(page, { score: 500, meet: true })
    const r2 = await rowsOf(page, '.kit-end')
    const earned = Math.max(s2.score, prog.minXp, prog.minXpPerRank * 3), doubled = Math.round(earned * prog.quotaXpMult)
    check(`unlocked: the quota row says "${fill(Q.met, { mult: prog.quotaXpMult })}"`, row(r2, Q.label) === fill(Q.met, { mult: prog.quotaXpMult }), JSON.stringify(r2))
    const net = row(r2, en.payslip.net)
    check(`unlocked: Net pay = the doubled XP (${fmt(earned)} × ${prog.quotaXpMult} = ${fmt(doubled)}) and the rank-up to 4`, num(net) === doubled && net.includes('Rank up! 4'), net)
    await page.screenshot({ path: `${OUT}/report-unlocked-390x844.png` })
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: en.payslip.paydayTitle }).waitFor({ timeout: 4000 })
    check('unlocked: the payday plays', true)
    await page.getByRole('button', { name: en.payslip.pay }).click()
    await page.locator('.kit-art-stage').waitFor({ timeout: 5000 })
    const want = `${fmt(doubled)} / ${fmt(xpToNext(4))} ${en.console.xp}`
    check(`unlocked: the meter at rank 4, ${want}`, await meterSays(page, want) && (await meterLevel(page)) === `${en.console.rank} 4`, `${await meterLevel(page)} · ${await meterText(page)}`)
    await consoleShot(page, 'console-unlocked-390x844')
    const p2 = await saved(page)
    check('unlocked: saved — rank 4, the quota used up, not held', p2.totalXp === xpFor(4) + doubled && p2.quotaMet === false && p2.xpHeld === false, JSON.stringify(p2))
    check('no card grew', (await growth(page)).length === 0, JSON.stringify(await growth(page)))
    check('no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- carried: a quota met early stays met until the rank-up ----------------
  {
    // (800 short of rank 4: the floor's XP — 300 at rank 3, the leftover goop eats the score — doubled to 600 leaves it
    // 200 short; the next shift's floor crosses it)
    const { page, errors, close } = await device(save({ totalXp: xpFor(3) + xpToNext(3) - 800 }), { seen: [...HAD, 'story:rankLock'] })
    await playShift(page, { score: 300, meet: true })
    const r1 = await rowsOf(page, '.kit-end')
    check('carried: a quota met far from the goal — "Quota met — rank unlocked"', row(r1, Q.label) === fill(Q.met, { mult: prog.quotaXpMult }), JSON.stringify(r1))
    check('carried: no rank-up yet', !row(r1, en.payslip.net).includes('Rank up'))
    await backToConsole(page)
    check('carried: saved with the quota met', (await saved(page)).quotaMet === true)
    await playShift(page, { score: 300, meet: false })
    const r2 = await rowsOf(page, '.kit-end')
    check(`carried: a later shift that misses still ranks up — "${Q.metEarlier}"`, row(r2, Q.label) === Q.metEarlier && row(r2, en.payslip.net).includes('Rank up! 4'), JSON.stringify(r2))
    await page.screenshot({ path: `${OUT}/report-met-earlier-390x844.png` })
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: en.payslip.paydayTitle }).waitFor({ timeout: 4000 })
    await page.getByRole('button', { name: en.payslip.pay }).click()
    await page.locator('.kit-art-stage').waitFor({ timeout: 5000 })
    const p = await saved(page)
    check('carried: saved at rank 4 with the quota used up', p.quotaMet === false && p.xpHeld === false && p.totalXp > xpFor(4), JSON.stringify(p))
    // a missed shift with the meter not yet full says so
    await playShift(page, { score: 300, meet: false })
    check(`carried: rank 4, missed, not full — "${Q.missed}"`, row(await rowsOf(page, '.kit-end'), Q.label) === Q.missed)
    check('carried: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- every portrait size: the moment, the full meter, the report's quota row ----------------
  for (const [w, h] of [[390, 844], [360, 780], [1100, 900], [1440, 900], [1920, 1080]]) {
    const { page, errors, close } = await device(save({ totalXp: xpFor(4), xpHeld: true }), { width: w, height: h })
    check(`${w}x${h}: a held save loads locked — rank 3, QUOTA NEEDED`, await meterSays(page, en.console.quotaNeeded) && (await meterLevel(page)) === `${en.console.rank} 3`, await meterText(page))
    const said = await playLockMoment(page, `moment-${w}x${h}`)
    check(`${w}x${h}: the lock's moment plays at the console`, said.every(Boolean), JSON.stringify(said))
    const words = await meterWordsFit(page)
    check(`${w}x${h}: QUOTA NEEDED fits on the meter`, words.ok, words.why)
    await consoleShot(page, `console-locked-${w}x${h}`)
    await playShift(page, { score: 900, meet: false })
    check(`${w}x${h}: the report's quota row`, row(await rowsOf(page, '.kit-end'), Q.label) === Q.locked)
    await page.screenshot({ path: `${OUT}/report-locked-${w}x${h}.png` })
    const report = await fits(page, '.kit-end')
    check(`${w}x${h}: the report fits the window, every button pressable`, report.ok, report.why)
    check(`${w}x${h}: no card grew, no page errors`, (await growth(page)).length === 0 && errors.length === 0, JSON.stringify(await growth(page)) + errors.join(' | '))
    await close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS')
process.exit(failed ? 1 : 0)
