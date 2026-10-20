// HUD screenshots + checks for the shift's HUD (F26, Muzzy's mock-up 2026-10-18; F59 his second, 2026-10-19): one top
// row (score · CRACKS x / y · Console button), the tank, the bottom panel (the next-piece window at its left from rank 1,
// the machine bars in a row over the integrity bar to its right; a column beside the tank on a phone on its side, headed
// by the crack count), the pressure readout on the pressure line, messages just above the goop — at every size, at
// ranks 0 / 1 / 3 / 4 / 6 (no machine · the window · + one machine · two · three), with a 5-digit score. Checked in
// each state (playing, quota met, a real rupture):
//   - every top-row part sits over the HUD column (--kit-hud-w) and inside the screen, in ONE row; nothing overlaps;
//     no text spills its box; nothing covers the tank; the crack count clear of the score and the Console button
//   - the panel: never over the tank, on screen, the same height all shift and never taller than the stage made room
//     for (--kit-hud-dock-size); the right number of machine bars (in one row, evenly spaced, centred over the
//     integrity bar; beside the tank: stacked); integrity always there; the crack count in the top row (beside the tank:
//     heading the panel)
//   - the next-piece window: only from rank 1, in the panel at its left, clear of its edges and of the bars, the piece
//     inside it with room round it, its cells big (at least 11 px)
//   - the readout inside the tank in both directions at position 0 and 100, above the visor glitch
//   - a message sits above the highest goop and the pressure readout, inside the tank, clear of the top row and the panel
//   - off-screen cracks get their edge arrow; the rupture says why; no sideways overflow, no errors
// Also a shot while fast-dropping (the drop guide's chevrons light up faster).
// Port 5254. Run: node e2e/hud-shots.mjs [rank filter] [size filter] → e2e-shots/hud/rank-<n>/
//   e.g. node e2e/hud-shots.mjs 6 phone,landscape
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5254, OUT = 'e2e-shots/hud'
const [rankFilter = '', sizeFilter = ''] = process.argv.slice(2)
// (no phone on its side or short-and-wide window: Goops is portrait only — Muzzy 2026-10-18)
const sizes = [['phone', 390, 844], ['small', 360, 780], ['laptop', 1100, 800],
  ['desktop', 1440, 900], ['hd', 1920, 1080], ['wide', 2000, 1121], ['tall', 1400, 1400], ['narrow', 654, 900], ['monitor', 2560, 1440]]
  .filter(([name]) => !sizeFilter || sizeFilter.split(',').includes(name))
// rank → how many machine bars the panel shows (visor unlocks at 2, laser at 4, controls at 6; the window at 1)
const RANKS = { 0: 0, 1: 0, 3: 1, 4: 2, 6: 3 }
const ranks = Object.keys(RANKS).filter((r) => !rankFilter || rankFilter.split(',').includes(r))

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const fail = (...msg) => { console.log('  ✗', ...msg); failed++ }

