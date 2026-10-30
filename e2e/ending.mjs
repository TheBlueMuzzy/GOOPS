// F65 THE ENDING + THE NEW CAREER (design/story.md "The ending — save the goop", "Rank titles"; TDD D28), in Playwright's
// own Chromium. Portrait sizes only (Goops never plays sideways): 390x844, 360x780, 1100x1300, 1440x900, 1920x1080.
// At every size:
//   the final shift won (its three valve stages forced through the engine's own countValve + openValveStage — the valve
//   panel itself is e2e/final-shift.mjs) with the Veteran still in the tank (F75) → every ending step in order with its
//   words: the goop pours out and fills the view, his white clump rising in it → the goop speaks through its mouths
//   (thank you, its names, the more, your name — every face's mouth open) → F75 the happy ending: he speaks out loud
//   from his clump ("you did it, kid." · Earth and his family), his bubble in the window, clear of his clump →
//   the console slides up (no speaker line, no quiet: he said it in person) → the last payday ("0 cr — paid by: 1,312
//   former employees") → the monitor glitches, the goop crosses out your title and writes The Savior of Goopkind +
//   GRADUAL ONBOARDING OF PERMANENT STAFF → the goop carries you out → the empty console (no Upgrades, no gear, the
//   periscope still, the monitor blank) → the end-game screen (Muzzy's art: every word inside its box with room) → Begin
//   a new career → rank 0, careers 1, no badge (Former Employee), the gold-trimmed console + periscope, the first day
//   NOT played, the monitor's "WELCOME BA—" slip, your title, the sign-in asked again (a new name signed), then a real
//   rank-0 shift — not the first day's — played with real keys.
// Once (390): lose the final shift → "New title: One Of Us" on the report and the badge saved; Try again → win with the
//   Veteran worn out (F75: today's ending — the speaker's last clear line, then quiet) → the badge rewrite crosses out One
//   Of Us, and The Savior of Goopkind replaces it · F75 today's ending (he's gone) at 1440x900 too, shots looked at · a page opened mid-ending (after the
//   win) goes straight to the end-game screen · RANK SELECT still works after a new career (rank 7, careers + gold kept).
// A page-error watch the whole way. Waits: the ending's own steps (looks clock) with roomy ceilings — never a tight
// wall-clock wait. Shots: e2e-shots/ending/ (<step>-<size>; every step at 390 + 1440, the end screen + gold console at all).
// Run: node e2e/ending.mjs  (own dev server on port 6480; ENDING_PART=sizes|lose|gone|resume|rankselect runs one part)
import { chromium } from 'playwright-core'
import { checkVersion } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 6480
const SHOTS = 'e2e-shots/ending'
const SIZES = [[390, 844], [360, 780], [1100, 1300], [1440, 900], [1920, 1080]]
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const endingJson = JSON.parse(readFileSync('content/tuning/ending.json', 'utf8'))
const art = JSON.parse(readFileSync('content/ui/art.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const E = en.ending, T = en.story.titles
const part = (name) => !process.env.ENDING_PART || process.env.ENDING_PART === name
mkdirSync(SHOTS, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }
// everything a player who reached rank 50 has had (lessons, notes, every story moment)
const SEEN = ['lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades', 'lesson:visor', 'lesson:laser',
  'lesson:controls', 'consoleNote:1', 'consoleNote:2', 'consoleNote:3', 'consoleNote:4', 'consoleNote:5', 'whisper:cold', 'look:mouths-open',
  ...Array.from({ length: 51 }, (_, i) => `story:${i}`)]
let xp50 = 0
for (let r = 0; r < 50; r++) xp50 += prog.xpBase + prog.xpPerRank * r
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
const goopSays = (key, name) => fill(E.goop[key], { name: name ?? en.story.sign.fallback, more: (endingJson.paidBy - endingJson.named).toLocaleString('en') })
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress') ?? 'null'))
// (the ending runs on the looks clock, which slows with the frame rate: under check:full load at 1920 a few seconds of
// pour took over 20 s of wall time — the waits are conditions, so a roomy cap costs nothing when the PC isn't busy)
const roomy = { timeout: 60000 }

// a device at the start of rank 50, signed "Muzzy", every lesson + story moment had (badge: an end title already on it)
async function open(w, h, { badge = null, careers = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?seed=7`)
  await page.evaluate(([xp, seen, badge, careers]) => {
    localStorage.setItem('goops-progress', JSON.stringify({ v: 4, totalXp: xp, scrapsSpent: 0, owned: {}, equipped: [], badge, name: 'Muzzy', careers }))
    window.__goopsSeen?.(seen)
  }, [xp50, SEEN, badge, careers])
  // (?story: the story moments are on — the new career's rank-0 sign-in is one)
  await page.goto(`http://localhost:${PORT}/?seed=7&story`)
  await checkVersion(page)
  return { page, errors, close: () => context.close() }
}
async function startFinal(page) {
  await page.getByRole('button', { name: 'Start shift' }).click()
  await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 8000 })
  await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing' && !!window.__goops.engine.state.final)
  // his drop-in played out on the engine's own clock; the machines don't wear down
  await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 2000 && e.state.final.intro; i++) e.tick(50); e.machines.tick = () => {} })
}
// the three valve stages, each filled and opened through the engine (the panel is final-shift.mjs's)
const winFinal = (page) => page.evaluate(() => {
  const e = window.__goops.engine
  // (watch for the opening shake from before the win: it lasts a couple of looks-clock seconds, and under check:full load
  // at 1920 it was over before the check looked — window.__endingShook remembers it happened)
  window.__endingShook = false
  new MutationObserver(() => { if ('endingShake' in document.body.dataset) window.__endingShook = true })
    .observe(document.body, { attributes: true, attributeFilter: ['data-ending-shake'] })
  for (let s = 0; s < 3; s++) { e.countValve(e.state.final.need); e.tick(16); e.openValveStage() }
})
// F75: the tank's damage wears the Veteran out (the engine's own wear, a whole tank's worth × plenty) — he's gone
const wearOut = (page) => page.evaluate(() => { const e = window.__goops.engine; e.wearVet(1e6); return !e.state.vet && e.state.final.vetAlive === false })
// a talking bubble: its whole line showing (typed out), then a tap moves on
const bubble = (page) => page.locator('.kit-talk[data-confirm]')
async function bubbleLine(page) {
  await bubble(page).waitFor(roomy)
  await page.waitForFunction(() => document.querySelector('.kit-talk[data-confirm]')?.getAttribute('data-phase') === 'wait', null, roomy).catch(() => {})
  return (await bubble(page).innerText()).replace('▼', '').replace(/\s+/g, ' ').trim() // (▼ = the bubble's "more" mark)
}
async function tapBubble(page) {
  const before = await bubble(page).innerText().catch(() => '')
  await bubble(page).click()
  // (gone, or the next line)
  await page.waitForFunction((b) => { const el = document.querySelector('.kit-talk[data-confirm]'); return !el || el.innerText !== b }, before, roomy).catch(() => {})
}
// a box inside the window, with room (px) from every edge
const inWindow = (page, sel) => page.evaluate((sel) => {
  const r = document.querySelector(sel)?.getBoundingClientRect()
  return !!r && r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5
}, sel)

