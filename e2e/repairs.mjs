// REPAIRS AT THE CONSOLE (F24 + F23 task 4), at 9 screen sizes, with a real mouse AND a real finger (CDP touch):
//   a shift at rank 6 (all three machines unlocked) → the machine bars in the panel under the tank (HUD check: every part over
//   the tank, nothing overlapping, the meters clear of the tank) → swipe up / W → the console slides over the tank,
//   which keeps running SLOWLY (engine ticks > 0, about consoleTimeScale of real time) → break each machine (DEV hook
//   window.__goops.breakMachine) → its panel lights up → solve it by reading its lamps like a player, half with the
//   mouse (drags + taps), half with a finger → the repair action fires (engine.act spied) and the machine is fixed →
//   the periscope (or Back to the tank on a phone on its side) → the SAME shift, running at full speed.
//   Once (phone size): the gear → the pause menu → time fully stops; Esc → slow again. A wrong visor button shakes the
//   panel and changes nothing. The broken laser's primed goop glow.
// Layout checks on every console shot: nothing wider than the window, art not stretched, words not spilling, every live
// control ≥ 44 px and no two live controls' hit areas overlapping. Shots: e2e-shots/repairs/<size>-<n>-<step>.png.
// Playwright's own Chromium (never the user's Chrome). Run: node e2e/repairs.mjs  (own dev server on 5267, stopped after;
// 5264 is console-shots', 5265 the visor sketch helper's)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { startShift } from './start.mjs'

const PORT = 5267, OUT = 'e2e-shots/repairs'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error('dev server stopped (port busy?)')))
})

