// The Dev Kit affects the game LIVE (Muzzy, 2026-10-18: "the purpose of the devkit is to affect things live"), and its
// Pause buttons work (Dev Kit 0.18.0). In a real browser with the real dev server:
//   live edits — the same devkit:tuning event the Tuning tab sends, then the change is seen: tank.json background (the
//     tank canvas), tank.json spinRepeatMs (a held key's repeats), shift.json fall.msPerRow (the piece stops falling),
//     hud.json topRowPx (the tank re-fits), messages.json stack.gapRows (where messages sit), goo-jelly.json look knobs
//     (the goo's pixels change — drawn into a FROZEN picture: a live edit during full pause redraws one frame)
//   ⏸ full pause — two screenshots 500 ms apart are identical; both clocks stand still; on resume nothing jumps
//   ◐ half pause — the engine's state doesn't change over 1 s, while the picture does (the drop guide's wave, the goo)
//   P cycles off → full → half → off in the panel; online games: n/a (Goops is offline)
//   Snapshots — Save moment → play on → Restore puts the exact shift back
//   Screenshots of the panel with both buttons + the badge at 1440x900 and 390x844 → e2e-shots/devkit-live/
// Run: node e2e/devkit-live.mjs  (own dev server on port 5282)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 5282, OUT = 'e2e-shots/devkit-live'
mkdirSync(OUT, { recursive: true })
const file = (name) => JSON.parse(readFileSync(`content/tuning/${name}.json`, 'utf8'))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

// the Tuning tab's own message: the whole edited file
const send = (page, name, data) => page.evaluate(([f, d]) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: f, data: d } })), [name, data])
const edit = (name, change) => { const d = file(name); change(d); return d }
const state = (page) => page.evaluate(() => { const s = window.__goops.engine.state
  return { spin: s.spin, pieceY: s.piece ? Math.min(...s.piece.cells.map(([, y]) => y)) : null, pressure: s.pressure, score: s.score, grid: Array.from(s.grid).join('') } })
const clocks = (page) => page.evaluate(() => window.__goops.clocks())
const openKit = async (page) => { if (!(await page.locator('aside.devkit').isVisible())) { await page.keyboard.press('Backquote'); await page.waitForTimeout(300) } }
const closeKit = async (page) => { if (await page.locator('aside.devkit').isVisible()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300) } }
const pauseBtn = (page, which) => page.locator(`aside.devkit .devkit-pause-btn[data-pause="${which}"]`)