// The end-game screen: every word inside its box (the stat boxes measured to their art, the rest inside the screen's dark
// glass), with room on every side; the button inside the glass too
const END_SCENE = '.kit-art-scene:has([data-tag="end-title"])' // (the console's scene is under it)
const endRoom = (page, artW, boxes, glass) => page.evaluate(([artW, boxes, glass, END_SCENE]) => {
  const scene = document.querySelector(END_SCENE).getBoundingClientRect()
  const u = scene.width / artW
  const toPx = ([x, y, w, h]) => ({ left: scene.left + x * u, top: scene.top + y * u, right: scene.left + (x + w) * u, bottom: scene.top + (y + h) * u })
  const textBox = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
  const layers = [...document.querySelectorAll(`${END_SCENE} .kit-art-layer[data-text]`)].filter((el) => el.textContent.trim())
  const glassPx = toPx(glass), boxPx = boxes.map(toPx)
  let least = Infinity, worst = ''
  for (const el of layers) {
    const t = textBox(el)
    const inBox = boxPx.find((b) => t.left >= b.left - 1 && t.right <= b.right + 1 && t.top >= b.top - 1 && t.bottom <= b.bottom + 1)
    const c = inBox ?? glassPx
    const room = Math.min(t.left - c.left, c.right - t.right, t.top - c.top, c.bottom - t.bottom)
    if (room < least) { least = room; worst = el.textContent.trim() }
  }
  const btn = document.querySelector('[data-tag="new-career"]').getBoundingClientRect()
  const btnRoom = Math.min(btn.left - glassPx.left, glassPx.right - btn.right, btn.top - glassPx.top, glassPx.bottom - btn.bottom)
  // the words never overlap each other
  let overlap = ''
  for (let i = 0; i < layers.length; i++) for (let j = i + 1; j < layers.length; j++) {
    const a = textBox(layers[i]), b = textBox(layers[j])
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap = `${layers[i].textContent} × ${layers[j].textContent}`
  }
  return { least: Math.round(least * 10) / 10, worst, btnRoom: Math.round(btnRoom * 10) / 10, overlap, onScreen: scene.top >= -1 && scene.bottom <= innerHeight + 1 }
}, [artW, boxes, glass, END_SCENE])

