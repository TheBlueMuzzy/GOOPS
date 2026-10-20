// Cracks you can read (F36, Muzzy 2026-10-18): one tank with every kind of crack, at every size → e2e-shots/cracks-look/
//   - OPEN cracks (nothing on them) leak bubbles into the tank; covered ones leak half as much; sealed ones none
//   - COVERED cracks (goop of any colour on them: a wrong colour, and the right colour = plugged) get the dotted white
//     x-ray box, and the goop over them is handed to the goo as see-through (view.xray)
//   - SEALED spots (cracks sealed earlier) show a dark grey mended scar
// The rules are held in the Dev Kit's half pause (the looks keep moving, so the bubbles rise). One extra shot with the
// visor glitch on (?visor=0.7): the x-ray box is under it, so it glitches too. Also: no bubbles and no box once the
// covered crack is popped and sealed (a real zap through the engine), and a clean console.
// Port 5331. Run: node e2e/cracks-look.mjs
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = 5331, OUT = 'e2e-shots/cracks-look'
mkdirSync(OUT, { recursive: true })
const sizes = [['phone', 390, 844], ['small', 360, 780], ['laptop', 1100, 800], ['desktop', 1440, 900], ['hd', 1920, 1080]]
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
const fail = (...msg) => { console.log('  ✗', ...msg); failed++ }

// The scene, built straight into the engine's state with the rules held: visible columns k (0 = the view's left edge).
//   k 1: open crack on the floor (empty column)        k 3: open crack 2 up, beside a short stack
//   k 5: covered by a WRONG colour (colour 2 over a colour-1 crack)
//   k 8: plugged (colour 3 over a colour-3 crack)      k 10: two sealed scars, and one sealed in a stack's side (k 6)
const setup = async (page) => page.evaluate(async () => {
  const { setClockPause } = await import('/src/devkit/gameClock.ts')
  const { regroup } = await import('/src/engine/groups.ts')
  setClockPause('half')
  const engine = window.__goops.engine, s = engine.state
  s.grid.fill(0)
  s.cracks.length = 0
  const vis = (k) => (s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k + s.width) % s.width
  const yOf = (row) => s.height - 1 - row // rows counted from the floor
  const put = (k, rows, colour) => { for (let row = 0; row < rows; row++) s.grid[yOf(row) * s.width + vis(k)] = colour }
  put(4, 2, 2); put(5, 3, 2); put(6, 4, 2); put(8, 3, 3); put(9, 2, 3)
  regroup(s, engine.book)
  for (const g of s.groups.values()) { g.fill = 1; engine.book.fillMs.set(g.id, 1e9) }
  const crack = (id, k, row, color) => ({ id, x: vis(k), y: yOf(row), color, plugged: s.grid[yOf(row) * s.width + vis(k)] === color })
  s.cracks.push(crack(901, 1, 0, 1), crack(902, 3, 2, 4), crack(903, 5, 1, 4), crack(904, 8, 1, 3))
  s.sealedCracks = [{ id: 801, x: vis(10), y: yOf(0) }, { id: 802, x: vis(10), y: yOf(3) }, { id: 803, x: vis(6), y: yOf(1) }]
  engine.setPressure(0.5)
  const at = (k, row) => yOf(row) * s.width + vis(k)
  return { open: [901, 902], covered: [at(5, 1), at(8, 1)], sealed: [[10, 0], [10, 3], [6, 1]].map(([k, r]) => ({ k, row: r })) }
})

// What the tank canvas has where the x-ray boxes and the sealed scars go (the tank canvas is 2D: read its pixels).
const probe = (page) => page.evaluate(() => {
  const { view, engine } = window.__goops, s = engine.state
  const c = document.querySelector('canvas.stage-layer'), ctx = c.getContext('2d')
  const cp = view.cellPx, dpr = view.dpr
  const cellBox = (x, y) => {
    let d = x - view.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
    const cx = view.centreX + d * cp, top = view.topY + (y - s.bufferRows) * cp
    return { left: cx - cp / 2, top, size: cp }
  }
  const px = (x, y, w, h) => ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr))).data
  // x-ray: the box's top edge strip (a dotted line: some near-white pixels)
  const xray = (s.cracks.filter((k) => s.grid[k.y * s.width + k.x] !== 0)).map((k) => {
    const b = cellBox(k.x, k.y), d = px(b.left - cp * 0.15, b.top - cp * 0.15, b.size * 1.3, cp * 0.2)
    let white = 0
    for (let i = 0; i < d.length; i += 4) {
      const lo = Math.min(d[i], d[i + 1], d[i + 2]), hi = Math.max(d[i], d[i + 1], d[i + 2])
      if (lo > 120 && hi - lo < 50) white++ // whitish (the box breathes, so not always full white)
    }
    return { id: k.id, white }
  })
  // sealed: dark grey pixels around the spot's centre (and, to prove the probe, an empty spot: none there)
  const greyAt = (x, y) => {
    const b = cellBox(x, y), d = px(b.left + cp * 0.2, b.top + cp * 0.05, cp * 0.6, cp * 0.9)
    let grey = 0
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, bl] = [d[i], d[i + 1], d[i + 2]]
      if (Math.abs(r - g) < 22 && Math.abs(g - bl) < 28 && r > 40 && r < 140) grey++
    }
    return grey
  }
  const sealed = (s.sealedCracks ?? []).map((k) => ({ id: k.id, grey: greyAt(k.x, k.y) }))
  const control = greyAt((s.spin + 3) % s.width, s.height - 8)
  // the pixel X (wrong colour on the crack: it will not seal): red pixels in the crack's cell
  const redAt = (k) => {
    const b = cellBox(k.x, k.y), d = px(b.left, b.top, b.size, b.size)
    let red = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] < 90 && d[i + 2] < 100) red++
    return red
  }
  const wrongX = Object.fromEntries(s.cracks.filter((k) => s.grid[k.y * s.width + k.x] !== 0).map((k) => [k.id, redAt(k)]))
  const bubbles = Object.fromEntries(s.cracks.map((k) => [k.id, window.__goops.bubbles.from(k.id)]))
  return { xray, sealed, control, bubbles, wrongX, gooXray: view.xray }
})

