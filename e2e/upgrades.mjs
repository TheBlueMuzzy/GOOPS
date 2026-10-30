// F34 — THE UPGRADES SCREEN (the console's shop), with real input in Playwright's own Chromium (never the user's Chrome).
// A REAL save is seeded (a version-1 save from the alpha, so the save upgrade runs in the browser too), not ?rank=N:
//   rank 5 — Upgrades opens: "Scraps: 5", one card per upgrade in rank order (F42: up to 38); 6 and up locked with "Opens at
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
// F42 (Sprint 19): one charge button per equipped active — 1, 2 and 3 equipped at every portrait size (abilitiesAt), the
// layout switch live (abilityLayouts). Shots: e2e-shots/upgrades/abilities-<n>-<size>.png.
// F43 + F48 (Sprint 20, part 'f43'): the ranks 10–38 upgrades MEASURED in a real shift — Junk Uniformer, Goop Swap (a
// real held key and a real held mouse), Sealing Bonus, Tougher Tank, Slow Cracks, Crack Matcher (max level vs none, from
// the SAME moment of the same shift: a snapshot of one restored into the other) — Quick Fix 2 at the console (2 fewer
// steps; with the max machine fixes still never below 1), and every Upgrades card fitting at every portrait size
// (390x844, 360x780, 1100x800, 1440x900, 1920x1080 — never sideways). Shots: e2e-shots/upgrades/f43-*.png.
// Run: node e2e/upgrades.mjs [shop | shift | abilities | f43]  (own dev server on port 5345; no part = all)
import { chromium } from 'playwright-core'
import { checkVersion, skipFirstDay } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ports: 5345 (E2E_PORT=… runs it on another)
const PORT = Number(process.env.E2E_PORT) || 5345, OUT = 'e2e-shots/upgrades', SCRATCH = join(homedir(), 'Documents', 'dev', '.scratch', 'goops-upgrades-2')
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
const ORDER = ['circuitStabilizer', 'autoPopper', 'capacitorEfficiency', 'cooldownBooster', 'gearLubrication', 'focusMode', 'denseGoop', 'pressureControl',
  'junkUniformer', 'goopSwap', 'goopDump', 'sealingBonus', 'activeSlot', 'tougherTank', 'goopColorizer', 'quickFix', 'slowCracks', 'crackMatcher',
  'crackDown', 'activeSlot2'] // (F42: the actives and slots of ranks 15–38; F43 / F48: the rest of ranks 10–38)
const ABOVE_9 = ORDER.slice(8) // locked at rank 9 too

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
// (a locked card's title also holds a hidden "Locked" for screen readers — kit Card locked, UI kit 0.27.0)
const card = (page, id) => page.locator('.kit-card').filter({ has: page.locator('.kit-card-title', { hasText: new RegExp(`^${items[id].name}( ${w.lockedLabel})?$`) }) })
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
  // (F43: the two chances are 0 when off, every multiplier 1)
  const CHANCES = ['junkSameColorChance', 'crackColorBias']
  check('nothing owned: every modifier is neutral (multipliers 1, chances 0)', Object.entries(base.modifiers).every(([k, v]) => v === (CHANCES.includes(k) ? 0 : 1)), JSON.stringify(base.modifiers))
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
// F42: the HUD's charge buttons, wherever the layout put them (content/tuning/hud.json abilities): each fully on screen
// with ≥ 6 px to the screen's edges; none overlapping another; in the bottom panel (panelRow): inside the panel's
// VISIBLE frame (its box minus its border) with ≥ 6 px room on every side, below the tank, clear of the next-piece
// window and every bar; in the top row (topRow): e2e/hud-shots.mjs' rule (it may hang over the tank's top edge — a part
// that starts above it, no deeper than 60 px — never lower than the Console button beside it) and clear of the score,
// the crack count, the Console button and the panel. Returns the problems as plain lines.
const hudProblems = (page) => page.evaluate(() => {
  const out = [], v = window.__goops.view, s = window.__goops.engine.state
  const tankTop = v.topY, tankBottom = v.topY + (s.height - s.bufferRows) * v.cellPx // (the stage fills the window)
  const box = (el) => el.getBoundingClientRect()
  const hits = (a, b) => b.width && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  const buttons = [...document.querySelectorAll('[data-tag="ability"]')]
  const consoleBtn = [...document.querySelectorAll('.kit-hud-slot button')].find((x) => x.dataset.tag !== 'ability')
  buttons.forEach((btn, i) => {
    const b = box(btn), name = btn.dataset.ability
    if (Math.min(b.left, b.top, innerWidth - b.right, innerHeight - b.bottom) < 6) out.push(`${name}: under 6 px from the screen's edge`)
    for (const other of buttons.slice(i + 1)) if (hits(b, box(other))) out.push(`${name} overlaps ${other.dataset.ability}`)
    const dock = btn.closest('.kit-hud-dock')
    if (dock) {
      const panel = dock.querySelector('.kit-panel'), r = box(panel), st = getComputedStyle(panel)
      const inner = { left: r.left + parseFloat(st.borderLeftWidth), right: r.right - parseFloat(st.borderRightWidth), top: r.top + parseFloat(st.borderTopWidth), bottom: r.bottom - parseFloat(st.borderBottomWidth) }
      const room = Math.min(b.left - inner.left, inner.right - b.right, b.top - inner.top, inner.bottom - b.bottom)
      if (room < 6) out.push(`${name}: only ${Math.round(room)} px from the panel's visible edge`)
      if (b.top < tankBottom) out.push(`${name}: reaches ${Math.round(tankBottom - b.top)} px into the tank`)
      for (const el of document.querySelectorAll('.kit-hud-dock .next-window, .kit-hud-dock .kit-bar, .kit-hud-dock .kit-hud-chip')) {
        if (hits(b, box(el))) out.push(`${name}: overlaps ${el.classList.contains('next-window') ? 'the next-piece window' : `the bar "${el.textContent.trim().slice(0, 12)}"`}`)
      }
    } else {
      const pause = box(consoleBtn)
      if (b.top > tankTop + 8 || b.bottom > tankTop + 60) out.push(`${name}: reaches ${Math.round(b.bottom - tankTop)} px into the tank`)
      if (b.bottom > pause.bottom + 1 || b.top < pause.top - 1) out.push(`${name} (${Math.round(b.top)}–${Math.round(b.bottom)}) is taller than the Console button (${Math.round(pause.top)}–${Math.round(pause.bottom)})`)
      const others = [['score', document.querySelector('.kit-hud-chip')], ['crack count', document.querySelector('.kit-hud-slot .kit-hud-text')],
        ['Console button', consoleBtn], ['bottom panel', document.querySelector('.kit-hud-dock')]]
      for (const [what, el] of others) if (el && hits(b, box(el))) out.push(`${name}: overlaps the ${what}`)
    }
  })
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page is wider than the screen')
  return out
})
// the Dev Kit's way to change hud.json live (the same browser event its Tuning tab sends): the file with these changes
const hudJson = JSON.parse(readFileSync('content/tuning/hud.json', 'utf8'))
const sendHud = (page, abilities) => page.evaluate((data) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'hud', data } })),
  { ...hudJson, abilities: { ...hudJson.abilities, ...abilities } })
