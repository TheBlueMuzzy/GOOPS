// FINGER GESTURES IN THE TANK (F28 task 6) — every tank gesture in research/gestures.md §1a (T1–T8) and the collisions
// in §2 that the code decides today, done with a REAL FINGER: CDP Input.dispatchTouchEvent on a touch screen
// (hasTouch, 390x844 portrait — Goops is portrait only, never landscape). Mouse versions live in e2e/controls.mjs.
//   taps: left half ↺ · right half ↻ · drag sideways + hold = keeps spinning, back to the start = stops · drag down +
//   hold = fast drop until the lift · quick flick down = a short fast drop · quick flick up = the console · C-6 fast
//   sideways drag ending in an upward lift = no console · C-8 drag down then flick up = no console · hold still 1.5 s =
//   swap with the next piece (rank 3+), nothing at rank 2 · diagonal drag = one axis only (the bigger one at the drag
//   lock) · tap a ready group = pops it
//   + TODAY'S BEHAVIOUR, three blocks marked "Muzzy's call pending — F28 task 5": C-1 second finger ignored · C-2 tap on
//   goop that isn't ready jiggles, no rotate · C-3 a 0.5 s press does nothing. Flip those blocks when he decides.
// Every touch number comes from content/tuning/tank.json (dragLockRem, dragDeadZoneRem, flickMs, flickRem, flickDropMs,
// holdDelayMs, holdToSwapMs, spinRepeatMs) × the page's rem — never restated here.
// Reads the game through the dev hooks (window.__goops) and a spy on engine.act (which controls were sent, with what).
// Pitfalls: a CDP swipe must be quick (~10 ms a step) or it outlasts flickMs. Each gesture group starts a fresh shift
// so a stack from an earlier group can't end the shift or catch a tap.
// Playwright's own Chromium (never the user's Chrome). Run: node e2e/gestures.mjs  (own dev server on port 5391)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { startShift } from './start.mjs'

