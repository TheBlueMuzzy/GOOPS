// "YOUR FIRST DAY" END TO END (F31, .planning/research/tutorial.md §3; content/lessons/first-day.json) — in a real browser
// with the real dev server (Playwright's own Chromium, never the user's Chrome), on a FRESH device (rank 0, no ?rank):
//   1. KEYS, 1440x900 — the whole day A1 → F3: the console's first line → ↓ pulls the periscope → B1 goop falls (controls
//      off) → B2 hold S → B3 turn (paused line) → C1 the pressure line, an early zap gets the game's own "Above the
//      pressure line", the yellow zap → C2 the join → C3 the blob zap → D1 crack + integrity → D2 a MISS (a second crack
//      piles up, "Try again") → D4 a crack spun out of view (the discovery, its arrow) → the plug → D3 the seal → E1 the
//      high crack, covered with the WRONG colour first (the red X) → uncovered, built up, plugged, sealed → F1 free play
//      with the safety rails (pressure capped at 90 %, no rupture before the quota, the overflow rail) → the quota
//      (the game's "Quota met!" banner shows) → F2 the rupture and its half-speed drain → F3 the report → Back to the
//      console → RANK 1, the day remembered (a reload doesn't play it) and the next shift starts with the rank-1 window
//      lesson.
//   2. A REAL FINGER (CDP touch), 390x844 — phases A–D with the Phone wording: tap the periscope, drag down, tap beside
//      the piece, tap goop, drag sideways to spin.
//   3. LEAVING MID-PHASE — End shift in phase D → the console says the first line again → the pull restarts at D1 (also
//      after a reload).
//   4. SHOTS — A1, C1, D1, E1, F1, F3 at 390x844, 360x780 and 1440x900 (portrait phones only) → e2e-shots/first-day/,
//      each checked: the bubble / monitor words inside the screen with room round them, the outline on screen.
// Time: the steps really run (real keys, clicks, touches; the runner's own timers). Only the slow parts of free play are
// sped up through the dev hooks (window.__goops.engine: ticking game time, and in F1 a crack with its goop placed on it,
// which a real click then seals); phase jumps for the shots use the Dev Kit's lesson jump (window.__goops.lesson).
// Run: node e2e/first-day.mjs  (own dev server on port 5347)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { startShift } from './start.mjs'

const PORT = 5347, OUT = 'e2e-shots/first-day'
mkdirSync(OUT, { recursive: true })
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const W = en.lessons['first-day']
const DRAIN_MS = JSON.parse(readFileSync('content/tuning/shift.json', 'utf8')).rupture.drainMs
const words = (id, input) => (typeof W[id] === 'string' ? W[id] : W[id][input])
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
const started = Date.now()
const BLUE = 2, GREEN = 3, YELLOW = 4 // (content/tuning/shift.json colors: red, blue, green, yellow…)

