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
const fits = async (page, w, h) => { const b = await bubble(page).boundingBox(); return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= w && b.y + b.height <= h }
// the visor's repair by real input, following the lesson's pointer: slide up → each lit button → slide down
async function repairVisor(page) {
  const vs = await page.getByRole('slider', { name: 'Visor slider' }).boundingBox()
  const drag = async (y0, y1) => { const x = vs.x + vs.width / 2; await page.mouse.move(x, y0); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(x, y0 + ((y1 - y0) * k) / 8); await page.mouse.up() }
  await drag(vs.y + vs.height * 0.85, vs.y - 20)
  await page.waitForTimeout(250)
  const buttons = await Promise.all(['Blue button', 'Yellow button', 'Pink button'].map((n) => page.getByRole('button', { name: n }).boundingBox()))
  for (let i = 0; i < 3; i++) {
    const lit = await page.locator('[data-tag="repair-visor"]').boundingBox()
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
    await gotIt(page).click()
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
    await gotIt(page).click()
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
  {
    const { page, errors } = await open(1440, 900, '?seed=7&rank=2')
    await spyEngine(page)
    // the visor fades and breaks on its own after ~10 s without a fast drop (content/tuning/breakdowns.json visor)
    await page.waitForFunction(() => window.__goops.lessonView().lessonId === 'visor', null, { timeout: 30000 })
    await stepIs(page, 'broke')
    await bubble(page).waitFor()
    await page.waitForTimeout(500)
    const toastSays = await page.evaluate(() => [...document.querySelectorAll('.kit-toast')].map((t) => t.textContent).join(' | '))
    const still = await gameMs(page, 600)
    check('V1: the visor\'s first real break pauses the shift and says what broke (not the game\'s "swipe up" message)',
      (await bubble(page).textContent()).includes('Your visor broke') && still === 0 && !toastSays.includes('Visor broken'), `game ms ${still}, toasts "${toastSays}"`)
    check('V1: points at the VISOR bar', await pointsAt(page, '.kit-bar:has([aria-label="VISOR"])'))
    await page.screenshot({ path: `${OUT}/f32-visor-1-broke-1440x900.png` })
    await gotIt(page).click()
    await stepIs(page, 'toConsole')
    // ("Got it" was a mouse click: the mouse words; W / ↑ is the keys version)
    check('V2: go to the console (mouse wording after a click), the shift running', (await bubble(page).textContent()).includes('Flick up for the console') && (await gameMs(page, 500)) > 300)
    // the HUD's Console button opens the PAUSE MENU: the lesson says so, then carries on when it's closed
    await page.getByRole('button', { name: 'Console', exact: true }).click()
    await page.waitForFunction(() => window.__goops.lessonView().message?.kind === 'reaction')
    await page.waitForTimeout(400)
    check('V2: the pause menu opened → "That\'s the pause menu. Use W or ↑…" over it', (await bubble(page).textContent()).includes("That's the pause menu"))
    await page.screenshot({ path: `${OUT}/f32-visor-2-pause-menu-1440x900.png` })
    await page.getByRole('button', { name: 'Back to the tank' }).click()
    await page.waitForFunction(() => window.__goops.lessonView().message?.kind !== 'reaction')
    check('…closing it brings the step back', (await lesson(page)).step === 'toConsole')
    await page.keyboard.press('KeyW')
    await stepIs(page, 'fullyPaused')
    await bubble(page).waitFor()
    await consoleStill(page)
    check('V3a (the very first breakdown lesson): "fully paused… normally 25%" at the console, the tank frozen',
      (await bubble(page).textContent()).includes('Normally it keeps running at 25% speed') && (await gameMs(page, 600)) === 0)
    await page.screenshot({ path: `${OUT}/f32-visor-3-fully-paused-1440x900.png` })
    await gotIt(page).click()
    await stepIs(page, 'fix')
    await page.waitForTimeout(500)
    check('V3: "follow the lights", pointing at the blinking top light; the tank frozen for this first repair',
      (await bubble(page).textContent()).includes('Follow the lights') && await pointsAt(page, '[data-tag="repair-visor"]') && (await gameMs(page, 1000)) === 0)
    await page.screenshot({ path: `${OUT}/f32-visor-4-fix-1440x900.png` })
    await repairVisor(page)
    await stepIs(page, 'fixed')
    check('V4: repaired by real input → "Fixed! Fast drops keep the visor charged."', (await bubble(page).textContent()).includes('Fast drops keep the visor charged'))
    check('the repair counts: seen on this device', await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))).seen.includes('lesson:visor')))
    await gotIt(page).click()
    await stepIs(page, 'back')
    check('V5: points at the periscope (the part you grab)', await pointsAt(page, '.kit-pull-grip'))
    await page.screenshot({ path: `${OUT}/f32-visor-5-back-1440x900.png` })
    await page.getByRole('button', { name: 'Back to the tank' }).click()
    await page.waitForFunction(() => window.__goops.lessonView().done && !window.__goops.lessonView().lessonId, null, { timeout: 5000 })
    await page.waitForTimeout(300)
    // normal play afterwards: full speed, every control works
    const full = await gameMs(page, 1000)
    const acts0 = await page.evaluate(() => window.__acts.length)
    for (const key of ['KeyA', 'KeyD', 'KeyQ', 'KeyE']) { await page.keyboard.press(key); await page.waitForTimeout(60) }
    await page.keyboard.down('KeyS'); await page.waitForTimeout(200); await page.keyboard.up('KeyS')
    const acts = await page.evaluate((n) => window.__acts.slice(n).map((a) => a.type), acts0)
    check('after the lesson: no message, the shift at full speed, spin / rotate / fast drop all work',
      (await bubble(page).count()) === 0 && full > 850 && ['spin', 'rotate', 'softDrop'].every((t) => acts.includes(t)), `${Math.round(full)} ms in 1 s; acts ${[...new Set(acts)]}`)

    // the next break: no lesson (once per device)
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await page.waitForTimeout(400)
    check('the visor breaks again → no lesson this time', (await lesson(page)).step === null && (await bubble(page).count()) === 0)

    // console visits outside a lesson: the first 5 say the tank runs at 25% there (content/tuning/lessons.json), then not
    const notes = []
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('KeyW')
      await consoleStill(page)
      await page.waitForTimeout(300)
      const says = (await bubble(page).count()) ? await bubble(page).textContent() : ''
      notes.push(says.includes('keeps running at 25% speed'))
      if (i === 0) {
        const ms = await gameMs(page, 1000)
        check('console visit 1: the note shows and the tank really runs at about 25%', notes[0] && ms > 150 && ms < 350, `${Math.round(ms)} ms in 1 s`)
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
    await page.screenshot({ path: `${OUT}/f32-replay-confirm-1440x900.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Replay lessons' }).click()
    await page.waitForTimeout(300)
    while (await page.evaluate(() => document.querySelector('.kit-pause, .kit-settings, [role="dialog"]') !== null)) { await page.keyboard.press('Escape'); await page.waitForTimeout(250) }
    await page.evaluate(() => { const m = window.__goops.engine.state.machines.visor; m.broken = false; m.health = 1 })
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await stepIs(page, 'broke')
    check('Replay lessons: the next visor break plays its lesson again', true)
    // leaving the shift before the repair → not marked seen
    await gotIt(page).click()
    await page.getByRole('button', { name: 'Console', exact: true }).click()
    await page.getByRole('button', { name: 'End shift' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'End shift' }).click()
    await page.locator('.kit-art-stage').waitFor()
    check('ending the shift before the repair: the lesson isn\'t marked seen', await page.evaluate(() => !JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kit-tips')))).seen.includes('lesson:visor')))
    check('F32 visor: no page errors', errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // ---------------- F32: the tank ruptures mid-lesson → the lesson steps aside, the drain runs ----------------
  {
    const { page, errors } = await open(1440, 900, '?seed=7&rank=6')
    await page.evaluate(() => window.__goops.breakMachine('visor', true))
    await stepIs(page, 'broke')
    await gotIt(page).click()
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

  // ---------------- F32: each lesson's first and console steps, phone + desktop (screenshots + pointer checks) ----------------
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    for (const machine of ['visor', 'laser', 'controls']) {
      const { page, errors } = await open(w, h, '?seed=7&rank=6')
      const name = `${machine}-${w}x${h}`
      await page.evaluate((m) => window.__goops.breakMachine(m, true), machine)
      await stepIs(page, 'broke')
      await bubble(page).waitFor()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${OUT}/f32-${name}-1-broke.png` })
      check(`${name}: V1 on screen, pointing at its bar`, await fits(page, w, h) && await pointsAt(page, `.kit-bar:has([aria-label="${machine.toUpperCase()}"])`))
      await gotIt(page).click()
      await stepIs(page, 'toConsole')
      await page.keyboard.press('KeyW')
      await stepIs(page, 'fullyPaused')
      await consoleStill(page)
      await gotIt(page).waitFor()
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/f32-${name}-2-fully-paused.png` })
      check(`${name}: "fully paused" on screen, pointing at the monitor's words`, await fits(page, w, h) && await pointsAt(page, '[data-tag="monitor"]'))
      await gotIt(page).click()
      await stepIs(page, 'fix')
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/f32-${name}-3-fix.png` })
      check(`${name}: the console step on screen, pointing at the part to do next`, await fits(page, w, h) && await pointsAt(page, `[data-tag="repair-${machine}"]`))
      check(`${name}: no page errors`, errors.length === 0, errors.join(' | '))
      await page.close()
    }
  }

  // ---------------- F32: the console-visit note on a phone (it may sit over the periscope there: it can be closed) ----------------
  {
    const { page, errors } = await open(390, 844, '?seed=7')
    await page.keyboard.press('KeyW')
    await consoleStill(page)
    await gotIt(page).waitFor()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/f32-console-note-390x844.png` })
    check('phone console note: on screen, with Got it', await fits(page, 390, 844) && (await bubble(page).textContent()).includes('25% speed'))
    await gotIt(page).click()
    await page.waitForTimeout(300)
    check('…Got it closes it; the periscope takes you back', (await bubble(page).count()) === 0)
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
