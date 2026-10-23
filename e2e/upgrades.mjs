// F34 — THE UPGRADES SCREEN (the console's shop), with real input in Playwright's own Chromium (never the user's Chrome).
// A REAL save is seeded (a version-1 save from the alpha, so the save upgrade runs in the browser too), not ?rank=N:
//   rank 5 — Upgrades opens: "Scraps: 5", one card per upgrade for ranks 2–9 in rank order; 6–9 locked with "Opens at
//            rank N" and no buttons; buy a level of Circuit Stabilizer → scraps 4, its pips 1 of 4, the card the same
//            size, saved (version 2) → reload → still owned, scraps still 4 → take it back → scraps 5, nothing owned;
//            Cooldown Booster: its switch is off and asleep until a level is bought, then takes it into the shift (saved),
//            and taking its last level back switches it off; a level you can't afford is refused (the + greys out)
//   breathing room — every card's contents sit inside its border with room to spare, every card inside the menu card;
//            nothing wider than its box; the list scrolls (a real finger swipe on a card, CDP touch) on a phone
//   no page errors, no card grew (the kit's fixed-size watch: window.__uiGrowth)
// Screenshots (looked at by hand): e2e-shots/upgrades/ and ~/Documents/dev/.scratch/goops-upgrades/ at 360x740, 390x844
// and 1440x900 (portrait only — D11): a fresh rank 5, and a rank 9 save with levels bought + the active equipped
// (top of the list and scrolled to the end).
// F34 tasks 5–7 (the 'shift' part, first): each of the 8 upgrades MEASURED in a real shift (see "what you own MEASURED"
// below), Cooldown Booster's HUD charge button (empty / charging / ready shots at the three sizes, F refused while not
// full, a tap and F fire it), and the cards' level number ("2/4"). Shots also in ~/Documents/dev/.scratch/goops-upgrades-2/.
// Run: node e2e/upgrades.mjs [shop | shift]  (own dev server on port 5345; no part = both)
import { chromium } from 'playwright-core'
import { checkVersion, skipFirstDay } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT = 5345, OUT = 'e2e-shots/upgrades', SCRATCH = join(homedir(), 'Documents', 'dev', '.scratch', 'goops-upgrades-2')
const en = JSON.parse(readFileSync('content/text/en.json', 'utf8'))
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const w = en.upgrades, items = w.items
mkdirSync(OUT, { recursive: true }); mkdirSync(SCRATCH, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

// all the XP to reach a rank (progression.json: xpBase + xpPerRank × rank per rank)
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += prog.xpBase + prog.xpPerRank * r; return xp }
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]))
const ORDER = ['circuitStabilizer', 'autoPopper', 'capacitorEfficiency', 'cooldownBooster', 'gearLubrication', 'focusMode', 'denseGoop', 'pressureControl']

// a device with this save, on the console
async function device(save, { width = 390, height = 844, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, ...(touch ? { hasTouch: true, isMobile: true } : {}) })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await skipFirstDay(page)
  await page.addInitScript((s) => {
    const key = `kit-tips:${location.pathname.split('/').slice(1, -1)[0] ?? ''}`
    const tips = JSON.parse(localStorage.getItem(key) ?? '{"on":true,"seen":[]}')
    localStorage.setItem(key, JSON.stringify({ ...tips, seen: [...new Set([...tips.seen, 'lesson:unlock-upgrades'])] })) // (the button's own lesson: e2e/unlocks.mjs)
    if (s && !sessionStorage.getItem('seeded')) { localStorage.setItem('goops-progress', s); sessionStorage.setItem('seeded', '1') } // once: reloads keep what was bought
  }, save)
  await page.goto(`http://localhost:${PORT}/?seed=7`)
  await checkVersion(page)
  await page.getByRole('button', { name: 'Start shift' }).waitFor()
  return { page, errors, close: () => context.close() }
}
const openShop = async (page) => {
  await page.locator('[data-tag="upgrades"]').click()
  const modal = page.getByRole('dialog', { name: w.title })
  await modal.waitFor({ timeout: 3000 })
  await page.waitForTimeout(500) // (the cards' entrance)
  return modal
}
const card = (page, id) => page.locator('.kit-card').filter({ has: page.getByText(items[id].name, { exact: true }) })
const pips = (page, id) => card(page, id).getByRole('meter')
const level = async (page, id) => Number(await pips(page, id).getAttribute('aria-valuenow'))
const scrapsShown = (page, n) => page.getByRole('dialog', { name: w.title }).getByText(fill(w.scraps, { n }), { exact: true }).count()
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('goops-progress')))
const buy = (page, id) => page.getByRole('button', { name: fill(w.buyLabel, { name: items[id].name }) })
const takeBack = (page, id) => page.getByRole('button', { name: fill(w.takeBackLabel, { name: items[id].name }) })
const equipSwitch = (page, id) => page.getByRole('switch', { name: fill(w.equipLabel, { name: items[id].name }) })
const size = async (loc) => { const b = await loc.boundingBox(); return `${Math.round(b.width)}x${Math.round(b.height)}` }

