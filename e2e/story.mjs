// F35 + F40 — STORY MOMENTS, ranks 0–30 (design/story.md "Story moments, rank by rank"; data content/story/moments.json,
// words content/text/en.json story), in Playwright's own Chromium (never the user's Chrome). Portrait only (Goops
// never plays sideways): 390x844, 360x780, 1100x800, 1440x900, 1920x1080. ?story turns the moments on (scripted checks
// keep them quiet otherwise — src/game/lessons/storyMoments.ts).
//   every rank 0–30 on a fresh device: its moment plays at the console — Management's lines type on the monitor (Got it
//     moves on), the Veteran's line is the talking bubble at the monitor (a tap moves on; a cut line moves on by
//     itself); the periscope waits for it; the monitor looks (flicker at 12/19/28, the red alarm at 30)
//   once only: after it, a reload shows the console's own words; rank 5+'s upgrades lesson comes right after its moment
//   two rank-ups at once (a fresh device at rank 4): the newest catchUp moments, oldest first
//   Settings → Replay lessons plays them again (at rank 30: 29, then the capture)
//   titles: a payday that reaches a new title says it
//   whispers: "…cold…" once at 3, feelings from 8, single words from 15, names from 24; Management's "NO VOICES" from 12
//   fines (F40): the first report at 30 fines "Association with a retired employee" first, once; paydays from 30 say
//     the after-capture words
// Screenshots: e2e-shots/story/
// Run: node e2e/story.mjs  (own dev server on port 5349; E2E_PORT=… to use another)
import { chromium } from 'playwright-core'
import { skipFirstDay, startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = Number(process.env.E2E_PORT) || 5349, OUT = 'e2e-shots/story'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const story = JSON.parse(readFileSync('content/story/moments.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const payslip = JSON.parse(readFileSync('content/tuning/payslip.json', 'utf8'))
const L = en.story.lines
const W = en.story.whispers
const xpToNext = (rank) => prog.xpBase + prog.xpPerRank * rank
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += xpToNext(r); return xp }
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error(`dev server stopped (port ${PORT} busy?)`)))
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