// THE WHOLE ENDING, from the win to the end-game screen; returns the order of steps seen. saved (F75) = he made it:
// the happy ending (his clump in the goop, his lines out loud, no speaker line + quiet)
async function playEnding(page, size, { shots, oldTitle, name = 'Muzzy', saved = false }) {
  const seen = []
  const shot = async (step) => { if (shots) await page.screenshot({ path: `${SHOTS}/${step}-${size}.png` }) }
  // 1. the tank opens: the view shakes, the goop pours out and fills the view
  const poured = await page.locator('[data-tag="ending-goop"][data-kind="pour"]').waitFor(roomy).then(() => true, () => false)
  const shook = await page.evaluate(() => window.__endingShook || 'endingShake' in document.body.dataset)
  if (shots) { await page.waitForTimeout(1600); await shot('1-pour') }
  const filled = await page.waitForFunction(() => { const r = document.querySelector('.ending-goop')?.getBoundingClientRect(); return !!r && r.top <= 1 }, null, roomy)
    .then(() => true, () => false)
  const goopAt = await page.evaluate(() => { const g = document.querySelector('.ending-goop'), r = g?.getBoundingClientRect()
    return r ? { top: Math.round(r.top), flood: Math.round(g.parentElement.getBoundingClientRect().top), anim: getComputedStyle(g).animationPlayState, paused: g.parentElement.dataset.paused ?? null } : null })
  check(`${size}: the tank opens — it shakes, the goop pours out and fills the whole view`, poured && shook && filled, JSON.stringify({ poured, shook, filled, goopAt }))
  if (poured) seen.push('pour')
  // F75: his white clump rides up in the goop (saved) — or isn't there (he's gone)
  const clump = await page.evaluate(() => { const v = document.querySelector('[data-tag="ending-vet"]'), r = v?.getBoundingClientRect()
    return r ? { inGoop: !!v.closest('.ending-goop'), w: Math.round(r.width), inWin: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight } : null })
  check(`${size}: ${saved ? 'his white clump rose with the goop and sits in the window' : 'no white clump in the goop (he\'s gone)'}`,
    saved ? !!clump && clump.inGoop && clump.w > 10 && clump.inWin : clump === null, JSON.stringify(clump))
  // 2. the goop speaks through its mouths: every line in order, every face's mouth open, the bubble from a face, in the window
  const lines = []
  for (const key of endingJson.goopLines) {
    const said = await bubbleLine(page)
    lines.push(said === goopSays(key, name))
    if (key === endingJson.goopLines[0]) {
      const faces = await page.evaluate(() => [...document.querySelectorAll('.ending-mouth')].map((m) => m.getBoundingClientRect().height))
      check(`${size}: ${endingJson.mouths.spots.length} faces in the goop, every mouth open at once`, faces.length === endingJson.mouths.spots.length && faces.every((hgt) => hgt > 4), JSON.stringify(faces.map(Math.round)))
      check(`${size}: the goop's bubble is inside the window`, await inWindow(page, '.kit-talk[data-confirm]'))
      await shot('2-goop-speaks')
    }
    await tapBubble(page)
  }
  check(`${size}: the goop says thank you + its names, in order (${endingJson.goopLines.join(', ')})`, lines.every(Boolean), JSON.stringify(lines))
  if (lines.every(Boolean)) seen.push('goop')
  if (saved) {
    // 3 (F75 the happy ending): still in the tank, he says his lines out loud from his clump — his final-shift bubble
    const said = []
    for (const key of endingJson.vetLines) {
      const line = await bubbleLine(page)
      said.push(line === E.vetSaved[key])
      const room = await page.evaluate(() => {
        const b = document.querySelector('.kit-talk[data-confirm]')?.getBoundingClientRect(), v = document.querySelector('[data-tag="ending-vet"]')?.getBoundingClientRect()
        if (!b || !v) return null
        const inWin = b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5
        const clear = b.bottom <= v.top + 1 || b.top >= v.bottom - 1 || b.right <= v.left + 1 || b.left >= v.right - 1 // (never over his clump)
        return { inWin, clear, tank: !document.querySelector('.kit-art-stage') }
      })
      check(`${size}: his line out loud "${E.vetSaved[key]}" — in the window, clear of his clump, still in the tank`, line === E.vetSaved[key] && !!room && room.inWin && room.clear && room.tank, JSON.stringify({ line, room }))
      await shot(`3-vet-saved-${key}`)
      await tapBubble(page)
    }
    if (said.every(Boolean)) seen.push('vetSays')
    await page.locator('.kit-art-stage').waitFor(roomy)
  } else {
    // 3. the console slides up over the tank: the Veteran's last clear line
    await page.locator('.kit-art-stage').waitFor(roomy)
    const vet = await bubbleLine(page)
    check(`${size}: at the console, his last line, clear: "${E.vet}"`, vet === E.vet, vet)
    check(`${size}: his bubble is inside the window`, await inWindow(page, '.kit-talk[data-confirm]'))
    await shot('3-vet')
    if (vet === E.vet) seen.push('vet')
    await tapBubble(page)
  }
  // …then the speaker quiet (no bubble), and the last payday (F75 saved: no speaker line, so straight to the payday)
  const quiet = await page.locator('.kit-talk').count() === 0
  const payday = await page.getByRole('heading', { name: E.payday.title }).waitFor(roomy).then(() => true, () => false)
  await page.waitForTimeout(1200) // (its row reveals)
  const pay = payday ? (await page.locator('.kit-modal').innerText()).replace(/\s+/g, ' ') : ''
  const debt = fill(E.payday.debtValue, { n: endingJson.paidBy.toLocaleString('en') })
  check(`${size}: ${saved ? 'no speaker line' : 'the speaker goes quiet'}, then the last payday: "${en.payslip.debt}: ${debt}"`, quiet && payday && pay.includes(en.payslip.debt) && pay.includes(debt), pay.slice(0, 160))
  check(`${size}: the payday card is inside the window`, await inWindow(page, '.kit-modal'))
  await shot('4-payday')
  if (quiet && !saved) seen.push('quiet')
  if (payday) seen.push('payday')
  await page.getByRole('button', { name: E.payday.done }).click()
  // 4. the badge: the monitor glitches, your title crossed out, The Savior of Goopkind + the acronym written
  const badge = await page.locator('[data-tag="badge"]').waitFor(roomy).then(() => true, () => false)
  const glitch = await page.locator('[data-tag="crt"][data-story-look="glitch"]').count() === 1
  const old = badge ? (await page.locator('[data-tag="badge-old"]').innerText()).trim() : ''
  const struck = await page.locator('[data-tag="badge-old"][data-struck]').waitFor(roomy).then(() => true, () => false)
  const written = await page.getByRole('button', { name: E.badge.next }).waitFor(roomy).then(() => true, () => false)
  const crt = written ? (await page.locator('[data-tag="crt"] .crt-badge').innerText()).replace(/\s+/g, ' ') : ''
  check(`${size}: the monitor glitches; the goop crosses out "${T[oldTitle]}" and writes "${T.savior}" + "${E.badge.acronym}"`,
    badge && glitch && old.toUpperCase() === T[oldTitle].toUpperCase() && struck && crt.toUpperCase().includes(T.savior.toUpperCase())
      && crt.includes(E.badge.acronym) && crt.toUpperCase().includes(fill(E.badge.operator, { name }).toUpperCase()), crt.slice(0, 200))
  // (the badge's words inside the monitor's screen, nothing cut off)
  const badgeIn = await page.evaluate(() => {
    const screen = document.querySelector('[data-tag="crt"]').getBoundingClientRect()
    // (each line's own letters: a typed line's .crt-words, not its hidden screen-reader copy)
    const words = [...document.querySelectorAll('.crt-badge > *')].map((el) => el.querySelector('.crt-words') ?? el)
      .flatMap((el) => { const r = document.createRange(); r.selectNodeContents(el); return [...r.getClientRects()] })
    return words.length > 0 && words.every((r) => r.width === 0 || (r.left >= screen.left - 0.5 && r.right <= screen.right + 0.5))
  })
  check(`${size}: every badge line fits inside the monitor (wraps, never cut)`, badgeIn)
  await shot('5-badge')
  if (badge && struck) seen.push('badge')
  await page.getByRole('button', { name: E.badge.next }).click()
  // 5. you leave: the goop rises over the console and carries you out
  const carried = await page.locator('[data-tag="ending-goop"][data-kind="carry"]').waitFor(roomy).then(() => true, () => false)
  if (shots) { await page.waitForTimeout(endingJson.console.leaveSeconds * 500); await shot('6-leave') }
  check(`${size}: you leave — the goop carries you out`, carried)
  if (carried) seen.push('leave')
  // 6. the empty console: nothing on it but the console — no Upgrades, no gear, the periscope still, the monitor blank
  const empty = await page.locator('.ending-empty').waitFor(roomy).then(() => true, () => false)
  await page.waitForTimeout(400)
  const bare = await page.evaluate(() => ({
    upgrades: !!document.querySelector('[data-tag="upgrades"]'), monitor: document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() ?? '',
    periscope: !!document.querySelector('.kit-pull-grip:disabled'), flood: !!document.querySelector('[data-tag="ending-goop"]'), rankSelect: !!document.querySelector('[data-tag="rankSelect"]'),
  }))
  const gear = await page.getByRole('button', { name: en.console.settings }).count()
  check(`${size}: the empty console — no Upgrades, no gear, no RANK SELECT, the periscope still, the monitor blank, the goop gone`,
    empty && !bare.upgrades && gear === 0 && !bare.rankSelect && bare.periscope && bare.monitor === '' && !bare.flood, JSON.stringify({ ...bare, gear }))
  await shot('7-empty')
  if (empty) seen.push('empty')
  // 7. the end-game screen (by itself after console.emptySeconds)
  const end = await page.locator('[data-tag="end-title"]').waitFor({ timeout: (endingJson.console.emptySeconds + 15) * 1000 }).then(() => true, () => false)
  if (end) seen.push('endScreen')
  return seen
}

