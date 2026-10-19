// F30 the lesson runner, in a real browser with the real dev server (Playwright's own Chromium, never the user's Chrome):
//   plays content/lessons/sample.json start to finish by REAL input — "Got it" clicks, holding S, clicking the goop —
//   checks a paused message really pauses the shift, a hint shows after waiting, the Dev Kit's ⏸ full pause stops the
//   lesson's timers (no hint while frozen), and the shift carries on as normal play after the last step.
//   Screenshots at 1440x900 and 390x844 → e2e-shots/lessons/
// Run: node e2e/lessons.mjs  (own dev server on port 5341)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5341, OUT = 'e2e-shots/lessons'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

const lesson = (page) => page.evaluate(() => { const v = window.__goops.lessonView(); return { step: v.stepId, kind: v.message?.kind ?? null, armed: !!v.message?.armed, done: v.done } })
const stepIs = (page, id, timeout = 15000) => page.waitForFunction((want) => window.__goops.lessonView().stepId === want, id, { timeout })
const bubble = (page) => page.locator('.kit-callout')
const gotIt = (page) => page.getByRole('button', { name: 'Got it' })
// (F32: Got it is there from the message's first frame, but works only once armed — dismissArmSeconds)
const clickGotIt = async (page) => {
  await page.waitForFunction(() => window.__goops.lessonView().message?.armed === true)
  await gotIt(page).click()
}
const pieceRow = (page) => page.evaluate(() => { const p = window.__goops.engine.state.piece; return p ? Math.max(...p.cells.map(([, y]) => y)) + p.fall : null })
const markCentre = async (page) => { const b = await page.locator('.lesson-mark').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2] }
const pauseBtn = (page, which) => page.locator(`aside.devkit .devkit-pause-btn[data-pause="${which}"]`)