// Breathing room (CLAUDE.md): everything in a card sits inside its border with room on every side — measured to the
// visible border (the card's box minus its border width), words by their ink (a Range round the text) — and every card
// sits inside the menu card. Nothing wider than its box. Returns the problems as plain lines.
const roomProblems = (page, minPx = 6) => page.evaluate((minPx) => {
  const out = []
  const modal = document.querySelector('.kit-modal').getBoundingClientRect()
  for (const c of document.querySelectorAll('.kit-modal .kit-card')) {
    const r = c.getBoundingClientRect(), s = getComputedStyle(c)
    const inner = { left: r.left + parseFloat(s.borderLeftWidth), right: r.right - parseFloat(s.borderRightWidth), top: r.top + parseFloat(s.borderTopWidth), bottom: r.bottom - parseFloat(s.borderBottomWidth) }
    const title = c.querySelector('.kit-card-title')?.textContent
    if (r.left - modal.left < minPx || modal.right - r.right < minPx) out.push(`${title}: card ${Math.round(r.left - modal.left)} / ${Math.round(modal.right - r.right)} px from the menu card's sides`)
    if (c.scrollWidth > c.clientWidth + 1) out.push(`${title}: wider than its card`)
    const boxes = []
    for (const el of c.querySelectorAll('button, [role="meter"], .kit-pip')) boxes.push([el.getAttribute('aria-label') ?? el.className, el.getBoundingClientRect()])
    const walker = document.createTreeWalker(c, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue
      const range = document.createRange(); range.selectNodeContents(n)
      boxes.push([n.textContent.trim().slice(0, 20), range.getBoundingClientRect()])
    }
    for (const [what, b] of boxes) {
      if (!b.width) continue
      const gaps = [b.left - inner.left, inner.right - b.right, b.top - inner.top, inner.bottom - b.bottom]
      if (Math.min(...gaps) < minPx) out.push(`${title}: "${what}" only ${Math.round(Math.min(...gaps))} px from the card's edge`)
    }
  }
  const list = document.querySelector('.kit-modal .kit-scroll')
  if (list && list.scrollWidth > list.clientWidth + 1) out.push('the list scrolls sideways')
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page is wider than the screen')
  return out
}, minPx)
const growth = (page) => page.evaluate(() => (window.__uiGrowth ?? []).map((g) => `${g.name} ${g.from} → ${g.to}`))
// the list: scroll it to the top / end (a wheel over it — the way a mouse does)
const scrollList = (page, to) => page.evaluate((to) => { const el = document.querySelector('.kit-modal .kit-scroll'); el.scrollTop = to === 'end' ? el.scrollHeight : 0 }, to)
const shot = async (page, name) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  await page.screenshot({ path: join(SCRATCH, `${name}.png`) })
}

const V1_RANK5 = JSON.stringify({ v: 1, totalXp: xpFor(5), scrapsSpent: 0 })
// rank 9: 9 scraps — Circuit Stabilizer max (4), Capacitor Efficiency 2, Cooldown Booster 1 equipped, Pressure Control 1 → 8 spent
const RANK9 = JSON.stringify({ v: 2, totalXp: xpFor(9), scrapsSpent: 8,
  owned: { circuitStabilizer: 4, capacitorEfficiency: 2, cooldownBooster: 1, pressureControl: 1 }, equipped: ['cooldownBooster'] })

// ============ F34 tasks 5–7: what you own MEASURED in a real shift ============
// Two rank-40 saves (enough scraps for everything at once — the same rank, so only the upgrades differ): one owning
// nothing, one owning every machine fix at max (4), Auto-Popper 4, Focus Mode 4, Dense Goop 4, Pressure Control 4 and
// Cooldown Booster 3 equipped. Each change is measured the same way in both shifts and compared:
//   the modifiers in the running engine's snapshot = upgrades.json's numbers at those levels
//   pressure rise (2 s) · a piece's fall (3 rows) · the rupture drain (pressure lost in 1 s) · the visor's grace (ms until
//   its signal starts to fade) · the laser's drain per zapped cell · the controls' cooling (health back in 0.4 s after
//   10 turns) — each ratio = the upgrade's number · Focus Mode: the rules clock's rate at the console mid-shift
//   (consoleTimeScale × 0.6) · the repair panels at the console: each machine's puzzle 1 step shorter
//   Cooldown Booster: the HUD's charge button (empty → charging → ready), F refused while not full, then a real tap with
//   the visor's calm time running → it grows by 50%
// The measuring runs with the shift held under the pause menu (the frame loop doesn't tick it) and moves the engine
// by hand (window.__goops.engine.tick): pure and seeded, so both saves see the same shift.
const XP40 = xpFor(40)
const NONE = JSON.stringify({ v: 2, totalXp: XP40, scrapsSpent: 0, owned: {}, equipped: [] })
const ALL_OWNED = { circuitStabilizer: 4, autoPopper: 4, capacitorEfficiency: 4, cooldownBooster: 3, gearLubrication: 4, focusMode: 4, denseGoop: 4, pressureControl: 4 }
const ALL = JSON.stringify({ v: 2, totalXp: XP40, scrapsSpent: Object.values(ALL_OWNED).reduce((a, b) => a + b, 0), owned: ALL_OWNED, equipped: ['cooldownBooster'] })
const LESSONS_SEEN = ['lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades', 'lesson:laser', 'lesson:visor', 'lesson:controls',
  ...Array.from({ length: 9 }, (_, i) => `consoleNote:${i + 1}`)]