async function open(w, h, url = '?seed=7&rank=6') {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/${url}`)
  await startShift(page)
  return { page, errors }
}

try {
  const { page, errors } = await open(1440, 900)
  await page.evaluate(() => window.__goops.fastDrop(true)) // goo on the floor for the goo checks
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.__goops.fastDrop(false))

  // ---- live edits ----
  {
    const px = () => page.evaluate(() => { const c = document.querySelector('.stage > canvas'); return Array.from(c.getContext('2d').getImageData(2, 2, 1, 1).data.slice(0, 3)).join(',') })
    const before = await px()
    await send(page, 'tank', edit('tank', (d) => { d.background = '#ff00ff' }))
    await page.waitForTimeout(150)
    const after = await px()
    check('tank.json background: the tank canvas changes colour at once', after === '255,0,255' && before !== after, `${before} → ${after}`)
    await send(page, 'tank', file('tank'))

    const spinsWhileHeld = async () => {
      const a = (await state(page)).spin
      await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowRight')
      const b = (await state(page)).spin, w = 30
      return (((b - a) % w) + w) % w
    }
    const normal = await spinsWhileHeld()
    await send(page, 'tank', edit('tank', (d) => { d.spinRepeatMs = 5000 }))
    const slow = await spinsWhileHeld()
    await send(page, 'tank', file('tank'))
    check('tank.json spinRepeatMs: a held key repeats at the new pace', normal >= 4 && slow <= 2, `held 1.2 s: ${normal} turns normally, ${slow} with 5000 ms (the press + the first-delay repeat)`)

    await send(page, 'shift', edit('shift', (d) => { d.fall.msPerRow = 1e9; d.fall.softDropFactor = 1 }))
    await page.waitForTimeout(100)
    const y0 = (await state(page)).pieceY
    await page.waitForTimeout(1200)
    const y1 = (await state(page)).pieceY
    await send(page, 'shift', file('shift'))
    await page.waitForTimeout(1500)
    const y2 = (await state(page)).pieceY
    check('shift.json fall.msPerRow: the engine follows mid-shift (stops, then falls again)', y0 !== null && y0 === y1 && (y2 !== y1), `piece row ${y0} → ${y1} (stopped) → ${y2} (file again)`)

    const topY = () => page.evaluate(() => window.__goops.view.topY)
    const t0 = await topY()
    await send(page, 'hud', edit('hud', (d) => { d.topRowPx += 120 }))
    await page.waitForTimeout(150)
    const t1 = await topY()
    await send(page, 'hud', file('hud'))
    await page.waitForTimeout(150)
    check('hud.json topRowPx: the tank re-fits at once', t1 > t0 + 30 && Math.abs((await topY()) - t0) < 1, `tank top ${Math.round(t0)} → ${Math.round(t1)} px`)

    const at = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--kit-toasts-at'))
    const m0 = await at()
    await send(page, 'messages', edit('messages', (d) => { d.stack.topShare = 0.9; d.stack.floorGapRows = 0 }))
    await page.waitForTimeout(600)
    const m1 = await at()
    await send(page, 'messages', file('messages'))
    check('messages.json stack: where messages sit follows the edit', m0 !== m1, `--kit-toasts-at ${m0} → ${m1}`)
  }

  // ---- ⏸ full pause ----
  await openKit(page)
  check('panel: ⏸ shows, and ◐ shows too (Goops can half-pause)', await pauseBtn(page, 'full').isVisible() && await pauseBtn(page, 'half').isVisible())
  await pauseBtn(page, 'full').click()
  await page.waitForTimeout(100)
  check('full pause: the PAUSED badge is on the title', (await page.locator('aside.devkit .devkit-pause-tag').textContent()) === 'PAUSED')
  await page.screenshot({ path: `${OUT}/panel-paused-1440x900.png` })
  await closeKit(page)
  check('closing the Dev Kit does not resume; a small badge stays', await page.locator('.devkit-pause-badge').isVisible() && (await clocks(page)).pause === 'full')
  await page.screenshot({ path: `${OUT}/closed-badge-1440x900.png` })
  {
    const c0 = await clocks(page), s0 = await state(page)
    const shotA = await page.screenshot()
    await page.waitForTimeout(500)
    const shotB = await page.screenshot()
    check('full pause: two screenshots 500 ms apart are identical', shotA.equals(shotB))
    await page.waitForTimeout(1500)
    const c1 = await clocks(page), s1 = await state(page)
    check('full pause: both clocks stand still, the shift too', c1.rules - c0.rules < 1 && c1.looks - c0.looks < 1 && s1.pressure === s0.pressure, `rules +${(c1.rules - c0.rules).toFixed(1)} ms, looks +${(c1.looks - c0.looks).toFixed(1)} ms over 2 s`)

    // a live edit while frozen redraws ONE frame (no time passes): the goo's look changes in the frozen picture
    const goo = page.locator('canvas[data-goo]')
    const g0 = await goo.screenshot()
    await send(page, 'goo-jelly', edit('goo-jelly', (d) => { d.translucency = 0; d.wetness = 0; d.readyGlow = 0 }))
    await page.waitForTimeout(300)
    const g1 = await goo.screenshot()
    const c2 = await clocks(page)
    check('goo-jelly.json: a goo knob shows at once — even in the frozen picture (one redraw, no time passing)', !g0.equals(g1) && c2.looks - c1.looks < 1)
    await send(page, 'goo-jelly', file('goo-jelly'))

    await page.locator('.devkit-pause-badge').click() // tap the badge = resume
    await page.waitForTimeout(250)
    const c3 = await clocks(page), s3 = await state(page)
    const riseMs = file('shift').pressure.riseMsToFull
    const ranMs = (s3.pressure - s1.pressure) * riseMs
    check('resume: the badge resumes, and nothing jumps (the clocks carry on from where they stopped)',
      c3.pause === null && c3.looks - c2.looks < 600 && c3.rules - c2.rules < 600 && ranMs < 600,
      `after 250 ms: looks +${Math.round(c3.looks - c2.looks)} ms, rules +${Math.round(c3.rules - c2.rules)} ms, pressure moved ${Math.round(ranMs)} ms' worth (paused 2.3 s)`)
  }

  // ---- ◐ half pause ----
  await openKit(page)
  await pauseBtn(page, 'half').click()
  await page.waitForTimeout(100)
  check('half pause: the HALF-PAUSED badge is on the title', (await page.locator('aside.devkit .devkit-pause-tag').textContent()) === 'HALF-PAUSED')
  await closeKit(page)
  {
    const snap = () => page.evaluate(() => JSON.stringify(window.__goops.engine.snapshot()))
    const e0 = await snap(), c0 = await clocks(page)
    const stage = page.locator('[data-testid="stage"]')
    const a = await stage.screenshot()
    await page.waitForTimeout(1000)
    const b = await stage.screenshot()
    const e1 = await snap(), c1 = await clocks(page)
    check('half pause: the engine\'s state is unchanged over 1 s', e0 === e1 && c1.rules - c0.rules < 1)
    check('half pause: the picture still moves (drop-guide wave, goo, glow)', !a.equals(b) && c1.looks - c0.looks > 800, `looks +${Math.round(c1.looks - c0.looks)} ms`)
    await page.keyboard.down('KeyR'); await page.waitForTimeout(1800); await page.keyboard.up('KeyR')
    check('half pause: the game takes no input (holding R does not swap)', (await snap()) === e1)
  }
  // P cycles in the panel: half → off → full → half
  await openKit(page)
  await page.locator('aside.devkit .devkit-tab').first().focus()
  const cycle = []
  for (let i = 0; i < 3; i++) { await page.keyboard.press('p'); cycle.push((await clocks(page)).pause) }
  check('P in the panel cycles: half → off → full → half', JSON.stringify(cycle) === JSON.stringify([null, 'full', 'half']), JSON.stringify(cycle))
  await page.keyboard.press('p') // off
  check('P typed in the search box is a letter, not the pause key', await (async () => {
    const search = page.locator('aside.devkit input[type="search"], aside.devkit input[aria-label^="Search"]').first()
    if (!(await search.count())) return true
    await search.fill(''); await search.type('p')
    return (await clocks(page)).pause === null && (await search.inputValue()) === 'p'
  })())

  // ---- Snapshots: save → play on → restore ----
  {
    await page.locator('aside.devkit .devkit-tab', { hasText: 'Snapshots' }).click()
    const name = page.getByRole('textbox', { name: 'Snapshot name' })
    await name.fill('e2e moment')
    const saved = await state(page) // (the moment as the button is pressed — the game is running)
    await page.getByRole('button', { name: 'Save moment' }).click()
    const kept = await page.evaluate(() => {
      const all = Object.keys(localStorage).filter((k) => k.includes('snapshot')).map((k) => JSON.parse(localStorage.getItem(k)))
      const list = all.flat().filter((s) => s && s.name === 'e2e moment')
      return list[0]?.state?.shift ? { grid: list[0].state.shift.state.grid.join(''), score: list[0].state.shift.state.score } : null
    })
    check('Save moment keeps the shift', !!kept && kept.grid.length === saved.grid.length, kept ? `score ${kept.score}` : 'not found in localStorage')
    await closeKit(page)
    await page.evaluate(() => window.__goops.fastDrop(true))
    await page.waitForTimeout(2500)
    const moved = await state(page)
    check('…the shift plays on (the tank changes)', moved.grid !== kept?.grid)
    await openKit(page)
    await page.getByRole('button', { name: 'Restore' }).first().click()
    await page.waitForTimeout(400)
    const back = await page.evaluate(() => { const s = window.__goops.engine.state; return { grid: Array.from(s.grid).join(''), score: s.score, status: s.status } })
    check('Restore puts that exact shift back (same tank, same score) and it runs', back.grid === kept?.grid && back.score === kept?.score && back.status === 'playing', `score ${back.score}`)
    await page.screenshot({ path: `${OUT}/snapshots-1440x900.png` })
  }
  check('1440x900: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await page.close()

  // ---- phone ----
  {
    const { page: phone, errors: pe } = await open(390, 844)
    await openKit(phone)
    await pauseBtn(phone, 'half').click()
    await phone.waitForTimeout(150)
    const fits = await phone.evaluate(() => { const r = document.querySelector('aside.devkit .devkit-title-row').getBoundingClientRect(); const p = document.querySelector('aside.devkit').getBoundingClientRect()
      return r.right <= p.right + 0.5 && document.querySelector('.devkit-pause-tag').getBoundingClientRect().right <= document.querySelector('.devkit-close').getBoundingClientRect().left })
    check('390x844: buttons, title and badge fit on the title row', fits)
    await phone.screenshot({ path: `${OUT}/panel-half-390x844.png` })
    await pauseBtn(phone, 'full').click()
    await phone.waitForTimeout(150)
    await phone.screenshot({ path: `${OUT}/panel-paused-390x844.png` })
    await closeKit(phone)
    await phone.screenshot({ path: `${OUT}/closed-badge-390x844.png` })
    await phone.locator('.devkit-pause-badge').click()
    check('390x844: the badge resumes', (await clocks(phone)).pause === null)
    check('390x844: no console errors', pe.length === 0, pe.slice(0, 3).join(' | '))
  }
} catch (e) {
  console.log('FAIL', e)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `${failed} check(s) FAILED` : 'all devkit-live checks passed')
process.exit(failed ? 1 : 0)
