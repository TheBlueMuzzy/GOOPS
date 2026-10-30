// F64 THE FINAL SHIFT (rank 50, the boss level — design/story.md "The final shift", TDD D26 / D27), in Playwright's own
// Chromium. Portrait sizes only (Goops never plays sideways): 390x844, 360x780, 1100x1300, 1440x900, 1920x1080.
// At every size:
//   his drop-in ("oh! hi!" — all four lines at 390) · every goop, junk and crack galaxy black · the top bar shows the
//   valve ("VALVE 1 · 5 / 6", not the crack count) · a stage filling → "GO TO THE CONSOLE!" + his "valve's open on your
//   console — go!" · W → the console: the hatch is open, the valve panel is up (inside its card with room on every
//   side, inside the screen, above the hatch), the shift runs at finalShift.json consoleTimeScale · the hatch shuts and opens the panel
//   · the wheels solved with REAL keys (A / D, ← / →; at 390 a real drag round a wheel first) → "STAGE 1 OPEN!" → the
//   stage opens and you're back in the tank · stages 2 and 3 (the green narrower each time) · the win: F65's ending starts (e2e/ending.mjs plays the rest).
// The three losses, forced through the engine's own paths (he's used up · goop over the top · integrity 0): "Final
// shift failed", which one, "You can try the final shift again", Try again.
// A long run with REAL keys + taps (and the whispers on) that plays rank 50 until a black crack GROWS (the rank-30+
// twist) — failing on any page error: the bots never draw, so a view crash only shows here (a grown crack's negative key
// froze the picture once — SPRINT 22 Notes).
// Waits are on the game's own clock (the engine's played time) or roomy — never a tight wall-clock wait.
// Shots: e2e-shots/final-shift/ (valve-<size>, valve-open-<size>, bar-<size>, bar-go-<size>, won-<size>, lost-*).
// Run: node e2e/final-shift.mjs  (own dev server on port 6450; FINAL_PART=sizes|losses|moment|long runs one part)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 6450
const SHOTS = 'e2e-shots/final-shift'
const SIZES = [[390, 844], [360, 780], [1100, 1300], [1440, 900], [1920, 1080]]
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const valveJson = JSON.parse(readFileSync('content/tuning/valve.json', 'utf8'))
const finalJson = JSON.parse(readFileSync('content/tuning/finalShift.json', 'utf8'))
const breakdowns = JSON.parse(readFileSync('content/tuning/breakdowns.json', 'utf8'))
const story = JSON.parse(readFileSync('content/story/moments.json', 'utf8'))
const V = en.console.valve, F = en.end.final
const part = (name) => !process.env.FINAL_PART || process.env.FINAL_PART === name
mkdirSync(SHOTS, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }
// everything a player who reached rank 50 has had (lessons, notes, every story moment) — this script is about the shift
const SEEN = ['lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades', 'lesson:visor', 'lesson:laser',
  'lesson:controls', 'consoleNote:1', 'consoleNote:2', 'consoleNote:3', 'consoleNote:4', 'consoleNote:5', 'whisper:cold', 'look:mouths-open',
  ...Array.from({ length: 51 }, (_, i) => `story:${i}`)]

// wait until `test` (a function body over S = the engine's state) holds, counting the time the ENGINE has played (its
// tick()s) — under check:full's load each frame's step is capped, so the game runs slower than the wall clock. A
// wall-clock ceiling of 8× stops a stuck page.
const until = (page, test, ms = 20000) => page.evaluate(([t, ms]) => {
  const e = window.__goops.engine
  if (!e.__played) { const tick = e.tick; e.__played = 0; e.tick = (d) => { e.__played += d; return tick.call(e, d) } }
  const f = new Function('S', 'E', `return (${t})`)
  const start = e.__played, wallEnd = performance.now() + ms * 8
  return new Promise((ok) => {
    const step = () => {
      if (f(e.state, e)) return ok(true)
      if (e.__played - start > ms || performance.now() > wallEnd) return ok(false)
      requestAnimationFrame(step)
    }
    step()
  })
}, [test, ms])
const bubbleSays = (page, words, timeout = 15000) => page.waitForFunction((w) => [...document.querySelectorAll('.kit-talk')]
  .some((b) => b.textContent.includes(w)), words, { timeout }).then(() => true, () => false)