try {
  // ---------------- every portrait size: the win → the whole ending → the end-game screen → the new career ----------------
  if (part('sizes')) for (const [w, h] of SIZES) {
    const size = `${w}x${h}`
    const shots = w === 390 || w === 1440
    const { page, errors, close } = await open(w, h)
    await startFinal(page)
    const alive = await page.evaluate(() => !!window.__goops.engine.state.vet && window.__goops.engine.state.final.vetAlive)
    check(`${size}: the Veteran is in the tank at the win (F75: the happy ending)`, alive)
    await winFinal(page)
    const seen = await playEnding(page, size, { shots, oldTitle: 'deputy', saved: true })
    const order = ['pour', 'goop', 'vetSays', 'payday', 'badge', 'leave', 'empty', 'endScreen']
    check(`${size}: every ending step, in order`, JSON.stringify(seen) === JSON.stringify(order), seen.join(' → '))
    // the end-game screen: Muzzy's art + the words, each inside its box with room
    await page.waitForTimeout(600)
    const words = (await page.locator(END_SCENE).innerText()).replace(/\s+/g, ' ')
    const want = [E.endScreen.title, fill(E.endScreen.subtitleNamed, { name: 'Muzzy', title: T.savior }), E.endScreen.rank, '50', E.endScreen.freed,
      endingJson.paidBy.toLocaleString('en'), E.endScreen.careers, E.endScreen.stages, '3 / 3', E.endScreen.debt, E.endScreen.debtValue, E.endScreen.tanks, E.endScreen.speaker]
    const missing = want.filter((x) => !words.toUpperCase().includes(x.toUpperCase()))
    const artSrc = await page.locator(`${END_SCENE} img`).first().getAttribute('src')
    const g = art.endGame
    const room = await endRoom(page, g.size[0], g.words.boxes, [23.26, 60.46, 537.16, 825.87])
    check(`${size}: the end-game screen — Muzzy's EndGameScreen.svg with every word (careers 1)`, missing.length === 0 && artSrc.endsWith('art/EndGameScreen.svg')
      && /CAREERS DONE\s*1/i.test(words), missing.join(' | '))
    check(`${size}: every word inside its box with room (≥ 4 px), none overlapping; the button inside the glass; all on screen`,
      room.least >= 4 && !room.overlap && room.btnRoom >= 4 && room.onScreen, JSON.stringify(room))
    await page.screenshot({ path: `${SHOTS}/8-end-screen-${size}.png` })
    const won = await save(page)
    check(`${size}: the win saved — The Savior of Goopkind on the badge, one career done`, won.badge === 'savior' && won.careers === 1, JSON.stringify(won))

    // THE NEW CAREER
    await page.getByRole('button', { name: E.endScreen.newCareer }).click()
    await page.locator('[data-tag="end-title"]').waitFor({ state: 'detached', timeout: 8000 })
    const fresh = await save(page)
    check(`${size}: the new career — rank 0 (no XP, nothing bought), no badge = Former Employee, careers kept, the name kept until signed`,
      fresh.totalXp === 0 && fresh.scrapsSpent === 0 && Object.keys(fresh.owned).length === 0 && fresh.badge === null && fresh.careers === 1 && fresh.name === 'Muzzy', JSON.stringify(fresh))
    const gold = await page.evaluate(() => ({ stage: !!document.querySelector('.kit-art-stage.career-gold-console'),
      parts: document.querySelectorAll('.career-gold').length, filter: getComputedStyle(document.querySelector('.career-gold img')).filter }))
    check(`${size}: the console + periscope are gold-trimmed (${art.console.career.layers.join(', ')})`, gold.stage && gold.parts === art.console.career.layers.length && gold.filter.includes('drop-shadow'), JSON.stringify(gold))
    // the rank-0 moment: the slip, the welcome, your title, the sign-in (a new name), the last line — and no first day
    const slip = await page.waitForFunction((t) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === t, en.story.lines.r0back, { timeout: 8000 })
      .then(() => true, () => false)
    const welcome = await page.waitForFunction((t) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === t, en.story.lines.r0a, roomy).then(() => true, () => false)
    check(`${size}: the monitor slips — "${en.story.lines.r0back}" — then the usual welcome`, slip && welcome)
    await page.getByRole('button', { name: en.lessons.gotIt }).click()
    const former = await page.waitForFunction((t) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === t, en.story.lines.r0former, roomy).then(() => true, () => false)
    check(`${size}: your title on the monitor: Former Employee`, former && en.story.lines.r0former.toUpperCase().includes(T.formerEmployee.toUpperCase()))
    await page.screenshot({ path: `${SHOTS}/9-new-career-${size}.png` })
    await page.getByRole('button', { name: en.lessons.gotIt }).click()
    const box = page.locator('[data-tag="name"]')
    const asked = await box.waitFor(roomy).then(() => true, () => false)
    const kept = asked ? await box.inputValue() : ''
    check(`${size}: the sign-in is asked again (the name kept until you sign: "${kept}")`, asked && kept === 'Muzzy')
    await box.fill('Nova')
    await page.getByRole('button', { name: en.story.sign.sign }).click()
    await page.getByRole('button', { name: en.lessons.gotIt }).click({ timeout: 15000 }) // (r0b)
    const hint = await page.waitForFunction((t) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === t, en.console.hint, roomy).then(() => true, () => false)
    const afterSign = await save(page)
    const dayPlays = await page.evaluate(() => window.__goops?.lessonView?.().lessonId ?? null)
    check(`${size}: the new name is kept (Nova); no first day on the console — just "${en.console.hint}"`, hint && afterSign.name === 'Nova' && dayPlays !== 'first-day', JSON.stringify({ name: afterSign.name, dayPlays }))
    // a real rank-0 shift — not the first day's training shift — played with real keys, errors watched
    await page.getByRole('button', { name: 'Start shift' }).click()
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 8000 })
    const real = await page.waitForFunction(() => { const e = window.__goops?.engine; return e?.state.status === 'playing' && e.state.rank === 0 && !e.state.final }, null, roomy).then(() => true, () => false)
    const lesson = await page.evaluate(() => window.__goops.lessonView().lessonId)
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'Space'][i % 6])
      await page.waitForTimeout(120)
    }
    check(`${size}: a real rank-0 shift starts (no first-day lesson) and plays with real keys`, real && lesson !== 'first-day', String(lesson))
    check(`${size}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }

  // ---------------- lose → One Of Us on the badge; then a win replaces it ----------------
  if (part('lose')) {
    const { page, errors, close } = await open(390, 844)
    await startFinal(page)
    await page.evaluate(() => { const e = window.__goops.engine; e.state.integrity = 0; e.rupture('integrity') })
    const lost = await page.getByRole('heading', { name: en.end.final.lostTitle }).waitFor(roomy).then(() => true, () => false)
    await page.waitForTimeout(2500) // (the rows reveal one by one)
    const report = lost ? (await page.locator('.kit-end').innerText()).replace(/\s+/g, ' ') : ''
    const after = await save(page)
    check(`lose: the report says "${en.payslip.newTitle}: ${T.oneOfUs}" and the badge is saved`, report.includes(en.payslip.newTitle) && report.includes(T.oneOfUs) && after.badge === 'oneOfUs', report.slice(-160))
    await page.screenshot({ path: `${SHOTS}/lose-one-of-us-390x844.png` })
    // a second loss keeps it (no new title this time)
    await page.getByRole('button', { name: en.end.final.again }).click()
    await page.waitForFunction(() => { const s = window.__goops?.engine.state; return s?.status === 'playing' && s.final?.stage === 0 }, null, roomy)
    await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 2000 && e.state.final.intro; i++) e.tick(50); e.machines.tick = () => {}; e.state.integrity = 0; e.rupture('integrity') })
    await page.getByRole('heading', { name: en.end.final.lostTitle }).waitFor(roomy)
    await page.waitForTimeout(2500)
    const again = (await page.locator('.kit-end').innerText()).replace(/\s+/g, ' ')
    check('lose again: One Of Us stays (not said again as new)', !again.includes(en.payslip.newTitle) && (await save(page)).badge === 'oneOfUs')
    // then the win: the badge rewrite crosses out One Of Us
    await page.getByRole('button', { name: en.end.final.again }).click()
    await page.waitForFunction(() => { const s = window.__goops?.engine.state; return s?.status === 'playing' && s.final?.stage === 0 }, null, roomy)
    await page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 2000 && e.state.final.intro; i++) e.tick(50); e.machines.tick = () => {} })
    check('lose → win: the Veteran worn out first (F75) — he\'s gone, the shift plays on', await wearOut(page) && await page.evaluate(() => window.__goops.engine.state.status === 'playing'))
    await winFinal(page)
    const seen = await playEnding(page, 'lose→win 390x844', { shots: false, oldTitle: 'oneOfUs' })
    const won = await save(page)
    check('then a win: The Savior of Goopkind replaces One Of Us', seen.includes('badge') && won.badge === 'savior' && won.careers === 1, JSON.stringify(won))
    check('then a win without him: today\'s ending — the speaker\'s last line, then quiet', JSON.stringify(seen) === JSON.stringify(['pour', 'goop', 'vet', 'quiet', 'payday', 'badge', 'leave', 'empty', 'endScreen']), seen.join(' → '))
    check('lose → win: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }

  // ---------------- F75 today's ending (he was worn out) at 1440x900, every step's shot ----------------
  if (part('gone')) {
    const { page, errors, close } = await open(1440, 900)
    await startFinal(page)
    check('gone 1440x900: the Veteran worn out (F75), the shift plays on', await wearOut(page) && await page.evaluate(() => window.__goops.engine.state.status === 'playing'))
    await winFinal(page)
    const seen = await playEnding(page, 'gone-1440x900', { shots: true, oldTitle: 'deputy' })
    check('gone 1440x900: today\'s ending, every step in order', JSON.stringify(seen) === JSON.stringify(['pour', 'goop', 'vet', 'quiet', 'payday', 'badge', 'leave', 'empty', 'endScreen']), seen.join(' → '))
    check('gone: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }

  // ---------------- a page opened after the win (mid-ending): straight to the end-game screen ----------------
  if (part('resume')) {
    const { page, errors, close } = await open(390, 844)
    await startFinal(page)
    await winFinal(page)
    await page.locator('[data-tag="ending-goop"]').waitFor(roomy)
    await page.reload()
    const end = await page.locator('[data-tag="end-title"]').waitFor(roomy).then(() => true, () => false)
    const story = await page.locator('.kit-talk').count()
    check('resume: a page opened after the win goes straight to the end-game screen (no story moment over it)', end && story === 0)
    check('resume: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }

  // ---------------- RANK SELECT still works after a new career: rank 7, careers + gold kept ----------------
  if (part('rankselect')) {
    const { page, errors, close } = await open(1440, 900, { careers: 1 })
    await page.locator('[data-tag="rankSelect"]').click()
    await page.getByText('Rank 7', { exact: true }).click()
    await page.waitForLoadState('load')
    await page.locator('.kit-art-stage').waitFor(roomy)
    await page.waitForTimeout(800)
    const s = await save(page)
    const gold = await page.locator('.kit-art-stage.career-gold-console').count()
    check('RANK SELECT 7 after a career: rank 7, no badge, careers kept, still gold-trimmed', s.totalXp > 0 && s.badge === null && s.careers === 1 && gold === 1, JSON.stringify(s))
    check('rank select: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }
} catch (e) {
  console.log('✗ crashed:', e.message)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\nFAIL — ${failed} check(s) failed` : '\nPASS — the ending + the new career')
process.exit(failed ? 1 : 0)