// Everything measured on the page, in CSS px: the tank, the HUD column, top-row parts, the panel and its bars, the
// readout, the message stack.
const measure = () => {
  const { view, engine } = window.__goops, s = engine.state
  const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx, right = left + s.visibleWidth * view.cellPx
  const tank = { left, right, top: view.topY, bottom: view.topY + (s.height - s.bufferRows) * view.cellPx }
  const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } }
  const hud = [...document.querySelectorAll('.kit-hud-slot > *')].map(box).filter((r) => r.width) // the slot itself has no box
  const dockEl = document.querySelector('.kit-hud-dock')
  const dock = dockEl ? { ...box(dockEl), side: dockEl.dataset.side, room: parseFloat(document.documentElement.style.getPropertyValue('--kit-hud-dock-size')) } : null
  const machineBars = [...document.querySelectorAll('.kit-hud-dock .kit-bar[data-label-at="above"]')].map(box)
  const integrity = [...document.querySelectorAll('.kit-hud-dock .kit-bar[data-label-at="inside"]')].map(box)
  const dockStatus = !!document.querySelector('.kit-hud-dock .kit-hud-text')
  // F59: the next-piece window and the piece's cells in it
  const nextEl = document.querySelector('.next-window')
  const next = nextEl ? box(nextEl) : null
  const nextCells = [...document.querySelectorAll('.next-window rect')].map(box)
  // the crack count's words in the panel: the box round their letters (a range), not the text box (which may be wider)
  const words = document.querySelector('.kit-hud-dock .kit-hud-text .kit-text')
  let dockWords = null
  if (words) { const r = document.createRange(); r.selectNodeContents(words); dockWords = box(r) }
  const topText = document.querySelector('.kit-hud-slot .kit-hud-text .kit-text')
  let topWords = null
  if (topText) { const r = document.createRange(); r.selectNodeContents(topText); topWords = box(r) }
  const readoutEl = document.querySelector('.stage-pin[data-tag="readout"] .kit-pinned')
  const readout = readoutEl ? box(readoutEl) : null
  const toastsEl = document.querySelector('.kit-toasts:popover-open')
  const toasts = toastsEl ? box(toastsEl) : null
  // text whose ink spills past its own box (nowrap) overlaps its neighbours even when the boxes don't
  const spills = [...document.querySelectorAll('.kit-hud-slot *, .kit-hud-dock *, .stage-pin *, .kit-toast *')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0).map((e) => e.textContent.slice(0, 30))
  // the highest goop in the visible columns (screen y of its top edge), as the messages read it
  let highest = s.height
  for (let y = s.bufferRows; y < s.height && highest === s.height; y++)
    for (let k = 0; k < s.visibleWidth; k++) {
      const x = (((s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k) % s.width) + s.width) % s.width
      if (s.grid[y * s.width + x]) { highest = y; break }
    }
  const goopTop = view.topY + (highest - s.bufferRows) * view.cellPx
  const hudW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kit-hud-w')) || innerWidth
  // the readout above the visor glitch: same stacking box (the stage), higher z-index
  const z = (e) => Number(e && getComputedStyle(e).zIndex) || 0
  const visor = document.querySelector('canvas[data-visor]')
  const readoutOnTop = z(document.querySelector('.stage-readout')) > z(visor) && z(document.querySelector('.stage-pin[data-tag="readout"]')) > z(visor)
  return { tank, hud, dock, dockStatus, dockWords, topWords, next, nextCells, pieceCells: s.nextCells?.length ?? 0, machineBars, integrity, readout, line: window.__goops.readout(), toasts, spills, goopTop, hudW,
    readoutOnTop, W: innerWidth, H: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth }
}
const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
const offScreen = (r, W, H) => r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5
const fmt = (r) => `${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`
const inside = (r, t, slack = 1) => r.left >= t.left - slack && r.right <= t.right + slack && r.top >= t.top - slack && r.bottom <= t.bottom + slack