const upgradesJson = JSON.parse(readFileSync('content/tuning/upgrades.json', 'utf8'))
const breakdownsJson = JSON.parse(readFileSync('content/tuning/breakdowns.json', 'utf8'))
const byLevel = (id, modifier) => { const u = upgradesJson.upgrades.find((x) => x.id === id); return u.effects.find((e) => e.modifier === modifier).byLevel[ALL_OWNED[id] - 1] }

async function inShift(save, size) {
  const d = await device(save, size)
  await d.page.evaluate((ids) => window.__goopsSeen?.(ids), LESSONS_SEEN)
  await d.page.getByRole('button', { name: 'Start shift' }).click()
  await d.page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
  await d.page.waitForFunction(() => window.__goops?.engine.state.status === 'playing')
  return d
}
// the shift held still under the pause menu (the HUD's Console button), and let go again (Esc)
const hold = async (page) => {
  await page.getByRole('button', { name: en.hud.pause, exact: true }).click()
  await page.getByRole('dialog').waitFor()
  await page.waitForFunction(() => window.__goops.clocks().rate === 0)
}
const letGo = async (page) => {
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.__goops.clocks().rate > 0)
}

// every measurement, in one go, on a held shift (returns plain numbers)
const measure = (page) => page.evaluate(() => {
  const e = window.__goops.engine, s = e.state, out = { modifiers: e.snapshot().options.modifiers }
  const keep = e.snapshot() // put back between measurements, so each starts from the same moment
  const back = () => { e.restore(keep); e.takeEvents() }
  // pressure: how much it rises in 2 s
  { const p0 = s.pressure; e.tick(2000); out.pressureRise = s.pressure - p0; back() }
  // a piece's fall: from one row step to the 4th after it, in 1 ms ticks (exact to the ms)
  { let ms = 0, steps = 0; e.takeEvents()
    while (steps < 1 && ms < 20000) { e.tick(1); ms++; steps += e.takeEvents().filter((x) => x.type === 'step').length }
    ms = 0; steps = 0
    while (steps < 4 && ms < 20000) { e.tick(1); ms++; steps += e.takeEvents().filter((x) => x.type === 'step').length }
    out.fall4RowsMs = ms; back() }
  // the visor's grace: fast drop on and off (its grace starts again), then ms until its signal starts to fade
  { e.act({ type: 'softDrop', on: true }); e.tick(16); e.act({ type: 'softDrop', on: false })
    let ms = 0
    while (s.machines.visor.health >= 1 && ms < 30000) { e.tick(50); ms += 50 }
    out.visorGraceMs = ms; back() }
  // the controls' cooling: 10 turns of heat, past the cooling delay, then health back in 0.4 s
  { for (let i = 0; i < 10; i++) e.act({ type: 'spin', dir: 1 })
    e.tick(250); const h0 = s.machines.controls.health; e.tick(400)
    out.controlsCool = s.machines.controls.health - h0; back() }
  // the laser's drain per zapped cell: pressure near full (every group under the line), let them fill, zap one
  { s.pressure = 0.99; e.tick(4000)
    const g = [...s.groups.values()].find((x) => x.ready)
    const h0 = s.machines.laser.health
    if (g) { const i = g.cells[0]; e.act({ type: 'pop', x: i % s.width, y: Math.floor(i / s.width) }) }
    out.laserDrainPerCell = g ? (h0 - s.machines.laser.health) / g.cells.length : null; back() }
  // the rupture's drain: integrity at 0 → the tank ruptures; pressure lost in 1 s of the drain
  { s.integrity = 0; e.tick(16); out.ruptured = s.phase === 'rupture'
    s.pressure = 0.9; const p0 = s.pressure; e.tick(1000); out.ruptureDrain = p0 - s.pressure; back() }
  return out
})
const near = (got, want, tol = 0.03) => Math.abs(got / want - 1) <= tol
const ratioLine = (got, want) => `${got.toFixed(3)} (want ${want})`

