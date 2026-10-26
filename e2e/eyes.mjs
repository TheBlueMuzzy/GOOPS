// The goop's faces (F62): eyes, worried brows and mouths grow on the goop by rank, in both goo styles, the way Muzzy
// approved in the sketch (research/sketches/goop-eyes.html, values content/tuning/eyes.json). Checks, Jelly then Particle:
//   rank 9: no faces at all · rank 20: eyes fade in one clump at a time (not all at once), in most clumps, and their
//   gaze swings toward the falling piece (moved left, then right) · a zap squeezes the neighbours' eyes shut (and the
//   zapped clump's) · the eyes are drawn in the goo's own picture (eye-white pixels where the faces are, none at rank 9)
//   · rank 10: only clumps of minClump10+ cells have eyes, fewer than at 20 · rank 30: brows only once pressure passes
//   worriedAt, then worried brows; they blink · rank 40: mouths, shut most of the time · F45 rank 48 (chorusRank): once
//   chorusMouths mouths show, every mouth opens at once, then shuts; kept as seen, so the next shift doesn't (shots:
//   <style>-rank48-mouths-open-<size>.png).
// The board is set up by hand and the rules held still (the piece hangs where it's put), so the faces are on known clumps.
// Then shots at every portrait size (the game is portrait only), both styles, ranks 10/20/30/40, into e2e-shots/eyes/
// (faces shown at once for the shots: appearSpread 0 sent the way the Dev Kit's Tuning tab sends an edit).
// The faces are read through __goops.faces() (dev only).
// Run: node e2e/eyes.mjs  (own dev server on port 6262)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 6262
const SHOTS = 'e2e-shots/eyes'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
const STYLES = (process.env.STYLES ?? 'Jelly,Particle').split(',') // (STYLES=Jelly: one style only; SHOTS=0: no shots)
const EYES = JSON.parse(readFileSync('content/tuning/eyes.json', 'utf8'))
mkdirSync(SHOTS, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }

// The board, bottom-up in visible columns 0–11 (k), rows counted from the floor. Letters = colours; '.' = empty.
// Clumps: three big ones (1 → 6 cells, 2 → 5, 4 → 6), an L of 4 (3, zapped later), more of 4 and 2, one single cell.
// The rows above stay empty for the piece.
const BOARD = [ // row 3 … row 0
  '...44....11.',
  '55.2..55.11.',
  '111223.42444',
  '111223332444',
]
// set the board up, hold the rules still (no tick: the piece hangs, nothing falls), every clump full and ready
const setup = (page, board) => page.evaluate(async (board) => {
  const { regroup } = await import('/src/engine/groups.ts')
  const engine = window.__goops.engine, s = engine.state
  engine.tick = () => {}
  s.grid.fill(0)
  s.cracks.length = 0
  const vis = (k) => (s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k + s.width) % s.width
  board.forEach((line, i) => {
    const y = s.height - board.length + i
    for (let k = 0; k < line.length; k++) if (line[k] !== '.') s.grid[y * s.width + vis(k)] = Number(line[k])
  })
  regroup(s, engine.book)
  for (const g of s.groups.values()) { g.fill = 1; g.ready = true; engine.book.fillMs.set(g.id, 1e9) }
  engine.setPressure(0.9) // (high enough to zap; ranks under 30 don't worry about it)
  s.rank = 9
}, board)
// the falling piece: two cells side by side over visible column k, 5 rows above the floor (in reach of the eyes)
const placePiece = (page, k) => page.evaluate((k) => {
  const s = window.__goops.engine.state
  const vis = (k) => (s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k + s.width) % s.width
  const y = s.height - 1 - 5
  s.piece.cells = [[vis(k), y], [vis(k + 1), y]]
  s.piece.fall = 0
}, k)
const setRank = (page, r) => page.evaluate((r) => { window.__goops.engine.state.rank = r }, r)
const setPressure = (page, p) => page.evaluate((p) => window.__goops.engine.setPressure(p), p)
const faces = (page) => page.evaluate(() => window.__goops.faces())
const sendEyes = (page, data) => page.evaluate((d) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'eyes', data: d } })), data)
// wait (polling every frame) until the faces pass `test` (a function body over `F` = faces()), or time out → false
const until = (page, test, ms = 20000) => page.waitForFunction((t) => new Function('F', `return (${t})`)(window.__goops.faces()), test, { polling: 'raf', timeout: ms }).then(() => true, () => false)
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
// every face's eyes have finished fading in or out (waits on the goo's own clock, which runs slow under load)
const settled = (F) => F.length > 0 && F.every((f) => (f.due ? f.eyes >= 0.99 : f.eyes === 0))