// ── the lesson, as the page sees it ──
const view = (page) => page.evaluate(() => { const v = window.__goops?.lessonView(); return v ? { step: v.stepId, kind: v.message?.kind ?? null, text: v.message?.text ?? null, armed: !!v.message?.armed, lesson: v.lessonId } : null })
const stepIs = (page, id, timeout = 20000) => page.waitForFunction((want) => window.__goops?.lessonView().stepId === want, id, { timeout }).then(() => true, () => false)
const messageIs = (page, text, timeout = 15000) => page.waitForFunction((want) => window.__goops?.lessonView().message?.text === want, text, { timeout }).then(() => true, () => false)
const bubble = (page) => page.locator('.lesson-spot .kit-callout')
const bubbleSays = async (page) => ((await bubble(page).count()) ? (await bubble(page).locator('.lesson-words').first().textContent()) : '')
const monitorSays = (page) => page.locator('[data-tag="crt"] .crt-read').textContent()
const gotIt = async (page) => {
  await page.waitForFunction(() => window.__goops?.lessonView().message?.armed === true, null, { timeout: 10000 })
  await page.keyboard.press('Enter') // (Enter closes an armed message, as Got it does)
  await sleep(120)
}
const tapGotIt = async (page, tap) => {
  await page.waitForFunction(() => window.__goops?.lessonView().message?.armed === true, null, { timeout: 10000 })
  const b = await bubble(page).getByRole('button').boundingBox()
  await tap(b.x + b.width / 2, b.y + b.height / 2)
  await sleep(150)
}
const state = (page) => page.evaluate(() => {
  const s = window.__goops.engine.state
  return { pressure: s.pressure, integrity: s.integrity, phase: s.phase, status: s.status, sealed: s.cracksSealed, needed: s.cracksNeeded, spin: s.spin, width: s.width,
    piece: s.piece ? { cells: s.piece.cells.map(([x, y]) => [x, y + 0]), color: s.piece.colors[0] } : null,
    cracks: s.cracks.map((c) => ({ x: c.x, y: c.y, color: c.color, plugged: c.plugged })) }
})
// a screen point over a tank cell (the cell the game picks there — the visor's curve included), or null
const cellPoint = (page, x, y) => page.evaluate(([x, y]) => {
  const { cellAt, view } = window.__goops
  const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
  const step = Math.max(2, view.cellPx / 5), hits = []
  for (let py = stage.top; py < stage.bottom; py += step) for (let px = stage.left; px < stage.right; px += step) {
    const c = cellAt(px, py)
    if (c && c[0] === x && c[1] === y) hits.push([px, py])
  }
  if (!hits.length) return null
  return [hits.reduce((a, h) => a + h[0], 0) / hits.length, hits.reduce((a, h) => a + h[1], 0) / hits.length]
}, [x, y])
// the cells of the biggest group of a colour (tank [x, y]), the highest first
const groupCells = (page, color) => page.evaluate((color) => {
  const s = window.__goops.engine.state
  const g = [...s.groups.values()].filter((g) => g.color === color).sort((a, b) => b.cells.length - a.cells.length)[0]
  return g ? g.cells.map((i) => [i % s.width, Math.floor(i / s.width)]) : []
}, color)
// (in the page) the goop on a plugged crack is ready to zap
const pluggedReady = () => {
  const s = window.__goops.engine.state, c = s.cracks.find((c) => c.plugged)
  const g = c && s.groups.get(s.groupOf[c.y * s.width + c.x])
  return !!g && g.ready
}
const readyGroups = (page, color) => page.evaluate((color) => [...window.__goops.engine.state.groups.values()].filter((g) => g.color === color && g.ready).length, color)
// click (or tap) a cell of the biggest group of a colour — a cell on screen
async function hitGroup(page, color, how) {
  for (const [x, y] of await groupCells(page, color)) {
    const p = await cellPoint(page, x, y)
    if (p) { await how(...p); return true }
  }
  return false
}
// the columns round the tank between two tank columns, the short way (+ = the piece must move right in tank columns)
const shortWay = (from, to, width) => { let d = (((to - from) % width) + width) % width; if (d > width / 2) d -= width; return d }
// spin the tank (one key press = one column) until the falling piece's left column is over tank column x
async function alignPiece(page, x, spinKeys = { more: 'KeyD', less: 'KeyA' }, press = (k) => page.keyboard.press(k)) {
  for (let i = 0; i < 40; i++) {
    const s = await state(page)
    if (!s.piece) return false
    const left = s.piece.cells.reduce((m, [cx]) => (shortWay(m, cx, s.width) < 0 ? cx : m), s.piece.cells[0][0])
    const d = shortWay(left, x, s.width)
    if (d === 0) return true
    await press(d > 0 ? spinKeys.more : spinKeys.less)
    await sleep(70)
    const after = await state(page)
    const left2 = after.piece?.cells.reduce((m, [cx]) => (shortWay(m, cx, after.width) < 0 ? cx : m), after.piece.cells[0][0])
    // (which key moves the piece which way: learnt on the first press)
    if (left2 !== undefined && Math.abs(shortWay(left2, x, after.width)) > Math.abs(d)) spinKeys = { more: spinKeys.less, less: spinKeys.more }
  }
  return false
}
// hold S until the falling piece lands (a lock)
async function dropWithS(page) {
  const locks = await page.evaluate(() => window.__locks)
  await page.keyboard.down('KeyS')
  await page.waitForFunction((n) => window.__locks > n, locks, { timeout: 15000 }).catch(() => {})
  await page.keyboard.up('KeyS')
  await sleep(80)
}
// count the engine's events the page sees (locks, rejects…) through the session's listener: a spy on takeEvents
const spy = (page) => page.evaluate(() => {
  const e = window.__goops.engine
  if (e.__spied) return
  e.__spied = true
  window.__locks = 0; window.__events = []
  const take = e.takeEvents.bind(e)
  e.takeEvents = () => { const ev = take(); for (const x of ev) { if (x.type === 'lock') window.__locks++; if (x.type !== 'step' && x.type !== 'move') window.__events.push(x.type) } return ev }
})
// game time, sped up: tick the engine in 50 ms steps until fn(state) holds (or maxMs of game time)
const tickUntil = (page, cond, maxMs) => page.evaluate(([cond, maxMs]) => {
  const e = window.__goops.engine, test = new Function('s', `return (${cond})`)
  let ms = 0
  while (ms < maxMs && !test(e.state)) { e.tick(50); ms += 50 }
  return { ms, ok: test(e.state) }
}, [cond, maxMs])
// the toasts (the game's own short messages)
const toastTexts = (page) => page.evaluate(() => [...document.querySelectorAll('.kit-toast')].map((t) => t.textContent))
// the look of a message (bubble or monitor): inside the window, words and button with room round them, outline on screen
const lookProblems = (page) => page.evaluate(() => {
  const bad = []
  const inside = (a, b, pad = 0) => a.left >= b.left + pad - 0.5 && a.top >= b.top + pad - 0.5 && a.right <= b.right - pad + 0.5 && a.bottom <= b.bottom - pad + 0.5
  const win = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
  const bubble = document.querySelector('.lesson-spot .kit-callout')
  if (bubble) {
    const b = bubble.getBoundingClientRect()
    if (!inside(b, win)) bad.push('bubble off screen')
    const button = bubble.querySelector('button')?.getBoundingClientRect()
    if (button && !inside(button, b, 4)) bad.push('button touches the bubble edge')
    const words = bubble.querySelector('.lesson-words')?.getBoundingClientRect()
    if (words && !inside(words, b, 4)) bad.push('words touch the bubble edge')
  }
  const screen = document.querySelector('[data-tag="crt"]'), crtWords = screen?.querySelector('.lesson-words')
  if (!bubble && screen && crtWords) {
    const s = screen.getBoundingClientRect(), w = crtWords.getBoundingClientRect()
    if (!inside(w, s, 4)) bad.push('monitor words touch the screen edge')
    if (!inside(w, win, 4)) bad.push('monitor words off the window')
  }
  if (!bubble && !crtWords) bad.push('no words')
  const ring = document.querySelector('.lesson-spot .kit-callout-ring')
  if (ring && ring.style.display !== 'none' && !inside(ring.getBoundingClientRect(), win)) bad.push('outline runs off screen')
  return bad
})
// is the message's outline (its ring) round this element?
const ringAround = (page, selector) => page.evaluate((selector) => {
  const ring = document.querySelector('.lesson-spot .kit-callout-ring'), el = document.querySelector(selector)
  if (!ring || ring.style.display === 'none' || !el) return false
  const r = ring.getBoundingClientRect(), b = el.getBoundingClientRect()
  return b.left >= r.left - 2 && b.top >= r.top - 2 && b.right <= r.right + 2 && b.bottom <= r.bottom + 2
}, selector)
const shot = async (page, name) => { await sleep(700); await page.screenshot({ path: `${OUT}/${name}.png` }) } // (after the bubble's fade-in)
const size = (page) => { const v = page.viewportSize(); return `${v.width}x${v.height}` }