const PORT = 5391
const tank = JSON.parse(readFileSync('content/tuning/tank.json', 'utf8'))
const text = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error(`dev server stopped (port ${PORT} busy?)`)))
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] }) // (the GPU, like repairs.mjs: frames — and so touches — come quicker)
let failed = 0, count = 0
const check = (name, ok, detail = '') => { count++; console.log(ok ? '✓' : '✗', name, detail ? `— ${detail}` : ''); if (!ok) failed++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const started = Date.now()

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const cdp = await page.context().newCDPSession(page)
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  const get = (f, arg) => page.evaluate(f, arg)

  // a fresh shift at this rank, with a spy on the engine's controls
  const fresh = async (rank = 3) => {
    await page.goto(`http://localhost:${PORT}/?seed=11&rank=${rank}`)
    await page.evaluate(() => window.__goopsSeen(['lesson:visor'])) // (the visor can break at rank 3: its lesson would stop the controls)
    await startShift(page)
    await page.waitForTimeout(300)
    await get(() => {
      const e = window.__goops.engine, act = e.act.bind(e)
      window.__acts = []
      e.act = (a) => { window.__acts.push({ ...a, t: performance.now() }); return act(a) }
    })
  }
  const mark = () => get(() => window.__acts.length)
  const actsSince = (from, type) => get(([f, ty]) => window.__acts.slice(f).filter((a) => !ty || a.type === ty), [from, type])
  const lastSoftDrop = () => get(() => { const s = window.__acts.filter((a) => a.type === 'softDrop'); return s.length ? s[s.length - 1].on : false })
  const playing = () => get(() => window.__goops.engine.state.status === 'playing')

  // ── a real finger (CDP touch). id = which finger (0 = the first) ──
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id = 0]) => ({ x, y, id })) })
  const fingerDown = (x, y) => touch('touchStart', [[x, y]])
  const fingerMove = (x, y) => touch('touchMove', [[x, y]])
  const fingerUp = () => touch('touchEnd', [])
  // a quick path, ~ms per step, finger down at the first point and up after the last. The sends are NOT awaited one by
  // one: each CDP touch waits for a frame (~30–60 ms here), so awaiting them made a 4-step flick last 230–600 ms — past
  // flickMs. CDP keeps them in order.
  const swipe = async (path, ms = 10) => {
    const sent = [fingerDown(...path[0])]
    for (const p of path.slice(1)) { await sleep(ms); sent.push(fingerMove(...p)) }
    await sleep(ms); sent.push(fingerUp())
    await Promise.all(sent)
  }
  const tap = async (x, y) => { await fingerDown(x, y); await sleep(40); await fingerUp() }
  const line = (x0, y0, x1, y1, n) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])

  const consoleOpen = () => page.waitForFunction(() => { const c = document.querySelector('.kit-screen[aria-label="Console"]'); return c && !c.hasAttribute('data-slide') }, null, { timeout: 3000 }).then(() => true, () => false)
  const consoleThere = () => get(() => !!document.querySelector('.kit-screen[aria-label="Console"]'))
  const backToTank = async () => {
    await page.getByRole('button', { name: 'Back to the tank' }).click()
    await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
  }
  // the Swap bar (the HUD's banner while a hold charges, named by en.json hud.swap): watch it for ms → the fullest it
  // got (0..100), or -1 if it never showed
  const swapBar = (ms) => get(async ([ms, name]) => {
    const end = performance.now() + ms
    let most = -1
    while (performance.now() < end) {
      for (const b of document.querySelectorAll('[role="progressbar"]')) if (b.getAttribute('aria-label') === name) most = Math.max(most, Number(b.getAttribute('aria-valuenow')))
      await new Promise((r) => setTimeout(r, 30))
    }
    return most
  }, [ms, text.hud.swap])

  // the tank on screen: page-px points over EMPTY water in the upper tank, left and right of the middle
  const where = () => get(() => {
    const { engine, view, cellAt } = window.__goops, s = engine.state
    const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
    const empty = (x, y) => { const c = cellAt(x, y); return !c || !s.grid[c[1] * s.width + c[0]] }
    const y = stage.top + view.topY + 2.5 * view.cellPx
    const left = [stage.left + view.centreX - 3 * view.cellPx, y], right = [stage.left + view.centreX + 3 * view.cellPx, y]
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
    return { left, right, mid: [stage.left + stage.width / 2, y], stage: { left: stage.left, top: stage.top, width: stage.width, height: stage.height },
      rem, leftEmpty: empty(...left), rightEmpty: empty(...right), cell: view.cellPx }
  })

  // ═══ 1. taps on empty water: left half ↺, right half ↻ (T5) ═══
  await fresh()
  let w = await where()
  const px = (r) => r * w.rem // tank.json's rem → page px
  console.log(`(rem ${w.rem} px · drag lock ${px(tank.dragLockRem)} px · dead zone ${px(tank.dragDeadZoneRem)} px · flick ${tank.flickMs} ms / ${px(tank.flickRem)} px)`)
  check('the tap spots are empty water', w.leftEmpty && w.rightEmpty, JSON.stringify(w))
  for (const [side, at, want] of [['left', w.left, -1], ['right', w.right, 1], ['left', w.left, -1], ['right', w.right, 1]]) {
    const m = await mark(), rot0 = await get(() => window.__goops.engine.state.piece?.rotation)
    await tap(...at); await sleep(80)
    const r = await actsSince(m), rot1 = await get(() => window.__goops.engine.state.piece?.rotation)
    const rots = r.filter((a) => a.type === 'rotate')
    check(`tap ${side} half rotates ${want < 0 ? 'anticlockwise' : 'clockwise'}`,
      rots.length === 1 && rots[0].dir === want && !r.some((a) => a.type === 'pop' || a.type === 'hold') && rot1 === (rot0 + want + 4) % 4,
      `rotate ${JSON.stringify(rots.map((a) => a.dir))} · rotation ${rot0} → ${rot1}`)
  }

  // ═══ 2. drag sideways and hold: keeps spinning; back to the start: stops (T1) ═══
  {
    const [x, y] = w.mid, out = px(tank.dragDeadZoneRem) * 3
    const m = await mark()
    await fingerDown(x, y)
    for (const [mx] of line(x, y, x - out, y, 5).slice(1)) { await sleep(10); await fingerMove(mx, y) }
    const t0 = Date.now(); await sleep(700)
    const held = await actsSince(m, 'spin'), heldMs = Date.now() - t0
    const most = Math.ceil(heldMs / tank.spinRepeatMs) + 2
    check('drag left and hold keeps spinning (one way: the goop follows the finger)',
      held.length >= 5 && held.length <= most && held.every((a) => a.dir === 1), `${held.length} spins (dir ${[...new Set(held.map((a) => a.dir))]}) in ~${heldMs} ms, at most ${most}`)
    for (const [mx] of line(x - out, y, x, y, 5).slice(1)) { await sleep(10); await fingerMove(mx, y) }
    await sleep(60)
    const m2 = await mark(); await sleep(600)
    const after = await actsSince(m2, 'spin')
    check('…back to where it started: the spinning stops (finger still down)', after.length === 0, `${after.length} spins in 600 ms`)
    await fingerUp(); await sleep(60)
    const all = await actsSince(m)
    check('…the drag never fast-drops or rotates', !all.some((a) => (a.type === 'softDrop' && a.on) || a.type === 'rotate'), '')
  }

  // ═══ 3. drag down and hold: fast drop while held, stops on the lift (T2) ═══
  await fresh(); w = await where()
  {
    const [x, y] = w.mid
    const m = await mark()
    await fingerDown(x, y)
    for (const [, my] of line(x, y, x, y + px(tank.flickRem) * 1.5, 5).slice(1)) { await sleep(10); await fingerMove(x, my) }
    await sleep(500)
    const on = await lastSoftDrop()
    const y0 = await get(() => Math.min(...window.__goops.engine.state.piece.cells.map((c) => c[1])))
    await sleep(300)
    const y1 = await get(() => Math.min(...(window.__goops.engine.state.piece?.cells ?? [[0, 99]]).map((c) => c[1])))
    check('drag down and hold: fast drop on while the finger is down', on === true, `piece row ${y0} → ${y1} in 300 ms`)
    await fingerUp(); await sleep(60)
    check('…lift: fast drop off', (await lastSoftDrop()) === false, '')
    const r = await actsSince(m)
    check('…never spins or rotates', !r.some((a) => a.type === 'spin' || a.type === 'rotate'), '')
  }

  // ═══ 4. quick flick down: a short fast drop after the lift (T3) ═══
  {
    const [x, y] = w.mid
    const m = await mark()
    await swipe(line(x, y, x, y + px(tank.flickRem) * 1.6, 4))
    await sleep(tank.flickDropMs + 400)
    // the lift turns fast drop off and straight back on (the flick), then off again flickDropMs later (rules clock)
    const r = await actsSince(m, 'softDrop'), last = r[r.length - 1], before = r[r.length - 2]
    const lasted = last && before ? Math.round(last.t - before.t) : -1
    check(`quick flick down: a short fast drop after the lift (~${tank.flickDropMs} ms)`,
      !!last && last.on === false && before.on === true && lasted >= tank.flickDropMs * 0.8 && lasted <= tank.flickDropMs * 2.5,
      `${r.map((a) => (a.on ? 'on' : 'off')).join(' ')} · the last fast drop lasted ${lasted} ms`)
    check('…no console', !(await consoleThere()))
  }

  // ═══ 5. quick flick up: the console (T4) ═══
  await fresh(); w = await where()
  {
    const [x] = w.mid, y = w.stage.top + w.stage.height * 0.6
    await swipe(line(x, y, x, y - px(tank.flickRem) * 2, 4))
    check('quick flick up opens the console', await consoleOpen())
    await backToTank()
    check('…and the periscope goes back to the shift', await playing())
  }

  // ═══ 6. C-6: a fast sideways drag ending in an upward lift — only turns the tank ═══
  {
    const [x, y] = [w.mid[0] + 60, w.stage.top + w.stage.height * 0.6]
    const L = px(tank.dragLockRem)
    const m = await mark()
    // locks sideways at the first step, then rises: overall more up than sideways and well over the flick distance
    await swipe([[x, y], [x - L * 1.6, y], [x - L * 3.2, y], [x - L * 4, y - L * 3], [x - L * 4.5, y - L * 7], [x - L * 4.7, y - L * 10]])
    await sleep(700)
    const r = await actsSince(m)
    check('C-6 fast sideways drag lifting upward: no console', !(await consoleThere()), '')
    check('C-6 …it turned the tank instead', r.some((a) => a.type === 'spin'), `${r.filter((a) => a.type === 'spin').length} spins`)
  }

  // ═══ 7. C-8: drag down, then flick up quickly — no console ═══
  {
    const [x, y] = [w.mid[0], w.stage.top + w.stage.height * 0.5]
    const L = px(tank.dragLockRem), F = px(tank.flickRem)
    const m = await mark()
    await swipe([[x, y], [x, y + L * 2], [x, y + L * 4], [x, y + L], [x, y - F * 0.8], [x, y - F * 1.6]])
    await sleep(700)
    const r = await actsSince(m)
    check('C-8 drag down then quick flick up: no console', !(await consoleThere()), '')
    check('C-8 …it was a fast drop', r.some((a) => a.type === 'softDrop' && a.on) && (await lastSoftDrop()) === false, '')
  }

  // ═══ 8. hold still 1.5 s at rank 3: the falling piece trades with the next piece (T8) ═══
  await fresh(3); w = await where()
  {
    const before = await get(() => { const s = window.__goops.engine.state; return { piece: JSON.stringify(s.piece.colors), next: JSON.stringify(s.next) } })
    const m = await mark()
    await fingerDown(...w.mid)
    const bar = await swapBar(tank.holdToSwapMs * 0.85)
    await sleep(tank.holdToSwapMs * 0.15 + 400)
    await fingerUp(); await sleep(80)
    const after = await get(() => { const s = window.__goops.engine.state; return { piece: JSON.stringify(s.piece?.colors), next: JSON.stringify(s.next) } })
    const r = await actsSince(m)
    check(`rank 3: hold still ${tank.holdToSwapMs / 1000} s swaps once`, r.filter((a) => a.type === 'hold').length === 1, JSON.stringify(r.map((a) => a.type)))
    check('…the falling piece and the next piece traded', after.next === before.piece && after.piece === before.next, `${JSON.stringify(before)} → ${JSON.stringify(after)}`)
    check('…the Swap bar filled while it charged', bar >= 50, `filled to ${bar}% (by ${Math.round(tank.holdToSwapMs * 0.85)} ms)`)
    check('…no rotate, no pop on the lift', !r.some((a) => a.type === 'rotate' || a.type === 'pop'))
  }

  // ═══ 9. C-3 — Muzzy's call pending — F28 task 5 ═══
  // TODAY: a press held past holdDelayMs and lifted before holdToSwapMs does NOTHING (no rotate, no swap; the Swap bar
  // flashes). If Muzzy picks "a short-ish press still counts as a tap", flip this block to expect one rotate.
  {
    const pressMs = 500
    const m = await mark()
    await fingerDown(...w.right)
    const bar = await swapBar(pressMs - 40)
    await fingerUp(); await sleep(tank.holdToSwapMs) // (past when a swap would have fired)
    const r = await actsSince(m)
    check(`C-3 (today) a ${pressMs} ms press then lift: no rotate, no swap, no pop`, !r.some((a) => ['rotate', 'hold', 'pop'].includes(a.type)), JSON.stringify(r.map((a) => a.type)))
    check('C-3 (today) …the Swap bar flashed up meanwhile', bar >= 0, `got to ${bar}%`)
  }

  // ═══ 10. diagonal drags lock to ONE axis: whichever is bigger at the drag lock (C-5 today) ═══
  for (const [name, fx, fy, want] of [['a bit more sideways', 1.3, 1.1, 'H'], ['a bit more down', 1.1, 1.3, 'V']]) {
    await fresh(); w = await where()
    const [x, y] = w.mid, L = px(tank.dragLockRem)
    const m = await mark()
    await fingerDown(x, y)
    await sleep(10); await fingerMove(x - L * fx, y + L * fy) // the first move past the drag lock decides
    await sleep(50)
    for (let k = 1; k <= 6; k++) { await sleep(10); await fingerMove(x - L * fx - 10 * k, y + L * fy + 10 * k) } // then a true 45°
    await sleep(400)
    const r = await actsSince(m)
    await fingerUp(); await sleep(60)
    const spun = r.some((a) => a.type === 'spin'), dropped = r.some((a) => a.type === 'softDrop' && a.on)
    check(`diagonal drag (${name} at the lock) → ${want === 'H' ? 'spins only' : 'fast-drops only'}`,
      want === 'H' ? spun && !dropped : dropped && !spun, `spins ${r.filter((a) => a.type === 'spin').length} · fast drop ${dropped}`)
  }

  // ═══ 11. C-1 — Muzzy's call pending — F28 task 5 ═══
  // TODAY: while the first finger drags, a second finger's tap is ignored completely (no rotate, no pop) and the first
  // finger's drag carries on. If Muzzy picks "a second thumb's tap turns the piece", flip this block to expect a rotate.
  await fresh(); w = await where()
  {
    const [x, y] = w.mid, out = px(tank.dragDeadZoneRem) * 3
    await fingerDown(x, y)
    for (const [mx] of line(x, y, x - out, y, 5).slice(1)) { await sleep(10); await fingerMove(mx, y) }
    await sleep(250)
    const m = await mark()
    // (make sure the page really saw a second finger go down and up, or this block proves nothing)
    await get(() => { window.__fingers = []; for (const t of ['pointerdown', 'pointerup']) window.addEventListener(t, (e) => window.__fingers.push(`${t} ${e.pointerId}`), true) })
    await touch('touchStart', [[x - out, y, 0], [w.right[0], w.right[1], 1]]) // second finger down on the right half
    await sleep(40)
    await touch('touchEnd', [[w.right[0], w.right[1], 1]]) // …and up again (CDP: a touchEnd lifts the fingers it lists)
    await sleep(300)
    const r = await actsSince(m)
    const seen = await get(() => window.__fingers.slice())
    await fingerUp(); await sleep(60)
    check('C-1 setup: the page saw a second finger go down and up while the first stayed', seen.length === 2 && seen[0].startsWith('pointerdown') && seen[1] === seen[0].replace('down', 'up'), seen.join(', '))
    check('C-1 (today) a second finger\'s tap while the first drags: ignored (no rotate, no pop)', !r.some((a) => a.type === 'rotate' || a.type === 'pop'), JSON.stringify([...new Set(r.map((a) => a.type))]))
    check('C-1 (today) …the first finger kept spinning the tank', r.filter((a) => a.type === 'spin').length >= 2, `${r.filter((a) => a.type === 'spin').length} spins`)
  }

  // ═══ 12. rank 2 (swap not unlocked): a hold does nothing, no Swap bar ═══
  await fresh(2); w = await where()
  {
    const m = await mark()
    await fingerDown(...w.mid)
    const bar = await swapBar(tank.holdToSwapMs + 300)
    await fingerUp(); await sleep(80)
    const r = await actsSince(m)
    check(`rank 2: hold still ${(tank.holdToSwapMs + 300) / 1000} s → no swap, no rotate`, !r.some((a) => a.type === 'hold' || a.type === 'rotate'), JSON.stringify(r.map((a) => a.type)))
    check('rank 2: …and no Swap bar', bar === -1)
  }

  // ═══ 13. C-2 — Muzzy's call pending — F28 task 5 ═══
  // TODAY: a tap on goop that can't pop yet (here: above the pressure line) jiggles it and does NOT rotate the piece.
  // If Muzzy picks "the tap falls through and turns the piece", flip this block to expect one rotate (+ the jiggle).
  await fresh(); w = await where()
  {
    // land the first piece, then hold the rules still with the pressure line at the floor: that goop can't pop
    // (rank 3 starts with some junk goop: wait for the piece's OWN new group)
    const got = await get(() => { const { engine } = window.__goops, s = engine.state
      const old = new Set(s.groups.keys()), fresh = () => [...s.groups.values()].find((g) => !old.has(g.id))
      for (let t = 0; t < 80 && !fresh(); t++) { engine.act({ type: 'softDrop', on: true }); engine.tick(100) }
      engine.act({ type: 'softDrop', on: false })
      engine.setPressure(0); engine.tick(1)
      engine.tick = () => {}
      const g = fresh()
      return g && !g.ready ? g.cells[0] : null })
    if (got === null) check('C-2 setup: a group that can\'t pop yet', false)
    else {
      await page.waitForTimeout(2500) // the landing wobble settles
      const pos = await get((c) => { const { engine, view, cellAt } = window.__goops, s = engine.state
        const x = c % s.width, y = Math.floor(c / s.width)
        let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
        const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
        const px = view.centreX + d * view.cellPx + stage.left, py = view.topY + (y - s.bufferRows + 0.5) * view.cellPx + stage.top
        const hit = cellAt(px, py)
        return { px, py, onCell: !!hit && hit[1] * s.width + hit[0] === c } }, got)
      const motion = () => get((c) => window.__goops.gooMotion(c), got)
      const calm = await motion()
      const m = await mark()
      await tap(pos.px, pos.py)
      let peak = 0
      for (let k = 0; k < 6; k++) { await sleep(40); peak = Math.max(peak, await motion()) }
      const r = await actsSince(m)
      const still = await get((c) => !!window.__goops.engine.state.grid[c], got)
      check('C-2 (today) tap on goop that can\'t pop: no rotate', pos.onCell && !r.some((a) => a.type === 'rotate'), JSON.stringify(r.map((a) => a.type)))
      check('C-2 (today) …it tried to zap, the goop stays and jiggles', r.some((a) => a.type === 'pop') && still && peak > Math.max(calm * 4, 0.02),
        `motion ${calm.toFixed(3)} → peak ${peak.toFixed(3)}`)
    }
  }

  // ═══ 14. tap a ready group: pops it (T6) ═══
  await fresh(); w = await where()
  {
    const target = await get(() => {
      const { engine } = window.__goops
      for (let i = 0; i < 6; i++) { // fast-drop six pieces side by side
        for (let k = 0; k < 3; k++) engine.act({ type: 'spin', dir: 1 })
        let lastY = -99
        for (let t = 0; t < 60; t++) {
          engine.act({ type: 'softDrop', on: true }); engine.tick(100)
          const p = engine.state.piece, y = p ? Math.min(...p.cells.map((c) => c[1])) : -99
          if (y < lastY) break
          lastY = y
        }
      }
      engine.act({ type: 'softDrop', on: false })
      for (let t = 0; t < 400; t++) {
        engine.tick(50)
        const s = engine.state
        for (const g of s.groups.values()) if (g.ready) {
          const cell = g.cells[0], x = cell % s.width
          let d = ((x - s.spin) % s.width + s.width) % s.width; if (d > s.width / 2) d -= s.width
          for (let k = 0; k < Math.abs(d); k++) engine.act({ type: 'spin', dir: d > 0 ? 1 : -1 })
          return { cell, size: g.cells.length, score: engine.state.score }
        }
      }
      return null
    })
    if (!target) check('a group became ready', false)
    else {
      await page.waitForTimeout(1500) // the camera glides to the new spin
      const pos = await get((cell) => {
        const { engine, view } = window.__goops, s = engine.state
        const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
        const x = cell % s.width, y = Math.floor(cell / s.width)
        let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
        return [stage.left + view.centreX + d * view.cellPx, stage.top + view.topY + (y - s.bufferRows + 0.5) * view.cellPx]
      }, target.cell)
      const m = await mark()
      await tap(...pos); await sleep(100)
      const r = await actsSince(m)
      const score = await get(() => window.__goops.engine.state.score)
      check('tap a ready group pops it', score > target.score && !r.some((a) => a.type === 'rotate'), `score ${target.score} → ${score} (group of ${target.size})`)
    }
  }

  check('no console errors', errors.length === 0, errors.join(' | '))
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
console.log(`\n${failed ? `${failed} of ${count} FAILED` : `all ${count} checks pass`} (${((Date.now() - started) / 1000).toFixed(0)} s)`)
process.exit(failed ? 1 : 0)