const ringInside = (page) => page.evaluate(() => Math.min(...[...document.querySelectorAll('[data-tag="ability"]')].map((btn) => {
  const ring = btn.querySelector('.kit-timer')
  const b = btn.getBoundingClientRect(), s = getComputedStyle(btn), r = ring.getBoundingClientRect()
  const inner = { left: b.left + parseFloat(s.borderLeftWidth), right: b.right - parseFloat(s.borderRightWidth), top: b.top + parseFloat(s.borderTopWidth), bottom: b.bottom - parseFloat(s.borderBottomWidth) }
  return Math.round(Math.min(r.left - inner.left, inner.right - r.right, r.top - inner.top, inner.bottom - r.bottom))
})))

async function boosterAt(width, height) {
  const tag = `${width}x${height}`
  const { page, errors, close } = await inShift(ALL, { width, height })
  await page.waitForTimeout(400)
  check(`${tag}: the HUD has the charge button`, await ability(page).count() === 1)
  const hp = await hudProblems(page)
  const inPanel = await page.locator('.kit-hud-dock [data-tag="ability"]').count() === 1
  check(`${tag}: the button sits in the bottom panel's own row (hud.json abilities, the default panelRow) — on screen, clear of the tank, the window and the bars, room to the panel's edge`,
    inPanel && hp.length === 0, `${inPanel ? 'in the panel' : 'NOT in the panel'} ${hp.join(' | ')}`)
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

// ============ F42: one charge button per equipped active ============
// A rank-40 save owning both Active Expansion Slots (3 slots) and all four actives, equipping 1, 2 or 3 — so every
// picture shows: 1 = Cooldown Booster; 2 = Booster + Goop Dump; 3 = Goop Dump, Goop Colorizer, Crack Down. At every
// portrait size, with the default layout (panelRow: their own row in the bottom panel):
//   one button per equipped active, in equip order, each with its own picture (data-picture) · all grey while charging,
//   the first one full → bright (primary) and "ready", the others still grey · each fits (hudProblems: on screen, no
//   overlaps with each other / the window / the bars / the tank, room to the panel's visible edge and the screen's) and
//   its ring sits inside it · a click on each sends THAT active's id to the engine and nothing else (no rotate or pop
//   from the tank under it) · a click on the panel beside the buttons still reaches the tank (a rotate) · keys 1 / 2 / 3
//   fire slot 1 / 2 / 3, F the first · no page errors. Shots: abilities-<n>-<size>.png.
const F42_SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
const F42_OWNED = { ...ALL_OWNED, activeSlot: 1, activeSlot2: 1, goopDump: 1, goopColorizer: 1, crackDown: 1 }
const F42_LOADOUTS = { 1: ['cooldownBooster'], 2: ['cooldownBooster', 'goopDump'], 3: ['goopDump', 'goopColorizer', 'crackDown'] }
const f42Save = (equipped) => JSON.stringify({ v: 2, totalXp: XP40, scrapsSpent: Object.values(F42_OWNED).reduce((a, b) => a + b, 0), owned: F42_OWNED, equipped })
// every action the HUD and the tank send the engine from now on (window.__acts)
const spyActs = (page) => page.evaluate(() => {
  const e = window.__goops.engine, act = e.act.bind(e)
  window.__acts = []
  e.act = (a) => { window.__acts.push(a); return act(a) }
})
const takeActs = (page) => page.evaluate(() => window.__acts.splice(0))
async function abilitiesAt(n, width, height) {
  const tag = `${width}x${height}`, ids = F42_LOADOUTS[n]
  const { page, errors, close } = await inShift(f42Save(ids), { width, height })
  await page.waitForTimeout(400)
  const engineIds = await page.evaluate(() => window.__goops.engine.state.abilities.map((a) => a.id))
  const shown = await page.evaluate(() => [...document.querySelectorAll('[data-tag="ability"]')].map((b) => ({ id: b.dataset.ability, picture: b.querySelector('.hud-ability-icon')?.dataset.picture, variant: b.dataset.variant })))
  check(`${n} equipped ${tag}: the shift has them, in equip order`, JSON.stringify(engineIds) === JSON.stringify(ids), engineIds.join(', '))
  check(`${n} equipped ${tag}: one button each, in that order, each with its own picture, all grey while charging`,
    JSON.stringify(shown.map((b) => b.id)) === JSON.stringify(ids) && shown.every((b) => b.picture === b.id && b.variant === 'secondary'), JSON.stringify(shown))
  // the first full, the others part-charged (so their rings show), held still under the pause menu
  await hold(page)
  await page.evaluate(() => window.__goops.engine.state.abilities.forEach((a, i) => { a.charge = i === 0 ? 1 : 0.3 + 0.25 * i; a.ready = i === 0 }))
  await letGo(page)
  await page.waitForTimeout(300)
  const variants = await page.evaluate(() => [...document.querySelectorAll('[data-tag="ability"]')].map((b) => `${b.dataset.variant}${b.dataset.ready !== undefined ? ' ready' : ''}`))
  check(`${n} equipped ${tag}: the full one turns bright (primary, "ready"), the charging ones stay grey`,
    variants[0] === 'primary ready' && variants.slice(1).every((v) => v === 'secondary'), variants.join(', '))
  const hp = await hudProblems(page)
  const inPanel = await page.locator('.kit-hud-dock [data-tag="ability"]').count()
  check(`${n} equipped ${tag}: every button in the panel row, on screen, no overlaps (each other, window, bars, tank), room to the panel's visible edge`,
    inPanel === n && hp.length === 0, `${inPanel} in the panel · ${hp.join(' | ')}`)
  const room = await ringInside(page)
  check(`${n} equipped ${tag}: every ring sits inside its button with room (≥ 2 px)`, room >= 2, `${room} px`)
  await page.mouse.move(0, 0)
  await shot(page, `abilities-${n}-${tag}`)
  // clicks: each button sends its own id, and nothing reaches the tank under it
  await spyActs(page)
  for (const id of ids) {
    await page.locator(`[data-tag="ability"][data-ability="${id}"]`).click()
    await page.waitForTimeout(50)
    const acts = await takeActs(page)
    check(`${n} equipped ${tag}: a click on ${id} fires ${id} — and only that (no rotate / pop underneath)`,
      acts.length === 1 && acts[0].type === 'ability' && acts[0].id === id, JSON.stringify(acts))
  }
  // the rest of the panel still lets taps through to the tank: a click on the integrity bar's middle → a rotate
  const bar = await page.locator('.kit-hud-dock .kit-bar').last().boundingBox()
  await page.mouse.click(bar.x + bar.width / 2, bar.y + bar.height / 2)
  await page.waitForTimeout(50)
  const through = await takeActs(page)
  check(`${n} equipped ${tag}: a tap on the panel beside the buttons still reaches the tank (rotate)`, through.some((a) => a.type === 'rotate'), JSON.stringify(through))
  // keys: 1 / 2 / 3 = slot 1 / 2 / 3, F = slot 1 (once is enough — at the phone size)
  if (width === 390) {
    for (let i = 0; i < 3; i++) await page.keyboard.press(`Digit${i + 1}`)
    await page.keyboard.press('KeyF')
    const keyed = (await takeActs(page)).filter((a) => a.type === 'ability').map((a) => a.id)
    check(`${n} equipped: keys 1 / 2 / 3 fire slot 1 / 2 / 3 (none past what's equipped), F the first`,
      JSON.stringify(keyed) === JSON.stringify([...ids, ids[0]]), keyed.join(', '))
  }
  check(`${n} equipped ${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await close()
}
// the layout switch, live (the Dev Kit's way): topRow takes ONE button to the top row (and gives the tank its height
// back); with 2 equipped they stay in the panel row; topRowWhenOne does the same for one in the panel layout
async function abilityLayouts() {
  const { page, close } = await inShift(f42Save(F42_LOADOUTS[1]), { width: 390, height: 844 })
  const where = () => page.evaluate(() => { const b = document.querySelector('[data-tag="ability"]'); return { dock: !!b.closest('.kit-hud-dock'), cell: window.__goops.view.cellPx, panelPx: parseFloat(document.documentElement.style.getPropertyValue('--kit-hud-dock-size')) } })
  await page.waitForTimeout(300)
  const panel = await where()
  await sendHud(page, { layout: 'topRow' })
  await page.waitForTimeout(400)
  const top = await where()
  // (the panel gets shorter; the tank takes the room back — on a phone the tank is as wide as the screen allows, so its
  // cells may stay the same size and the room goes above it)
  check('one equipped, layout topRow (live): its button moves to the top row, the panel gets shorter, the tank no smaller',
    panel.dock && !top.dock && top.panelPx < panel.panelPx && top.cell >= panel.cell, `${JSON.stringify(panel)} → ${JSON.stringify(top)}`)
  const hp = await hudProblems(page)
  check('one equipped, topRow: it fits the top row', hp.length === 0, hp.join(' | '))
  await shot(page, 'abilities-1-topRow-390x844')
  await sendHud(page, { layout: 'panelRow', topRowWhenOne: true })
  await page.waitForTimeout(400)
  check('one equipped, panelRow + topRowWhenOne: in the top row too', !(await where()).dock)
  await close()
  const two = await inShift(f42Save(F42_LOADOUTS[2]), { width: 390, height: 844 })
  await sendHud(two.page, { layout: 'topRow' })
  await two.page.waitForTimeout(400)
  const inDock = await two.page.locator('.kit-hud-dock [data-tag="ability"]').count()
  check('two equipped, layout topRow: they stay in the panel row (the top row only fits one)', inDock === 2, `${inDock} in the panel`)
  await two.close()
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
      await sendHud(page, { layout: 'topRow' }) // (F42: one equipped goes in the top row only in this layout)
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

// ============ F43 + F48 (Sprint 20): ranks 10–38 MEASURED in a real shift ============
// Two rank-40 saves that differ only in the F43 passives (both own Cooldown Booster 1, equipped, for Sealing Bonus to
// charge): BASE owns nothing else, MAX owns Junk Uniformer, Goop Swap, Sealing Bonus, Tougher Tank, Slow Cracks and
// Crack Matcher at level 4. Same seed (?seed=7), so both shifts start the same. Each measurement starts from ONE moment
// of the base shift (its snapshot, restored into the other engine — restore keeps an engine's own modifiers), so only
// the upgrades differ. Shifts held under the pause menu, the engine moved by hand (window.__goops.engine).
const F43_MAX = { junkUniformer: 4, goopSwap: 4, sealingBonus: 4, tougherTank: 4, slowCracks: 4, crackMatcher: 4 }
const rank40Save = (owned, equipped = []) => JSON.stringify({ v: 2, totalXp: XP40, scrapsSpent: Object.values(owned).reduce((a, b) => a + b, 0), owned, equipped })
const F43_BASE_SAVE = rank40Save({ cooldownBooster: 1 }, ['cooldownBooster'])
const F43_MAX_SAVE = rank40Save({ cooldownBooster: 1, ...F43_MAX }, ['cooldownBooster'])
const valueAt = (id, modifier, level) => upgradesJson.upgrades.find((x) => x.id === id).effects.find((e) => e.modifier === modifier).byLevel[level - 1]
const WILD = 255

// the junk on the floor at the shift's start: the share of it in its most common colour
const junkShare = (page) => page.evaluate(() => {
  const s = window.__goops.engine.state, row = [...s.grid.slice((s.height - 1) * s.width, s.height * s.width)].filter((c) => c !== 0)
  const counts = {}
  for (const c of row) counts[c] = (counts[c] ?? 0) + 1
  return { cells: row.length, share: Math.max(...Object.values(counts)) / row.length, row: row.join('') }
})
// a moment of the base shift with at least one open crack (ticked by hand until there is one)
const openCrackMoment = (page) => page.evaluate(() => {
  const e = window.__goops.engine, s = e.state
  for (let t = 0; t < 120000 && !s.cracks.some((c) => !c.plugged); t += 100) e.tick(100)
  return e.snapshot()
})
// everything measured from a moment (snap), in one go
const measureFrom = (page, snap) => page.evaluate(({ snap, WILD }) => {
  const e = window.__goops.engine, s = e.state, out = {}
  const from = (change) => { const x = structuredClone(snap); change?.(x); e.restore(x); e.takeEvents() }
  // Tougher Tank: integrity lost in 0.5 s with the open cracks there (no new crack, no growth in that time)
  from((x) => { x.inner.crackTimerMs = 0; for (const c of x.state.cracks) if (c.growMs) c.growMs = c.growMs.map(() => 1e9) })
  { const i0 = s.integrity; e.tick(500); out.wear = i0 - s.integrity }
  // Slow Cracks: ms from a crack (timer at 0) to the next one
  from((x) => { x.inner.crackTimerMs = 0 })
  { let ms = 0; while (ms < 60000 && !e.takeEvents().some((v) => v.type === 'crack')) { e.tick(10); ms += 10 } out.nextCrackMs = ms }
  // Crack Matcher: 12 new pieces (each fast-dropped, the tank spun between), and how many came in the lowest open crack's
  // colour (most of their cells; a wild one doesn't count)
  from()
  {
    const lowest = () => { let best = null, by = -1; for (const c of s.cracks) { if (c.plugged) continue; const y = Math.max(...(c.cells ?? [[c.x, c.y]]).map((p) => p[1])); if (y > by) { best = c; by = y } } return best }
    let match = 0, total = 0
    for (let i = 0; i < 12 && s.status === 'playing' && s.phase === 'playing'; i++) {
      for (let k = 0; k < 4; k++) e.act({ type: 'spin', dir: 1 })
      e.act({ type: 'softDrop', on: true })
      let ms = 0, spawned = false
      while (!spawned && ms < 20000) { e.tick(16); ms += 16; spawned = e.takeEvents().some((v) => v.type === 'spawn') }
      const c = lowest(), next = s.next
      if (!spawned || !c || !next || next.includes(WILD)) continue
      total++
      const n = next.filter((v) => v === c.color).length
      if (n > 0 && next.every((v) => next.filter((w) => w === v).length <= n)) match++
    }
    out.matcher = { match, total }
  }
  // Sealing Bonus: a crack covered by full, ready goop of its colour (put there by hand — every cell of it if it grew),
  // the active at 0 — one pop seals it; the charge it gave (a grown crack: one seal a cell)
  from((x) => {
    const c = x.state.cracks.find((k) => !k.plugged && (k.cells ?? [[k.x, k.y]]).every(([cx, cy]) => x.state.grid[cy * x.width + cx] === 0))
    if (!c) return
    const cells = (c.cells ?? [[c.x, c.y]]).map(([cx, cy]) => cy * x.width + cx), id = x.inner.nextGroupId
    for (const i of cells) x.state.grid[i] = c.color
    x.state.groups.push({ id, color: c.color, cells, fill: 1, ready: true })
    x.inner.fillMs.push([id, 1e9]); x.inner.nextGroupId = id + 1
    c.plugged = true
    x.state.pressure = 0.95
    x.state.abilities[0].charge = 0; x.state.abilities[0].ready = false
    out.sealCrack = c.id
    out.sealCells = cells.length
  })
  if (out.sealCrack !== undefined) {
    const c = s.cracks.find((k) => k.id === out.sealCrack)
    const c0 = s.abilities[0].charge
    e.act({ type: 'pop', x: c.x, y: c.y })
    const pop = e.takeEvents().find((v) => v.type === 'pop')
    out.sealed = pop?.sealed ?? []
    out.sealCharge = s.abilities[0].charge - c0
  }
  e.restore(snap)
  return out
}, { snap, WILD })

// Goop Swap: how long a REAL hold takes to swap — a held R key (the HUD's Swap bar) and a held mouse button on the tank
// (the ring beside it). The time from the press to the engine's 'hold' action, on the page's clock.
async function swapTimes(page) {
  await page.evaluate(() => {
    const e = window.__goops.engine, act = e.act.bind(e)
    window.__swapAt = null
    e.act = (a) => { if (a.type === 'hold' && window.__swapAt === null) window.__swapAt = performance.now(); return act(a) }
  })
  const timeOne = async (press, release, extra) => {
    await page.evaluate(() => { window.__swapAt = null; window.__pressAt = performance.now() })
    await press()
    let sawTimer = false
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__swapAt !== null)); i++) {
      await page.waitForTimeout(50)
      if (!sawTimer) sawTimer = await extra()
    }
    await release()
    await page.waitForTimeout(150)
    return { ms: await page.evaluate(() => window.__swapAt === null ? null : Math.round(window.__swapAt - window.__pressAt)), sawTimer }
  }
  const key = await timeOne(() => page.keyboard.down('KeyR'), () => page.keyboard.up('KeyR'),
    () => page.evaluate((name) => [...document.querySelectorAll(`[aria-label="${name}"]`)].some((el) => el.getBoundingClientRect().width > 0), en.hud.swap))
  // (the mouse on the tank, right of centre and low — empty water, not goop: a hold, not a zap)
  const box = await page.locator('[data-testid="stage"]').boundingBox()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.35)
  const mouse = await timeOne(() => page.mouse.down(), () => page.mouse.up(),
    () => page.evaluate(() => { const r = document.querySelector('[data-testid="swap-ring"]'); return !!r && getComputedStyle(r).display !== 'none' && getComputedStyle(r).visibility !== 'hidden' && Number(getComputedStyle(r).opacity) > 0 }))
  return { key, mouse }
}

async function measureF43() {
  const base = await inShift(F43_BASE_SAVE), max = await inShift(F43_MAX_SAVE)
  const junk0 = await junkShare(base.page), junk1 = await junkShare(max.page)
  await hold(base.page); await hold(max.page)
  const mods = await max.page.evaluate(() => window.__goops.engine.snapshot().options.modifiers)
  const want = {
    junkSameColorChance: valueAt('junkUniformer', 'junkSameColorChance', 4), swapHoldTimeMult: valueAt('goopSwap', 'swapHoldTimeMult', 4),
    abilityChargePerSealMult: valueAt('sealingBonus', 'abilityChargePerSealMult', 4), integrityDrainMult: valueAt('tougherTank', 'integrityDrainMult', 4),
    crackEveryMult: valueAt('slowCracks', 'crackEveryMult', 4), crackColorBias: valueAt('crackMatcher', 'crackColorBias', 4),
  }
  for (const [name, value] of Object.entries(want)) check(`F43 max: the running shift's ${name} = ${value}`, Math.abs(mods[name] - value) < 1e-9, String(mods[name]))
  check('Junk Uniformer 4: more of the starting junk shares one colour (same seed)', junk1.cells === junk0.cells && junk1.share > junk0.share,
    `${junk0.row} (${Math.round(junk0.share * 100)}%) → ${junk1.row} (${Math.round(junk1.share * 100)}%)`)
  const moment = await openCrackMoment(base.page)
  const m0 = await measureFrom(base.page, moment), m1 = await measureFrom(max.page, moment)
  console.log('     F43 measured (none → max):', JSON.stringify({ none: m0, max: m1 }))
  check('Tougher Tank 4: open cracks wear the tank 0.5× as fast', m0.wear > 0 && near(m1.wear / m0.wear, want.integrityDrainMult, 0.01), ratioLine(m1.wear / m0.wear, want.integrityDrainMult))
  check('Slow Cracks 4: the next crack comes ~1.6× later', m1.nextCrackMs / m0.nextCrackMs > 1.45 && m1.nextCrackMs / m0.nextCrackMs < 1.75, `${m0.nextCrackMs} → ${m1.nextCrackMs} ms`)
  check('Crack Matcher 4: every new piece comes in the lowest open crack’s colour', m1.matcher.total >= 6 && m1.matcher.match === m1.matcher.total, JSON.stringify(m1.matcher))
  check('…and without it, far fewer do', m0.matcher.total >= 6 && m0.matcher.match / m0.matcher.total < 0.6, JSON.stringify(m0.matcher))
  const perSeal = (m, mult) => Math.min(1, m.sealCells * 0.25 * mult) // (Cooldown Booster: 0.25 a sealed cell)
  check('Sealing Bonus 4: a seal charges Cooldown Booster 0.25 → 0.4 a cell (× 1.6)', m0.sealed?.length === 1 && m1.sealed?.length === 1
    && Math.abs(m0.sealCharge - perSeal(m0, 1)) < 1e-6 && Math.abs(m1.sealCharge - perSeal(m1, want.abilityChargePerSealMult)) < 1e-6,
    `${m0.sealCells} cell(s): ${m0.sealCharge} → ${m1.sealCharge}`)
  // Goop Swap: real input, the shift running (let go of the pause)
  await letGo(base.page); await letGo(max.page)
  const s0 = await swapTimes(base.page), s1 = await swapTimes(max.page)
  console.log('     Goop Swap (none → max):', JSON.stringify({ none: s0, max: s1 }))
  check('Goop Swap: without it a held R swaps after ~1.5 s, the Swap bar showing', s0.key.ms > 1400 && s0.key.ms < 1800 && s0.key.sawTimer, JSON.stringify(s0.key))
  check('Goop Swap 4: a held R swaps after ~0.5 s, the Swap bar showing', s1.key.ms > 400 && s1.key.ms < 800 && s1.key.sawTimer, JSON.stringify(s1.key))
  check('Goop Swap 4: a held mouse on the tank swaps after ~0.5 s (vs ~1.5 s), the ring showing', s0.mouse.ms > 1400 && s1.mouse.ms > 400 && s1.mouse.ms < 800 && s1.mouse.sawTimer,
    `${JSON.stringify(s0.mouse)} → ${JSON.stringify(s1.mouse)}`)
  check('F43 measuring: no page errors', !base.errors.length && !max.errors.length, [...base.errors, ...max.errors].join(' | '))
  await base.close(); await max.close()
}

// F48 Quick Fix at the console mid-shift: each machine broken (the DEV hook) → its repair panel's steps
async function quickFix() {
  const stepsWith = async (owned, name) => {
    const d = await inShift(rank40Save(owned))
    await d.page.keyboard.press('KeyW')
    await d.page.locator('[data-tag="panel-visor"]').waitFor({ state: 'attached', timeout: 5000 })
    await d.page.waitForTimeout(1200) // (the slide)
    await d.page.evaluate(() => { for (const id of ['laser', 'visor', 'controls']) window.__goops.breakMachine(id) })
    await d.page.waitForTimeout(400)
    const steps = await d.page.evaluate(() => Object.fromEntries(['laser', 'visor', 'controls'].map((id) => [id, Number(document.querySelector(`[data-tag="panel-${id}"]`)?.dataset.steps)])))
    if (name) await shot(d.page, name)
    check(`Quick Fix (${JSON.stringify(owned)}): no page errors`, d.errors.length === 0, d.errors.join(' | '))
    await d.close()
    return steps
  }
  const none = await stepsWith({}), qf2 = await stepsWith({ quickFix: 2 }, 'f43-quickfix2-panels-390x844')
  const qf1 = await stepsWith({ quickFix: 1 })
  const all = await stepsWith({ quickFix: 2, circuitStabilizer: 4, capacitorEfficiency: 4, gearLubrication: 4 })
  check('Quick Fix 0: the repairs take 4 / 3 / 4 steps', JSON.stringify(none) === JSON.stringify({ laser: 4, visor: 3, controls: 4 }), JSON.stringify(none))
  check('Quick Fix 1: every repair 1 step shorter (3 / 2 / 3)', JSON.stringify(qf1) === JSON.stringify({ laser: 3, visor: 2, controls: 3 }), JSON.stringify(qf1))
  check('Quick Fix 2: every repair 2 steps shorter (2 / 1 / 2)', JSON.stringify(qf2) === JSON.stringify({ laser: 2, visor: 1, controls: 2 }), JSON.stringify(qf2))
  check('Quick Fix 2 + every machine fix at max: never below 1 step (1 / 1 / 1)', JSON.stringify(all) === JSON.stringify({ laser: 1, visor: 1, controls: 1 }), JSON.stringify(all))
}

// Every Upgrades card at every portrait size, at rank 40 with levels in the new ones (green cards, max lines, Quick
// Fix's count line): breathing room in every card, nothing wider than its box, no card grew; shots at the top, at the
// new cards (Junk Uniformer, Tougher Tank, Crack Matcher) and at the end. Then buy / take back a level of each new one
// (the card keeps its size).
const F43_SHOP_SAVE = rank40Save({ circuitStabilizer: 4, cooldownBooster: 1, junkUniformer: 2, goopSwap: 4, sealingBonus: 1, tougherTank: 3, quickFix: 2, slowCracks: 1, crackMatcher: 4 }, ['cooldownBooster'])
const F43_SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
async function shopCardsAt(width, height) {
  const tag = `${width}x${height}`
  const { page, errors, close } = await device(F43_SHOP_SAVE, { width, height })
  await openShop(page)
  const titles = await page.locator('.kit-modal .kit-card-title').allTextContents()
  check(`${tag}: every upgrade's card, in rank order, none locked at rank 40`, JSON.stringify(titles) === JSON.stringify(ORDER.map((id) => items[id].name)), titles.join(', '))
  // (the number line: the card's label text with an arrow or "(max)")
  const amount = (id) => card(page, id).locator('.kit-text[data-kind="label"]').filter({ hasText: /→|\(max\)/ }).textContent()
  check(`${tag}: the new cards' number lines — Junk Uniformer "+20% → +30%", Goop Swap "−67% (max)", Quick Fix "2 (max)", Crack Matcher "+100% (max)"`,
    await amount('junkUniformer') === '+20% → +30%' && await amount('goopSwap') === '−67% (max)' && await amount('quickFix') === '2 (max)' && await amount('crackMatcher') === '+100% (max)',
    `${await amount('junkUniformer')} · ${await amount('goopSwap')} · ${await amount('quickFix')} · ${await amount('crackMatcher')}`)
  const room = await roomProblems(page)
  check(`${tag}: breathing room in every card, nothing wider than its box`, room.length === 0, room.join(' | '))
  // one line each: the number line never wraps (the card stays its fixed size)
  const wrapped = await page.evaluate(() => [...document.querySelectorAll('.kit-modal .kit-card .kit-text[data-kind="label"]')].filter((el) => /→|\(max\)/.test(el.textContent)).filter((el) => {
    const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1
  }).map((el) => el.closest('.kit-card').querySelector('.kit-card-title').textContent))
  check(`${tag}: every number line on one line`, wrapped.length === 0, wrapped.join(', '))
  await shot(page, `f43-shop-top-${tag}`)
  for (const id of ['junkUniformer', 'tougherTank', 'crackMatcher']) {
    await card(page, id).evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await shot(page, `f43-shop-${id}-${tag}`)
  }
  await scrollList(page, 'end')
  await shot(page, `f43-shop-end-${tag}`)
  // buy / take back a level of each new upgrade: the card keeps its size
  for (const id of ['junkUniformer', 'sealingBonus', 'tougherTank', 'slowCracks']) {
    const before = await size(card(page, id))
    await buy(page, id).click()
    await page.waitForTimeout(120)
    const bought = await size(card(page, id))
    await takeBack(page, id).click()
    await page.waitForTimeout(120)
    check(`${tag}: ${items[id].name} — buy then take back a level, the card keeps its size`, bought === before && (await size(card(page, id))) === before, `${before} → ${bought}`)
  }
  check(`${tag}: no card grew`, (await growth(page)).length === 0, (await growth(page)).join(' | '))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await close()
}

const part = process.argv[2] // 'shop' = the screen only · 'shift' = the measuring, the HUD buttons, the level number
// · 'abilities' = F42's charge buttons only · 'f43' = Sprint 20's upgrades only · none = all
try {
  if (part === 'f43' || !part) {
    await measureF43()
    await quickFix()
    for (const [width, height] of F43_SIZES) await shopCardsAt(width, height)
  }
  if (part === 'f43') { /* (Sprint 20's part only) */ } else if (part === 'abilities') {
    for (const n of [1, 2, 3]) for (const [width, height] of F42_SIZES) await abilitiesAt(n, width, height)
    await abilityLayouts()
  } else if (part !== 'shop') {
    await measureShift()
    for (const [width, height] of [[360, 740], [390, 844], [1440, 900]]) await boosterAt(width, height)
    await boosterKey()
    await widestTopRow()
    for (const n of [1, 2, 3]) for (const [width, height] of F42_SIZES) await abilitiesAt(n, width, height)
    await abilityLayouts()
    await levelNumbers()
  }
  if (part !== 'shift' && part !== 'abilities' && part !== 'f43') {
  // ---------------- rank 5: buy → reload → still owned → take back ----------------
  {
    const { page, errors, close } = await device(V1_RANK5)
    check('rank 5 (a version-1 save): the console offers Upgrades with 5 scraps', (await page.locator('[data-tag="upgrades"]').textContent()).includes('5'))
    await openShop(page)
    check('the shop: "Scraps: 5"', await scrapsShown(page, 5) === 1)
    const titles = await page.locator('.kit-modal .kit-card-title').allTextContents()
    const LOCKED5 = ['gearLubrication', 'focusMode', 'denseGoop', 'pressureControl', ...ABOVE_9]
    const want = ORDER.map((id) => LOCKED5.includes(id) ? `${items[id].name} ${w.lockedLabel}` : items[id].name)
    check('one card per upgrade, in rank order (the locked ones read out "… Locked")', JSON.stringify(titles) === JSON.stringify(want), titles.join(', '))
    for (const [id, rank] of [['gearLubrication', 6], ['focusMode', 7], ['denseGoop', 8], ['pressureControl', 9]]) {
      check(`${items[id].name}: locked (kit greyed card), "Opens at rank ${rank}", no buttons`, await card(page, id).getByText(fill(w.locked, { rank })).count() === 1
        && await card(page, id).getByRole('button').count() === 0 && await card(page, id).getAttribute('data-locked') !== null)
    }
    check('nothing owned: no card is green', await page.locator('.kit-modal .kit-card[data-tone="success"]').count() === 0)
    await scrollList(page, 'end')
    await shot(page, 'locked-cards-390x844')
    await scrollList(page, 'top')
    check('Pressure Control shows 8 pips, the others 4 (Cooldown Booster 3)', await pips(page, 'pressureControl').getAttribute('aria-valuemax') === '8'
      && await pips(page, 'circuitStabilizer').getAttribute('aria-valuemax') === '4' && await pips(page, 'cooldownBooster').getAttribute('aria-valuemax') === '3')
    check('nothing owned: every − is greyed out', await takeBack(page, 'circuitStabilizer').isDisabled() && await takeBack(page, 'cooldownBooster').isDisabled())
    await shot(page, 'rank5-fresh-390x844')
    const before = await size(card(page, 'circuitStabilizer'))
    await buy(page, 'circuitStabilizer').click()
    await page.waitForTimeout(200)
    check('buy a level of Circuit Stabilizer → scraps 4, its pips 1 of 4', await scrapsShown(page, 4) === 1 && await level(page, 'circuitStabilizer') === 1)
    check('the card kept its size', (await size(card(page, 'circuitStabilizer'))) === before, `${before} → ${await size(card(page, 'circuitStabilizer'))}`)
    check('a level in it → its card is green (kit tone success), the others not', await card(page, 'circuitStabilizer').getAttribute('data-tone') === 'success'
      && await page.locator('.kit-modal .kit-card[data-tone="success"]').count() === 1)
    await shot(page, 'green-card-390x844')
    const s1 = await saved(page)
    check('saved at once, as version 5 (XP kept)', s1.v === 5 && s1.owned.circuitStabilizer === 1 && s1.scrapsSpent === 1 && s1.totalXp === xpFor(5), JSON.stringify(s1))
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
    // Respec flashes the scraps number green, then it fades back (Muzzy, 2026-10-23: no toast; only Respec, not −)
    const scrapsNum = page.locator('.kit-modal [data-tag="scraps"]')
    const colourOf = () => scrapsNum.evaluate((el) => getComputedStyle(el).color)
    const success = await page.evaluate(() => { const p = document.createElement('i'); p.style.color = 'var(--success)'; document.querySelector('.kit-modal').append(p); const c = getComputedStyle(p).color; p.remove(); return c })
    const normal = await scrapsNum.evaluate((el) => getComputedStyle(el.parentElement).color) // the heading's own colour
    check('spending scraps: the number is its normal colour (not green)', await colourOf() === normal && normal !== success, `${await colourOf()} vs ${normal}`)
    await takeBack(page, 'capacitorEfficiency').click()
    await page.waitForTimeout(120)
    check('− gives a scrap back without the green flash', await scrapsShown(page, 1) === 1 && await colourOf() === normal, await colourOf())
    await respecBtn.click()
    await page.waitForTimeout(120)
    check('Respec: the scraps number turns green', await colourOf() === success, `${await colourOf()} vs ${success}`)
    check('Respec: no toast message', await page.locator('.kit-toast').count() === 0)
    await shot(page, 'respec-green-390x844')
    await page.waitForTimeout(1500)
    check('…then it goes back to its normal colour', await colourOf() === normal, `${await colourOf()} vs ${normal}`)
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
      check(`${tag} rank 9: "Scraps: 1", Circuit Stabilizer at max, Cooldown Booster switched on, nothing up to rank 9 locked`,
        await scrapsShown(page, 1) === 1 && await level(page, 'circuitStabilizer') === 4 && await equipSwitch(page, 'cooldownBooster').getAttribute('aria-checked') === 'true'
        && await page.getByText(/Opens at rank/).count() === ABOVE_9.length)
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
      check(`${tag} rank 9: scrolled to the end, the last card shows whole`, visible)
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