// The goo canvas's pixels in a box round each point (stage CSS px), read in the frame it's drawn (WebGL), kept in the
// page under `name`; changed(a, b) = how many of those pixels differ clearly between two such pictures
const grab = (page, name, points, r) => page.evaluate(({ name, points, r }) => new Promise((done) => requestAnimationFrame(() => {
  const c = document.querySelector('canvas[data-goo]')
  const g = document.createElement('canvas'); g.width = c.width; g.height = c.height
  const ctx = g.getContext('2d'); ctx.drawImage(c, 0, 0)
  const k = c.width / c.getBoundingClientRect().width
  window.__grabs = window.__grabs ?? {}
  window.__grabs[name] = points.map(([x, y]) => {
    const x0 = Math.max(0, Math.round((x - r) * k)), y0 = Math.max(0, Math.round((y - r) * k)), w = Math.max(1, Math.round(2 * r * k))
    return ctx.getImageData(x0, y0, w, w).data
  })
  done()
})), { name, points, r })
const changed = (page, a, b) => page.evaluate(({ a, b }) => {
  const A = window.__grabs[a], B = window.__grabs[b]
  let n = 0
  A.forEach((d, j) => { for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - B[j][i]) + Math.abs(d[i + 1] - B[j][i + 1]) + Math.abs(d[i + 2] - B[j][i + 2]) > 150) n++ })
  return n
}, { a, b })

async function openShift(w, h, style, rank = 9) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`http://localhost:${PORT}/?seed=7&visor=off&rank=${rank}`)
  await startShift(page)
  await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
  await sleep(400)
  await setup(page, BOARD)
  await placePiece(page, 5)
  await sleep(1200) // the new board's goo springs into place
  return { page, errors }
}