// a fresh device with this much XP, on the console (the first day had; ?story on)
async function device(totalXp, { width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await skipFirstDay(page)
  await page.goto(`http://localhost:${PORT}/?seed=7&story`)
  await page.evaluate((xp) => localStorage.setItem('goops-progress', JSON.stringify({ v: 2, totalXp: xp, scrapsSpent: 0, owned: {}, equipped: [] })), totalXp)
  await page.reload()
  await page.locator('.kit-art-stage').waitFor()
  await page.waitForTimeout(800)
  return { page, errors, close: () => context.close() }
}
// …at the start of this rank, with every older moment seen (as a player who had them), so only this rank's is due
async function deviceAt(rank, size) {
  const d = await device(xpFor(rank) + 10, size)
  await d.page.evaluate((r) => window.__goopsSeen?.(Array.from({ length: r }, (_, i) => `story:${i}`)), rank)
  await d.page.reload(); await d.page.locator('.kit-art-stage').waitFor(); await d.page.waitForTimeout(800)
  return d
}
const monitorSays = (page) => page.locator('[data-tag="crt"] .crt-read').textContent()
const monitorLook = (page) => page.locator('[data-tag="crt"]').getAttribute('data-story-look')
const periscopeOff = (page) => page.locator('.kit-pull-grip').first().isDisabled()
const typeMs = (words) => words.length / 22 * 1000 // (talk.json typeSpeed 22 letters a second)
// play the moment that's up, line by line, checking each line's voice and look; returns what was seen per line
async function playMoment(page, rank, shot) {
  const seen = []
  for (const [i, line] of story.moments[String(rank)].lines.entries()) {
    const words = L[line.words]
    if (line.voice === 'mon') {
      await page.locator('[data-tag="crt"]').getByRole('button', { name: en.lessons.gotIt }).waitFor({ timeout: 4000 })
      seen.push(['mon', (await monitorSays(page)).trim() === words, (await monitorLook(page)) === (line.monitor ?? null)])
      if (shot && i === story.moments[String(rank)].lines.length - 1) await page.screenshot({ path: `${OUT}/${shot}.png` })
      await page.waitForTimeout(200)
      await page.locator('[data-tag="crt"]').getByRole('button', { name: en.lessons.gotIt }).click()
    } else {
      const b = page.locator('.kit-talk').first()
      await b.waitFor({ timeout: 4000 })
      const look = await monitorLook(page)
      const said = (await b.textContent()).includes(words.slice(0, 12))
      if (line.cut) {
        // cut off: once typed out it goes by itself after looks.cutSeconds — no tap
        if (shot && i === 0) { await page.waitForTimeout(typeMs(words) * 0.6); await page.screenshot({ path: `${OUT}/${shot}-cut.png` }) }
        const gone = await page.waitForFunction((w) => ![...document.querySelectorAll('.kit-talk')].some((t) => t.textContent.includes(w)),
          words.slice(0, 12), { timeout: typeMs(words) + story.looks.cutSeconds * 1000 + 4000 }).then(() => true, () => false)
        seen.push(['spk cut', said && gone, look === (line.monitor ?? null)])
      } else {
        await page.waitForTimeout(typeMs(words) + 2000) // (it types out, rests at the static)
        if (shot && i === 0) await page.screenshot({ path: `${OUT}/${shot}.png` })
        seen.push(['spk', said, look === (line.monitor ?? null)])
        await b.click()
      }
    }
    await page.waitForTimeout(400)
  }
  return seen
}
// end the running shift at once (the engine runs on), then the report
async function endShift(page) {
  await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
  await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(500 + 10 * payslip.lineMs)
}
// the end report's row labels, in order
const reportLabels = async (page) => (await page.locator('.kit-end .kit-stat-row').allInnerTexts()).map((t) => t.split('\n').map((s) => s.trim()).filter(Boolean)[0])
const allSeen = (page, more = []) => page.evaluate((m) => window.__goopsSeen?.(Array.from({ length: 51 }, (_, i) => `story:${i}`).concat(m)), more)

try {
  // ---------------- every rank 0–30: its moment, in its voice, with its look, once ----------------
  // (STORY_FROM=31 skips this part while working on the rest)
  for (let rank = Number(process.env.STORY_FROM ?? 0); rank <= 30; rank++) {
    const { page, errors, close } = await deviceAt(rank)
    check(`rank ${rank}: the periscope waits while the moment plays`, await periscopeOff(page))
    const seen = await playMoment(page, rank, `rank${rank}-390x844`)
    check(`rank ${rank}: every line in its voice, with its words and monitor look`, seen.length && seen.every(([, ok, look]) => ok && look), JSON.stringify(seen))
    await page.waitForTimeout(600)
    const after = (await monitorSays(page)).trim()
    // (rank 5+ on a fresh device: upgrading's unlock lesson hasn't been seen yet, so it follows the moment)
    if (rank >= 5) check(`rank ${rank}: the upgrades lesson comes right after the moment`, after === en.lessons['unlock-upgrades'].upgrades, after)
    else check(`rank ${rank}: then the console's own words`, after === en.console.hint, after)
    check(`rank ${rank}: the monitor look is gone after the moment`, (await monitorLook(page)) === null)
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await page.waitForTimeout(1200)
    const again = (await monitorSays(page)).trim()
    check(`rank ${rank}: once only — after a reload no moment`, !Object.values(L).includes(again) && !(await page.locator('.kit-talk').count()), again)
    check(`rank ${rank}: no page errors`, errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- two unseen at once: the newest catchUp, oldest first ----------------
  {
    const { page, close } = await device(xpFor(4) + 10)
    await page.evaluate(() => window.__goopsSeen?.(['story:0', 'story:1', 'story:2']))
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await page.waitForTimeout(800)
    const first = (await monitorSays(page)).trim()
    check('two due (3 and 4): rank 3 first', first === L.r3a, first)
    await playMoment(page, 3)
    const second = (await monitorSays(page)).trim()
    check('… then rank 4', second === L.r4a, second)
    await close()
  }

  // ---------------- Settings → Replay lessons plays them again (rank 30: 29, then the capture) ----------------
  {
    const { page, errors, close } = await deviceAt(30)
    await playMoment(page, 30)
    await page.evaluate(() => window.__goopsSeen?.(['lesson:unlock-upgrades']))
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await page.waitForTimeout(1000)
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.waitForTimeout(1200)
    // (a phone-width Settings shows its tabs as a carousel: the other tabs are there but out of view)
    await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.trim() === 'Gameplay')?.click())
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Replay lessons' }).click()
    await page.locator('.kit-ask').getByRole('button', { name: 'Replay lessons' }).click({ timeout: 3000 })
    for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('.kit-layer') !== null); i++) { await page.keyboard.press('Escape'); await sleep(300) }
    const first = await page.waitForFunction((w) => [...document.querySelectorAll('.kit-talk')].some((t) => t.textContent.includes(w)), L.r29.slice(0, 12), { timeout: 6000 }).then(() => true, () => false)
    check('Replay lessons at rank 30: rank 29\'s moment plays again first', first)
    const seen29 = await playMoment(page, 29)
    const seen30 = await playMoment(page, 30, 'replay-rank30-390x844')
    check('… then the capture again (cut off, then the alarm)', [...seen29, ...seen30].every(([, ok, look]) => ok && look), JSON.stringify([...seen29, ...seen30]))
    check('Replay: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- the capture (30) and a Veteran line (20) at every portrait size ----------------
  for (const [w, h] of SIZES) {
    const { page, errors, close } = await deviceAt(30, { width: w, height: h })
    await playMoment(page, 30, `capture-${w}x${h}`)
    const v = await deviceAt(20, { width: w, height: h })
    await v.page.waitForTimeout(typeMs(L.r20) + 2000)
    await v.page.screenshot({ path: `${OUT}/rank20-${w}x${h}.png` })
    const inside = await v.page.locator('.kit-talk').first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 }).catch(() => false)
    check(`${w}x${h}: the Veteran's bubble is on screen (rank 20)`, inside)
    // F35 S9: a light bubble with dark words (content/tuning/talk.json colours, UI kit 0.33 TalkingBubble colours)
    const paint = await v.page.locator('.kit-talk').first().evaluate((el) => {
      const shape = el.querySelector('.kit-talk-shape')
      return { fill: shape && getComputedStyle(shape).fill, outline: shape && getComputedStyle(shape).stroke, ink: getComputedStyle(el).color }
    }).catch(() => null)
    check(`${w}x${h}: the bubble is light (#f4f4f2) with dark words (#222) and a grey outline (#555)`,
      paint?.fill === 'rgb(244, 244, 242)' && paint?.ink === 'rgb(34, 34, 34)' && paint?.outline === 'rgb(85, 85, 85)', JSON.stringify(paint))
    check(`${w}x${h}: no page errors`, errors.length === 0 && v.errors.length === 0, [...errors, ...v.errors].join(' | '))
    await v.close()
    await close()
  }

  // ---------------- a payday that reaches a new title says it ----------------
  {
    const { page, close } = await device(xpFor(5) - 50)
    await allSeen(page)
    await page.reload(); await page.locator('.kit-art-stage').waitFor()
    await startShift(page)
    await endShift(page)
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: en.payslip.paydayTitle }).waitFor({ timeout: 3000 })
    await page.waitForTimeout(500 + 10 * payslip.lineMs)
    const card = await page.locator('.kit-modal').innerText()
    check('payday to rank 5: "New title: Tank Associate"', card.includes(en.story.titles.associate), card.replace(/\n/g, ' | '))
    check('payday before the capture: the usual words', card.includes(en.payslip.debt) && !card.includes(en.payslip.afterCaught.debt))
    await page.screenshot({ path: `${OUT}/payday-new-title-390x844.png` })
    await close()
  }

  // ---------------- F40 fines: the first report at 30 fines YOU for knowing him, once; paydays from 30 change words ----------------
  {
    const { page, errors, close } = await device(xpFor(payslip.caughtRank + 1) - 50)
    await allSeen(page, ['lesson:unlock-upgrades'])
    await page.reload(); await page.locator('.kit-art-stage').waitFor()
    await startShift(page)
    await endShift(page)
    const labels = await reportLabels(page)
    check(`rank ${payslip.caughtRank} report: "${en.payslip.fines.association}" is the first fine (right after Gross pay)`,
      labels.indexOf(en.payslip.fines.association) === labels.indexOf(en.payslip.gross) + 1, labels.join(' | '))
    await page.screenshot({ path: `${OUT}/fine-association-390x844.png` })
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: en.payslip.paydayTitle }).waitFor({ timeout: 3000 })
    await page.waitForTimeout(500 + 10 * payslip.lineMs)
    const card = await page.locator('.kit-modal').innerText()
    const message = en.payslip.afterCaught.paydayMessage.split('{due}')[1].trim().slice(0, 30)
    check(`payday from ${payslip.caughtRank}: the after-capture words`, card.includes(message) && card.includes(en.payslip.afterCaught.debt), card.replace(/\n/g, ' | '))
    await page.screenshot({ path: `${OUT}/payday-after-capture-390x844.png` })
    await page.getByRole('button', { name: en.payslip.pay }).click()
    await page.getByRole('button', { name: 'Start shift' }).waitFor({ timeout: 6000 })
    await page.waitForTimeout(1500)
    await startShift(page)
    await endShift(page)
    const next = await reportLabels(page)
    check('the next report: no association fine (once only)', next.includes(en.payslip.gross) && !next.includes(en.payslip.fines.association), next.join(' | '))
    check('fines: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- in-shift whispers by stage; Management's "no voices" from 12 ----------------
  const stage = (from) => story.whispers.stages.find((s) => s.from === from).say.map((k) => W[k])
  for (const [rank, want, again, denies] of [
    [3, [W.cold], false, false],
    [8, stage(8), true, false],
    [12, stage(8), true, true],
    [15, stage(15), true, true],
    [24, stage(24), true, true],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await skipFirstDay(page)
    for (let shift = 1; shift <= 2; shift++) {
      await page.goto(`http://localhost:${PORT}/?seed=7&story&rank=${rank}&whisperAt=1`)
      await allSeen(page, ['lesson:unlock-upgrades'])
      await page.reload(); await page.locator('.kit-art-stage').waitFor()
      await startShift(page)
      await page.waitForTimeout(1000 + 1500)
      const said = await page.locator('.kit-talk').allInnerTexts()
      if (shift === 1) {
        await page.screenshot({ path: `${OUT}/whisper-rank${rank}-390x844.png` })
        check(`rank ${rank}: a whisper from its stage in the shift`, said.length > 0 && said.every((t) => want.some((w) => t.includes(w))), JSON.stringify(said))
        // Management answers it once it goes (showSeconds + noVoicesDelaySeconds after it shows)
        const wait = (story.whispers.showSeconds + story.whispers.noVoicesDelaySeconds) * 1000 + 1500
        const denied = await page.waitForFunction((t) => [...document.querySelectorAll('.kit-toast')].some((el) => el.textContent.includes(t)), L.noVoices, { timeout: wait })
          .then(() => true, () => false)
        if (denied) await page.screenshot({ path: `${OUT}/no-voices-rank${rank}-390x844.png` })
        check(`rank ${rank}: Management ${denies ? 'says' : 'does not say'} "there are no voices"`, denied === denies)
      } else check(`rank ${rank}: the next shift ${again ? 'whispers again' : 'stays quiet ("cold" was once)'}`, said.length > 0 === again, JSON.stringify(said))
    }
    check(`rank ${rank} whispers: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ---------------- "no voices" at every portrait size (looked at by hand) ----------------
  for (const [w, h] of SIZES) {
    const context = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await context.newPage()
    await skipFirstDay(page)
    await page.goto(`http://localhost:${PORT}/?seed=7&story&rank=24&whisperAt=1`)
    await allSeen(page, ['lesson:unlock-upgrades'])
    await page.reload(); await page.locator('.kit-art-stage').waitFor()
    await startShift(page)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/whisper-name-${w}x${h}.png` })
    const ok = await page.waitForFunction((t) => [...document.querySelectorAll('.kit-toast')].some((el) => el.textContent.includes(t)), L.noVoices, { timeout: 8000 }).then(() => true, () => false)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/no-voices-${w}x${h}.png` })
    const inside = await page.evaluate((t) => {
      const el = [...document.querySelectorAll('.kit-toast')].find((e) => e.textContent.includes(t))
      const r = el?.getBoundingClientRect()
      return !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5
    }, L.noVoices)
    check(`${w}x${h}: "no voices" shows, on screen`, ok && inside)
    await context.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS')
process.exit(failed ? 1 : 0)