async function measureShift() {
  const none = await inShift(NONE)
  await hold(none.page)
  const base = await measure(none.page)
  const all = await inShift(ALL)
  await hold(all.page)
  const up = await measure(all.page)
  const m = up.modifiers
  const want = {
    visorGraceMult: byLevel('circuitStabilizer', 'visorGraceMult'), ruptureDrainTimeMult: byLevel('autoPopper', 'ruptureDrainTimeMult'),
    laserDrainMult: byLevel('capacitorEfficiency', 'laserDrainMult'), controlsCoolMult: byLevel('gearLubrication', 'controlsCoolMult'),
    consoleTimeScaleMult: byLevel('focusMode', 'consoleTimeScaleMult'), fallSpeedMult: byLevel('denseGoop', 'fallSpeedMult'),
    pressureRiseTimeMult: byLevel('pressureControl', 'pressureRiseTimeMult'),
  }
  check('nothing owned: every modifier is 1', Object.values(base.modifiers).every((v) => v === 1), JSON.stringify(base.modifiers))
  for (const [name, value] of Object.entries(want)) check(`owned: the running shift's ${name} = ${value}`, Math.abs(m[name] - value) < 1e-9, String(m[name]))
  console.log('     measured (nothing owned → owned):', JSON.stringify({ base: { ...base, modifiers: undefined }, owned: { ...up, modifiers: undefined } }))
  check('Pressure Control 4: pressure rises 1.2× slower', near(base.pressureRise / up.pressureRise, want.pressureRiseTimeMult), ratioLine(base.pressureRise / up.pressureRise, want.pressureRiseTimeMult))
  check('Dense Goop 4: pieces fall 1.5× faster', near(base.fall4RowsMs / up.fall4RowsMs, want.fallSpeedMult, 0.02), `${base.fall4RowsMs} → ${up.fall4RowsMs} ms for 4 rows`)
  check('Auto-Popper 4: the rupture drains 1.6× slower', base.ruptured && up.ruptured && near(base.ruptureDrain / up.ruptureDrain, want.ruptureDrainTimeMult), ratioLine(base.ruptureDrain / up.ruptureDrain, want.ruptureDrainTimeMult))
  check('Circuit Stabilizer 4: the visor holds 1.6× longer', near(up.visorGraceMs / base.visorGraceMs, want.visorGraceMult, 0.03), `${base.visorGraceMs} → ${up.visorGraceMs} ms`)
  check('Capacitor Efficiency 4: each zapped cell drains the laser 0.75×', base.laserDrainPerCell !== null && up.laserDrainPerCell !== null
    && near(up.laserDrainPerCell / base.laserDrainPerCell, want.laserDrainMult), `${base.laserDrainPerCell} → ${up.laserDrainPerCell} a cell`)
  check('Gear Lubrication 4: the controls cool 1.5× faster', near(up.controlsCool / base.controlsCool, want.controlsCoolMult), ratioLine(up.controlsCool / base.controlsCool, want.controlsCoolMult))

  // at the console mid-shift: Focus Mode's speed, and the repair panels (each machine broken by the DEV hook)
  const atConsole = async (page) => {
    await letGo(page)
    await page.keyboard.press('KeyW')
    await page.locator('[data-tag="panel-visor"]').waitFor({ state: 'attached', timeout: 5000 })
    await page.waitForTimeout(1200) // (the slide)
    const rate = await page.evaluate(() => window.__goops.clocks().rate)
    await page.evaluate(() => { for (const id of ['laser', 'visor', 'controls']) window.__goops.breakMachine(id) })
    await page.waitForTimeout(400)
    const steps = await page.evaluate(() => Object.fromEntries(['laser', 'visor', 'controls'].map((id) => [id, Number(document.querySelector(`[data-tag="panel-${id}"]`)?.dataset.steps)])))
    return { rate, steps }
  }
  const c0 = await atConsole(none.page), c1 = await atConsole(all.page)
  check('nothing owned: the shift runs at consoleTimeScale at the console', near(c0.rate, breakdownsJson.consoleTimeScale, 0.001), String(c0.rate))
  check('Focus Mode 4: at the console it runs at consoleTimeScale × 0.6', near(c1.rate, breakdownsJson.consoleTimeScale * want.consoleTimeScaleMult, 0.001), `${c0.rate} → ${c1.rate}`)
  check('nothing owned: the repairs take 4 / 3 / 4 steps (laser / visor / controls)', JSON.stringify(c0.steps) === JSON.stringify({ laser: 4, visor: 3, controls: 4 }), JSON.stringify(c0.steps))
  check('every machine fix at max: each repair 1 step shorter', JSON.stringify(c1.steps) === JSON.stringify({ laser: 3, visor: 2, controls: 3 }), JSON.stringify(c1.steps))
  check('measuring: no page errors', !none.errors.length && !all.errors.length, [...none.errors, ...all.errors].join(' | '))
  await none.close(); await all.close()
}