async function freshDevice(width, height, touch = false) {
  const context = await browser.newContext({ viewport: { width, height }, ...(touch ? { hasTouch: true, isMobile: true } : {}) })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?seed=7`)
  await page.getByRole('button', { name: 'Start shift' }).waitFor()
  return { page, context, errors }
}

try {
  // ════════════════ 1. THE WHOLE DAY WITH KEYS (and the mouse for zaps), 1440x900 ════════════════
  {
    const { page, context, errors } = await freshDevice(1440, 900)
    // ── A1 · on the console ──
    await page.waitForFunction((want) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent === want, words('pull', 'keys'), { timeout: 8000 }).catch(() => {})
    check('A1: a fresh device opens on the console with the day\'s first line on the monitor (Keys wording)', (await monitorSays(page)) === words('pull', 'keys'), await monitorSays(page))
    check('A1: the periscope is outlined', await ringAround(page, '.kit-pull-grip'))
    await sleep(6500)
    check('A1: after 6 s the hint (Keys)', (await monitorSays(page)) === words('pullHint', 'keys'), await monitorSays(page))
    await page.keyboard.press('ArrowDown') // ↓ pulls the periscope (no focus needed)
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    await spy(page)
    // ── B1 · goop falls, every control off ──
    check('↓ pulls the periscope → the day\'s shift starts at B1', await stepIs(page, 'B1'))
    await messageIs(page, 'falls')
    check('B1: "Goop drops into the tank…" pointing at the piece', (await bubbleSays(page)) === words('falls'), await bubbleSays(page))
    const spin0 = (await state(page)).spin
    await page.keyboard.press('KeyD'); await page.keyboard.press('KeyE')
    await sleep(150)
    check('B1: spin and turn do nothing (controls off)', (await state(page)).spin === spin0)
    await page.keyboard.press('KeyW'); await sleep(300)
    check('B1: W doesn\'t open the console (off until free play)', !(await page.locator('.kit-screen[aria-label="Console"]').count()))
    // ── B2 · fast drop ──
    check('B1 → B2 when the piece is a third of the way down', await stepIs(page, 'B2'))
    await messageIs(page, 'fastDrop')
    check('B2: "Hold S or ↓ to fast drop" (Keys)', (await bubbleSays(page)) === words('fastDrop', 'keys'), await bubbleSays(page))
    const t0 = Date.now()
    await dropWithS(page)
    check('B2: holding S lands it quickly → B3', (await stepIs(page, 'B3')) && Date.now() - t0 < 4000, `${Date.now() - t0} ms`)
    // ── B3 · turn the piece (a paused line after 1.2 s) ──
    await messageIs(page, 'turn')
    const p0 = (await state(page)).piece
    await sleep(500)
    check('B3: "Q or E turns the piece" — the shift paused under it', (await bubbleSays(page)) === words('turn', 'keys') && JSON.stringify((await state(page)).piece) === JSON.stringify(p0), await bubbleSays(page))
    await shot(page, 'B3-1440x900')
    await gotIt(page)
    const r0 = await page.evaluate(() => window.__goops.engine.state.piece.rotation)
    await page.keyboard.press('KeyE'); await sleep(100)
    check('B3: E turns the piece', (await page.evaluate(() => window.__goops.engine.state.piece.rotation)) !== r0)
    await dropWithS(page)
    // ── C1 · the pressure line ──
    check('B3 → C1 when it lands', await stepIs(page, 'C1'))
    await messageIs(page, 'pressureLine')
    check('C1: "Pressure rises over time…" on the PSI readout', (await bubbleSays(page)) === words('pressureLine') && await ringAround(page, '[data-tag="readout"] .kit-pinned'))
    await shot(page, 'C1-1440x900')
    check('C1: the look (words, room, outline)', (await lookProblems(page)).length === 0, (await lookProblems(page)).join(', '))
    await gotIt(page)
    check('C1 → the line rises (no message: the game\'s own messages show)', await stepIs(page, 'C1-rise'))
    // an early zap on the yellow (its top above the line): the game's own "Above the pressure line"
    const early = (await state(page)).pressure
    await hitGroup(page, YELLOW, (x, y) => page.mouse.click(x, y))
    await sleep(250)
    check('C1: zapping the yellow too early → the game\'s own "Above the pressure line"', (await toastTexts(page)).some((t) => t.includes(en.messages.refusedAboveLine)) && early < 0.15, `${JSON.stringify(await toastTexts(page))} at ${Math.round(early * 100)}%`)
    check('C1: the line passes the yellow → "Now click the yellow goop" (pressure held)', await messageIs(page, 'zapYellow', 20000))
    check('C1: the words (Keys/Mouse)', (await bubbleSays(page)) === words('zapYellow', 'mouse'), await bubbleSays(page))
    const held = (await state(page)).pressure; await sleep(600)
    check('C1: pressure holds while it waits', Math.abs((await state(page)).pressure - held) < 0.001)
    await hitGroup(page, BLUE, (x, y) => page.mouse.click(x, y)); await sleep(200)
    check('C1: the blue can\'t be zapped (yellow only)', (await groupCells(page, BLUE)).length >= 4 && (await view(page)).step === 'C1-zap')
    await hitGroup(page, YELLOW, (x, y) => page.mouse.click(x, y))
    // ── C2 · same colours join ──
    check('C1: zapping the yellow → C2 (a blue O comes)', await stepIs(page, 'C2'))
    await sleep(300)
    await dropWithS(page)
    check('C2: it lands on the blue and joins → "Same colours join…" (paused)', (await messageIs(page, 'join')) && (await bubbleSays(page)) === words('join'))
    await gotIt(page)
    // ── C3 · zap the blob ──
    check('C2 → C3 "Zap the blue blob once it\'s full"', (await messageIs(page, 'zapBlob')) && (await bubbleSays(page)) === words('zapBlob'))
    if (!(await readyGroups(page, BLUE))) {
      await hitGroup(page, BLUE, (x, y) => page.mouse.click(x, y)); await sleep(200)
      check('C3: zapping it while it fills → "Still filling" (the lesson\'s reaction)', (await bubbleSays(page)) === words('stillFilling'), await bubbleSays(page))
    } else console.log('(C3: the blob was full already — the "Still filling" reaction not tried)')
    await page.waitForFunction(() => [...window.__goops.engine.state.groups.values()].some((g) => g.color === 2 && g.ready), null, { timeout: 15000 })
    await hitGroup(page, BLUE, (x, y) => page.mouse.click(x, y))
    check('C3: the zap → "Zapping lets out a little pressure…" on the readout', (await messageIs(page, 'vent')) && (await bubbleSays(page)) === words('vent'))
    await gotIt(page)
    // ── D1 · a crack ──
    check('C3 → D1 (empty tank, a green crack)', await stepIs(page, 'D1'))
    await messageIs(page, 'crack')
    check('D1: "A crack! Cover it…" pointing at the crack', (await bubbleSays(page)) === words('crack') && (await state(page)).cracks.length === 1)
    await shot(page, 'D1-1440x900')
    check('D1: the look', (await lookProblems(page)).length === 0, (await lookProblems(page)).join(', '))
    await gotIt(page)
    check('D1: "Open cracks wear down the tank" on INTEGRITY', (await messageIs(page, 'integrity')) && await ringAround(page, `.kit-bar:has([aria-label="${en.hud.integrity}"])`))
    await gotIt(page)
    // ── D2 · spin the tank: a miss first ──
    check('D1 → D2 (a green O)', await stepIs(page, 'D2'))
    check('D2: at a third of the way down, the spin line (paused)', (await messageIs(page, 'spin')) && (await bubbleSays(page)) === words('spin', 'keys'), await bubbleSays(page))
    await gotIt(page)
    await dropWithS(page) // straight down: a miss
    check('D2: a miss → "Try again…" and a second green crack piles up', (await messageIs(page, 'tryAgain')) && (await state(page)).cracks.length === 2, JSON.stringify((await state(page)).cracks))
    await gotIt(page)
    // D4: spin a crack out of view → the discovery
    const before = await state(page)
    for (let i = 0; i < 12 && !(await page.evaluate(() => window.__goops.lessonView().message?.kind === 'interrupt')); i++) { await page.keyboard.press('KeyA'); await sleep(90) }
    check('D4: a crack spun out of view → "You only see part of the tank…" (paused) pointing at its arrow on the edge', (await view(page)).kind === 'interrupt' && (await bubbleSays(page)) === words('outOfView'), JSON.stringify(await view(page)))
    await shot(page, 'D4-1440x900')
    await gotIt(page)
    check('D4: dismissed → back to D2 where it was', (await view(page)).step === 'D2-spin' && before.cracks.length === 2)
    const crack = (await state(page)).cracks.find((c) => !c.plugged)
    check('D2: the piece lined up over a crack by spinning (A / D)', await alignPiece(page, crack.x))
    await dropWithS(page)
    // ── D3 · seal it ──
    check('D2: plugged → D3 "Zap that goop to seal it"', (await messageIs(page, 'seal')) && (await state(page)).cracks.some((c) => c.plugged))
    await page.waitForFunction(pluggedReady, null, { timeout: 15000 })
    const plugged = (await state(page)).cracks.find((c) => c.plugged)
    const at = await cellPoint(page, plugged.x, plugged.y)
    await page.mouse.click(...at)
    check('D3: the zap seals it → "Sealed! Seal 4 cracks a day…" on CRACKS', (await messageIs(page, 'sealed')) && (await bubbleSays(page)).includes('Seal 4 cracks') && await ringAround(page, '.kit-hud-text[data-size="l"]'), await bubbleSays(page))
    await gotIt(page)
    // ── E1 · a high crack, the red X first ──
    check('D3 → E1', await stepIs(page, 'E1'))
    await messageIs(page, 'high')
    const e1 = await state(page)
    const high = e1.cracks[0]
    check('E1: "Cracks form up high too…" — one green crack 5 rows up, pressure 35 %', (await bubbleSays(page)) === words('high') && e1.cracks.length === 1 && high.y === 24 - 1 - 4 && Math.round(e1.pressure * 100) === 35, JSON.stringify(e1.cracks))
    await shot(page, 'E1-1440x900')
    await gotIt(page)
    await stepIs(page, 'E1-build')
    await sleep(200)
    // the blue I somewhere else, the green O under the crack (too low), then the blue I the game sends to build up —
    // dropped on the crack: the wrong colour covers it
    await alignPiece(page, (high.x + 4) % e1.width); await dropWithS(page)
    await alignPiece(page, high.x); await dropWithS(page)
    const bu = await state(page)
    check('E1: the stack under the crack too low → a blue I comes to build up', bu.piece?.color === BLUE, JSON.stringify(bu.piece))
    await alignPiece(page, high.x); await dropWithS(page)
    check('E1: the blue covers the crack → "Wrong colour. See the red X?…" (paused)', (await messageIs(page, 'redX')) && (await bubbleSays(page)) === words('redX'), await bubbleSays(page))
    await shot(page, 'E1-redX-1440x900')
    await gotIt(page)
    await page.waitForFunction(() => { const s = window.__goops.engine.state; const c = s.cracks[0]; const g = s.groups.get(s.groupOf[c.y * s.width + c.x]); return g && g.ready }, null, { timeout: 15000 })
    await page.mouse.click(...(await cellPoint(page, high.x, high.y)))
    await sleep(300)
    check('E1: zapping the blue uncovers the crack', (await state(page)).cracks[0] && !(await page.evaluate(() => { const s = window.__goops.engine.state; const c = s.cracks[0]; return s.grid[c.y * s.width + c.x] })))
    // build up: the blue I flat on the green O, then a green O onto the crack
    for (let i = 0; i < 4 && (await view(page)).step === 'E1-build'; i++) {
      const s = await state(page)
      if (!s.piece) { await sleep(300); continue }
      if (s.piece.color === BLUE) { await page.keyboard.press('KeyE'); await sleep(80); await alignPiece(page, (high.x - 1 + s.width) % s.width) }
      else await alignPiece(page, high.x)
      await dropWithS(page)
    }
    check('E1: built up and plugged with green → "Now zap the green goop…"', await messageIs(page, 'sealHigh'))
    await page.waitForFunction(pluggedReady, null, { timeout: 40000 }).catch(async (e) => {
      console.log(await page.evaluate(() => { const s = window.__goops.engine.state; const c = s.cracks.find((c) => c.plugged); const g = c && s.groups.get(s.groupOf[c.y * s.width + c.x]); return JSON.stringify({ c, g: g && { ...g, cells: g.cells.map((i) => [i % s.width, Math.floor(i / s.width)]) }, p: s.pressure }) }))
      throw e
    })
    const hp = (await state(page)).cracks.find((c) => c.plugged)
    await page.mouse.click(...(await cellPoint(page, hp.x, hp.y)))
    // ── F1 · free play to the quota, with the safety rails ──
    check('E1: sealed → F1 "Cracks come faster as pressure rises…"', (await stepIs(page, 'F1')) && (await messageIs(page, 'freePlay')))
    await shot(page, 'F1-1440x900')
    check('F1: the look', (await lookProblems(page)).length === 0, (await lookProblems(page)).join(', '))
    await gotIt(page)
    check('F1: "Seal 2 more to meet the quota." on CRACKS', (await messageIs(page, 'quota')) && (await bubbleSays(page)) === 'Seal 2 more to meet the quota.', await bubbleSays(page))
    await gotIt(page)
    await stepIs(page, 'F1-work')
    // the rails: pressure stops at 90 %; open cracks can't wear the tank under 20 % or rupture it; a full tank is cleared
    await page.evaluate(() => window.__goops.engine.train({ type: 'pressure', value: 0.85 }))
    const cap = await tickUntil(page, 's.pressure >= 0.95', 20000)
    check('F1 rail: pressure can\'t pass 90 %', !cap.ok && Math.round((await state(page)).pressure * 100) === 90, `${Math.round((await state(page)).pressure * 100)}% after ${cap.ms} ms of game time`)
    await sleep(300)
    check('F1: at the cap → "Zap goop to let pressure out."', (await bubbleSays(page)) === words('capped'), await bubbleSays(page))
    await page.evaluate(() => { const e = window.__goops.engine; e.act({ type: 'softDrop', on: true }) })
    const flood = await tickUntil(page, 's.phase !== "playing" || s.integrity <= 0.2001', 600000)
    await page.evaluate(() => window.__goops.engine.act({ type: 'softDrop', on: false }))
    const f = await state(page)
    const railed = await page.evaluate(() => window.__events.includes('overflowRail'))
    check('F1 rail: 10 min of piled-up cracks and pieces → still playing, integrity held at 20 %, the overflow rail cleared the top (no rupture)',
      f.phase === 'playing' && f.status === 'playing' && Math.round(f.integrity * 100) === 20 && railed && !(await page.evaluate(() => window.__events.includes('rupture'))),
      `${flood.ms} ms · phase ${f.phase} · integrity ${Math.round(f.integrity * 100)}% · rail ${railed}`)
    await page.evaluate(() => window.__goops.engine.train({ type: 'pressure', value: 0.3 }))
    // two seals by real clicks: a crack in view with its own colour's goop placed on it (dev hook), zapped when ready
    for (let n = 0; n < 2; n++) {
      const placed = await page.evaluate(() => {
        const e = window.__goops.engine, s = e.state
        e.train({ type: 'clear' }) // (room to work: the flood above filled the tank)
        const y = s.height - 1
        if (!e.train({ type: 'freeCrack', where: 'inView', y, color: 1 })) return null
        const c = s.cracks[s.cracks.length - 1]
        e.train({ type: 'goop', cells: [[c.x, c.y, c.color], [(c.x + 1) % s.width, c.y, c.color]] })
        return [c.x, c.y]
      })
      await sleep(200)
      if (placed) await page.mouse.click(...(await cellPoint(page, ...placed)))
      await sleep(250)
    }
    const q = await state(page)
    check('F1: two more seals meet the quota → F2', q.sealed >= q.needed && (await stepIs(page, 'F2')), `${q.sealed} / ${q.needed}`)
    check('F1: the game\'s own "Quota met!" banner shows (not hidden by the lesson)', (await toastTexts(page)).some((t) => t.includes(en.messages.quotaMet)), JSON.stringify(await toastTexts(page)))
    // ── F2 · the rupture ──
    const rup = await tickUntil(page, 's.phase === "rupture"', 900000)
    check('F2: rails off — the tank ruptures (open cracks wear it to 0)', rup.ok, `${rup.ms} ms of game time`)
    await sleep(300)
    check('F2: the game\'s own "Rupture!" line shows first', (await toastTexts(page)).some((t) => t.includes('Rupture!')), JSON.stringify(await toastTexts(page)))
    check('F2: then "The tank broke! Zap all the goop you can…" (paused)', (await messageIs(page, 'rupture', 5000)) && (await bubbleSays(page)) === words('rupture'))
    await gotIt(page)
    const p = (await state(page)).pressure, want = p * DRAIN_MS * 2 // (pressure drains at 1 / drainMs a ms; × 0.5 on day one)
    const drain = await tickUntil(page, 's.status !== "playing"', 60000)
    check('F2: the drain runs at half speed on day one (2 × the usual time from this pressure)', drain.ok && Math.abs(drain.ms - want) <= 150, `${drain.ms} ms of game time from ${Math.round(p * 100)}% (half speed: ${Math.round(want)} ms)`)
    // ── F3 · clock out ──
    const f3 = await stepIs(page, 'F3')
    if (!f3) console.log('debug', JSON.stringify(await view(page)), JSON.stringify(await page.evaluate(() => window.__goops.clocks())))
    check('F2 → F3: the report, "Day one done!…" pointing at Back to the console', f3 && (await messageIs(page, 'clockOut')) && (await bubbleSays(page)) === words('clockOut'))
    await page.waitForTimeout(600)
    check('F3: the outline is round "Back to the console"', await ringAround(page, '.kit-end-actions button[data-variant="secondary"]'))
    check('F3: the report says the rank-up (rank 1)', (await page.locator('.kit-end').textContent()).includes('Rank up! 1'), await page.locator('.kit-end').textContent())
    await shot(page, 'F3-1440x900')
    check('F3: the look', (await lookProblems(page)).length === 0, (await lookProblems(page)).join(', '))
    await page.getByRole('button', { name: en.end.quit }).click()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await page.waitForTimeout(2500)
    const after = await page.evaluate(() => ({ progress: JSON.parse(localStorage.getItem('goops-progress')), tips: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))) }))
    check('F3: back at the console at RANK 1, the day remembered', after.progress.totalXp >= 3500 && after.tips.seen.includes('lesson:first-day'), JSON.stringify(after))
    check('F3: the monitor says its own words again', (await monitorSays(page)) === en.console.hint, await monitorSays(page))
    await page.reload()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await sleep(1500)
    check('after a reload: no day (the console\'s own words)', (await monitorSays(page)) === en.console.hint, await monitorSays(page))
    await startShift(page, { unlockLessons: true, firstDay: true })
    await sleep(800)
    check('the next shift is a real rank-1 shift starting with the next-piece window lesson', (await view(page)).lesson === 'unlock-window' && (await page.evaluate(() => window.__goops.engine.state.rank)) === 1, JSON.stringify(await view(page)))
    // Settings → Replay lessons: the day plays again at rank 1 (a replay: no XP top-up — tests/progress.test.ts)
    await gotIt(page) // (the window lesson)
    await page.getByRole('button', { name: en.hud.pause }).click()
    await page.getByRole('button', { name: en.pause.quit }).click()
    await page.locator('.kit-ask').getByRole('button').last().click()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await sleep(2500)
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('tab', { name: 'Gameplay' }).click()
    await page.getByRole('button', { name: 'Replay lessons' }).click()
    await page.locator('.kit-ask').getByRole('button', { name: 'Replay lessons' }).click({ timeout: 3000 })
    for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('.kit-layer') !== null); i++) { await page.keyboard.press('Escape'); await sleep(300) }
    await page.waitForFunction((want) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent === want, words('pull', 'keys'), { timeout: 8000 }).catch(() => {})
    check('Replay lessons (at rank 1): the console says the day\'s first line again', (await monitorSays(page)) === words('pull', 'keys'), await monitorSays(page))
    await page.keyboard.press('ArrowDown') // (Enter would press the focused gear button — Settings just closed)
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    check('…and the pull starts the day again from B1', await stepIs(page, 'B1'))
    check('pass 1: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ════════════════ 2. A REAL FINGER, 390x844: phases A–D in Phone words; then leaving mid-phase ════════════════
  {
    const { page, context, errors } = await freshDevice(390, 844, true)
    const cdp = await context.newCDPSession(page)
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y, id: 0 })) })
    const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await sleep(40); await touch('touchEnd', []); await sleep(60) }
    const mid = () => page.evaluate(() => {
      const { view } = window.__goops, stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
      const y = stage.top + view.topY + 3 * view.cellPx
      return { x: stage.left + view.centreX, y, cell: view.cellPx, rem: parseFloat(getComputedStyle(document.documentElement).fontSize) }
    })
    // drag down and hold until the piece lands
    const dragDownUntilLock = async () => {
      const m = await mid(), locks = await page.evaluate(() => window.__locks)
      await touch('touchStart', [[m.x, m.y]])
      for (let k = 1; k <= 6; k++) { await sleep(15); await touch('touchMove', [[m.x, m.y + k * m.rem * 0.6]]) }
      await page.waitForFunction((n) => window.__locks > n, locks, { timeout: 15000 }).catch(() => {})
      await touch('touchEnd', [])
      await sleep(100)
    }
    // one column of spin by a finger: drag sideways past the drag lock, lift as soon as the tank has turned one column
    const fingerSpin = async (dir) => {
      const m = await mid(), spin0 = (await state(page)).spin
      await touch('touchStart', [[m.x, m.y]])
      for (let k = 1; k <= 12; k++) {
        await sleep(15); await touch('touchMove', [[m.x + dir * k * m.rem * 0.4, m.y]])
        if ((await state(page)).spin !== spin0) break
      }
      await touch('touchEnd', [])
      await sleep(120)
    }
    const press = async (k) => fingerSpin(k === 'right' ? 1 : -1)

    // ── A1 on the console: the Phone wording before anything was touched ──
    await page.waitForFunction((want) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent === want, words('pull', 'phone'), { timeout: 8000 }).catch(() => {})
    check('finger A1: a phone opens on the Phone wording ("Pull the periscope down…")', (await monitorSays(page)) === words('pull', 'phone'), await monitorSays(page))
    const grip = await page.locator('.kit-pull-grip').boundingBox()
    await tap(grip.x + grip.width / 2, grip.y + grip.height / 2)
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    await spy(page)
    check('finger: a tap on the periscope starts the day at B1', await stepIs(page, 'B1'))
    // ── B ──
    check('finger B2: "Drag down on the tank to fast drop" (Phone)', (await stepIs(page, 'B2')) && (await messageIs(page, 'fastDrop')) && (await bubbleSays(page)) === words('fastDrop', 'phone'), await bubbleSays(page))
    await dragDownUntilLock()
    check('finger B2: a drag down lands it → B3 "Tap left or right of the piece…" (Phone)', (await messageIs(page, 'turn')) && (await bubbleSays(page)) === words('turn', 'phone'), await bubbleSays(page))
    await tapGotIt(page, tap)
    const rot0 = await page.evaluate(() => window.__goops.engine.state.piece.rotation)
    const m0 = await mid()
    await tap(m0.x + m0.cell * 3, m0.y)
    check('finger B3: a tap beside the piece turns it', (await page.evaluate(() => window.__goops.engine.state.piece.rotation)) !== rot0)
    await dragDownUntilLock()
    // ── C ──
    check('finger C1: the pressure line', await messageIs(page, 'pressureLine'))
    await tapGotIt(page, tap)
    check('finger C1: "Now tap the yellow goop to zap it" (Phone)', (await messageIs(page, 'zapYellow', 20000)) && (await bubbleSays(page)) === words('zapYellow', 'phone'), await bubbleSays(page))
    await hitGroup(page, YELLOW, tap)
    check('finger C1: a tap on the yellow zaps it → C2', await stepIs(page, 'C2'))
    await sleep(300)
    await dragDownUntilLock()
    await messageIs(page, 'join'); await tapGotIt(page, tap)
    await messageIs(page, 'zapBlob')
    await page.waitForFunction(() => [...window.__goops.engine.state.groups.values()].some((g) => g.color === 2 && g.ready), null, { timeout: 15000 })
    await hitGroup(page, BLUE, tap)
    check('finger C3: a tap on the blob zaps it → the vent line', await messageIs(page, 'vent'))
    await tapGotIt(page, tap)
    // ── D ──
    check('finger D1: the crack', await messageIs(page, 'crack'))
    await tapGotIt(page, tap)
    await messageIs(page, 'integrity'); await tapGotIt(page, tap)
    check('finger D2: "Drag sideways to spin the tank" (Phone)', (await messageIs(page, 'spin')) && (await bubbleSays(page)) === words('spin', 'phone'), await bubbleSays(page))
    await tapGotIt(page, tap)
    const target = (await state(page)).cracks.find((c) => !c.plugged)
    check('finger D2: dragging sideways spins the tank over the crack', await alignPiece(page, target.x, { more: 'right', less: 'left' }, press))
    await dragDownUntilLock()
    check('finger D2: plugged → D3', await messageIs(page, 'seal'))
    await page.waitForFunction(pluggedReady, null, { timeout: 15000 })
    const pc = (await state(page)).cracks.find((c) => c.plugged)
    await tap(...(await cellPoint(page, pc.x, pc.y)))
    check('finger D3: a tap on the green on the crack seals it → "Sealed!…"', await messageIs(page, 'sealed'))
    // ── leaving mid-phase (still in phase D): End shift → the console → the pull restarts at D1 ──
    const pauseBtn = await page.getByRole('button', { name: en.hud.pause }).boundingBox()
    await tap(pauseBtn.x + pauseBtn.width / 2, pauseBtn.y + pauseBtn.height / 2)
    const tapEl = async (locator) => { await locator.waitFor(); const b = await locator.boundingBox(); await tap(b.x + b.width / 2, b.y + b.height / 2) }
    await tapEl(page.getByRole('button', { name: en.pause.quit }))
    await tapEl(page.locator('.kit-ask').getByRole('button').last())
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await page.waitForFunction((want) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent === want, words('pull', 'phone'), { timeout: 8000 }).catch(() => {})
    check('leaving mid-day (End shift in phase D): the console says the day\'s first line again', (await monitorSays(page)) === words('pull', 'phone'), await monitorSays(page))
    check('…the phase reached is remembered (D1)', (await page.evaluate(() => JSON.parse(localStorage.getItem('goops-first-day'))?.at)) === 'D1')
    const g2 = await page.locator('.kit-pull-grip').boundingBox()
    await tap(g2.x + g2.width / 2, g2.y + g2.height / 2)
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    check('…the pull restarts at the start of phase D (D1: a fresh tank, one crack)', (await stepIs(page, 'D1')) && (await state(page)).cracks.length === 1)
    await page.reload()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await sleep(1500)
    const g3 = await page.locator('.kit-pull-grip').boundingBox()
    await tap(g3.x + g3.width / 2, g3.y + g3.height / 2)
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    check('…and after closing the page (a reload) too', await stepIs(page, 'D1'))
    check('pass 2 (finger): no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ════════════════ 3. SHOTS: A1, C1, D1, E1, F1, F3 at every portrait size ════════════════
  for (const [w, h] of [[390, 844], [360, 780], [1440, 900]]) {
    const { page, context, errors } = await freshDevice(w, h)
    const name = `${w}x${h}`
    await page.waitForFunction(() => document.querySelector('[data-tag="crt"]') && !document.querySelector('[data-tag="crt"]').hasAttribute('data-typing'), null, { timeout: 8000 }).catch(() => {})
    await sleep(400)
    await shot(page, `A1-${name}`)
    check(`${name} A1: the look (the monitor's words inside its screen, the periscope's outline on screen)`, (await lookProblems(page)).length === 0 && await ringAround(page, '.kit-pull-grip'), (await lookProblems(page)).join(', '))
    await page.locator('.kit-pull-grip').click()
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    await page.evaluate(() => window.__goopsSeen(['interrupt:outOfView'])) // (F1's out-of-view crack would bring D4 up over F1's line)
    for (const [step, message] of [['C1', 'pressureLine'], ['D1', 'crack'], ['E1', 'high'], ['F1', 'freePlay']]) {
      await page.evaluate((step) => window.__goops.lesson('first-day', step), step)
      const ok = await messageIs(page, message)
      await sleep(700) // (the bubble fades in)
      await shot(page, `${step}-${name}`)
      const bad = await lookProblems(page)
      check(`${name} ${step}: the line shows, the look is right (${bad.join(', ') || 'room round the words and button, outline on screen'})`, ok && bad.length === 0)
    }
    // F3: from F2 — the quota met and the tank overfilled at once (dev hooks), the report, the day's last line
    await page.evaluate(() => window.__goops.lesson('first-day', 'F2'))
    await stepIs(page, 'F2')
    await spy(page)
    await page.evaluate(() => { const s = window.__goops.engine.state; s.cracksSealed = s.cracksNeeded; s.quotaMet = true })
    await page.evaluate(() => { window.__goops.engine.train({ type: 'spawn' }); window.__goops.engine.act({ type: 'softDrop', on: true }) })
    await tickUntil(page, 's.status !== "playing"', 900000)
    const f3 = await messageIs(page, 'clockOut')
    await sleep(900)
    await shot(page, `F3-${name}`)
    const bad = await lookProblems(page)
    check(`${name} F3: "Day one done!" on the report, pointing at Back to the console (${bad.join(', ') || 'look right'})`, f3 && bad.length === 0 && await ringAround(page, '.kit-end-actions button[data-variant="secondary"]'))
    check(`${name}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
} catch (e) {
  failed++
  console.log('FAIL (crashed)', e)
} finally {
  await browser.close()
  server.kill()
}
console.log(`\n${failed ? 'FAILED' : 'PASSED'} — ${count - failed}/${count} checks in ${Math.round((Date.now() - started) / 1000)} s`)
process.exit(failed ? 1 : 0)
