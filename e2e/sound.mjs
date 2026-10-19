// SOUND (F29) — reads the audio module's log (window.__audioLog: every play and drop, with why; src/game/sound.ts) in a
// real shift on the real dev server:
//   1. the console: the periscope pull plays its clunk (and the kit's tap)
//   2. a shift played by the Sharp balance bot (scripts/bots, the game's own engine and inputs): goop lands, merges,
//      fills, pops, cracks form and get sealed — each one PLAYED (not dropped), every file found
//   3. a machine repaired (dev hook breaks the visor, the engine repairs it) → machine.fixed
//   4. NOTHING plays while the rules clock stands still: ⏸ full pause (a click on the Dev Kit can't wake it either),
//      ◐ half pause and the game's own pause menu — the engine is even ticked by hand meanwhile, and its events stay silent
//   5. the tank ruptures (the low alarm), and the shift's end plays its sound
//   + no errors or warnings in the console
// Headless Chromium starts with --autoplay-policy=no-user-gesture-required (the first click unlocks the audio anyway).
// Port 5321 (its own dev server). Run: node e2e/sound.mjs
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'

const PORT = 5321
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => { stop(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

const log = (page) => page.evaluate(() => window.__audioLog?.entries() ?? null)
const played = (entries, id, from = -Infinity, to = Infinity) => entries.filter((e) => e.id === id && e.result === 'played' && e.t >= from && e.t <= to)
const pageNow = (page) => page.evaluate(() => performance.now())
const pauseBtn = (page, which) => page.locator(`aside.devkit .devkit-pause-btn[data-pause="${which}"]`)
const openKit = async (page) => { if (!(await page.locator('aside.devkit').isVisible())) { await page.keyboard.press('Backquote'); await page.waitForTimeout(300) } }
const closeKit = async (page) => { if (await page.locator('aside.devkit').isVisible()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300) } }
// the engine, ticked by hand, makes events the game's frame loop then hands to the sound code
const tickByHand = (page) => page.evaluate(() => {
  const e = window.__goops.engine
  for (let i = 0; i < 4; i++) { e.act({ type: 'rotate', dir: 1 }); e.act({ type: 'spin', dir: 1 }); e.tick(1500) }
})

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const problems = []
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`) })
  page.on('response', (r) => { if (r.url().includes('/audio/') && r.status() >= 400) problems.push(`missing sound file ${r.url()} (${r.status()})`) })
  await page.goto(`http://localhost:${PORT}/?seed=7&rank=1`)
  check('the audio log is there (window.__audioLog)', !!(await log(page)))

  // ---- 1. the console ----
  await startShift(page)
  await page.waitForTimeout(300)
  {
    const entries = await log(page)
    check('the periscope pull plays its clunk', played(entries, 'ui.periscope').length === 1, JSON.stringify(entries.filter((e) => e.id === 'ui.periscope')))
    // (the very first tap of a visit unlocks the audio and starts loading the files, so its own click is still loading:
    // logged 'not-loaded' — every later one plays; the pause menu's button below checks that)
    check('the kit\'s tap is asked for too (setControlSound)', entries.some((e) => e.id === 'ui.tap' && (e.result === 'played' || e.reason === 'not-loaded')))
  }

  // ---- 2. a shift played by the Sharp bot ----
  await page.evaluate(async () => {
    const { Bot } = await import('/scripts/bots/bot.ts')
    const bots = (await import('/scripts/bots/bots.json')).default
    const g = window.__goops, engine = g.engine, s = engine.state
    const bot = new Bot(bots.bots.sharp)
    // the bot hears the game's events as they're taken (the frame loop takes them — this listens in)
    const take = engine.takeEvents.bind(engine)
    engine.takeEvents = () => {
      const events = take()
      const now = g.clocks().rules
      for (const e of events) {
        if (e.type === 'spawn') bot.newPiece(now, false)
        if (e.type === 'hold') bot.newPiece(now, true)
        if (e.type === 'reject' && e.action === 'spin') bot.spinRejected(s)
        if (e.type === 'reject' && e.action === 'rotate') bot.rotateRejected()
      }
      return events
    }
    bot.newPiece(g.clocks().rules, false)
    window.__bot = setInterval(() => {
      const c = g.clocks()
      if (c.rate <= 0 || s.status !== 'playing') return
      const action = bot.decide(s, c.rules, 120)
      if (action) engine.act(action)
    }, 20)
  })
  const want = ['goop.land', 'goop.merge', 'goop.ready', 'goop.pop', 'crack.form', 'crack.seal']
  const started = Date.now()
  let entries = []
  while (Date.now() - started < 150000) {
    await page.waitForTimeout(1000)
    entries = await log(page)
    if (want.every((id) => played(entries, id).length)) break
    if (await page.evaluate(() => window.__goops.engine.state.phase !== 'playing')) break
  }
  const seconds = Math.round((Date.now() - started) / 1000)
  for (const id of want) check(`${id} played in the bot's shift`, played(entries, id).length > 0, `${played(entries, id).length}× in ${seconds} s`)
  const drops = entries.filter((e) => e.result === 'dropped')
  const badDrops = drops.filter((e) => ['unknown-sound', 'no-files'].includes(e.reason))
  check('no sound is unknown or without files', badDrops.length === 0, JSON.stringify(badDrops.slice(0, 3)))
  const why = {}
  for (const d of drops) why[`${d.id}:${d.reason}`] = (why[`${d.id}:${d.reason}`] ?? 0) + 1
  console.log('     drops so far (cooldowns / limits are the module thinning repeats):', JSON.stringify(why))
  // spins and pops never machine-gun: never two of the same sound closer than its cooldown
  for (const id of ['tank.spin', 'goop.pop', 'goop.land']) {
    const ts = played(entries, id).map((e) => e.t)
    const closest = ts.slice(1).reduce((m, t, i) => Math.min(m, t - ts[i]), Infinity)
    check(`${id}: repeats keep their distance`, closest >= 29, `closest ${Math.round(closest)} ms over ${ts.length} plays`)
  }
  await page.evaluate(() => clearInterval(window.__bot))

  // ---- 3. a machine repaired ----
  {
    const t0 = await pageNow(page)
    await page.evaluate(() => { const g = window.__goops; g.breakMachine('visor'); g.engine.act({ type: 'repair', machine: 'visor' }) })
    await page.waitForTimeout(300)
    check('a repaired machine plays machine.fixed', played(await log(page), 'machine.fixed', t0).length === 1)
  }

  // ---- 4. nothing plays while the rules clock stands still ----
  {
    await openKit(page)
    // ⏸ full pause: the game is frozen; a click on the Dev Kit (a tap the audio engine hears) must not wake it
    await pauseBtn(page, 'full').click()
    const t0 = await pageNow(page)
    await page.keyboard.press('KeyE') // (the game takes no keys now)
    await page.locator('aside.devkit').click({ position: { x: 20, y: 120 } })
    await page.waitForTimeout(1200)
    const t1 = await pageNow(page)
    await pauseBtn(page, 'full').click() // resume
    await page.waitForTimeout(200)
    const during = (await log(page)).filter((e) => e.t >= t0 && e.t <= t1 && e.result === 'played')
    check('⏸ full pause: nothing plays', during.length === 0, JSON.stringify(during.map((e) => e.id)))

    // ◐ half pause: the frame loop runs; the engine ticked by hand makes events — they stay silent
    await pauseBtn(page, 'half').click()
    const t2 = await pageNow(page)
    await tickByHand(page)
    await page.waitForTimeout(800)
    const t3 = await pageNow(page)
    const half = (await log(page)).filter((e) => e.t >= t2 && e.t <= t3 && e.result === 'played')
    check('◐ half pause: nothing plays, even with events made by hand', half.length === 0, JSON.stringify(half.map((e) => e.id)))
    await pauseBtn(page, 'half').click() // resume
    await closeKit(page)
    await page.waitForTimeout(200)
  }
  {
    // the game's own pause menu (the Console button in the shift): its button clicks, the tank goes quiet
    const tBtn = await pageNow(page)
    await page.getByRole('button', { name: 'Console' }).click()
    await page.waitForTimeout(400)
    check('a kit button plays ui.tap', played(await log(page), 'ui.tap', tBtn).length === 1)
    const t0 = await pageNow(page)
    await tickByHand(page)
    await page.waitForTimeout(800)
    const t1 = await pageNow(page)
    const menu = (await log(page)).filter((e) => e.t >= t0 && e.t <= t1 && e.result === 'played')
    check('the pause menu: nothing from the tank plays', menu.length === 0, JSON.stringify(menu.map((e) => e.id)))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }

  // ---- the Dev Kit's Sound tab: lists every sound, and ▶ plays one through the game's engine ----
  {
    await openKit(page)
    await page.locator('aside.devkit .devkit-tab', { hasText: 'Sound' }).click()
    await page.waitForTimeout(400)
    const names = await page.locator('aside.devkit .sb-sound-name').allTextContents()
    check('Dev Kit Sound tab lists every sound', names.length === 26 && names.includes('goop.pop'), `${names.length} sounds`)
    const t0 = await pageNow(page)
    await page.getByRole('button', { name: 'Play crack.seal', exact: true }).click()
    await page.waitForTimeout(300)
    check('Dev Kit Sound tab: ▶ plays it in the game', played(await log(page), 'crack.seal', t0).length === 1)
    await closeKit(page)
  }

  // ---- 5. the rupture and the end ----
  {
    const t0 = await pageNow(page)
    await page.evaluate(() => { const e = window.__goops.engine; for (let t = 0; t < 600000 && e.state.phase === 'playing'; t += 500) e.tick(500) })
    await page.waitForTimeout(500)
    check('the tank ruptures: the alarm plays', played(await log(page), 'tank.rupture', t0).length === 1)
    await page.evaluate(() => { const e = window.__goops.engine; for (let t = 0; t < 600000 && e.state.status === 'playing'; t += 500) e.tick(500) })
    await page.waitForTimeout(800)
    const end = await log(page)
    const status = await page.evaluate(() => window.__goops.engine.state.status)
    check(`the shift ends (${status}): its sound plays`, played(end, status === 'won' ? 'shift.won' : 'shift.lost', t0).length === 1)
  }
  check('console clean (no errors or warnings, no missing files)', problems.length === 0, problems.slice(0, 5).join(' | '))
  await page.close()
} finally {
  await browser.close()
  stop()
}
console.log(failed ? `${failed} FAILED` : 'all sound checks passed')
process.exit(failed ? 1 : 0)