// Cooldown Booster in the HUD at one size: shots empty → charging → ready; F refused while not full; a real tap fires it
const ability = (page) => page.locator('[data-tag="ability"]')
const abilityState = (page) => page.evaluate(() => { const a = window.__goops.engine.state.abilities[0]; return { charge: a.charge, ready: a.ready } })
// the HUD with the button: every part on screen, the button clear of the tank, the score, the crack count, the
// Console button and the bottom panel, with room to its edges (measured to the visible border)
const hudProblems = (page) => page.evaluate(() => {
  const out = [], v = window.__goops.view, stage = document.querySelector('.kit-hud-dock').parentElement.getBoundingClientRect()
  const b = document.querySelector('[data-tag="ability"]').getBoundingClientRect()
  const tankTop = v.topY // (the stage fills the window)
  if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) out.push('the button is off the screen')
  // (e2e/hud-shots.mjs' rule: the top row may hang over the tank's top edge — a part that starts above it, no deeper
  // than 60 px — and the button never hangs lower than the Console button beside it)
  const pause = [...document.querySelectorAll('.kit-hud-slot button')].find((x) => x.dataset.tag !== 'ability').getBoundingClientRect()
  if (b.top > tankTop + 8 || b.bottom > tankTop + 60) out.push(`the button reaches ${Math.round(b.bottom - tankTop)} px into the tank`)
  if (b.bottom > pause.bottom + 1 || b.top < pause.top - 1) out.push(`the button (${Math.round(b.top)}–${Math.round(b.bottom)}) is taller than the Console button (${Math.round(pause.top)}–${Math.round(pause.bottom)})`)
  const others = [['score', document.querySelector('.kit-hud-chip')], ['crack count', [...document.querySelectorAll('.kit-hud-slot .kit-hud-text, .kit-hud-slot [class*="hud-text"]')][0]],
    ['Console button', [...document.querySelectorAll('.kit-hud-slot button')].find((x) => x.dataset.tag !== 'ability')], ['bottom panel', document.querySelector('.kit-hud-dock')]]
  for (const [name, el] of others) {
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) out.push(`overlaps the ${name}`)
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page is wider than the screen')
  void stage
  return out
})
const ringInside = (page) => page.evaluate(() => {
  const btn = document.querySelector('[data-tag="ability"]'), ring = btn.querySelector('.kit-timer')
  const b = btn.getBoundingClientRect(), s = getComputedStyle(btn), r = ring.getBoundingClientRect()
  const inner = { left: b.left + parseFloat(s.borderLeftWidth), right: b.right - parseFloat(s.borderRightWidth), top: b.top + parseFloat(s.borderTopWidth), bottom: b.bottom - parseFloat(s.borderBottomWidth) }
  return Math.round(Math.min(r.left - inner.left, inner.right - r.right, r.top - inner.top, inner.bottom - r.bottom))
})

async function boosterAt(width, height) {
  const tag = `${width}x${height}`
  const { page, errors, close } = await inShift(ALL, { width, height })
  await page.waitForTimeout(400)
  check(`${tag}: the HUD has the charge button`, await ability(page).count() === 1)
  const hp = await hudProblems(page)
  check(`${tag}: the button fits the top row — on screen, clear of the tank, the score, the crack count, the Console button and the panel`, hp.length === 0, hp.join(' | '))
  const room = await ringInside(page)
  check(`${tag}: the ring sits inside the button with room (≥ 2 px to its border)`, room >= 2, `${room} px`)
  await shot(page, `hud-ability-empty-${tag}`)
  // charging: half full
  await hold(page)
  await page.evaluate(() => window.__goops.engine.tick(10_000))
  await letGo(page)
  await page.waitForTimeout(300)
  const half = await abilityState(page)
  const label = await ability(page).getAttribute('aria-label')
  check(`${tag}: after 10 s of play (+ the seconds it ran on screen) it's half charged, and the button says so`, half.charge > 0.49 && half.charge < 0.65 && !half.ready && /charging, [56]\d%/.test(label), `${half.charge.toFixed(3)} · "${label}"`)
  await shot(page, `hud-ability-charging-${tag}`)
  // F while not full: refused (charge kept)
  const before = await abilityState(page)
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(100)
  const after = await abilityState(page)
  check(`${tag}: F while not full is refused — the charge stays`, after.charge >= before.charge && !after.ready, `${before.charge.toFixed(3)} → ${after.charge.toFixed(3)}`)
  // full, the visor's calm time running (broken by the DEV hook, repaired by the engine's own repair)
  await hold(page)
  await page.evaluate(() => { const e = window.__goops.engine; e.tick(11_000); window.__goops.breakMachine('visor'); e.act({ type: 'repair', machine: 'visor' }) })
  await letGo(page)
  await page.waitForTimeout(300)
  check(`${tag}: full → the button turns bright (primary) and says ready`, (await abilityState(page)).ready
    && await ability(page).getAttribute('data-variant') === 'primary' && /ready/.test(await ability(page).getAttribute('aria-label')))
  await shot(page, `hud-ability-ready-${tag}`)
  await page.mouse.move(0, 0)
  const cool0 = await page.evaluate(() => window.__goops.engine.state.machines.visor.cooldownMs)
  await ability(page).click()
  const cool1 = await page.evaluate(() => window.__goops.engine.state.machines.visor.cooldownMs)
  const fired = await abilityState(page)
  check(`${tag}: a tap fires it — the visor's calm time grows by 50% (level 3), the charge starts again`, cool1 / cool0 > 1.45 && cool1 / cool0 < 1.51 && fired.charge < 0.05 && !fired.ready,
    `${Math.round(cool0)} → ${Math.round(cool1)} ms (×${(cool1 / cool0).toFixed(3)})`)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await close()
}