function hudProblems(m, bars, rank) {
  const mid = (m.tank.left + m.tank.right) / 2, half = Math.max(m.hudW / 2 + 1, (m.tank.right - m.tank.left) / 2 + 17)
  const problems = []
  if (!m.hud.length) problems.push('no HUD parts')
  for (const r of m.hud) if (r.left < mid - half || r.right > mid + half) problems.push(`HUD part outside its column ${fmt(r)}`)
  m.hud.forEach((a, i) => m.hud.slice(i + 1).forEach((b) => { if (hit(a, b)) problems.push(`overlap ${fmt(a)} × ${fmt(b)}`) }))
  // one top row: the score, the crack count (big, centred) and the Console button share a line (their boxes overlap top
  // to bottom). (A phone on its side: the score and the Console button beside the tank, the crack count heading the
  // panel column.)
  const sideways = m.dock?.side === 'right'
  const window = Number(rank) >= 1
  // (Muzzy's hud.json topRowPx 19, 2026-10-18: the top row may hang over the tank's top edge, so a top-row part is one
  // that STARTS at or above the tank's top)
  const top = m.hud.filter((r) => sideways ? r.top < m.tank.top + 60 : r.top < m.tank.top + 8).sort((a, b) => a.left - b.left)
  const want = sideways ? 2 : 3
  if (top.length !== want) problems.push(`${top.length} of ${want} parts in the top row (score, ${sideways ? '' : 'cracks, '}Console button)`)
  if (sideways !== m.dockStatus) problems.push(sideways ? 'no crack count heading the panel column' : 'the crack count is in the bottom panel, not the top row')
  // (the crack count's words between the corners, clear of the score and the Console button)
  if (!sideways && top.length === 3 && m.topWords && (m.topWords.left < top[0].right + 4 || m.topWords.right > top[2].left - 4))
    problems.push(`the crack count touches the score or the Console button ${fmt(m.topWords)}`)
  // F59: the next-piece window from rank 1 only — in the panel, at its left (the bars to its right), clear of the
  // panel's edges, the whole piece inside it with room round it (nothing touches a container's edge), cells big
  if (window !== !!m.next) problems.push(window ? 'no next-piece window' : 'a next-piece window before rank 1')
  if (m.next && m.dock) {
    const d = m.dock
    if (m.next.left < d.left + 4 || m.next.right > d.right - 4 || m.next.top < d.top + 4 || m.next.bottom > d.bottom - 4) problems.push(`the next-piece window touches the panel's edge ${fmt(m.next)} panel ${fmt(d)}`)
    for (const r of [...m.machineBars, ...m.integrity]) if (r.left < m.next.right + 4) problems.push(`a bar is not right of the next-piece window ${fmt(r)} window ${fmt(m.next)}`)
    for (const r of m.hud) if (hit(r, m.next)) problems.push(`the next-piece window is under a HUD part ${fmt(m.next)} × ${fmt(r)}`)
  }
  if (m.next && m.nextCells.length !== m.pieceCells) problems.push(`${m.nextCells.length} of ${m.pieceCells} cells in the next-piece window`)
  if (m.next) for (const c of m.nextCells) if (c.left < m.next.left + 4 || c.right > m.next.right - 4 || c.top < m.next.top + 4 || c.bottom > m.next.bottom - 4) problems.push(`a cell touches the next-piece window's edge ${fmt(c)} in ${fmt(m.next)}`)
  if (m.next && m.nextCells.some((c) => c.width < 11 || c.height < 11)) problems.push(`the next-piece window's cells are small (${Math.round(m.nextCells[0].width)} px)`)
  if (top.some((a) => top.some((b) => a.bottom < b.top || b.bottom < a.top))) problems.push('the top row is not one row')
  for (const r of m.hud) if (offScreen(r, m.W, m.H)) problems.push(`past the screen edge ${fmt(r)}`)
  // only the top row may overlap the tank, and only its top edge (no deeper than topRowPx + one row of HUD text)
  for (const r of m.hud) if (hit(r, m.tank) && (!top.includes(r) || r.bottom > m.tank.top + 60)) problems.push(`covers the tank ${fmt(r)} tank ${fmt(m.tank)}`)
  // the pressure readout's words never go under a top-row part (95% slid under "CRACKS 0 / 6", 2026-10-18)
  if (m.readout) for (const r of m.hud) if (hit(r, m.readout)) problems.push(`the readout is under a HUD part ${fmt(m.readout)} × ${fmt(r)}`)
  // the panel
  const d = m.dock
  if (!d) problems.push('no panel')
  else {
    if (hit(d, m.tank)) problems.push(`the panel covers the tank ${fmt(d)} tank ${fmt(m.tank)}`)
    if (offScreen(d, m.W, m.H)) problems.push(`the panel is past the screen edge ${fmt(d)}`)
    for (const r of m.hud) if (hit(r, d)) problems.push(`a HUD part under the panel ${fmt(r)}`)
    if (m.machineBars.length !== bars) problems.push(`${m.machineBars.length} of ${bars} machine bars`)
    if (m.integrity.length !== 1) problems.push('no integrity bar')
    // the stage keeps the tank clear of the room it made for the panel: the panel never needs more (F59: a row of
    // machine names that wrapped made it grow over that room)
    if (d.side === 'bottom' && d.height > d.room + 0.5) problems.push(`the panel is taller than its room (${Math.round(d.height)} > ${d.room} px)`)
    for (const r of [...m.machineBars, ...m.integrity]) if (!inside(r, d)) problems.push(`a bar outside the panel ${fmt(r)}`)
    // nothing touches the panel's edge (breathing room on every side)
    for (const r of [...m.machineBars, ...m.integrity]) if (r.left < d.left + 4 || r.right > d.right - 4 || r.top < d.top + 4 || r.bottom > d.bottom - 4) problems.push(`a bar touches the panel's edge ${fmt(r)}`)
    // (and the crack count's words, beside the integrity bar since F59: measured by their ink, not their box)
    if (m.dockWords && (m.dockWords.left < d.left + 4 || m.dockWords.right > d.right - 4 || m.dockWords.top < d.top + 4 || m.dockWords.bottom > d.bottom - 4)) problems.push(`the crack count touches the panel's edge ${fmt(m.dockWords)} panel ${fmt(d)}`)
    if (d.side === 'bottom' && bars && m.integrity.length) {
      // (centred over the integrity bar: the window takes the panel's left)
      const centre = (m.integrity[0].left + m.integrity[0].right) / 2, b = [...m.machineBars].sort((x, y) => x.left - y.left)
      const groupMid = (b[0].left + b[b.length - 1].right) / 2
      if (Math.abs(groupMid - centre) > 2) problems.push(`machine bars not centred (${Math.round(groupMid)} vs ${Math.round(centre)})`)
      const gaps = b.slice(1).map((r, i) => r.left - b[i].right)
      if (gaps.some((g) => Math.abs(g - gaps[0]) > 1.5)) problems.push(`machine bars not evenly spaced (${gaps.map(Math.round)})`)
      if (b.some((r) => Math.abs(r.top - b[0].top) > 1)) problems.push('machine bars not in one row')
    }
    if (d.side === 'right' && m.machineBars.some((r, i, all) => i && r.top < all[i - 1].bottom)) problems.push('machine bars not stacked')
  }
  // the pressure readout: inside the tank, line and words
  if (!m.readout) problems.push('no pressure readout')
  else if (!inside(m.readout, m.tank)) problems.push(`the readout is outside the tank ${fmt(m.readout)} tank ${fmt(m.tank)}`)
  for (const [x, y] of [m.line.foot, m.line.end]) if (x < m.tank.left - 1 || x > m.tank.right + 1 || y < m.tank.top - 1 || y > m.tank.bottom + 1) problems.push(`the readout's line leaves the tank (${Math.round(x)},${Math.round(y)})`)
  if (!m.readoutOnTop) problems.push('the readout is not above the visor glitch')
  if (m.spills.length) problems.push(`text spills: ${m.spills.join(' | ')}`)
  if (m.overflow) problems.push('sideways overflow')
  return problems
}