try {
  for (const style of STYLES) {
    const { page, errors } = await openShift(390, 844, style)
    const cellPx = await page.evaluate(() => window.__goops.view.cellPx)

    // --- rank 9: nothing ---
    await sleep(500)
    check(`${style} rank 9: no faces at all`, (await faces(page)).length === 0)

    // --- rank 20: eyes fade in one clump at a time ---
    await setRank(page, 20)
    const firstFull = new Map() // face (its cells) → when its eyes were first fully open (ms since rank 20)
    const t0 = Date.now()
    let all = []
    while (Date.now() - t0 < 30000) {
      all = await faces(page)
      for (const f of all) if (f.eyes >= 0.99 && !firstFull.has(f.cells.join())) firstFull.set(f.cells.join(), Date.now() - t0)
      if (Date.now() - t0 > 500 && settled(all)) break
      await sleep(60)
    }
    const times = [...firstFull.values()].sort((a, b) => a - b)
    const spread = times.length ? times[times.length - 1] - times[0] : 0
    check(`${style} rank 20: eyes fade in one clump at a time (not all at once)`, times.length >= 3 && spread > 500,
      `${times.length} clumps opened their eyes over ${(spread / 1000).toFixed(1)} s: ${times.map((t) => (t / 1000).toFixed(1)).join(', ')}`)
    const big = all.filter((f) => f.size >= EYES.minClump20)
    const eyed20 = big.filter((f) => f.eyes >= 0.99)
    check(`${style} rank 20: eyes in most clumps`, eyed20.length >= big.length / 2 && eyed20.length >= 3, `${eyed20.length} of ${big.length} clumps of ${EYES.minClump20}+ cells`)

    // --- rank 20: they follow the falling piece ---
    const lookingAt = async (k) => {
      await placePiece(page, k)
      await sleep(900)
      const F = await faces(page)
      const piece = await page.evaluate(() => {
        const G = window.__goops, s = G.engine.state, v = G.view
        const p = s.piece.cells
        let d = p[0][0] - v.camera; d = ((d % s.width) + s.width) % s.width; if (d >= s.width / 2) d -= s.width
        const stage = document.querySelector('[data-testid="stage"]').getBoundingClientRect()
        return [v.centreX + (d + 1) * v.cellPx, v.topY + (p[0][1] - s.bufferRows + 0.5) * v.cellPx, stage.left]
      })
      const near = F.filter((f) => f.eyes >= 0.99 && Math.hypot(piece[0] - f.at[0], piece[1] - f.at[1]) / cellPx < EYES.followRange - 0.5)
      const toward = near.filter((f) => {
        const dx = piece[0] - f.at[0], dy = piece[1] - f.at[1], d = Math.hypot(dx, dy)
        return (f.gaze[0] * dx + f.gaze[1] * dy) / d > 0.5 // the gaze points at the piece (a dot product)
      })
      return { near, toward, F }
    }
    const left = await lookingAt(0)
    const right = await lookingAt(10)
    check(`${style} rank 20: the eyes look at the piece on the left`, left.near.length >= 2 && left.toward.length === left.near.length, `${left.toward.length} of ${left.near.length} eyed clumps in reach`)
    check(`${style} rank 20: …and swing to it on the right`, right.near.length >= 2 && right.toward.length === right.near.length, `${right.toward.length} of ${right.near.length}`)
    const swung = left.F.filter((a) => a.eyes >= 0.99 && right.F.some((b) => b.cells.join() === a.cells.join() && Math.sign(b.gaze[0]) !== Math.sign(a.gaze[0]) && Math.abs(b.gaze[0] - a.gaze[0]) > 0.3))
    check(`${style} rank 20: gazes moved with it`, swung.length >= 1, `${swung.length} clumps turned their eyes from left to right`)
    await placePiece(page, 5)
    await sleep(300)

    // --- a zap: the neighbours squeeze their eyes shut ---
    const zap = await page.evaluate(() => {
      const engine = window.__goops.engine, s = engine.state
      const vis = (k) => (s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k + s.width) % s.width
      const x = vis(5), y = s.height - 1 // colour 3's T (bottom row, visible columns 5–7)
      const cells = s.groups.get(s.groupOf[y * s.width + x]).cells
      const near = new Set()
      for (const c of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = Math.floor(c / s.width) + dy, n = ny * s.width + ((c % s.width) + dx + s.width) % s.width
        if (ny >= 0 && ny < s.height && s.grid[n] && !cells.includes(n)) near.add(n)
      }
      return { x, y, cells, near: [...near] }
    })
    const before = (await faces(page)).filter((f) => f.eyes >= 0.99 && f.cells.some((c) => zap.near.includes(c)))
    await page.evaluate(({ x, y }) => window.__goops.engine.act({ type: 'pop', x, y }), zap)
    const shut = await until(page, `F.some((f) => !f.dying && f.shut > 0.9 && f.cells.some((c) => ${JSON.stringify(zap.near)}.includes(c)))`, 3000)
    check(`${style} zap: the clumps touching it squeeze their eyes shut`, before.length > 0 && shut, `${before.length} eyed neighbours`)
    await until(page, 'F.every((f) => f.shut < 0.05 && !f.dying)', 5000)
    check(`${style} zap: …and open them again`, (await faces(page)).every((f) => f.shut < 0.05), '')

    // --- drawn in the goo's own picture: the goo canvas changes where the faces are when they go (rank 9), and
    // hardly at all between two pictures without them ---
    const spots = (await faces(page)).filter((f) => f.eyes >= 0.99).map((f) => f.at)
    const r = cellPx * (EYES.eyeGap / 2 + EYES.eyeSize) + 3
    await grab(page, 'with', spots, r)
    await setRank(page, 9)
    await sleep(300)
    await grab(page, 'without', spots, r)
    await sleep(300)
    await grab(page, 'without2', spots, r)
    const faceNow = await changed(page, 'with', 'without')
    const still = await changed(page, 'without', 'without2')
    check(`${style}: the faces are drawn in the goo canvas`, faceNow > spots.length * 4 && still < faceNow / 5,
      `${faceNow} px change round ${spots.length} faces when they go · ${still} px between two pictures without faces`)
    check(`${style} rank 9 again: no faces`, (await faces(page)).length === 0)

    // --- rank 10: a few, only in big clumps ---
    await setRank(page, 10)
    let small = 0
    const t10 = Date.now()
    while (Date.now() - t10 < 30000) {
      const F = await faces(page)
      small = Math.max(small, F.filter((f) => f.eyes > 0 && f.size < EYES.minClump10).length)
      if (Date.now() - t10 > 500 && settled(F)) break
      await sleep(100)
    }
    const eyed10 = (await faces(page)).filter((f) => f.eyes >= 0.99)
    check(`${style} rank 10: a few eyes, only in clumps of ${EYES.minClump10}+ cells`, small === 0 && eyed10.length >= 1 && eyed10.length < eyed20.length,
      `${eyed10.length} eyed clumps (sizes ${eyed10.map((f) => f.size).join(', ')}) · at 20 there were ${eyed20.length}`)

    // --- rank 30: worried only at high pressure; they blink ---
    await setPressure(page, Math.max(0, EYES.worriedAt - 0.3))
    await setRank(page, 30)
    await sleep(500)
    await until(page, 'F.every((f) => (f.due ? f.eyes >= 0.99 : f.eyes === 0))') // (rank 30: more clumps get eyes again)
    const calm = await faces(page)
    check(`${style} rank 30, pressure under worriedAt: no brows`, calm.every((f) => f.brows === 0), '')
    await setPressure(page, 0.95)
    const worried = await until(page, `F.filter((f) => f.eyes >= 0.99).every((f) => f.brows >= 0.99 && f.worried > 0.5)`, 15000)
    check(`${style} rank 30, pressure ${0.95} ≥ worriedAt: worried brows on every eyed clump`, worried, '')
    const blinked = await until(page, 'F.some((f) => f.eyes >= 0.99 && f.shut > 0.5 && !f.dying)', 10000)
    check(`${style} rank 30: they blink`, blinked, '')

    // --- rank 40: mouths, shut most of the time ---
    await setRank(page, 40)
    const mouths = await until(page, 'F.some((f) => f.mouth >= 0.99)', 15000)
    let samples = 0, talking = 0
    const t40 = Date.now()
    while (Date.now() - t40 < 10000) {
      for (const f of await faces(page)) if (f.mouth >= 0.99) { samples++; if (f.talking) talking++ }
      await sleep(100)
    }
    check(`${style} rank 40: some clumps grow mouths`, mouths, '')
    check(`${style} rank 40: …shut most of the time`, samples > 20 && talking / samples < 0.4, `talking in ${talking} of ${samples} looks (${samples ? Math.round((100 * talking) / samples) : 0}%)`)
    check(`${style}: no page errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }

  // --- F45 (story 48): the first shift from chorusRank, every mouth opens at once — once per device ---
  // (every eyed clump gets a mouth and they show at once: mouthChance 1, appearSpread 0, sent like a Dev Kit edit)
  for (const style of STYLES) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const { page, errors } = await openShift(w, h, style, EYES.chorusRank)
      await sendEyes(page, { ...EYES, appearSpread: 0, mouthChance: 1, talkEvery: 30 })
      await setRank(page, EYES.chorusRank)
      const sang = await until(page, `F.filter((f) => f.mouth >= 0.99).length >= ${EYES.chorusMouths} && F.filter((f) => f.mouth >= 0.99).every((f) => f.chorus > 0.9)`, 15000)
      if (sang) await page.screenshot({ path: `${SHOTS}/${style.toLowerCase()}-rank${EYES.chorusRank}-mouths-open-${w}x${h}.png` })
      check(`${style} ${w}x${h} rank ${EYES.chorusRank}: once ${EYES.chorusMouths}+ mouths show, every mouth opens at once`, sang, '')
      const shut = await until(page, 'F.every((f) => f.chorus === 0)', (EYES.chorusTime + 3) * 1000)
      check(`${style} ${w}x${h}: …then they shut again`, shut, '')
      check(`${style} ${w}x${h}: it's kept as seen on the device`, await page.evaluate(() => JSON.stringify(localStorage).includes('look:mouths-open')), '')
      if (w === 390) { // the next shift: not again
        await page.goto(`http://localhost:${PORT}/?seed=7&visor=off&rank=${EYES.chorusRank}`)
        await startShift(page)
        await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
        await sleep(400)
        await setup(page, BOARD)
        await sendEyes(page, { ...EYES, appearSpread: 0, mouthChance: 1, talkEvery: 30 })
        await setRank(page, EYES.chorusRank)
        await until(page, `F.filter((f) => f.mouth >= 0.99).length >= ${EYES.chorusMouths}`, 10000)
        let again = false
        for (let t = Date.now(); Date.now() - t < 3000; await sleep(100)) if ((await faces(page)).some((f) => f.chorus > 0)) again = true
        check(`${style}: the next shift, the mouths don't all open again`, !again, '')
      }
      check(`${style} ${w}x${h} chorus: no page errors`, errors.length === 0, errors.join(' | '))
      await page.close()
    }
  }

  // --- shots: every portrait size, both styles, ranks 10 / 20 / 30 / 40 (faces shown at once: appearSpread 0) ---
  for (const [w, h] of process.env.SHOTS === '0' ? [] : SIZES)
    for (const style of STYLES) {
      const { page, errors } = await openShift(w, h, style)
      await sendEyes(page, { ...EYES, appearSpread: 0 })
      await placePiece(page, 3)
      for (const rank of [10, 20, 30, 40]) {
        await setPressure(page, rank >= 30 ? 0.95 : 0.4)
        await setRank(page, rank)
        await sleep(200)
        await until(page, 'F.every((f) => (f.due ? f.eyes >= 0.99 : f.eyes === 0))', 5000)
        await sleep(rank === 40 ? 1600 : 900)
        await page.screenshot({ path: `${SHOTS}/${style.toLowerCase()}-rank${rank}-${w}x${h}.png` })
      }
      const F = await faces(page)
      check(`shots ${style} ${w}x${h}: faces showing at rank 40, no page errors`, F.some((f) => f.eyes >= 0.99) && errors.length === 0, errors.join(' | '))
      await page.close()
    }
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
process.exit(failed ? 1 : 0)