// the key fires it too (one size is enough): full, a calm time running → F
async function boosterKey() {
  const { page, close } = await inShift(ALL)
  await hold(page)
  await page.evaluate(() => { const e = window.__goops.engine; e.tick(21_000); window.__goops.breakMachine('laser'); e.act({ type: 'repair', machine: 'laser' }) })
  await letGo(page)
  const cool0 = await page.evaluate(() => window.__goops.engine.state.machines.laser.cooldownMs)
  await page.keyboard.press('KeyF')
  const cool1 = await page.evaluate(() => window.__goops.engine.state.machines.laser.cooldownMs)
  check('F fires it when full: the laser\'s calm time grows by 50%', cool1 / cool0 > 1.45 && cool1 / cool0 < 1.51, `${Math.round(cool0)} → ${Math.round(cool1)} ms`)
  await close()
}

// the Upgrades card's level as a number beside the pips ("2/4")
// The top row's WORST case with the charge button in it (game-ui: HUD checks use the widest text a real game shows):
// the biggest quota (every colour in play + progression.json maxRank 50 = 57) with two-digit seals, quota met with 99
// seals, the rupture word — each with a 5-digit score (hud-shots' worst case: a shift's score is its XP, ~16k a rank at
// rank 50) — at the two phone sizes. The crack count's visible ink (a Range round its
// words) must stay ≥ 6 px from the score badge and from the charge button's visible edge (its border box), on one line.
const shiftJson = JSON.parse(readFileSync('content/tuning/shift.json', 'utf8'))
const MAX_QUOTA = shiftJson.colors.length + 50
async function widestTopRow() {
  const cases = [
    ['count', { sealed: MAX_QUOTA - 1, needed: MAX_QUOTA }], ['quota', { sealed: 99, needed: MAX_QUOTA }], ['rupture', { sealed: 8, needed: MAX_QUOTA, rupture: true }],
  ]
  for (const [width, height] of [[360, 740], [390, 844]]) {
    const tag = `${width}x${height}`
    for (const [name, c] of cases) {
      const { page, errors, close } = await inShift(ALL, { width, height })
      await page.evaluate((c) => {
        const s = window.__goops.engine.state
        Object.assign(s, { cracksSealed: c.sealed, cracksNeeded: c.needed, score: 99999, quotaMet: c.sealed >= c.needed })
        if (c.rupture) s.phase = 'rupture'
      }, c)
      await page.waitForTimeout(600) // (the HUD's 10-a-second update, and the text fitting itself)
      const m = await page.evaluate(() => {
        // the words' own ink: a Range round each TEXT node (a Range round an element counts its whole block box)
        const ink = (el) => {
          const boxes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(n); boxes.push(r.getBoundingClientRect()) }
          return { left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)), top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)) }
        }
        const status = document.querySelector('.kit-hud-slot[data-one-row] .kit-hud-text') ?? document.querySelector('.kit-hud-slot[data-one-row]').firstElementChild
        // (the count's line, and its name's small line under it when stacked: the ink of both)
        const textEl = status.querySelector('.kit-text') ?? status
        const words = ink(status), button = document.querySelector('[data-tag="ability"]').getBoundingClientRect()
        const consoleBtn = [...document.querySelectorAll('.kit-hud-slot button')].find((x) => x.dataset.tag !== 'ability').getBoundingClientRect()
        const score = document.querySelector('.kit-hud-chip').getBoundingClientRect()
        const textNode = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT).nextNode()
        const range = document.createRange(); range.selectNodeContents(textNode)
        const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size // (one line = one top)
        return { text: status.textContent, toButton: Math.round(button.left - words.right), toScore: Math.round(words.left - score.right), lines,
          scoreText: document.querySelector('.kit-hud-chip .kit-float-anchor > .kit-text')?.textContent, within: words.top >= consoleBtn.top - 1 && words.bottom <= consoleBtn.bottom + 1 }
      })
      check(`${tag} widest top row (${name}: "${m.text}", score ${m.scoreText}): the crack count ≥ 6 px from the charge button and the score, its line unbroken, no taller than the Console button`,
        m.toButton >= 6 && m.toScore >= 6 && m.lines === 1 && m.within, `${m.toButton} px to the button · ${m.toScore} px to the score · ${m.lines} line(s) · within the button's height: ${m.within}`)
      await shot(page, `widest-${name}-${tag}`)
      check(`${tag} widest (${name}): no page errors`, errors.length === 0, errors.join(' | '))
      await close()
    }
  }
}

async function levelNumbers() {
  for (const [width, height] of [[360, 740], [390, 844], [1440, 900]]) {
    const tag = `${width}x${height}`
    const { page, close } = await device(RANK9, { width, height })
    await openShop(page)
    const shown = await card(page, 'capacitorEfficiency').getByText(fill(w.levelShort, { n: 2, max: 4 }), { exact: true }).count()
    const pc = await card(page, 'pressureControl').getByText(fill(w.levelShort, { n: 1, max: 8 }), { exact: true }).count()
    check(`${tag}: each card shows its level as a number — "2/4" (Capacitor Efficiency), "1/8" (Pressure Control)`, shown === 1 && pc === 1)
    await page.evaluate(() => [...document.querySelectorAll('.kit-modal .kit-card')][2].scrollIntoView({ block: 'center' }))
    await shot(page, `card-level-number-${tag}`)
    const room = await roomProblems(page)
    check(`${tag}: with the number, breathing room in every card`, room.length === 0, room.join(' | '))
    await close()
  }
}