// F32 helpers: a spy on the engine (its actions, the game time it's given); game ms passed in `ms` real ms
const spyEngine = (page) => page.evaluate(() => {
  const e = window.__goops.engine
  window.__acts = []; window.__ticked = 0
  const act = e.act.bind(e), tick = e.tick.bind(e)
  e.act = (a) => { window.__acts.push(a); act(a) }
  e.tick = (ms) => { window.__ticked += ms; tick(ms) }
})
const gameMs = (page, ms) => page.evaluate(async (ms) => { const t0 = window.__ticked; await new Promise((r) => setTimeout(r, ms)); return window.__ticked - t0 }, ms)
// the console has slid in over the tank
const consoleStill = (page) => page.waitForFunction(() => { const s = document.querySelector('.kit-screen[aria-label="Console"]'); return s && !s.hasAttribute('data-slide') }, null, { timeout: 5000 })
// the message's pulse ring (the Callout's hole) is round the element the selector finds
const pointsAt = (page, selector) => page.evaluate((selector) => {
  const layer = document.querySelector('.kit-callout-layer'), el = document.querySelector(selector)
  if (!layer || !el) return false
  const st = getComputedStyle(layer), r = el.getBoundingClientRect()
  const hole = ['l', 't', 'r', 'b'].map((k) => parseFloat(st.getPropertyValue(`--kit-hole-${k}`)))
  return hole[0] <= r.left + 1 && hole[1] <= r.top + 1 && hole[2] >= r.right - 1 && hole[3] >= r.bottom - 1 && hole[2] - hole[0] < r.width + 40
}, selector)
// F32 look helpers ─ the console's monitor screen (the lesson's words there); is the spotlight's dim up; is a target
// cut out of it (taps at 5 points over it reach it, not the dim's blocker); is the bubble inside the game's column;
// does the ONE outline wrap all of these targets
const crt = (page) => page.locator('[data-tag="crt"]')
const dimmed = (page) => page.evaluate(() => !!document.querySelector('.lesson-spot .kit-callout-dim'))
const undimmed = (page, selector) => page.evaluate((selector) => {
  const els = [...document.querySelectorAll(selector)].filter((e) => e.getBoundingClientRect().width > 0)
  if (!els.length) return false
  return els.every((el) => {
    const r = el.getBoundingClientRect()
    return [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].every(([fx, fy]) => {
      const x = r.left + r.width * fx, y = r.top + r.height * fy
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true
      return !document.elementFromPoint(x, y)?.classList.contains('lesson-spot-block')
    })
  })
}, selector)
const columnNow = () => {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const screen = document.querySelector('.kit-screen[aria-label="Console"]')
  if (screen) { const r = screen.getBoundingClientRect(), st = getComputedStyle(screen); return { l: r.left + parseFloat(st.paddingLeft), r: r.right - parseFloat(st.paddingRight), t: 0, b: innerHeight } }
  const w = Math.min(innerWidth, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-hud-w')) || innerWidth)
  return { l: (innerWidth - w) / 2, r: (innerWidth + w) / 2, t: 0, b: innerHeight }
}
const inColumn = (page) => page.evaluate((columnSrc) => {
  const column = new Function(`return (${columnSrc})()`)()
  const b = document.querySelector('.lesson-spot .kit-callout')?.getBoundingClientRect()
  return !!b && b.left >= column.l - 1 && b.right <= column.r + 1 && b.top >= column.t - 1 && b.bottom <= column.b + 1
}, columnNow.toString())
const ringAround = (page, selectors) => page.evaluate((selectors) => {
  const ring = document.querySelector('.lesson-spot .kit-callout-ring')
  if (!ring || ring.style.display === 'none') return false
  const r = ring.getBoundingClientRect()
  const els = selectors.flatMap((s) => [...document.querySelectorAll(s)]).filter((e) => e.getBoundingClientRect().width > 0)
  return els.length > 0 && els.every((e) => { const b = e.getBoundingClientRect(); return b.left >= r.left - 1 && b.top >= r.top - 1 && b.right <= r.right + 1 && b.bottom <= r.bottom + 1 })
}, selectors)
// the message's first frame: does it already hold its button, and how big is it (it must never change shape)
const watchFirstFrame = (page) => page.evaluate(() => {
  window.__firstFrame = null
  const look = () => {
    const b = document.querySelector('.lesson-spot[data-ready] .kit-callout')
    if (!b || window.__firstFrame) return
    const r = b.getBoundingClientRect()
    window.__firstFrame = { button: !!b.querySelector('button'), w: r.width, h: r.height }
  }
  new MutationObserver(look).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ready'] })
})
// every step's look: the bubble inside the window and the column, its button with room round it; the monitor's words
// inside its screen with room; the outline whole on screen
function lookProblems(want) {
  const bad = []
  const inside = (a, b, pad = 0) => a.left >= b.left + pad - 0.5 && a.top >= b.top + pad - 0.5 && a.right <= b.right - pad + 0.5 && a.bottom <= b.bottom - pad + 0.5
  const win = { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
  const bubble = document.querySelector('.lesson-spot .kit-callout')
  if (want.bubble) {
    if (!bubble) bad.push('no bubble')
    else {
      const b = bubble.getBoundingClientRect()
      if (!inside(b, win)) bad.push('bubble off screen')
      const button = bubble.querySelector('button')?.getBoundingClientRect()
      if (button && !inside(button, b, 4)) bad.push('button touches the bubble edge')
      const words = bubble.querySelector('.lesson-words')?.getBoundingClientRect()
      if (words && !inside(words, b, 4)) bad.push('words touch the bubble edge')
    }
  }
  if (want.crt) {
    const screen = document.querySelector('[data-tag="crt"]'), words = screen?.querySelector('.lesson-words')
    if (!screen || !words) bad.push('no words on the monitor')
    else {
      const s = screen.getBoundingClientRect(), w = words.getBoundingClientRect()
      if (!inside(w, s, 4)) bad.push('monitor words touch the screen edge')
      if (!inside(w, win, 4)) bad.push('monitor words off the window')
      const button = screen.querySelector('button')?.getBoundingClientRect()
      if (button && !inside(button, s, 4)) bad.push('Got it touches the screen edge')
    }
  }
  if (want.ring) {
    const ring = document.querySelector('.lesson-spot .kit-callout-ring')
    if (!ring || ring.style.display === 'none') bad.push('no outline')
    else if (!inside(ring.getBoundingClientRect(), win)) bad.push('outline runs off screen')
  }
  return bad
}
// the visor's repair by real input, following the lit lamps: slide up → each lit button → slide down
// (atButtons: run once the buttons' turn has come)
async function repairVisor(page, atButtons) {
  const vs = await page.getByRole('slider', { name: 'Visor slider' }).boundingBox()
  const drag = async (y0, y1) => { const x = vs.x + vs.width / 2; await page.mouse.move(x, y0); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(x, y0 + ((y1 - y0) * k) / 8); await page.mouse.up() }
  await drag(vs.y + vs.height * 0.85, vs.y - 20)
  await page.waitForTimeout(250)
  await atButtons?.()
  const buttons = await Promise.all(['Blue button', 'Yellow button', 'Pink button'].map((n) => page.getByRole('button', { name: n }).boundingBox()))
  for (let i = 0; i < 3; i++) {
    const lit = await page.locator('img[src*="Light-On"]').first().boundingBox()
    const ly = lit.y + lit.height / 2
    const b = buttons.reduce((best, r) => (Math.abs(r.y + r.height / 2 - ly) < Math.abs(best.y + best.height / 2 - ly) ? r : best))
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(250)
  }
  await drag(vs.y + vs.height * 0.15, vs.y + vs.height + 20)
}

async function open(w, h, url) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('Lesson'))) errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/${url}`)
  await startShift(page)
  return { page, errors }
}

try {
  // ---------------- desktop: the whole sample lesson, by real input ----------------
  {
    const { page, errors } = await open(1440, 900, '?seed=7&lesson=sample')
    await stepIs(page, 'welcome')
    await bubble(page).waitFor()
    await page.waitForTimeout(400)
    const y0 = await pieceRow(page)
    await page.waitForTimeout(800)
    const y1 = await pieceRow(page)
    check('welcome: the message shows and the shift is paused under it', (await bubble(page).textContent()).includes('Goop drops') && y0 === y1, `piece row ${y0} → ${y1}`)
    await page.screenshot({ path: `${OUT}/1-welcome-1440x900.png` })
    await clickGotIt(page)
    await stepIs(page, 'falls')
    check('Got it (a click) moves on; the piece falls on its own', true)
    await stepIs(page, 'fastDrop', 15000)
    check('position gate: the piece reached row 5 → the fast-drop step', true)

    // wait-then-hint: do nothing for longer than the hint's 4 s
    await page.waitForTimeout(4500)
    const hint = await lesson(page)
    check('wait-then-hint: after waiting, the hint replaces the message', hint.kind === 'hint' && (await bubble(page).textContent()).includes('Hold S'))
    await page.screenshot({ path: `${OUT}/2-hint-1440x900.png` })
    await page.keyboard.down('KeyS')
    await stepIs(page, 'zap', 10000)
    await page.keyboard.up('KeyS')
    check('holding S fast-drops the piece; it lands → the zap step', true)

    // the Dev Kit's full pause stops the lesson's timers: frozen for longer than the 5 s hint → no hint
    await page.waitForTimeout(600)
    await page.keyboard.press('Backquote'); await page.waitForTimeout(300)
    await pauseBtn(page, 'full').click()
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    await page.waitForTimeout(6000)
    const frozen = await lesson(page)
    check('Dev Kit full pause: the lesson\'s hint timer stands still (no hint after 6 s frozen)', frozen.kind === 'step', JSON.stringify(frozen))
    await page.locator('.devkit-pause-badge').click()
    await page.waitForTimeout(5000)
    check('…and after resuming it runs on: the hint comes', (await lesson(page)).kind === 'hint')
    await page.screenshot({ path: `${OUT}/3-zap-hint-1440x900.png` })
    const [cx, cy] = await markCentre(page)
    await page.mouse.click(cx, cy)
    await stepIs(page, 'pressure', 5000)
    check('clicking the green goop zaps it → the pressure step', true)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/4-pressure-1440x900.png` })
    await stepIs(page, 'done', 15000)
    check('pressure gate: 30% → the last step', (await page.evaluate(() => window.__goops.engine.state.pressure)) >= 0.3)
    await page.waitForTimeout(600)
    await clickGotIt(page)
    await page.waitForFunction(() => window.__goops.lessonView().done)
    const p0 = await page.evaluate(() => window.__goops.engine.state.pressure)
    await page.waitForTimeout(1500)
    const after = await page.evaluate(() => ({ p: window.__goops.engine.state.pressure, piece: !!window.__goops.engine.state.piece }))
    check('finished: no message, the shift carries on as normal play (a piece, pressure rising)',
      (await bubble(page).count()) === 0 && after.piece && after.p > p0, `pressure ${p0.toFixed(3)} → ${after.p.toFixed(3)}`)

    // the Dev Kit's Lessons tab: ▶ a step plays the lesson from there; a timing edit reaches the running lesson
    await page.keyboard.press('Backquote'); await page.waitForTimeout(300)
    await page.locator('aside.devkit .devkit-tab', { hasText: 'Lessons' }).click()
    await page.locator('aside.devkit select[aria-label="Lesson"]').selectOption('sample') // (F32 added more lessons)
    await page.getByRole('button', { name: 'Play from step 4' }).click()
    await stepIs(page, 'zap')
    await page.getByLabel('zap: hint after').fill('1')
    await page.screenshot({ path: `${OUT}/5-devkit-tab-1440x900.png` })
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    await page.evaluate(() => window.__goops.lesson('sample', 'zap')) // the step again, with the edit
    await page.waitForTimeout(1600)
    check('Lessons tab: ▶ jumps to a step; an edited hint time (1 s) is used when the step plays again', (await lesson(page)).kind === 'hint')
    check('desktop: no page errors or lesson set-up warnings', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- phone: the look at 390x844; jump straight to a step (the dev hook) ----------------
  {
    const { page, errors } = await open(390, 844, '?seed=7&lesson=sample')
    await stepIs(page, 'welcome')
    await gotIt(page).waitFor()
    await page.screenshot({ path: `${OUT}/1-welcome-390x844.png` })
    await page.evaluate(() => window.__goops.lesson('sample', 4))
    await stepIs(page, 'zap')
    await bubble(page).waitFor()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/3-zap-390x844.png` })
    const box = await bubble(page).boundingBox()
    check('phone: the message fits on screen', box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, JSON.stringify(box))
    await page.evaluate(() => window.__goops.lesson('sample', 'pressure'))
    await stepIs(page, 'pressure')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/4-pressure-390x844.png` })
    check('phone: jumping to steps works; no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- F32: the visor's first breakdown in a REAL shift (rank 2), played through by real input ----------------
  // (Muzzy's first try, 2026-10-19: bubbles only in the tank, with Got it from the first frame, inside the phone column,
  //  on the spotlight's dim; ONE go-to-console message that insists; at the console the words are on the monitor)
  {
    const { page, errors } = await open(1440, 900, '?seed=7&rank=2')
    await spyEngine(page)
    await watchFirstFrame(page)
    // the visor fades and breaks on its own after ~10 s without a fast drop (content/tuning/breakdowns.json visor)
    await page.waitForFunction(() => window.__goops.lessonView().lessonId === 'visor', null, { timeout: 30000 })
    await stepIs(page, 'broke')
    await bubble(page).waitFor()
    await page.waitForTimeout(500)
    const toastSays = await page.evaluate(() => [...document.querySelectorAll('.kit-toast')].map((t) => t.textContent).join(' | '))
    const still = await gameMs(page, 600)
    check('V1: the visor\'s first real break pauses the shift and says what broke (not the game\'s "swipe up" message)',
      (await bubble(page).textContent()).includes('Your visor broke') && still === 0 && !toastSays.includes('Visor broken'), `game ms ${still}, toasts "${toastSays}"`)
    const first = await page.evaluate(() => window.__firstFrame)
    const later = await bubble(page).boundingBox()
    check('V1: the words and Got it are there together on the message\'s first frame, and it never changes shape',
      first?.button === true && Math.abs(first.w - later.width) < 1 && Math.abs(first.h - later.height) < 1, JSON.stringify({ first, later }))
    check('V1: points at the VISOR bar, which is cut out of the dim', await pointsAt(page, '.kit-bar:has([aria-label="VISOR"])') && await undimmed(page, '.kit-bar:has([aria-label="VISOR"])'))
    check('V1: the message sits inside the game\'s column', await inColumn(page))
    await page.screenshot({ path: `${OUT}/f32-visor-1-broke-1440x900.png` })
    await clickGotIt(page)
    await stepIs(page, 'toConsole')
    // ("Got it" was a mouse click: the mouse words; W / ↑ is the keys version)
    check('V2: go to the console (mouse wording after a click), the shift running, no dim yet',
      (await bubble(page).textContent()).includes('Flick up for the console') && (await gameMs(page, 500)) > 300 && !(await dimmed(page)))
    // the HUD's Console button opens the PAUSE MENU: the lesson says so, then carries on when it's closed
    await page.getByRole('button', { name: 'Console', exact: true }).click()
    await page.waitForFunction(() => window.__goops.lessonView().message?.kind === 'reaction')
    await page.waitForTimeout(400)
    check('V2: the pause menu opened → "That\'s the pause menu…" over it', (await bubble(page).textContent()).includes("That's the pause menu"))
    await page.screenshot({ path: `${OUT}/f32-visor-2-pause-menu-1440x900.png` })
    await page.getByRole('button', { name: 'Back to the tank' }).click()
    await page.waitForFunction(() => window.__goops.lessonView().message?.kind !== 'reaction')
    check('…closing it brings the step back', (await lesson(page)).step === 'toConsole')
    // nothing done: once the visor has been broken insistSeconds (4 s = its glitch at full strength), the SAME message
    // insists — the shift pauses, the dim comes on, only W / ↑ / flick up work
    await page.waitForFunction(() => window.__goops.lessonView().message?.insisting === true, null, { timeout: 10000 })
    await page.waitForTimeout(400)
    const acts0 = await page.evaluate(() => window.__acts.length)
    for (const key of ['KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyS']) { await page.keyboard.press(key); await page.waitForTimeout(40) }
    // (S let go = "stop fast-dropping": a release, not a control)
    const tankActs = await page.evaluate((n) => window.__acts.slice(n).filter((a) => a.type !== 'console' && !(a.type === 'softDrop' && !a.on)).map((a) => a.type), acts0)
    const hudButton = await page.getByRole('button', { name: 'Console', exact: true }).boundingBox()
    const pauseBlocked = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.classList.contains('lesson-spot-block'),
      [hudButton.x + hudButton.width / 2, hudButton.y + hudButton.height / 2])
    check('V2 insists: one message (same words), the shift paused, dimmed, the tank\'s keys do nothing, the HUD is behind the dim',
      // (the keys just pressed switch it to the keys' words: "Press W or ↑ for the console.")
      (await bubble(page).count()) === 1 && (await bubble(page).textContent()).includes('for the console') && (await gameMs(page, 500)) === 0
      && await dimmed(page) && tankActs.length === 0 && pauseBlocked, JSON.stringify({ tankActs, pauseBlocked }))
    check('V2 insists: the tank under the dim still takes the flick (taps reach it)', await page.evaluate(() => {
      const st = document.querySelector('[data-testid="stage"]'), c = document.querySelector('canvas')?.getBoundingClientRect()
      return !!st && !!c && st.contains(document.elementFromPoint(c.x + c.width / 2, c.y + c.height * 0.6))
    }))
    await page.screenshot({ path: `${OUT}/f32-visor-2b-insist-1440x900.png` })
    // the flick up (a quick drag up on the tank) is the one control that works
    const tank = await page.evaluate(() => { const c = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return [c.x + c.width / 2, c.y + c.height * 0.6] })
    await page.mouse.move(tank[0], tank[1]); await page.mouse.down()
    for (let k = 1; k <= 5; k++) { await page.mouse.move(tank[0], tank[1] - 30 * k); await page.waitForTimeout(10) }
    await page.mouse.up()
    await stepIs(page, 'fullyPaused')
    check('V2 insists: a flick up opens the console', true)
    await consoleStill(page)
    await page.waitForTimeout(400)
    check('V3a (the very first breakdown lesson): "fully paused… normally 25%" on the monitor with Got it, no bubble, the tank frozen',
      (await crt(page).textContent()).includes('Normally it keeps running at 25% speed') && (await crt(page).getByRole('button', { name: 'Got it' }).count()) === 1
      && (await bubble(page).count()) === 0 && (await gameMs(page, 600)) === 0)
    check('V3a: the monitor\'s screen is cut out of the dim', await dimmed(page) && await undimmed(page, '[data-tag="crt"]'))
    await page.screenshot({ path: `${OUT}/f32-visor-3-fully-paused-1440x900.png` })
    await clickGotIt(page)
    await stepIs(page, 'fix')
    await page.waitForTimeout(500)
    check('V3: "Drag the slider toward the light" on the monitor; ONE outline round the top light AND the slider; the whole panel undimmed; tank frozen',
      (await crt(page).textContent()).includes('Drag the slider toward the light') && await ringAround(page, ['[aria-label="Visor slider"]', 'img[src*="Light-On"]'])
      && await undimmed(page, '[data-tag="panel-visor"]') && (await gameMs(page, 1000)) === 0)
    await page.screenshot({ path: `${OUT}/f32-visor-4-fix-1440x900.png` })
    // a click on the top of the track: the knob doesn't jump there (a real drag)
    const vs = await page.getByRole('slider', { name: 'Visor slider' }).boundingBox()
    await page.mouse.click(vs.x + vs.width / 2, vs.y + vs.height * 0.1)
    await page.waitForTimeout(200)
    check('fix: a click on the top of the slider\'s track leaves the knob down', await page.evaluate(() => document.querySelector('[aria-label="Visor slider"]').getAttribute('aria-valuenow')) === '1')
    await repairVisor(page, async () => {
      await page.waitForTimeout(400)
      check('fix, button stage: "Press the lit button" — one text; the outline round the lit button and its light',
        (await crt(page).textContent()).includes('Press the lit button') && !(await crt(page).textContent()).includes('slider')
        && await ringAround(page, ['img[src*="Light-On"]']))
      await page.screenshot({ path: `${OUT}/f32-visor-4b-fix-button-1440x900.png` })
      const shakeOf = () => page.evaluate(() => document.querySelector('.kit-art-layer[data-shake]')?.getAttribute('data-shake') ?? '')
      const s0 = await shakeOf()
      await page.mouse.click(vs.x + vs.width / 2, vs.y + vs.height * 0.3)
      await page.waitForTimeout(80)
      check('fix, button stage: touching the slider shakes the panel (like a wrong button)', (await shakeOf()) !== s0)
      await page.waitForTimeout(400)
    })
    await stepIs(page, 'fixed')
    await page.waitForTimeout(400)
    const fixedText = await crt(page).textContent()
    check('V4: repaired by real input → "Fixed!" and the tip on the monitor (two lines), Got it with them',
      fixedText.includes('Fixed!') && fixedText.includes('Dropping the Goop faster keeps the Visor charged') && (await crt(page).getByRole('button', { name: 'Got it' }).count()) === 1
      && await page.evaluate(() => getComputedStyle(document.querySelector('[data-tag="crt"] .lesson-words')).whiteSpace === 'pre-line'))
    check('V4: the visor panel is shown lit (not switched off), outlined and undimmed', await page.evaluate(() => !document.querySelector('[data-tag="panel-visor"]').parentElement.hasAttribute('data-off'))
      && await ringAround(page, ['[data-tag="panel-visor"]']) && await undimmed(page, '[data-tag="panel-visor"]'))
    check('the repair counts: seen on this device', await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))).seen.includes('lesson:visor')))
    await page.screenshot({ path: `${OUT}/f32-visor-5-fixed-1440x900.png` })
    await clickGotIt(page)
    await stepIs(page, 'back')
    await page.waitForTimeout(400)
    check('V5: no message — the monitor says "pull the periscope", the spotlight is on the periscope (outlined, undimmed)',
      (await bubble(page).count()) === 0 && (await crt(page).textContent()).toLowerCase().includes('periscope') && await pointsAt(page, '.kit-pull-grip') && await undimmed(page, '.kit-pull-grip'))
    await page.screenshot({ path: `${OUT}/f32-visor-6-back-1440x900.png` })
    await page.locator('.kit-pull-grip').click() // (a tap on the periscope pulls it — through the spotlight's hole)
    await page.waitForFunction(() => window.__goops.lessonView().done && !window.__goops.lessonView().lessonId, null, { timeout: 5000 })
    await page.waitForTimeout(300)
    // normal play afterwards: full speed, every control works
    const full = await gameMs(page, 1000)
    const acts1 = await page.evaluate(() => window.__acts.length)
    for (const key of ['KeyA', 'KeyD', 'KeyQ', 'KeyE']) { await page.keyboard.press(key); await page.waitForTimeout(60) }
    await page.keyboard.down('KeyS'); await page.waitForTimeout(200); await page.keyboard.up('KeyS')
    const acts = await page.evaluate((n) => window.__acts.slice(n).map((a) => a.type), acts1)
    check('after the lesson: no message, no dim, the shift at full speed, spin / rotate / fast drop all work',
      (await bubble(page).count()) === 0 && !(await dimmed(page)) && full > 850 && ['spin', 'rotate', 'softDrop'].every((t) => acts.includes(t)), `${Math.round(full)} ms in 1 s; acts ${[...new Set(acts)]}`)

    // the next break: no lesson (once per device)
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await page.waitForTimeout(400)
    check('the visor breaks again → no lesson this time', (await lesson(page)).step === null && (await bubble(page).count()) === 0)

    // console visits outside a lesson: the first 5 say (on the monitor) the tank runs at 25% there, then not
    const notes = []
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('KeyW')
      await consoleStill(page)
      await page.waitForTimeout(300)
      notes.push((await crt(page).textContent()).includes('keeps running at 25% speed'))
      if (i === 0) {
        const ms = await gameMs(page, 1000)
        check('console visit 1: the note shows on the monitor (no bubble) and the tank really runs at about 25%', notes[0] && (await bubble(page).count()) === 0 && ms > 150 && ms < 350, `${Math.round(ms)} ms in 1 s`)
        await page.screenshot({ path: `${OUT}/f32-console-note-1440x900.png` })
      }
      await page.getByRole('button', { name: 'Back to the tank' }).click()
      await page.waitForFunction(() => document.querySelector('.kit-art-stage') === null, null, { timeout: 5000 })
      await page.waitForTimeout(200)
    }
    check('console visits: the note on the first 5, not the 6th', notes.join() === 'true,true,true,true,true,false', notes.join())

    // Settings → Replay lessons: the visor's lesson plays again at its next break
    await page.getByRole('button', { name: 'Console', exact: true }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('tab', { name: 'Gameplay' }).click()
    await page.getByRole('button', { name: 'Replay lessons' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Replay lessons' }).click()
    await page.waitForTimeout(300)
    while (await page.evaluate(() => document.querySelector('.kit-pause, .kit-settings, [role="dialog"]') !== null)) { await page.keyboard.press('Escape'); await page.waitForTimeout(250) }
    await page.evaluate(() => { const m = window.__goops.engine.state.machines.visor; m.broken = false; m.health = 1; m.brokenMs = 0 })
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await stepIs(page, 'broke')
    check('Replay lessons: the next visor break plays its lesson again', true)
    // leaving the shift before the repair → not marked seen
    await clickGotIt(page)
    await page.getByRole('button', { name: 'Console', exact: true }).click()
    await page.getByRole('button', { name: 'End shift' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'End shift' }).click()
    await page.locator('.kit-art-stage').waitFor()
    check('ending the shift before the repair: the lesson isn\'t marked seen', await page.evaluate(() => !JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))).seen.includes('lesson:visor')))
    check('F32 visor: no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- F32 bug (Muzzy, 2026-10-19): Replay lessons from the START console's gear did nothing ----------------
  // (that screen stack had no kit confirm screen: Settings closed and nothing was forgotten)
  {
    const { page, errors } = await open(1440, 900, '?seed=7&rank=6')
    await page.evaluate(() => { // (the kit's key: 'kit-tips:' + the first folder of the page's path — '' here)
      const k = `kit-tips:${location.pathname.split('/').slice(1, -1)[0] ?? ''}`
      localStorage.setItem(k, JSON.stringify({ on: true, seen: ['lesson:visor', 'lesson:laser', 'lesson:controls'] }))
    })
    await page.reload()
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('tab', { name: 'Gameplay' }).click()
    await page.getByRole('button', { name: 'Replay lessons' }).click()
    await page.locator('.kit-ask').getByRole('button', { name: 'Replay lessons' }).click({ timeout: 3000 })
    const forgot = await page.waitForFunction(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))).seen.length === 0, null, { timeout: 3000 }).then(() => true, () => false)
    check('Replay lessons from the start console: the device forgets the lessons', forgot,
      await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.startsWith('kit-tips')).map(([, v]) => v).join()))
    for (let i = 0; i < 6 && await page.evaluate(() => document.querySelector('.kit-layer') !== null); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300) }
    await startShift(page)
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await stepIs(page, 'broke')
    check('…and the next visor break plays its lesson', true)
    check('Replay from the console: no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- F32: the tank ruptures mid-lesson → the lesson steps aside, the drain runs ----------------
  {
    const { page, errors } = await open(1440, 900, '?seed=7&rank=6')
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await stepIs(page, 'broke')
    await clickGotIt(page)
    await stepIs(page, 'toConsole')
    await page.evaluate(() => { const s = window.__goops.engine.state; s.pressure = 0.8; s.integrity = 0 })
    await page.waitForFunction(() => window.__goops.engine.state.phase === 'rupture', null, { timeout: 5000 })
    await page.waitForTimeout(300)
    check('rupture mid-lesson: the lesson stops', await page.evaluate(() => !window.__goops.lessonView().lessonId))
    const p0 = await page.evaluate(() => window.__goops.engine.state.pressure)
    await page.keyboard.press('KeyW')
    await page.waitForTimeout(1500)
    const p1 = await page.evaluate(() => window.__goops.engine.state.pressure)
    check('rupture mid-lesson: the drain keeps running at the console', p1 < p0, `${p0} → ${p1}`)
    check('rupture mid-lesson: no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- F32: every step of each lesson at every size (screenshots + look checks) ----------------
  // (the repair itself is done by the engine here — the visor's real-input repair is above)
  for (const [w, h] of [[390, 844], [360, 780], [1440, 900], [1920, 1080], [844, 390]]) {
    const side = h < w && h < 500 // a phone on its side: no monitor on screen, the bubbles come back at the console
    for (const machine of ['visor', 'laser', 'controls']) {
      if (side && machine !== 'visor') continue // (on its side: one lesson is enough to see nothing breaks)
      const { page, errors } = await open(w, h, '?seed=7&rank=6')
      const name = `${machine}-${w}x${h}`
      const shot = (step) => page.screenshot({ path: `${OUT}/f32-${name}-${step}.png` })
      const looks = []
      const look = async (step, want) => { const bad = await page.evaluate(lookProblems, want); if (bad.length) looks.push(`${step}: ${bad.join(', ')}`) }
      await watchFirstFrame(page)
      await page.evaluate((m) => window.__goops.breakMachine(m, true), machine)
      await stepIs(page, 'broke')
      await bubble(page).waitFor()
      await page.waitForTimeout(500)
      await shot('1-broke')
      const first = await page.evaluate(() => window.__firstFrame)
      check(`${name}: V1 — Got it on the first frame, inside the column, pointing at its bar (cut out of the dim)`,
        first?.button === true && await inColumn(page) && await pointsAt(page, `.kit-bar:has([aria-label="${machine.toUpperCase()}"])`)
        && await undimmed(page, `.kit-bar:has([aria-label="${machine.toUpperCase()}"])`), JSON.stringify(first))
      await look('broke', { bubble: true })
      await clickGotIt(page)
      await stepIs(page, 'toConsole')
      await page.waitForTimeout(400)
      await shot('2-to-console')
      check(`${name}: V2 inside the column, not dimmed`, await inColumn(page) && !(await dimmed(page)))
      await page.waitForFunction(() => window.__goops.lessonView().message?.insisting === true, null, { timeout: 10000 })
      await page.waitForTimeout(400)
      await shot('2b-insist')
      check(`${name}: V2 insists — one message, inside the column, dimmed`, (await bubble(page).count()) === 1 && await inColumn(page) && await dimmed(page))
      await look('insist', { bubble: true })
      await page.keyboard.press('KeyW')
      await stepIs(page, 'fullyPaused')
      await consoleStill(page)
      await page.waitForTimeout(400)
      await shot('3-fully-paused')
      if (!side) check(`${name}: fully paused — on the monitor with Got it, screen undimmed, no bubble`, (await crt(page).getByRole('button', { name: 'Got it' }).count()) === 1 && await undimmed(page, '[data-tag="crt"]') && (await bubble(page).count()) === 0)
      else check(`${name}: fully paused — a bubble (the monitor is off screen) inside the window`, await inColumn(page))
      await look('fullyPaused', { bubble: side, crt: !side })
      await clickGotIt(page)
      await stepIs(page, 'fix')
      await page.waitForTimeout(500)
      await shot('4-fix')
      if (!side) check(`${name}: fix — words on the monitor, the part to use outlined, its panel undimmed`, (await bubble(page).count()) === 0 && await ringAround(page, [`[data-tag="repair-${machine}"]`]) && await undimmed(page, `[data-tag="panel-${machine}"]`))
      await look('fix', { bubble: side, crt: !side, ring: true })
      await page.evaluate((m) => window.__goops.engine.act({ type: 'repair', machine: m }), machine)
      await stepIs(page, 'fixed')
      await page.waitForTimeout(500)
      await shot('5-fixed')
      if (!side) {
        const said = await crt(page).textContent()
        check(`${name}: Fixed! + its tip on the monitor, the panel lit and undimmed`, said.includes('Fixed!') && said.length > 20 && await undimmed(page, `[data-tag="panel-${machine}"]`)
          && await page.evaluate((m) => !document.querySelector(`[data-tag="panel-${m}"]`).parentElement.hasAttribute('data-off'), machine))
      }
      await look('fixed', { bubble: side, crt: !side, ring: true })
      await clickGotIt(page)
      await stepIs(page, 'back')
      await page.waitForTimeout(500)
      await shot('6-back')
      check(`${name}: back — no bubble, the way back outlined and undimmed`, (await bubble(page).count()) === 0 && (side ? await undimmed(page, '.kit-screen[aria-label="Console"] [data-slot="bottom-left"] button') : await undimmed(page, '.kit-pull-grip')))
      await look('back', { ring: true })
      check(`${name}: every step's look (outline whole, breathing room, words on the screen)`, looks.length === 0, looks.join(' | '))
      check(`${name}: no page errors`, errors.length === 0, errors.join(' | '))
      await page.close()
    }
  }

  // ---------------- F32: the console-visit note on a phone: on the monitor ----------------
  {
    const { page, errors } = await open(390, 844, '?seed=7')
    await page.keyboard.press('KeyW')
    await consoleStill(page)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/f32-console-note-390x844.png` })
    const grip = await page.locator('.kit-pull-grip').boundingBox(), screen = await crt(page).boundingBox()
    check('phone console note: on the monitor, no bubble, no Got it, and the screen doesn\'t slide over the periscope',
      (await crt(page).textContent()).includes('25% speed') && (await bubble(page).count()) === 0 && (await crt(page).getByRole('button').count()) === 0
      && screen.y + screen.height <= grip.y + 1, JSON.stringify({ screen, grip }))
    await page.waitForTimeout(6500)
    check('…it goes by itself after ~6 s; the monitor says its own words again', !(await crt(page).textContent()).includes('25% speed'))
    await page.getByRole('button', { name: 'Back to the tank' }).click()
    await page.waitForFunction(() => document.querySelector('.kit-art-stage') === null, null, { timeout: 5000 })
    check('phone console note: no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
process.exit(failed ? 1 : 0)