try {
  for (const [name, w, h] of sizes) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: name === 'phone' || name === 'small' ? 2 : 1 })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()) })
    await page.goto(`http://localhost:${PORT}/?rank=4`)
    await startShift(page)
    const scene = await setup(page)
    await page.waitForTimeout(1500) // bubbles rise for a while
    const r = await probe(page)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`${name} ${w}x${h}: bubbles ${JSON.stringify(r.bubbles)} · x-ray white px ${r.xray.map((x) => x.white).join('/')} · sealed grey px ${r.sealed.map((x) => x.grey).join('/')} (empty spot ${r.control}) · red X px ${JSON.stringify(r.wrongX)}`)
    if (r.control >= 8) fail(`${name}: the scar probe sees grey where there is no scar (${r.control})`)
    for (const id of scene.open) if (!(r.bubbles[id] > 0)) fail(`${name}: open crack ${id} has no bubbles`)
    // covered cracks leak too, at half the rate, up through the goop (Muzzy 2026-10-19) — a random stream, so the pair
    if (!(r.bubbles[903] + r.bubbles[904] > 0)) fail(`${name}: covered cracks 903/904 are not bubbling`)
    if (r.xray.length !== 2 || r.xray.some((x) => x.white < 3)) fail(`${name}: x-ray box missing`, JSON.stringify(r.xray))
    if (JSON.stringify([...(r.gooXray?.cells ?? [])].sort()) !== JSON.stringify([...scene.covered].sort())) fail(`${name}: goo not told the x-ray cells`, JSON.stringify(r.gooXray))
    if (!(r.wrongX[903] >= 6)) fail(`${name}: no red X on the wrong-colour crack 903`, JSON.stringify(r.wrongX))
    if (r.wrongX[904] > 2) fail(`${name}: a red X on the plugged (right colour) crack 904`, JSON.stringify(r.wrongX))
    if (r.sealed.length !== 3 || r.sealed.some((x) => x.grey < 8)) fail(`${name}: sealed scar missing`, JSON.stringify(r.sealed))

    if (name === 'phone') {
      // the glitch goes over the box
      await page.evaluate(() => window.__goopsVisor.set({ amount: 0.7 }))
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${OUT}/phone-glitch.png` })
      await page.evaluate(() => window.__goopsVisor.set({ amount: null }))
      // the other goo style sees through the box too
      await page.evaluate(() => window.__goops.gooStyle.setFromSetting('Particle'))
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/phone-particle.png` })
      await page.evaluate(() => window.__goops.gooStyle.setFromSetting('Jelly'))
      await page.waitForTimeout(300)
      // reduce motion (Settings): a calmer stream — fewer bubbles from the same crack
      await page.evaluate(() => document.documentElement.setAttribute('data-reduce-motion', ''))
      await page.waitForTimeout(3000)
      const calm = await page.evaluate(() => window.__goops.bubbles.from(901))
      await page.screenshot({ path: `${OUT}/phone-reduce-motion.png` })
      await page.evaluate(() => document.documentElement.removeAttribute('data-reduce-motion'))
      console.log(`  reduce motion: crack 901 bubbles ${calm} (normal ${r.bubbles[901]})`)
      if (!(calm < r.bubbles[901])) fail('reduce motion did not calm the bubbles')
      // pop the plugged goop for real (the engine seals the crack): the box goes, the spot turns into a scar
      const sealed = await page.evaluate(() => {
        const engine = window.__goops.engine, s = engine.state
        const k = s.cracks.find((c) => c.id === 904)
        engine.act({ type: 'pop', x: k.x, y: k.y })
        return { still: s.cracks.some((c) => c.id === 904), scar: (s.sealedCracks ?? []).some((c) => c.x === k.x && c.y === k.y) }
      })
      await page.waitForTimeout(800)
      const after = await probe(page)
      await page.screenshot({ path: `${OUT}/phone-after-seal.png` })
      console.log(`  after sealing 904: crack left ${sealed.still} · scar ${sealed.scar} · x-ray boxes ${after.xray.length}`)
      if (sealed.still || !sealed.scar) fail('popping the plugged goop did not seal 904 into a scar')
      if (after.xray.length !== 1) fail('the x-ray box stayed after the seal')
      // a sealed crack never leaks: once the bubbles already out have faded, none come from it
      await page.waitForTimeout(3200)
      const fromSealed = await page.evaluate(() => window.__goops.bubbles.from(904))
      console.log(`  sealed 904 bubbles after 4 s: ${fromSealed}`)
      if (fromSealed !== 0) fail('a sealed crack still leaks bubbles')
    }
    if (errors.length) fail(`${name}: console errors:`, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `${failed} problem(s)` : 'cracks-look: all checks passed')
process.exit(failed ? 1 : 0)