const part = process.argv[2] // 'shop' = the screen only · 'shift' = the measuring, the HUD button, the level number · none = all
try {
  if (part !== 'shop') {
    await measureShift()
    for (const [width, height] of [[360, 740], [390, 844], [1440, 900]]) await boosterAt(width, height)
    await boosterKey()
    await widestTopRow()
    await levelNumbers()
  }
  if (part !== 'shift') {
  // ---------------- rank 5: buy → reload → still owned → take back ----------------
  {
    const { page, errors, close } = await device(V1_RANK5)
    check('rank 5 (a version-1 save): the console offers Upgrades with 5 scraps', (await page.locator('[data-tag="upgrades"]').textContent()).includes('5'))
    await openShop(page)
    check('the shop: "Scraps: 5"', await scrapsShown(page, 5) === 1)
    const titles = await page.locator('.kit-modal .kit-card-title').allTextContents()
    check('one card per upgrade, ranks 2–9 in rank order', JSON.stringify(titles) === JSON.stringify(ORDER.map((id) => items[id].name)), titles.join(', '))
    for (const [id, rank] of [['gearLubrication', 6], ['focusMode', 7], ['denseGoop', 8], ['pressureControl', 9]]) {
      check(`${items[id].name}: locked, "Opens at rank ${rank}", no buttons`, await card(page, id).getByText(fill(w.locked, { rank })).count() === 1
        && await card(page, id).getByRole('button').count() === 0)
    }
    check('Pressure Control shows 8 pips, the others 4 (Cooldown Booster 3)', await pips(page, 'pressureControl').getAttribute('aria-valuemax') === '8'
      && await pips(page, 'circuitStabilizer').getAttribute('aria-valuemax') === '4' && await pips(page, 'cooldownBooster').getAttribute('aria-valuemax') === '3')
    check('nothing owned: every − is greyed out', await takeBack(page, 'circuitStabilizer').isDisabled() && await takeBack(page, 'cooldownBooster').isDisabled())
    await shot(page, 'rank5-fresh-390x844')
    const before = await size(card(page, 'circuitStabilizer'))
    await buy(page, 'circuitStabilizer').click()
    await page.waitForTimeout(200)
    check('buy a level of Circuit Stabilizer → scraps 4, its pips 1 of 4', await scrapsShown(page, 4) === 1 && await level(page, 'circuitStabilizer') === 1)
    check('the card kept its size', (await size(card(page, 'circuitStabilizer'))) === before, `${before} → ${await size(card(page, 'circuitStabilizer'))}`)
    const s1 = await saved(page)
    check('saved at once, as version 2 (XP kept)', s1.v === 2 && s1.owned.circuitStabilizer === 1 && s1.scrapsSpent === 1 && s1.totalXp === xpFor(5), JSON.stringify(s1))
    check('the console button says 4 scraps too', (await page.locator('[data-tag="upgrades"]').textContent()).includes('4'))
    await page.reload()
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await openShop(page)
    check('after a reload: still level 1, scraps still 4', await level(page, 'circuitStabilizer') === 1 && await scrapsShown(page, 4) === 1)
    await takeBack(page, 'circuitStabilizer').click()
    await page.waitForTimeout(200)
    const s2 = await saved(page)
    check('take it back → scraps 5, level 0, nothing owned in the save', await scrapsShown(page, 5) === 1 && await level(page, 'circuitStabilizer') === 0
      && Object.keys(s2.owned).length === 0 && s2.scrapsSpent === 0, JSON.stringify(s2))

    // the active: its switch
    const sw = equipSwitch(page, 'cooldownBooster')
    check('Cooldown Booster: its switch is off and asleep with no level bought', await sw.isDisabled() && await sw.getAttribute('aria-checked') === 'false')
    await buy(page, 'cooldownBooster').click()
    await sw.click()
    await page.waitForTimeout(200)
    check('bought + switched on → taken into the shift (saved)', await sw.getAttribute('aria-checked') === 'true' && JSON.stringify((await saved(page)).equipped) === '["cooldownBooster"]')
    await takeBack(page, 'cooldownBooster').click()
    await page.waitForTimeout(200)
    check('its last level taken back → switched off and asleep, unequipped in the save', await sw.getAttribute('aria-checked') === 'false' && await sw.isDisabled()
      && (await saved(page)).equipped.length === 0)

    // spend everything: the + greys out when a level costs more than you have
    for (let i = 0; i < 4; i++) await buy(page, 'circuitStabilizer').click()
    await buy(page, 'capacitorEfficiency').click()
    check('5 scraps spent → scraps 0, every + greyed out', await scrapsShown(page, 0) === 1 && await buy(page, 'autoPopper').isDisabled()
      && await buy(page, 'capacitorEfficiency').isDisabled() && await buy(page, 'circuitStabilizer').isDisabled())
    check('max level: Circuit Stabilizer 4 of 4', await level(page, 'circuitStabilizer') === 4)
    const room = await roomProblems(page)
    check('390x844: breathing room in every card, nothing wider than its box', room.length === 0, room.join(' | '))
    const scrolls = await page.evaluate(() => document.querySelector('.kit-modal .kit-scroll').hasAttribute('data-scrolls'))
    check('390x844: the list scrolls (more cards than room)', scrolls)
    check('no card grew', (await growth(page)).length === 0, (await growth(page)).join(' | '))

    // Respec (Muzzy, 2026-10-22): top right of the header once a level is in anything; every level back, all scraps return
    const respecBtn = page.getByRole('dialog', { name: w.title }).locator('.kit-menu-header').getByRole('button', { name: w.respecLabel })
    const titleBox = await page.locator('.kit-modal .kit-menu-header-title').boundingBox(), respecBox = await respecBtn.boundingBox()
    check('Respec: in the header, right of UPGRADES, on its line', !!respecBox && respecBox.x > titleBox.x + titleBox.width - 1
      && respecBox.y < titleBox.y + titleBox.height && respecBox.y + respecBox.height > titleBox.y, JSON.stringify({ titleBox, respecBox }))
    await shot(page, 'respec-shown-390x844')
    await respecBtn.click()
    await page.waitForTimeout(250)
    const s3 = await saved(page)
    check('Respec → scraps 5, every level 0, nothing owned or equipped in the save', await scrapsShown(page, 5) === 1 && await level(page, 'circuitStabilizer') === 0
      && await level(page, 'capacitorEfficiency') === 0 && Object.keys(s3.owned).length === 0 && s3.equipped.length === 0 && s3.scrapsSpent === 0, JSON.stringify(s3))
    check('…and the Respec button is gone (nothing to take back)', await respecBtn.count() === 0)
    check('the − buttons are the red (danger) kind', await takeBack(page, 'circuitStabilizer').getAttribute('data-variant') === 'danger')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('Esc closes it, back on the console', await page.getByRole('dialog', { name: w.title }).count() === 0)
    check('rank 5: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- a phone: a real finger swipe scrolls the list ----------------
  {
    const { page, errors, close } = await device(V1_RANK5, { width: 390, height: 844, touch: true })
    await openShop(page)
    const box = await card(page, 'autoPopper').boundingBox()
    const cdp = await page.context().newCDPSession(page)
    const x = Math.round(box.x + box.width / 2), y0 = Math.round(box.y + box.height / 2)
    const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
    await touch('touchStart', y0)
    for (let i = 1; i <= 10; i++) { await touch('touchMove', y0 - i * 30); await page.waitForTimeout(16) }
    await touch('touchEnd')
    await page.waitForTimeout(400)
    const top = await page.evaluate(() => document.querySelector('.kit-modal .kit-scroll').scrollTop)
    check('phone: a finger swipe up on a card scrolls the list', top > 50, `scrollTop ${top}`)
    check('phone: no page errors', errors.length === 0, errors.join(' | '))
    await close()
  }

  // ---------------- the three sizes: fresh rank 5, and rank 9 with levels bought + the active equipped ----------------
  for (const [width, height] of [[360, 740], [390, 844], [1440, 900]]) {
    const tag = `${width}x${height}`
    {
      const { page, close } = await device(V1_RANK5, { width, height })
      await openShop(page)
      await shot(page, `rank5-fresh-${tag}`)
      const room = await roomProblems(page)
      check(`${tag} rank 5: breathing room, nothing wider than its box`, room.length === 0, room.join(' | '))
      await close()
    }
    {
      const { page, errors, close } = await device(RANK9, { width, height })
      await openShop(page)
      check(`${tag} rank 9: "Scraps: 1", Circuit Stabilizer at max, Cooldown Booster switched on, nothing locked`,
        await scrapsShown(page, 1) === 1 && await level(page, 'circuitStabilizer') === 4 && await equipSwitch(page, 'cooldownBooster').getAttribute('aria-checked') === 'true'
        && await page.getByText(/Opens at rank/).count() === 0)
      await shot(page, `rank9-bought-${tag}`)
      await page.evaluate(() => [...document.querySelectorAll('.kit-modal .kit-card')][3].scrollIntoView({ block: 'center' })) // Cooldown Booster: its switch
      await shot(page, `rank9-active-${tag}`)
      await scrollList(page, 'end')
      await shot(page, `rank9-bought-end-${tag}`)
      const room = await roomProblems(page)
      check(`${tag} rank 9: breathing room, nothing wider than its box`, room.length === 0, room.join(' | '))
      const visible = await page.evaluate(() => {
        const list = document.querySelector('.kit-modal .kit-scroll').getBoundingClientRect(), last = [...document.querySelectorAll('.kit-modal .kit-card')].pop().getBoundingClientRect()
        return last.bottom <= list.bottom + 1 && last.top >= list.top - 1
      })
      check(`${tag} rank 9: scrolled to the end, the last card (Pressure Control) shows whole`, visible)
      check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
      await close()
    }
  }
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
console.log(failed ? `\nFAIL ${failed} check(s)` : '\nok — the Upgrades screen buys, saves, takes back and equips')
process.exit(failed ? 1 : 0)