const only = process.env.SIZES?.split(',') // e.g. SIZES=1440x900 node e2e/repairs.mjs
const sizes = [[360, 780], [390, 844], [844, 390], [768, 343], [654, 900], [1100, 800], [1440, 900], [1920, 1080], [2560, 1440]]
let failed = 0
const check = (name, what, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${name} ${what}${detail ? ' — ' + detail : ''}`); if (!ok) failed++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── in the page ──
function consoleProblems() {
  const problems = []
  const W = innerWidth
  if (document.documentElement.scrollWidth > W) problems.push(`page wider than the window (${document.documentElement.scrollWidth} > ${W})`)
  const box = (el) => el.getBoundingClientRect()
  for (const img of document.querySelectorAll('.kit-art-layer[data-sized] > img, .kit-pull > img, .kit-snap-knob > img')) {
    const r = box(img), want = img.naturalWidth / img.naturalHeight, got = r.width / r.height
    if (img.naturalWidth && r.width && Math.abs(got / want - 1) > 0.01) problems.push(`stretched art ${img.src.split('/').pop()} (${got.toFixed(3)} vs ${want.toFixed(3)})`)
  }
  for (const el of document.querySelectorAll('.kit-art-layer[data-text]:not(:has(.kit-level-meter))')) {
    if (el.scrollWidth > el.clientWidth + 1) problems.push(`words spill: "${el.textContent}" (${el.scrollWidth} > ${el.clientWidth})`)
  }
  // live controls: big enough, and no two of them fighting for the same spot
  const live = [...document.querySelectorAll('.kit-screen button:not(:disabled), .kit-snap-hit[tabindex="0"]')].filter((b) => !b.closest('[data-off], [inert]'))
  const rects = live.map((b) => ({ name: b.getAttribute('aria-label') ?? b.textContent, r: box(b) })).filter((x) => x.r.width)
  for (const { name, r } of rects) if (r.width < 43.5 || r.height < 43.5) problems.push(`small target ${Math.round(r.width)}×${Math.round(r.height)}: ${name}`)
  // (≤ 6 px allowed: the visor's three buttons are drawn 76 units apart, so on the smallest phone (360×780, the console
  // at ~0.51 px per unit) they're 39 px apart and their 44 px minimums overlap by 5 px — the art's spacing; logged for Muzzy)
  const hit = (a, b) => a.left < b.right - 6 && b.left < a.right - 6 && a.top < b.bottom - 6 && b.top < a.bottom - 6
  rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => { if (hit(a.r, b.r)) problems.push(`targets overlap: ${a.name} / ${b.name} (${Math.round(Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left))}×${Math.round(Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top))} px)`) }))
  // live controls inside the window
  for (const { name, r } of rects) if (r.left < 0 || r.top < 0 || r.right > W || r.bottom > innerHeight) problems.push(`target off screen: ${name}`)
  return problems
}
function hudProblems() {
  const { view, engine } = window.__goops, s = engine.state
  const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx, right = left + s.visibleWidth * view.cellPx
  const bottom = view.topY + (s.height - s.bufferRows) * view.cellPx
  const parts = [...document.querySelectorAll('.kit-hud-slot > *')].map((e) => e.getBoundingClientRect())
  // the HUD's column (--kit-hud-w): on a phone on its side it reaches past the tank far enough for the panel beside it
  const hudW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-hud-w')) || innerWidth
  const mid = (left + right) / 2, half = Math.max(hudW / 2 + 1, (right - left) / 2 + 17)
  const out = parts.filter((r) => r.width && (r.left < mid - half || r.right > mid + half)).length
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
  const overlaps = parts.flatMap((a, i) => parts.slice(i + 1).filter((b) => hit(a, b))).length
  const spills = [...document.querySelectorAll('.kit-hud-slot *, .kit-hud-dock *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).length
  // the machine bars: in the bottom panel under the tank, or the column beside it on a phone on its side — never over the tank
  const meters = [...document.querySelectorAll('.kit-hud-dock .kit-bar[data-label-at="above"]')].map((e) => e.getBoundingClientRect())
  const onTank = meters.filter((r) => r.top < bottom - 1 && r.bottom > view.topY + 1 && r.right > left + 1 && r.left < right - 1).length
  const offScreen = meters.filter((r) => r.bottom > innerHeight || r.left < 0 || r.right > innerWidth).length
  return { parts: parts.length, meters: meters.length, out, overlaps, spills, onTank, offScreen }
}

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
try {
  for (const [index, [w, h]] of sizes.entries()) {
    const name = `${w}x${h}`
    if (only && !only.includes(name)) continue
    const short = h <= 480
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true })
    const cdp = await page.context().newCDPSession(page)
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(`http://localhost:${PORT}/?seed=7&rank=6`)
    await page.evaluate(() => document.fonts.ready)
    await startShift(page)
    await page.waitForTimeout(600)

    // ── gestures: a real mouse, or a real finger (CDP touch events) ──
    const finger = async (path, ms = 25) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: path[0][0], y: path[0][1] }] })
      for (const [x, y] of path.slice(1)) { await sleep(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }) }
      await sleep(ms)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    const mouse = async (path) => {
      await page.mouse.move(path[0][0], path[0][1]); await page.mouse.down()
      for (const [x, y] of path.slice(1)) await page.mouse.move(x, y)
      await page.mouse.up()
    }
    const line = (x0, y0, x1, y1, n = 8) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])
    const gesture = (byFinger, path) => (byFinger ? finger(path) : mouse(path))
    const centre = (r) => [r.x + r.width / 2, r.y + r.height / 2]
    const boxOf = (locator) => locator.boundingBox()

    // ── 1. the shift with the machine bars ──
    await page.evaluate(() => { window.__goops.engine.state.score = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-hud-w')) < 380 ? 9999 : 99999 })
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${OUT}/${name}-1-shift-meters.png` })
    const hud = await page.evaluate(hudProblems)
    check(name, 'HUD with meters: 3 meters, all over the tank, no overlaps or spills, clear of the tank, on screen',
      hud.meters === 3 && !hud.out && !hud.overlaps && !hud.spills && !hud.onTank && !hud.offScreen, JSON.stringify(hud))

    // spy on the engine: its actions and how much time it's given
    await page.evaluate(() => {
      const e = window.__goops.engine
      window.__first = e; window.__acts = []; window.__ticked = 0
      const act = e.act.bind(e), tick = e.tick.bind(e)
      e.act = (a) => { window.__acts.push(a); act(a) }
      e.tick = (ms) => { window.__ticked += ms; tick(ms) }
    })

    // ── 2. mid-shift: to the console (W on some sizes, a quick swipe up with mouse / finger on others) ──
    const toConsole = async (how) => {
      if (how === 'key') await page.keyboard.press('KeyW')
      else {
        const x = w / 2, y = h * 0.6
        const path = line(x, y, x, y - Math.min(200, h * 0.3), 3) // quick: a swipe is under 300 ms
        await (how === 'finger' ? finger(path, 10) : mouse(path))
      }
      await page.waitForFunction(() => { const s = document.querySelector('.kit-screen[aria-label="Console"]'); return s && !s.hasAttribute('data-slide') }, null, { timeout: 5000 })
      await page.waitForTimeout(200)
    }
    const how = index === 1 ? 'finger' : index % 2 ? 'key' : 'mouse'
    await toConsole(how)
    const slow = await page.evaluate(async () => { const t0 = window.__ticked, r0 = performance.now(); await new Promise((r) => setTimeout(r, 1000)); return { game: window.__ticked - t0, real: performance.now() - r0 } })
    const ratio = slow.game / slow.real
    check(name, `${how}: console mid-shift, the tank still running slowly`, ratio > 0.15 && ratio < 0.35 && await page.evaluate(() => window.__goops.engine.state.status === 'playing'),
      `${Math.round(slow.game)} ms game time in ${Math.round(slow.real)} ms (${ratio.toFixed(2)})`)
    check(name, 'at the console the engine is told (act console on): the machines\' break-progress pauses',
      await page.evaluate(() => window.__acts.some((a) => a.type === 'console' && a.on)))
    check(name, 'the tank takes no input under the console', await page.evaluate(() => { const before = window.__acts.length; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' })); return window.__acts.length === before }))
    await page.screenshot({ path: `${OUT}/${name}-2-console-mid-shift.png` })

    const repaired = (id) => page.evaluate((id) => window.__acts.some((a) => a.type === 'repair' && a.machine === id) && !window.__goops.engine.state.machines[id].broken, id)
    const broken = async (id, n) => {
      check(name, `${id}: breaks (dev hook)`, await page.evaluate((id) => window.__goops.breakMachine(id), id))
      await page.waitForTimeout(250) // the console reads the machines every 100 ms
      await page.screenshot({ path: `${OUT}/${name}-${n}-${id}-broken.png` })
      const problems = await page.evaluate(consoleProblems)
      check(name, `${id}: panel lit, layout ok`, !problems.length, problems.join(' | '))
    }
    const litLamps = () => page.evaluate(() => [...document.querySelectorAll('.kit-art-layer > img[src*="Light-On"]')].map((i) => { const r = i.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] }))

    // ── 3. LASER: read the 4 lit lamps (all sliders, breakdowns.json laser.repairSliders); mouse and finger take turns
    //    (drag on even sizes, tap on odd) ──
    await broken('laser', 3)
    const lamps = await litLamps()
    check(name, 'laser: 4 lamps lit (all sliders)', lamps.length === 4, String(lamps.length))
    const sliders = await Promise.all([1, 2, 3, 4].map((n) => boxOf(page.getByRole('slider', { name: `Laser slider ${n}` }))))
    const tapStyle = index % 2 === 1
    for (const [k, [lx, ly]] of lamps.entries()) {
      const s = sliders.reduce((best, r) => (Math.abs(centre(r)[1] - ly) + Math.abs(centre(r)[0] - lx) < Math.abs(centre(best)[1] - ly) + Math.abs(centre(best)[0] - lx) ? r : best))
      const [cx, cy] = centre(s), leftEnd = lx < cx
      const end = leftEnd ? s.x + s.width * 0.1 : s.x + s.width * 0.9
      // a drag starts on the knob (in the middle) and goes past the end; a tap goes on the end
      await gesture(k % 2 === 1, tapStyle ? [[end, cy]] : line(cx, cy, leftEnd ? s.x - 20 : s.x + s.width + 20, cy))
      await page.waitForTimeout(250)
      if (k === 0) await page.screenshot({ path: `${OUT}/${name}-4-laser-half.png` })
    }
    await page.waitForTimeout(250)
    check(name, `laser: fixed (${tapStyle ? 'mouse + finger taps' : 'mouse + finger drags'}) → act repair`, await repaired('laser'))

    // ── 4. VISOR: top lamp → slide up (mouse) → 3 lit buttons (mouse, finger, mouse; a wrong one first) → slide down (finger) ──
    await broken('visor', 5)
    const vs = await boxOf(page.getByRole('slider', { name: 'Visor slider' }))
    await mouse(line(vs.x + vs.width / 2, vs.y + vs.height * 0.85, vs.x + vs.width / 2, vs.y - 20))
    await page.waitForTimeout(250)
    const buttons = await Promise.all(['Blue button', 'Yellow button', 'Pink button'].map((n) => boxOf(page.getByRole('button', { name: n }))))
    for (let i = 0; i < 3; i++) {
      const [[, ly]] = await litLamps()
      const b = buttons.reduce((best, r) => (Math.abs(centre(r)[1] - ly) < Math.abs(centre(best)[1] - ly) ? r : best))
      if (i === 0) { // a wrong press first: a shake, nothing resets
        const wrong = buttons.find((r) => r !== b)
        await page.mouse.click(...centre(wrong))
        await page.waitForTimeout(80)
        const shook = await page.evaluate(() => document.querySelectorAll('.kit-art-layer[data-shake]').length > 0)
        const still = (await litLamps()).some(([, y]) => Math.abs(y - ly) < 2)
        check(name, 'visor: a wrong button shakes the panel and changes nothing', shook && still)
        await page.waitForTimeout(300)
      }
      if (i === 1) await finger([centre(b)]); else await page.mouse.click(...centre(b))
      await page.waitForTimeout(200)
      if (i === 1) await page.screenshot({ path: `${OUT}/${name}-6-visor-half.png` })
    }
    await page.waitForTimeout(150)
    await finger(line(vs.x + vs.width / 2, vs.y + vs.height * 0.15, vs.x + vs.width / 2, vs.y + vs.height + 20))
    await page.waitForTimeout(300)
    check(name, 'visor: fixed (mouse drag, mouse + finger taps, finger drag) → act repair', await repaired('visor'),
      await page.evaluate(() => `slider ${document.querySelector('[aria-label="Visor slider"]')?.getAttribute('aria-valuenow')}, lit lamps ${document.querySelectorAll('img[src*="Light-On"]').length}`))

    // ── 5. CONTROLS: the lit corner → turn the dial there, 4 times (1 mouse drag, 2 finger drag, 3–4 taps); the lit
    //    corner is never the one the dial is already on ──
    await broken('controls', 7)
    const dialHit = page.getByRole('slider', { name: 'Controls dial' })
    const d = await boxOf(dialHit)
    const [dx, dy] = centre(d), R = d.width * 0.4
    const angles = [311, 49, 139.5, 220.5]
    const at = (deg) => [dx + R * Math.sin((deg * Math.PI) / 180), dy - R * Math.cos((deg * Math.PI) / 180)]
    let notAlreadyThere = true
    for (let i = 0; i < 4; i++) {
      const [[lx, ly]] = await litLamps()
      const corner = lx < dx ? (ly < dy ? 0 : 3) : (ly < dy ? 1 : 2)
      const from = Number(await dialHit.getAttribute('aria-valuenow'))
      if (corner === from) notAlreadyThere = false
      if (i < 2) {
        let a0 = angles[from], a1 = angles[corner]
        const turn = ((a1 - a0 + 540) % 360) - 180 // the short way round
        const path = Array.from({ length: 13 }, (_, k) => at(a0 + (turn * k) / 12))
        await gesture(i === 1, path)
      } else { // taps step it clockwise until it's there
        for (let k = 0; k < 4 && Number(await dialHit.getAttribute('aria-valuenow')) !== corner; k++) { await page.mouse.click(dx, dy); await page.waitForTimeout(150) }
      }
      await page.waitForTimeout(250)
      if (i === 0) await page.screenshot({ path: `${OUT}/${name}-8-controls-half.png` })
    }
    await page.waitForTimeout(200)
    check(name, 'controls: 4 corners, never the one the dial is on; fixed (mouse drag, finger drag, taps) → act repair', notAlreadyThere && await repaired('controls'))
    await page.screenshot({ path: `${OUT}/${name}-9-all-fixed.png` })
    const after = await page.evaluate(consoleProblems)
    check(name, 'console layout after the repairs', !after.length, after.join(' | '))

    // ── 6. once: the gear → the pause menu → time stops; Esc → slow again ──
    if (index === 1) {
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.getByRole('button', { name: 'End shift' }).waitFor({ timeout: 3000 })
      await page.screenshot({ path: `${OUT}/${name}-10-pause.png` })
      const stopped = await page.evaluate(async () => { const t0 = window.__ticked; await new Promise((r) => setTimeout(r, 600)); return window.__ticked - t0 })
      check(name, 'gear → pause menu: time fully stops', stopped === 0, `${stopped} ms`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      const again = await page.evaluate(async () => { const t0 = window.__ticked; await new Promise((r) => setTimeout(r, 600)); return window.__ticked - t0 })
      check(name, 'Esc closes it: slow again', again > 50 && again < 300, `${Math.round(again)} ms`)
    }

    // ── 7. back to the same shift: the periscope (a mouse drag) or, on a phone on its side, Back to the tank ──
    if (short) await page.locator('[data-slot="bottom-left"] button').click()
    else {
      const scope = await boxOf(page.locator('.kit-pull-grip'))
      const gx = scope.x + scope.width / 2, gy = scope.y + scope.height * 0.4, length = scope.height / 0.345
      await mouse(line(gx, gy, gx, gy + length * 0.566, 10))
    }
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
    const back = await page.evaluate(async () => { const t0 = window.__ticked, r0 = performance.now(); await new Promise((r) => setTimeout(r, 500)); return { same: window.__goops.engine === window.__first, playing: window.__goops.engine.state.status === 'playing', ratio: (window.__ticked - t0) / (performance.now() - r0) } })
    check(name, 'back at the tank: act console off', await page.evaluate(() => { const c = window.__acts.filter((a) => a.type === 'console'); return c.length > 0 && c[c.length - 1].on === false }))
    check(name, `${short ? 'Back to the tank' : 'periscope'} → the same shift, full speed`, back.same && back.playing && back.ratio > 0.8, JSON.stringify(back))
    await page.screenshot({ path: `${OUT}/${name}-11-back-in-the-tank.png` })

    // ── 8. once: the broken laser's primed goop glow ──
    if (index === 1) {
      const primed = await page.evaluate(() => {
        const e = window.__goops.engine, s = e.state
        for (let i = 0; i < 40 && ![...s.groups.values()].some((g) => g.ready); i++) { e.act({ type: 'softDrop', on: true }); e.tick(1500) }
        window.__goops.breakMachine('laser')
        const g = [...s.groups.values()].find((g) => g.ready)
        if (!g) return 'no ready group'
        const c = g.cells[0]
        e.act({ type: 'pop', x: c % s.width, y: Math.floor(c / s.width) })
        return s.primed?.includes(g.id) ? 'primed' : `not primed (${JSON.stringify(s.primed)})`
      })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${OUT}/${name}-12-primed.png` })
      check(name, 'broken laser: a first zap primes the group (glow shown)', primed === 'primed', primed)
      // End shift from the console mid-shift: asks first, then the run is thrown away — the console stays, no XP
      const xp = await page.evaluate(() => localStorage.getItem('goops-progress'))
      await toConsole('key')
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.getByRole('button', { name: 'End shift' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'End shift' }).click()
      await page.getByRole('button', { name: 'Start shift' }).waitFor({ timeout: 3000 }).catch(() => {})
      const ended = await page.evaluate(() => ({ idle: !!document.querySelector('[aria-label="Start shift"]'), screens: document.querySelectorAll('[role="dialog"]').length }))
      check(name, 'End shift at the console: asks, then the console stays (idle), no XP', ended.idle && !ended.screens && xp === await page.evaluate(() => localStorage.getItem('goops-progress')), JSON.stringify(ended))
    }
    check(name, 'no console errors', !errors.length, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  stop()
}
console.log(failed ? `${failed} problem(s)` : 'all good')
process.exit(failed ? 1 : 0)
