// F35 — STORY MOMENTS, ranks 0–9 (design/story.md "Story moments, rank by rank"; data content/story/moments.json,
// words content/text/en.json story), in Playwright's own Chromium (never the user's Chrome). Portrait only (Goops
// never plays sideways): 390x844, 360x780, 1100x900, 1440x900, 1920x1080. ?story turns the moments on (scripted checks
// keep them quiet otherwise — src/game/lessons/storyMoments.ts).
//   every rank 0–9 on a fresh device: its moment plays at the console — Management's lines type on the monitor (Got it
//     moves on), the Veteran's line is the talking bubble at the monitor (a tap moves on); the periscope waits for it
//   once only: after it, a reload shows the console's own words; rank 5's upgrades lesson comes right after its moment
//   two rank-ups at once (a fresh device at rank 9): the newest catchUp moments, oldest first
//   Settings → Replay lessons plays it again
//   titles: a payday that reaches a new title says it
// Screenshots: e2e-shots/story/
// Run: node e2e/story.mjs  (own dev server on port 5349)
import { chromium } from 'playwright-core'
import { skipFirstDay, startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 5349, OUT = 'e2e-shots/story'
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const story = JSON.parse(readFileSync('content/story/moments.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const L = en.story.lines
const xpToNext = (rank) => prog.xpBase + prog.xpPerRank * rank
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += xpToNext(r); return xp }
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
const monitorSays = (page) => page.locator('[data-tag="crt"] .crt-read').textContent()
const periscopeOff = (page) => page.locator('.kit-pull-grip').first().isDisabled()
// play the moment that's up, line by line, checking each line's voice; returns the lines seen
async function playMoment(page, rank, shot) {
  const seen = []
  for (const [i, line] of story.moments[String(rank)].lines.entries()) {
    const words = L[line.words]
    if (line.voice === 'mon') {
      await page.locator('[data-tag="crt"]').getByRole('button', { name: en.lessons.gotIt }).waitFor({ timeout: 4000 })
      seen.push(['mon', (await monitorSays(page)).trim() === words])
      if (shot && i === 0) await page.screenshot({ path: `${OUT}/${shot}.png` })
      await page.waitForTimeout(200)
      await page.locator('[data-tag="crt"]').getByRole('button', { name: en.lessons.gotIt }).click()
    } else {
      const b = page.locator('.kit-talk').first()
      await b.waitFor({ timeout: 4000 })
      await page.waitForTimeout(words.length / 22 * 1000 + 2000) // (it types out, rests at the static)
      if (shot && i === 0) await page.screenshot({ path: `${OUT}/${shot}.png` })
      seen.push(['spk', (await b.textContent()).includes(words.slice(0, 12))])
      await b.click()
    }
    await page.waitForTimeout(400)
  }
  return seen
}

try {
  // ---------------- every rank 0–9: its moment, in its voice, once ----------------
  for (let rank = 0; rank <= 9; rank++) {
    const { page, errors, close } = await device(xpFor(rank) + 10)
    // (a fresh device at rank N has every moment up to N unseen: mark the older ones seen, as a player who had them)
    await page.evaluate((r) => window.__goopsSeen?.(Array.from({ length: r }, (_, i) => `story:${i}`)), rank)
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await page.waitForTimeout(800)
    check(`rank ${rank}: the periscope waits while the moment plays`, await periscopeOff(page))
    const seen = await playMoment(page, rank, `rank${rank}-390x844`)
    check(`rank ${rank}: every line in its voice with its words`, seen.length && seen.every(([, ok]) => ok), JSON.stringify(seen))
    await page.waitForTimeout(600)
    const after = (await monitorSays(page)).trim()
    // (rank 5+ on a fresh device: upgrading's unlock lesson hasn't been seen yet, so it follows the moment)
    if (rank >= 5) check(`rank ${rank}: the upgrades lesson comes right after the moment`, after === en.lessons['unlock-upgrades'].upgrades, after)
    else check(`rank ${rank}: then the console's own words`, after === en.console.hint, after)
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

  // ---------------- a payday that reaches a new title says it ----------------
  {
    const { page, close } = await device(xpFor(5) - 50)
    await page.evaluate(() => window.__goopsSeen?.(Array.from({ length: 10 }, (_, i) => `story:${i}`)))
    await page.reload(); await page.locator('.kit-art-stage').waitFor()
    await startShift(page)
    await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 60 && e.state.status === 'playing'; i++) e.tick(600000) })
    await page.getByRole('heading', { name: /Shift (complete|failed)/ }).waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('heading', { name: en.payslip.paydayTitle }).waitFor({ timeout: 3000 })
    await page.waitForTimeout(500 + 10 * 450)
    const card = await page.locator('.kit-modal').innerText()
    check('payday to rank 5: "New title: Tank Associate"', card.includes(en.story.titles.associate), card.replace(/\n/g, ' | '))
    await page.screenshot({ path: `${OUT}/payday-new-title-390x844.png` })
    await close()
  }

  // ---------------- in-shift whispers: "…cold…" once at rank 3, a feeling every shift from 8 ----------------
  for (const [rank, want, again] of [[3, [en.story.whispers.cold], false], [8, Object.values(en.story.whispers), true]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await skipFirstDay(page)
    for (let shift = 1; shift <= 2; shift++) {
      await page.goto(`http://localhost:${PORT}/?seed=7&story&rank=${rank}&whisperAt=1`)
      await page.evaluate(() => window.__goopsSeen?.(Array.from({ length: 51 }, (_, i) => `story:${i}`).concat(['lesson:unlock-upgrades'])))
      await page.reload(); await page.locator('.kit-art-stage').waitFor()
      await startShift(page)
      await page.waitForTimeout(1000 + 1500)
      const said = await page.locator('.kit-talk').allInnerTexts()
      if (shift === 1) {
        await page.screenshot({ path: `${OUT}/whisper-rank${rank}-390x844.png` })
        check(`rank ${rank}: a whisper in the shift`, said.some((t) => want.some((w) => t.includes(w))), JSON.stringify(said))
      } else check(`rank ${rank}: the next shift ${again ? 'whispers again' : 'stays quiet ("cold" was once)'}`, said.length > 0 === again, JSON.stringify(said))
    }
    await context.close()
  }

  // ---------------- the Veteran's bubble at every portrait size (looked at by hand) ----------------
  for (const [w, h] of [[360, 780], [1100, 900], [1440, 900], [1920, 1080]]) {
    const { page, errors, close } = await device(xpFor(5) + 10, { width: w, height: h })
    await page.evaluate(() => window.__goopsSeen?.(['story:0', 'story:1', 'story:2', 'story:3', 'story:4']))
    await page.reload(); await page.locator('.kit-art-stage').waitFor(); await page.waitForTimeout(800)
    await page.waitForTimeout(L.r5.length / 22 * 1000 + 2000)
    await page.screenshot({ path: `${OUT}/rank5-${w}x${h}.png` })
    const inside = await page.locator('.kit-talk').first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 }).catch(() => false)
    check(`${w}x${h}: the Veteran's bubble is on screen`, inside)
    check(`${w}x${h}: no page errors`, errors.length === 0, errors.join(' | '))
    await close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS')
process.exit(failed ? 1 : 0)