let rankNow = '0' // (the rank being checked: the next-piece window shows from rank 1)
async function checkHud(page, label, bars) {
  const m = await page.evaluate(measure)
  const problems = hudProblems(m, bars, rankNow)
  if (problems.length) fail(label, problems.join('; '))
  else console.log('  ✓', label, `${m.hud.length} top-row parts, panel ${fmt(m.dock)} with ${m.machineBars.length} + 1 bars, tank ${fmt(m.tank)}`)
  return m
}

try {
  for (const rank of ranks) {
    const bars = RANKS[rank]
    rankNow = rank
    const dir = `${OUT}/rank-${rank}`
    mkdirSync(dir, { recursive: true })
    console.log(`── Rank ${rank} (${bars} machine bar${bars === 1 ? '' : 's'})`)
    for (const [name, w, h] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(`http://localhost:${PORT}/?seed=7&rank=${rank}`)
      await startShift(page)
      // a few pieces + some cracks open (nobody seals) → integrity falling
      await page.evaluate(() => { const { engine } = window.__goops
        for (let i = 0; i < 10; i++) { for (let k = 0; k < (i * 5) % 7; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'softDrop', on: true }); engine.tick(2500) }
        engine.act({ type: 'softDrop', on: false }) })
      // the worst case: a 5-digit score (a wide score box squeezed the status line in Muzzy's shift, score 1241)
      await page.evaluate(() => { window.__goops.engine.state.score = 99999 })
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${dir}/${name}-1-playing.png` })
      const playing = await checkHud(page, `${name} playing`, bars)
      const panelH = playing.dock?.height

      // the readout at both ends of the line, in both directions: always inside the tank
      for (const direction of ['Line, then text', 'Text, then line']) for (const position of [0, 100]) {
        await page.evaluate((v) => window.__goops.setReadout(v), { readoutDirection: direction, readoutPosition: position })
        await page.waitForTimeout(150)
        const m = await page.evaluate(measure)
        const where = `readout ${direction} at ${position}`
        const p = []
        if (!m.readout || !inside(m.readout, m.tank)) p.push(`words outside the tank ${m.readout && fmt(m.readout)}`)
        for (const [x, y] of [m.line.foot, m.line.end]) if (x < m.tank.left - 1 || x > m.tank.right + 1 || y < m.tank.top - 1 || y > m.tank.bottom + 1) p.push('line outside the tank')
        // the words sit at the line's upper end: after it (line first) or before it (text first)
        const [ex] = m.line.end
        if (m.readout && direction === 'Line, then text' && m.readout.left < ex - 1) p.push('words not after the line')
        if (m.readout && direction === 'Text, then line' && m.readout.right > ex + 1) p.push('words not before the line')
        // near the top (pressure 97%) the words stay clear of the top row, which hangs over the tank's top
        const pressureWas = await page.evaluate(() => { const g = window.__goops, was = g.engine.state.pressure; g.engine.setPressure(0.97); return was })
        await page.waitForTimeout(150)
        const high = await page.evaluate(measure)
        await page.evaluate((was) => window.__goops.engine.setPressure(was), pressureWas)
        for (const r of high.hud) if (high.readout && hit(r, high.readout)) p.push(`at 97% the words are under a HUD part ${fmt(high.readout)} × ${fmt(r)}`)
        if (high.readout && !inside(high.readout, high.tank)) p.push(`at 97% the words are outside the tank ${fmt(high.readout)}`)
        if (p.length) fail(name, where, p.join('; '))
        if (rank === '6' && ['phone', 'landscape', 'desktop'].includes(name)) await page.screenshot({ path: `${dir}/${name}-1r-${direction[0] === 'L' ? 'line' : 'text'}-${position}.png` })
      }
      await page.evaluate(() => window.__goops.setReadout({ readoutDirection: 'Line, then text', readoutPosition: 65 }))

      // a message (the longest one) sits just above the goop, inside the tank, clear of the top row and the panel
      await page.evaluate(() => window.__goops.say('brokeControls'))
      await page.waitForTimeout(900) // the point updates a few times a second and the stack glides there
      {
        const m = await page.evaluate(measure)
        await page.screenshot({ path: `${dir}/${name}-1d-message.png` })
        const t = m.toasts, H = m.tank.bottom - m.tank.top
        const clampedHigh = m.goopTop < m.tank.top + 0.34 * H // goop above the lower 2/3: the stack stops at that line
        const problems = []
        if (!t) problems.push('no message shown')
        else {
          if (!clampedHigh && t.bottom > m.goopTop + 1) problems.push(`not above the goop (bottom ${Math.round(t.bottom)}, goop ${Math.round(m.goopTop)})`)
          if (t.top < m.tank.top - 1 || t.bottom > m.tank.bottom + 1) problems.push(`outside the tank ${fmt(t)} tank ${fmt(m.tank)}`)
          if (!clampedHigh && m.readout && hit(m.readout, t)) problems.push(`covers the pressure readout ${fmt(m.readout)}`)
          if (t.bottom < m.tank.top + 0.32 * H) problems.push(`above the tank's lower 2/3 ${fmt(t)}`)
          for (const r of [...m.hud, ...(m.dock ? [m.dock] : [])]) if (hit(r, t)) problems.push(`under the HUD ${fmt(r)}`)
          if (offScreen(t, m.W, m.H)) problems.push(`past the screen edge ${fmt(t)}`)
        }
        if (problems.length) fail(name, 'message at the stack:', problems.join('; '))
        else console.log('  ✓', name, `message at the stack ${fmt(t)} above goop ${Math.round(m.goopTop)}${clampedHigh ? ' (clamped)' : ''}`)
      }
      await page.evaluate(() => window.__goops.say('refusedFilling')) // a second one stacks above it, still clear
      await page.waitForTimeout(900)
      const two = await page.evaluate(measure)
      if (two.toasts && two.hud.some((r) => hit(r, two.toasts))) fail(name, 'two messages reach under the HUD')
      await page.screenshot({ path: `${dir}/${name}-1e-two-messages.png` })

      // fast drop held: the drop guide's wave runs faster (a shot to look at)
      if (rank === '6' && ['phone', 'desktop'].includes(name)) {
        await page.evaluate(() => { const { engine } = window.__goops; engine.state.score = 99999; window.__goops.fastDrop(true) })
        await page.waitForTimeout(120)
        await page.screenshot({ path: `${dir}/${name}-1f-fast-drop.png` })
        await page.evaluate(() => window.__goops.fastDrop(false))
      }

      // low: integrity and every machine under the line → red + pulsing; a broken machine flashes
      const integrityWas = await page.evaluate(() => { const s = window.__goops.engine.state, was = s.integrity
        s.integrity = Math.min(s.integrity, 0.2)
        for (const id of ['laser', 'visor', 'controls']) if (s.machines[id].unlocked) s.machines[id].health = 0.2
        return was })
      if (bars) await page.evaluate(() => window.__goops.breakMachine('visor'))
      await page.waitForTimeout(300)
      // (controls cool down fast, so only the broken visor and the weak tank are sure to still be low here)
      const alerts = await page.evaluate(() => [...document.querySelectorAll('.kit-hud-dock .kit-bar')].map((e) => [e.dataset.labelAt, e.dataset.alert ?? '']))
      const integrityPulse = alerts.some(([at, a]) => at === 'inside' && a === 'pulse')
      const wantAlerts = integrityPulse && alerts.filter(([, a]) => a === 'flash').length === (bars ? 1 : 0)
      if (!wantAlerts) fail(name, 'low / broken bars do not call attention', JSON.stringify(alerts))
      await page.screenshot({ path: `${dir}/${name}-1g-low.png` })
      // (back to the integrity it had, so the tank doesn't rupture before the checks below)
      await page.evaluate((was) => { window.__goops.engine.state.integrity = was }, integrityWas)

      // quota met: the crack line changes (display only — the rule itself is unit-tested)
      await page.evaluate(() => { const s = window.__goops.engine.state; s.cracksSealed = s.cracksNeeded })
      await page.waitForTimeout(250)
      await checkHud(page, `${name} quota met`, bars)
      await page.screenshot({ path: `${dir}/${name}-1c-quota.png` })

      // a crack out of view gets an arrow at the tank edge: turn the tank away from one and look for its colour there
      const arrow = await page.evaluate(async () => {
        const { engine, view } = window.__goops, s = engine.state
        const c = s.cracks[0]; if (!c) return 'no crack'
        // turn until the crack is half way round, behind the tank (the tank turns one column per spin)
        const turns = (((c.x + s.width / 2 - s.spin) % s.width) + s.width) % s.width
        for (let k = 0; k < turns; k++) engine.act({ type: 'spin', dir: 1 })
        await new Promise((r) => setTimeout(r, 1200)) // the camera glides there
        const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx, right = left + s.visibleWidth * view.cellPx
        const y = view.topY + (c.y - s.bufferRows + 0.5) * view.cellPx
        const ctx = document.querySelector('canvas').getContext('2d'), d = view.dpr
        const px = (x) => [...ctx.getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data]
        return { leftEdge: px(left + 6), rightEdge: px(right - 6) }
      })
      const lit = (p) => Array.isArray(p) && Math.max(p[0], p[1], p[2]) > 120
      if (typeof arrow === 'string' || !(lit(arrow.leftEdge) || lit(arrow.rightEdge))) fail(name, 'no off-screen arrow', JSON.stringify(arrow))

      // run on until the tank ruptures for real: its message says why
      const ruptured = await page.evaluate(() => { const { engine } = window.__goops
        for (let t = 0; t < 400 && engine.state.phase === 'playing'; t++) engine.tick(250)
        return engine.state.phase === 'rupture' })
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${dir}/${name}-2-rupture.png` })
      const end = await checkHud(page, `${name} rupture`, bars)
      if (end.dock && Math.abs(end.dock.height - panelH) > 0.5) fail(name, `the panel changed height mid-shift (${panelH} → ${end.dock.height})`)
      const why = await page.locator('.kit-toast').getByText(/^Rupture! (Too many open cracks|The tank overflowed)$/).count()
      if (!ruptured || !why) fail(name, 'rupture:', ruptured, 'its message:', why ? 'yes' : 'NO')
      if (errors.length) fail(name, 'page errors', errors.join(' | '))
      if (playing.overflow) fail(name, 'sideways overflow')
      await page.close()
    }
  }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
console.log(failed ? `\n✗ ${failed} problem(s)` : '\n✓ every rank, every size')
process.exit(failed ? 1 : 0)