const topBar = (page) => page.evaluate(() => [...document.querySelectorAll('.kit-hud-text')].map((el) => el.textContent).join(' | '))
const atConsole = (page) => page.locator('.kit-art-stage').count().then((n) => n > 0)

async function open(w, h, url = `?rank=50&seed=7`) {
  const context = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/${url}`)
  await page.evaluate((ids) => window.__goopsSeen?.(ids), SEEN)
  // (with ?story the moments play: the one due was already up as the page opened — seen now, so a reload is quiet)
  if (url.includes('story')) await page.reload()
  await startShift(page)
  return { page, errors, close: () => context.close() }
}
// the intro played out on the engine's own clock (the rest of the checks don't need to watch it)
const skipIntro = (page) => page.evaluate(() => { const e = window.__goops.engine; for (let i = 0; i < 2000 && e.state.final.intro; i++) e.tick(50) })
// the machines don't wear down (a breakdown would only add a repair on the way to the valve)
const quietMachines = (page) => page.evaluate(() => { window.__goops.engine.machines.tick = () => {} })

// the valve: turn each wheel to its right click with real keys (A / D the left, ← / → the right)
async function solveWithKeys(page) {
  const v = await page.evaluate(() => window.__goopsValve)
  for (const [i, [back, on]] of [[0, ['KeyA', 'KeyD']], [1, ['ArrowLeft', 'ArrowRight']]]) {
    const off = Math.atan2(Math.sin(v.right[i] - v.angle[i]), Math.cos(v.right[i] - v.angle[i]))
    const n = Math.round(off / v.keyTurn)
    for (let k = 0; k < Math.abs(n); k++) await page.keyboard.press(n < 0 ? back : on)
  }
}
// a real drag round the left wheel: a quarter turn clockwise, from its top (8 clicks a turn → 2 clicks on)
async function dragLeftWheel(page) {
  const box = await page.evaluate(() => window.__goopsValve.wheelAt(0))
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width * 0.4
  const at = (deg) => [cx + Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r]
  await page.mouse.move(...at(0))
  await page.mouse.down()
  for (let d = 10; d <= 90; d += 10) await page.mouse.move(...at(d))
  await page.mouse.up()
}

// the panel: its card inside the screen and above the hatch; everything drawn on it with room on every side
const panelRoom = (page) => page.evaluate(() => {
  const bg = document.querySelector('.valve-bg').getBoundingClientRect()
  const hatch = document.querySelector('[data-tag="hatch"]')?.getBoundingClientRect()
  let least = Infinity
  for (const el of document.querySelectorAll('.valve-title, .valve-name, .valve-tick, .valve-red, .valve-stage, .valve-rim')) {
    const r = el.getBoundingClientRect()
    least = Math.min(least, r.left - bg.left, bg.right - r.right, r.top - bg.top, bg.bottom - r.bottom)
  }
  return { least: Math.round(least * 10) / 10, onScreen: bg.left >= 0 && bg.top >= 0 && bg.right <= innerWidth && bg.bottom <= innerHeight,
    aboveHatch: !hatch || bg.bottom <= hatch.top + 1 }
})

try {
  // ---------------- the final shift at every portrait size: black, his drop-in, the 3 valve stages, the win ----------------
  if (part('sizes')) for (const [w, h] of SIZES) {
    const size = `${w}x${h}`
    const { page, errors, close } = await open(w, h)
    // his drop-in: the bubble above him ("oh! hi!" … at 390 every line, in order)
    const lines = w === 390 ? ['hi', 'itsMe', 'oof', 'help'] : ['hi']
    const said = []
    for (const l of lines) said.push(await bubbleSays(page, en.finalShift.vet[l], 60000))
    check(`${size}: he drops in saying ${lines.join(', ')}`, said.every(Boolean), JSON.stringify(said))
    await skipIntro(page)
    await quietMachines(page)
    check(`${size}: the intro is over — a piece is falling`, await until(page, '!S.final.intro && !!S.piece', 10000))
    // galaxy black: the piece, every cell in the tank and every crack
    await until(page, 'S.cracks.length > 0 || S.grid.some((c) => c)', 30000)
    const black = await page.evaluate(() => {
      const e = window.__goops.engine, s = e.state
      return { piece: !s.piece || s.piece.colors.every((c) => c === e.black), grid: [...s.grid].every((c) => !c || c === e.black),
        cracks: s.cracks.every((c) => c.color === e.black), colour: e.black, name: e.config.colors[e.black - 1] }
    })
    check(`${size}: every goop + crack is galaxy black (${black.name})`, black.piece && black.grid && black.cracks && black.name === finalJson.colour, JSON.stringify(black))
    // the top bar: the valve, not the cracks
    await page.evaluate(() => { const e = window.__goops.engine; e.countValve(e.state.final.need - 1) })
    await until(page, 'true', 300)
    await page.waitForTimeout(300)
    const bar = await topBar(page)
    check(`${size}: the top bar shows the valve`, bar.includes(en.hud.valve.replace('{n}', 1).replace('{seals}', finalJson.valve.stages[0] - 1).replace('{need}', finalJson.valve.stages[0]))
      && !/CRACKS/.test(bar), JSON.stringify(bar))
    await page.screenshot({ path: `${SHOTS}/bar-${size}.png` })

    for (let stage = 0; stage < 3; stage++) {
      // the stage fills: it waits at the console — the top bar and his bubble say go
      await page.evaluate(() => { const e = window.__goops.engine; e.countValve(e.state.final.need) })
      const waits = await until(page, `S.final.waiting && S.final.stage === ${stage}`, 2000)
      const go = await bubbleSays(page, en.finalShift.vet.valveGo, 8000)
      await page.waitForFunction((t) => [...document.querySelectorAll('.kit-hud-text')].some((el) => el.textContent.includes(t)), en.hud.valveGo, { timeout: 5000 }).catch(() => {})
      check(`${size} stage ${stage + 1}: filled → it waits, the top bar says go, and so does he`, waits && go && (await topBar(page)).includes(en.hud.valveGo))
      if (stage === 0) await page.screenshot({ path: `${SHOTS}/bar-go-${size}.png` })
      // to the console: W
      await page.keyboard.press('KeyW')
      await page.locator('.kit-art-stage').waitFor({ timeout: 8000 })
      await page.waitForFunction(() => !!window.__goopsValve, null, { timeout: 8000 })
      await page.waitForTimeout(900) // (the console's slide)
      const v = await page.evaluate(() => window.__goopsValve)
      const green = valveJson.green * valveJson.shrink ** stage
      check(`${size} stage ${stage + 1}: the hatch is open, the panel up, the green ${green.toFixed(3)} wide`,
        Math.abs(v.green - green) < 1e-9 && v.stage === stage && await page.locator('[data-tag="hatch"][aria-pressed="true"]').count() === 1
        && (await page.locator('.valve-title').textContent()).trim() === V.title.replace('{n}', stage + 1).replace('{total}', 3))
      if (stage === 0) {
        const rate = await page.evaluate(() => window.__goops.clocks().rate)
        // (the final shift's own console speed — finalShift.json consoleTimeScale, not breakdowns.json's: F52)
        check(`${size}: at the console the shift runs at the final shift's consoleTimeScale (${finalJson.consoleTimeScale}, not ${breakdowns.consoleTimeScale})`, Math.abs(rate - finalJson.consoleTimeScale) < 1e-9, String(rate))
        const room = await panelRoom(page)
        check(`${size}: the panel is on screen, above the hatch, nothing touching its edge`, room.onScreen && room.aboveHatch && room.least >= 6, JSON.stringify(room))
        await page.screenshot({ path: `${SHOTS}/valve-${size}.png` })
        // the hatch shuts the panel (to repair a machine) and opens it again
        await page.locator('[data-tag="hatch"]').click()
        const shut = await page.locator('.valve').count() === 0 && await page.locator('[data-tag="hatch"][aria-pressed="false"]').count() === 1
        await page.locator('[data-tag="hatch"]').click()
        await page.waitForFunction(() => !!window.__goopsValve, null, { timeout: 5000 }).catch(() => {})
        check(`${size}: the hatch shuts the panel and opens it again`, shut && await page.locator('.valve').count() === 1)
        if (w === 390) {
          const before = await page.evaluate(() => window.__goopsValve.angle[0])
          await dragLeftWheel(page)
          const after = await page.evaluate(() => window.__goopsValve)
          const clicks = Math.round((after.angle[0] - before) / after.click)
          check(`${size}: a drag a quarter round the left wheel turns it 2 clicks`, clicks === 2, String(clicks))
        }
      }
      // solve it with real keys: the needle settles in the green, is held, the stage opens
      await solveWithKeys(page)
      const opened = await page.waitForFunction(() => window.__goopsValve?.opened, null, { timeout: 20000 }).then(() => true, () => false)
      if (opened && stage === 0) {
        check(`${size}: "${V.opened.replace('{n}', 1)}" on the panel`, (await page.locator('.valve-title').textContent()).trim() === V.opened.replace('{n}', 1))
        await page.screenshot({ path: `${SHOTS}/valve-open-${size}.png` })
      }
      const next = await until(page, `S.final.stage === ${stage + 1} && !S.final.waiting`, 10000)
      check(`${size} stage ${stage + 1}: solved with keys → the stage opens`, opened && next)
      if (stage < 2) {
        const back = await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 10000 }).then(() => true, () => false)
        check(`${size} stage ${stage + 1}: back in the tank, the next stage needs ${finalJson.valve.stages[stage + 1]}`, back
          && await page.evaluate((n) => window.__goops.engine.state.final.need === n, finalJson.valve.stages[stage + 1]))
      }
    }
    // the win: F65 — The ending starts in the tank (the goop pours out; no report) — e2e/ending.mjs plays it all
    const won = await page.locator('[data-tag="ending-goop"]').waitFor({ timeout: 15000 }).then(() => true, () => false)
    await page.waitForTimeout(1500)
    check(`${size}: the third stage = the win: the ending starts (the goop pours out), no report`, won && await page.locator('.kit-end').count() === 0
      && await page.evaluate(() => window.__goops.engine.state.final.outcome === 'won' && window.__goops.engine.state.final.stage === 3))
    await page.screenshot({ path: `${SHOTS}/won-${size}.png` })
    check(`${size}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }

  // ---------------- the three losses, each through the engine's own path ----------------
  const LOSSES = [
    ['vetGone', [390, 844], () => { const e = window.__goops.engine; e.state.vet.size = 0; e.events.push({ type: 'vetGone' }); e.finalLoss('vetGone') }],
    ['overflow', [1440, 900], () => window.__goops.engine.rupture('overflow')],
    ['integrity', [360, 780], () => { const e = window.__goops.engine; e.state.integrity = 0; e.rupture('integrity') }],
  ]
  if (part('losses')) for (const [outcome, [w, h], force] of LOSSES) {
    const { page, errors, close } = await open(w, h)
    await skipIntro(page)
    await quietMachines(page)
    await page.evaluate(force)
    const lost = await page.getByRole('heading', { name: F.lostTitle }).waitFor({ timeout: 10000 }).then(() => true, () => false)
    await page.waitForTimeout(1200)
    const report = lost ? await page.locator('.kit-end').innerText() : ''
    const flat = report.replace(/\s+/g, ' ')
    check(`lose (${outcome}) at ${w}x${h}: "${F.lostTitle}", which loss, try again`, lost && flat.includes(F[outcome].replace(/\s+/g, ' ').slice(0, 30))
      && flat.includes(F.tryAgain) && await page.getByRole('button', { name: F.again }).count() === 1
      && await page.evaluate((o) => window.__goops.engine.state.final.outcome === o, outcome), flat.slice(0, 160))
    await page.screenshot({ path: `${SHOTS}/lost-${outcome}-${w}x${h}.png` })
    // Try again = rank 50 again, from his drop-in
    await page.getByRole('button', { name: F.again }).click()
    const again = await page.waitForFunction(() => { const s = window.__goops?.engine.state; return s?.status === 'playing' && s.final?.stage === 0 }, null, { timeout: 15000 })
      .then(() => true, () => false)
    check(`lose (${outcome}): Try again plays the final shift again`, again)
    check(`lose (${outcome}): no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }

  // ---------------- rank 50's story moment: Management's line, with the red alarm, before the shift ----------------
  if (part('moment')) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${PORT}/?seed=7&story`)
    const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
    let xp = 0
    for (let r = 0; r < 50; r++) xp += prog.xpBase + prog.xpPerRank * r
    await page.evaluate(([xp, seen]) => {
      localStorage.setItem('goops-progress', JSON.stringify({ v: 3, totalXp: xp + 10, scrapsSpent: 0, owned: {}, equipped: [], name: null }))
      window.__goopsSeen?.(seen)
    }, [xp, SEEN.filter((id) => id !== 'story:50')])
    await page.reload()
    const words = en.story.lines[story.moments['50'].lines[0].words]
    const says = await page.waitForFunction((w) => document.querySelector('[data-tag="crt"] .crt-read')?.textContent.trim() === w, words, { timeout: 15000 })
      .then(() => true, () => false)
    const look = await page.locator('[data-tag="crt"]').getAttribute('data-story-look')
    check('rank 50: the moment is Management\'s "FINAL PERFORMANCE REVIEW…" with the red alarm', says && look === 'alarm', String(look))
    await page.screenshot({ path: `${SHOTS}/moment50-390x844.png` })
    check('rank 50 moment: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await context.close()
  }

  // ---------------- a long run with real keys + taps until a black crack GROWS — any page error fails ----------------
  if (part('long')) {
    const [w, h] = [390, 844]
    const { page, errors, close } = await open(w, h, `?rank=50&seed=3&story&whisperAt=12`)
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyS', 'Space', 'KeyW']
    let rnd = 3 * 9301 + 49297
    const r = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280 }
    let grownAt = -1, shifts = 1, consoleFor = 0, t = 0, shot = false
    for (; t < 1500; t++) {
      if (await atConsole(page)) { // mid-shift at the console (a W, or the valve): a few presses there, then the periscope back
        if (++consoleFor > 4) { await page.locator('.kit-pull-grip').first().click().catch(() => {}); consoleFor = 0 }
        else await page.keyboard.press(keys[Math.floor(r() * 7)])
      } else {
        consoleFor = 0
        const report = page.locator('.kit-end')
        if (await report.count()) { // the shift ended: play it again, as a player would
          await page.waitForTimeout(800)
          await page.getByRole('button', { name: new RegExp(`^(${F.again}|${en.end.again})$`) }).first().click().catch(() => {})
          shifts++
          await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing', null, { timeout: 15000 }).catch(() => {})
          continue
        }
        await page.keyboard.press(keys[Math.floor(r() * keys.length)])
        if (r() < 0.4) await page.mouse.click(w * (0.2 + 0.6 * r()), h * (0.45 + 0.35 * r()))
      }
      await page.waitForTimeout(150)
      if (t % 5 === 4) {
        const grown = await page.evaluate(() => window.__goops?.engine.state.cracks.some((c) => (c.cells?.length ?? 1) > 1) ?? false)
        if (grown && grownAt < 0) { grownAt = t; console.log(`  a black crack grew after ${t} actions (shift ${shifts})`) }
        if (grown && !shot && !await atConsole(page)) { shot = true; await page.screenshot({ path: `${SHOTS}/grown-${w}x${h}.png` }) } // (in the tank)
        if (grownAt >= 0 && t - grownAt >= 60) break // keep playing a while with it drawn
        if (errors.length) break
      }
    }
    check('long run (real keys + taps, whispers on): a black crack grew and was drawn for a while', grownAt >= 0 && t - grownAt >= 60, `${t} actions, ${shifts} shift(s)`)
    check('long run: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await close()
  }
} catch (e) {
  console.log('✗ crashed:', e.message)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall final-shift checks passed')
process.exit(failed ? 1 : 0)
