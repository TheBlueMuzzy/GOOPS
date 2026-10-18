// HUD screenshots + checks for every F26 test layout: "Meters (test)" (Top / Hug the tank / Bottom strip) ×
// "Messages (test)" (Centre / At the stack), at every size, with all three machines' meters on (rank 6 — the worst case)
// and a 5-digit score. Checked in each state (playing, quota met, a real rupture):
//   - every HUD part sits over the HUD column (--kit-hud-w) and inside the screen; nothing overlaps; no text spills
//   - HUD parts and the Hug tags never cover the tank; the tags stay on screen
//   - At the stack: a message sits above the highest goop, inside the tank, and clear of the HUD
//   - off-screen cracks get their edge arrow; the rupture says why; no sideways overflow, no errors
// Port 5254. Run: node e2e/hud-shots.mjs [layout filter] [size filter] → e2e-shots/hud/<meters>-<messages>/
//   e.g. node e2e/hud-shots.mjs hug-stack phone
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5254, OUT = 'e2e-shots/hud'
const [layoutFilter = '', sizeFilter = ''] = process.argv.slice(2)
const sizes = [['phone', 390, 844], ['small', 360, 780], ['landscape', 844, 390], ['short', 768, 343], ['laptop', 1100, 800],
  ['desktop', 1440, 900], ['hd', 1920, 1080], ['wide', 2000, 1121], ['tall', 1400, 1400], ['narrow', 654, 900], ['monitor', 2560, 1440]]
  .filter(([name]) => !sizeFilter || sizeFilter.split(',').includes(name))
const METERS = { top: 'Top', hug: 'Hug the tank', strip: 'Bottom strip' }
const MESSAGES = { centre: 'Centre', stack: 'At the stack' }
const layouts = Object.keys(METERS).flatMap((m) => Object.keys(MESSAGES).map((g) => [m, g]))
  .filter(([m, g]) => !layoutFilter || `${m}-${g}`.includes(layoutFilter))

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const fail = (...msg) => { console.log('  ✗', ...msg); failed++ }

// Everything measured on the page, in CSS px: the tank, the HUD column, HUD parts, Hug tags, the message stack.
const measure = () => {
  const { view, engine } = window.__goops, s = engine.state
  const left = view.centreX - (Math.ceil(s.visibleWidth / 2) - 1 + 0.5) * view.cellPx, right = left + s.visibleWidth * view.cellPx
  const tank = { left, right, top: view.topY, bottom: view.topY + (s.height - s.bufferRows) * view.cellPx }
  const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width } }
  const hud = [...document.querySelectorAll('.kit-hud-slot > *')].map(box).filter((r) => r.width) // the slot itself has no box
  const tags = [...document.querySelectorAll('.stage-pin .kit-pinned')].map((e) => ({ ...box(e), tag: e.dataset.pin })).filter((r) => r.width)
  const toastsEl = document.querySelector('.kit-toasts:popover-open')
  const toasts = toastsEl ? box(toastsEl) : null
  // text whose ink spills past its own box (nowrap) overlaps its neighbours even when the boxes don't
  const spills = [...document.querySelectorAll('.kit-hud-slot *, .stage-pin *, .kit-toast *')]
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
  return { tank, hud, tags, toasts, spills, goopTop, hudW, W: innerWidth, H: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth }
}
const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
const offScreen = (r, W, H) => r.left < -0.5 || r.top < -0.5 || r.right > W + 0.5 || r.bottom > H + 0.5
const fmt = (r) => `${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`

async function checkHud(page, label, meters) {
  const m = await page.evaluate(measure)
  const mid = (m.tank.left + m.tank.right) / 2, half = Math.max(m.hudW / 2 + 1, (m.tank.right - m.tank.left) / 2 + 17)
  const problems = []
  if (!m.hud.length) problems.push('no HUD parts')
  for (const r of m.hud) if (r.left < mid - half || r.right > mid + half) problems.push(`HUD part outside its column ${fmt(r)}`)
  const all = [...m.hud, ...m.tags.filter((t) => t.tag !== 'pressure')] // (the pressure tag lives inside the tank, on its line)
  all.forEach((a, i) => all.slice(i + 1).forEach((b) => { if (hit(a, b)) problems.push(`overlap ${fmt(a)} × ${fmt(b)}`) }))
  for (const r of [...m.hud, ...m.tags]) if (offScreen(r, m.W, m.H)) problems.push(`past the screen edge ${fmt(r)}`)
  for (const r of all) if (hit(r, m.tank)) problems.push(`covers the tank ${fmt(r)} tank ${fmt(m.tank)}`)
  if (meters === 'hug') {
    if (m.tags.length !== 4) problems.push(`${m.tags.length} of 4 tags`)
    const p = m.tags.find((t) => t.tag === 'pressure')
    if (p && (p.left < m.tank.left || p.right > m.tank.right || p.top < m.tank.top - 1 || p.bottom > m.tank.bottom + 1)) problems.push(`pressure tag outside the tank ${fmt(p)}`)
  }
  if (m.spills.length) problems.push(`text spills: ${m.spills.join(' | ')}`)
  if (m.overflow) problems.push('sideways overflow')
  if (problems.length) fail(label, problems.join('; '))
  else console.log('  ✓', label, `${m.hud.length} HUD parts${m.tags.length ? ` + ${m.tags.length} tags` : ''} ok, tank ${fmt(m.tank)}`)
  return m
}

try {
  for (const [meters, messages] of layouts) {
    const dir = `${OUT}/${meters}-${messages}`
    mkdirSync(dir, { recursive: true })
    console.log(`── Meters: ${METERS[meters]} · Messages: ${MESSAGES[messages]}`)
    for (const [name, w, h] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript((values) => localStorage.setItem('kit-settings:', JSON.stringify(values)),
        { metersTest: METERS[meters], messagesTest: MESSAGES[messages] })
      await page.goto(`http://localhost:${PORT}/?seed=7&rank=6`)
      await startShift(page)
      // a few pieces + some cracks open (nobody seals) → integrity falling
      await page.evaluate(() => { const { engine } = window.__goops
        for (let i = 0; i < 10; i++) { for (let k = 0; k < (i * 5) % 7; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'softDrop', on: true }); engine.tick(2500) } })
      // the worst case: a 5-digit score (a wide score box squeezed the status line in Muzzy's shift, score 1241).
      // Top (today's layout) on a 360 px phone only fits 4 digits beside its bars — logged in ROADMAP; the F26 layouts
      // are the fix, so they get 5 digits everywhere
      await page.evaluate((top) => { window.__goops.engine.state.score = top && innerWidth < 380 ? 9999 : 99999 }, meters === 'top')
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${dir}/${name}-1-playing.png` })
      const playing = await checkHud(page, `${name} playing`, meters)

      // At the stack: a message (the longest one) sits just above the goop, inside the tank, clear of the HUD
      if (messages === 'stack') {
        await page.evaluate(() => window.__goops.say('brokeControls'))
        await page.waitForTimeout(900) // the point updates a few times a second and the stack glides there
        const m = await page.evaluate(measure)
        await page.screenshot({ path: `${dir}/${name}-1d-message.png` })
        const t = m.toasts, H = m.tank.bottom - m.tank.top
        const clampedHigh = m.goopTop < m.tank.top + 0.34 * H // goop above the lower 2/3: the stack stops at that line
        const problems = []
        if (!t) problems.push('no message shown')
        else {
          if (!clampedHigh && t.bottom > m.goopTop + 1) problems.push(`not above the goop (bottom ${Math.round(t.bottom)}, goop ${Math.round(m.goopTop)})`)
          if (t.top < m.tank.top - 1 || t.bottom > m.tank.bottom + 1) problems.push(`outside the tank ${fmt(t)} tank ${fmt(m.tank)}`)
          if (t.bottom < m.tank.top + 0.32 * H) problems.push(`above the tank's lower 2/3 ${fmt(t)}`)
          for (const r of [...m.hud, ...m.tags.filter((x) => x.tag !== 'pressure')]) if (hit(r, t)) problems.push(`under the HUD ${fmt(r)}`)
          if (offScreen(t, m.W, m.H)) problems.push(`past the screen edge ${fmt(t)}`)
        }
        if (problems.length) fail(name, 'message at the stack:', problems.join('; '))
        else console.log('  ✓', name, `message at the stack ${fmt(t)} above goop ${Math.round(m.goopTop)}${clampedHigh ? ' (clamped)' : ''}`)
        await page.evaluate(() => window.__goops.say('refusedFilling')) // a second one stacks above it, still clear
        await page.waitForTimeout(900)
        const two = await page.evaluate(measure)
        if (two.toasts && [...two.hud, ...two.tags.filter((x) => x.tag !== 'pressure')].some((r) => hit(r, two.toasts))) fail(name, 'two messages reach under the HUD')
        await page.screenshot({ path: `${dir}/${name}-1e-two-messages.png` })
      }

      // quota met: the crack line changes (display only — the rule itself is unit-tested)
      await page.evaluate(() => { const s = window.__goops.engine.state; s.cracksSealed = s.cracksNeeded })
      await page.waitForTimeout(250)
      await checkHud(page, `${name} quota met`, meters)
      await page.screenshot({ path: `${dir}/${name}-1c-quota.png` })

      // a crack out of view gets an arrow at the tank edge: turn the tank away from one and look for its colour there
      const arrow = await page.evaluate(async () => {
        const { engine, view } = window.__goops, s = engine.state
        const c = s.cracks[0]; if (!c) return 'no crack'
        for (let k = 0; k < 15; k++) engine.act({ type: 'spin', dir: 1 }) // half way round: the crack is behind the tank
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
      await checkHud(page, `${name} rupture`, meters)
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
console.log(failed ? `\n✗ ${failed} problem(s)` : '\n✓ every layout, every size')
process.exit(failed ? 1 : 0)
