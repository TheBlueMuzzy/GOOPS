// F39 rank twists in a real shift (Jelly; Particle at 1440). Checks:
//   rank 20: a two-colour piece falls (glowing) and locks as two clumps, each cell its own colour
//   rank 31 (grow.fromRank): a crack grows over several cells; covering all but one doesn't plug it (popping there seals nothing);
//            covering every cell plugs it; one pop seals it whole and the quota counts its cell count
//   rank 40: a wild piece falls and locks in the wild look; wild goop on a crack of another colour plugs + seals it;
//            a normal piece landing on a wild clump turns the whole clump its colour; faces never doubled
//   no page errors anywhere. Shots at every portrait size into e2e-shots/twists/.
// The numbers are pushed the way the Dev Kit sends an edit (twists.json: chance 1 / fast growth) so it doesn't wait on
// luck; the shift's own cracks + machine wear are off so the board stays readable.
// Run: node e2e/twists.mjs  (own dev server on port 6420)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 6420
const SHOTS = 'e2e-shots/twists'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]].filter(([w]) => !process.env.ONLY || process.env.ONLY === String(w)) // (ONLY=1440: one size)
const WILD = 255
const TWISTS = JSON.parse(readFileSync('content/tuning/twists.json', 'utf8'))
mkdirSync(SHOTS, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(ok ? '✓' : '✗', name, detail); if (!ok) failed++ }
const sendTwists = (page, patch) => page.evaluate((d) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: 'twists', data: d } })),
  { ...TWISTS, ...patch, split: { ...TWISTS.split, ...patch.split }, grow: { ...TWISTS.grow, ...patch.grow }, wild: { ...TWISTS.wild, ...patch.wild } })
const until = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { polling: 'raf', timeout: ms }).then(() => true, () => false)

async function open(w, h, rank, style = 'Jelly') {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?rank=${rank}&seed=11`)
  await startShift(page)
  if (style !== 'Jelly') await page.evaluate((st) => window.__goops.gooStyle.setFromSetting(st), style)
  await page.evaluate(() => {
    const e = window.__goops.engine
    e.growCracks = () => {} // (the shift's own new cracks — growing ones are twists.ts, still on)
    e.machines.tick = () => {}
    e.state.cracks.length = 0
    e.setPressure(0.85) // the pop line high, so the test's goop can pop and cracks can grow up
    window.__locks = [] // every lock event, as the screen takes them
    const take = e.takeEvents.bind(e)
    e.takeEvents = () => { const ev = take(); for (const x of ev) if (x.type === 'lock') window.__locks.push(x); return ev }
  })
  return { page, errors }
}

// the next piece that passes `test` (piece => bool, as a function body over P): fast-drop the others away
async function waitPiece(page, test) {
  await page.evaluate(() => window.__goops.fastDrop(true))
  const ok = await until(page, (t) => { const P = window.__goops.engine.state.piece; return !!P && new Function('P', `return (${t})`)(P) }, test, 25000)
  await page.evaluate(() => window.__goops.fastDrop(false))
  return ok
}
// let the falling piece come a few rows down into view (for the shot)
const inView = (page) => until(page, () => {
  const s = window.__goops.engine.state
  return !!s.piece && Math.min(...s.piece.cells.map(([, y]) => y)) >= s.bufferRows + 3
}, null, 15000)
// fast-drop the falling piece and wait for its lock; returns the lock event
async function dropAndLock(page) {
  const n = await page.evaluate(() => window.__locks.length)
  await page.evaluate(() => window.__goops.fastDrop(true))
  await until(page, (n) => window.__locks.length > n, n, 15000)
  await page.evaluate(() => window.__goops.fastDrop(false))
  return page.evaluate((n) => window.__locks[n], n)
}
// the goop's faces: none share a cell, and each sits on one colour
const facesOk = (page) => page.evaluate(() => {
  const s = window.__goops.engine.state, seen = new Set()
  for (const f of window.__goops.faces()) {
    if (f.dying) continue
    for (const c of f.cells) { if (seen.has(c)) return `cell ${c} has two faces`; seen.add(c) }
    if (new Set(f.cells.map((c) => s.grid[c])).size > 1) return `a face over ${[...new Set(f.cells.map((c) => s.grid[c]))]}`
  }
  return ''
})

try {
  for (const [w, h] of SIZES) {
    const tag = `${w}x${h}`
    const main = w === 1440

    // ---------------- rank 20: two-colour pieces
    {
      const { page, errors } = await open(w, h, 20)
      await sendTwists(page, { split: { chance: 1 } })
      check(`${tag} r20: a two-colour piece comes`, await waitPiece(page, 'new Set(P.colors).size === 2'))
      await inView(page)
      await page.screenshot({ path: `${SHOTS}/r20-falling-${tag}.png` })
      const lock = await dropAndLock(page)
      const got = await page.evaluate((lock) => {
        const s = window.__goops.engine.state
        return { own: lock.cells.every((c, k) => s.grid[c] === lock.colors[k]), groups: new Set(lock.cells.map((c) => s.groupOf[c])).size, colours: new Set(lock.colors).size }
      }, lock)
      check(`${tag} r20: it locks as two colours, each cell its own`, !!lock && got.colours === 2 && got.own, JSON.stringify(got))
      check(`${tag} r20: … as two clumps (at least two groups)`, got.groups >= 2, String(got.groups))
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/r20-locked-${tag}.png` })
      check(`${tag} r20: no page errors`, errors.length === 0, errors.join(' | '))
      await page.close()
    }

    // ---------------- rank 30: a crack grows; sealed only when every cell is covered; counts its size
    {
      const { page, errors } = await open(w, h, TWISTS.grow.fromRank)
      await page.evaluate(() => { window.__goops.engine.fallPiece = () => {} }) // the piece hangs at the top
      await sendTwists(page, { grow: { everyMsMin: 300, everyMsMax: 400, baseChance: 1, leafMult: 1, hopFalloff: 0, minFalloff: 1 } })
      const id = await page.evaluate(async () => {
        const { regroup } = await import('/src/engine/groups.ts')
        const e = window.__goops.engine, s = e.state
        s.grid.fill(0)
        regroup(s, e.book)
        const x = s.spin, y = s.height - 1 // the floor of the middle column
        s.cracks.push({ id: 9300, x, y, color: 1, plugged: false })
        return 9300
      })
      check(`${tag} r30: the crack grows to 3+ cells`, await until(page, (id) => (window.__goops.engine.state.cracks.find((c) => c.id === id)?.cells?.length ?? 1) >= 3, id, 15000))
      await sendTwists(page, { grow: { fromRank: 99 } }) // stop it there
      // hold the rules (the Dev Kit's half pause): the test's goop doesn't fall or refill; the looks keep moving
      await page.evaluate(async () => (await import('/src/devkit/gameClock.ts')).setClockPause('half'))
      await page.waitForTimeout(300)
      await page.screenshot({ path: `${SHOTS}/r30-grown-${tag}.png` })
      // cover all but one cell with its colour: not plugged; popping there seals nothing
      const r1 = await page.evaluate(async (id) => {
        const { regroup } = await import('/src/engine/groups.ts')
        const { updatePlugs } = await import('/src/engine/cracks.ts')
        const e = window.__goops.engine, s = e.state, c = s.cracks.find((k) => k.id === id)
        const cells = c.cells.slice()
        for (const [x, y] of cells.slice(0, -1)) s.grid[y * s.width + x] = 1
        regroup(s, e.book)
        for (const g of s.groups.values()) { g.fill = 1; e.book.fillMs.set(g.id, 1e9) }
        updatePlugs(s, [])
        return { size: cells.length, plugged: c.plugged, sealed: s.cracksSealed, cell: cells[0] }
      }, id)
      check(`${tag} r30: all but one cell covered → not plugged`, r1.plugged === false)
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${SHOTS}/r30-partly-covered-${tag}.png` })
      const r2 = await page.evaluate(({ id, cell }) => {
        const e = window.__goops.engine, s = e.state
        e.act({ type: 'pop', x: cell[0], y: cell[1] })
        return { still: s.cracks.some((k) => k.id === id), sealed: s.cracksSealed, gone: s.grid[cell[1] * s.width + cell[0]] === 0, why: e.rejectReason, line: s.pressureRow, cell }
      }, { id, cell: r1.cell })
      check(`${tag} r30: popping there pops the goop but seals nothing`, r2.gone && r2.still && r2.sealed === r1.sealed, JSON.stringify(r2))
      // every cell covered: plugged; one pop seals it whole and counts its size
      const r3 = await page.evaluate(async (id) => {
        const { regroup } = await import('/src/engine/groups.ts')
        const { updatePlugs } = await import('/src/engine/cracks.ts')
        const e = window.__goops.engine, s = e.state, c = s.cracks.find((k) => k.id === id)
        for (const [x, y] of c.cells) s.grid[y * s.width + x] = 1
        regroup(s, e.book)
        for (const g of s.groups.values()) { g.fill = 1; e.book.fillMs.set(g.id, 1e9) }
        updatePlugs(s, [])
        return { plugged: c.plugged, sealed: s.cracksSealed, cell: c.cells[0], size: c.cells.length }
      }, id)
      check(`${tag} r30: every cell covered → plugged`, r3.plugged === true)
      await page.waitForTimeout(250)
      await page.screenshot({ path: `${SHOTS}/r30-covered-${tag}.png` })
      const r4 = await page.evaluate(({ id, cell }) => {
        const e = window.__goops.engine, s = e.state
        e.act({ type: 'pop', x: cell[0], y: cell[1] })
        return { still: s.cracks.some((k) => k.id === id), sealed: s.cracksSealed, scars: s.sealedCracks.filter((k) => k.id === id).length }
      }, { id, cell: r3.cell })
      check(`${tag} r30: one pop seals it whole`, !r4.still && r4.scars === r3.size, JSON.stringify(r4))
      check(`${tag} r30: the quota counts its ${r3.size} cells`, r4.sealed === r3.sealed + r3.size, `${r3.sealed} → ${r4.sealed}`)
      // let the rules run again (the zap's beam + spray run on the goo's clock, which the half pause holds)
      await page.evaluate(async () => (await import('/src/devkit/gameClock.ts')).setClockPause(null))
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${SHOTS}/r30-sealed-${tag}.png` })
      check(`${tag} r30: no page errors`, errors.length === 0, errors.join(' | '))
      await page.close()
    }

    // ---------------- rank 40: wild goop (Jelly everywhere; Particle too at 1440)
    for (const style of main ? ['Jelly', 'Particle'] : ['Jelly']) {
      const st = style === 'Jelly' ? '' : '-particle'
      const { page, errors } = await open(w, h, 40, style)
      await sendTwists(page, { split: { chance: 0 }, wild: { chance: 1 } })
      check(`${tag}${st} r40: a wild piece comes`, await waitPiece(page, `P.colors.every((c) => c === ${WILD})`))
      await inView(page)
      await page.screenshot({ path: `${SHOTS}/r40-wild-falling${st}-${tag}.png` })
      const lock = await dropAndLock(page)
      check(`${tag}${st} r40: it locks as wild goop`, !!lock && (await page.evaluate((l) => l.cells.every((c) => window.__goops.engine.state.grid[c] === 255), lock)))
      // a crack of a real colour under one of its cells: wild plugs it, and a pop seals it
      const seal = await page.evaluate(async (lock) => {
        const { regroup } = await import('/src/engine/groups.ts')
        const { updatePlugs } = await import('/src/engine/cracks.ts')
        const e = window.__goops.engine, s = e.state
        const low = lock.cells.reduce((a, b) => (b > a ? b : a)) // its lowest cell
        const x = low % s.width, y = Math.floor(low / s.width)
        s.cracks.push({ id: 9400, x, y, color: 2, plugged: false })
        regroup(s, e.book)
        for (const g of s.groups.values()) { g.fill = 1; e.book.fillMs.set(g.id, 1e9) }
        updatePlugs(s, [])
        const plugged = s.cracks.find((c) => c.id === 9400).plugged
        const before = s.cracksSealed
        e.act({ type: 'pop', x, y })
        return { plugged, sealed: !s.cracks.some((c) => c.id === 9400) && s.cracksSealed === before + 1 }
      }, lock)
      check(`${tag}${st} r40: wild goop plugs a crack of another colour`, seal.plugged)
      check(`${tag}${st} r40: … and popping it seals the crack`, seal.sealed)
      // a wild clump under where the next (normal) piece lands: it takes the piece's colour
      await sendTwists(page, { split: { chance: 0 }, wild: { chance: 0 } })
      check(`${tag}${st} r40: a normal piece comes`, await waitPiece(page, `P.colors.every((c) => c !== ${WILD})`))
      const clump = await page.evaluate(async () => {
        const { regroup } = await import('/src/engine/groups.ts')
        const e = window.__goops.engine, s = e.state
        e.fallPiece = () => {} // hold it while the clump goes in under its landing spot
        const out = []
        // the piece's landing cells that rest on something go wild (so nothing loose falls away); it lands on them
        for (const [x, y] of s.ghost) {
          if (y + 1 < s.height && !s.grid[(y + 1) * s.width + x]) continue
          s.grid[y * s.width + x] = 255
          out.push(y * s.width + x)
        }
        regroup(s, e.book)
        return out
      })
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/r40-wild-clump${st}-${tag}.png` })
      await page.evaluate(() => { const e = window.__goops.engine; delete e.fallPiece })
      const lock2 = await dropAndLock(page)
      const turned = await page.evaluate(({ clump, lock }) => {
        const s = window.__goops.engine.state
        return clump.length > 0 && clump.every((c) => s.grid[c] !== 255 && lock.colors.includes(s.grid[c]))
      }, { clump, lock: lock2 })
      check(`${tag}${st} r40: the wild clump turns the landing piece's colour`, turned, `clump ${clump.length}`)
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${SHOTS}/r40-turned${st}-${tag}.png` })
      const faces = await facesOk(page)
      check(`${tag}${st} r40: faces: none doubled, each on one colour`, faces === '', faces)
      if (main && style === 'Jelly') {
        // the white goop seals a grown crack whole: his ring goes round the whole crack, not its root
        const id = await page.evaluate(() => {
          const e = window.__goops.engine, s = e.state, v = s.vet
          if (!v) return null
          e.fallPiece = () => {}
          s.cracks.length = 0
          for (const dx of [2, -2, 3, -3]) {
            const x = (v.x + dx + s.width) % s.width, x2 = (x + Math.sign(dx) + s.width) % s.width, y = v.y
            const free = (cx, cy) => cy < s.height && cy > s.bufferRows && !s.grid[cy * s.width + cx]
            if (!free(x, y) || !free(x2, y) || !free(x2, y - 1)) continue
            s.cracks.push({ id: 9500, x, y, color: 3, plugged: false, cells: [[x, y], [x2, y], [x2, y - 1]], parent: [-1, 0, 1], growMs: [1e9, 1e9, 1e9] })
            return 9500
          }
          return null
        })
        if (id === null) check(`${tag} r40: room for a grown crack beside the white goop`, false)
        else {
          // (~9 s of game time; under check:full load — since final-shift + ending joined it — 20 s of wall time wasn't
          // enough, B004: a roomy cap on a condition costs nothing when the PC isn't busy)
          const sealing = await until(page, () => { const v = window.__goops.white(); return v && v.mode === 'seal' && v.seal > 0.35 }, null, 60000)
          check(`${tag} r40: the white goop seals a grown crack`, sealing)
          await page.screenshot({ path: `${SHOTS}/r40-white-ring-${tag}.png` })
        }
        await page.evaluate(() => { delete window.__goops.engine.fallPiece })
      }
      // compare (the sketch's Compare): each goop colour in a 2×2 next to a wild 2×2 — wild must read as none of them
      await page.evaluate(async () => {
        const { regroup } = await import('/src/engine/groups.ts')
        ;(await import('/src/devkit/gameClock.ts')).setClockPause('half')
        const e = window.__goops.engine, s = e.state
        s.grid.fill(0)
        s.cracks.length = 0
        const vis = (k) => (s.spin - (Math.ceil(s.visibleWidth / 2) - 1) + k + s.width) % s.width
        const put = (k, row, c) => { s.grid[(s.height - 1 - row) * s.width + vis(k)] = c }
        for (let c = 1; c <= 7; c++) {
          const k = c % 2 ? 0 : 6, row = Math.floor((c - 1) / 2) * 3
          for (const [dk, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { put(k + dk, row + dr, c); put(k + 2 + dk, row + dr, 255) }
        }
        regroup(s, e.book)
        for (const g of s.groups.values()) { g.fill = 1; e.book.fillMs.set(g.id, 1e9) }
      })
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${SHOTS}/r40-compare${st}-${tag}.png` })
      check(`${tag}${st} r40: no page errors`, errors.length === 0, errors.join(' | '))
      await page.close()
    }
  }
} catch (e) {
  console.log('✗ crashed:', e.message)
  failed++
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nALL PASS')
process.exit(failed ? 1 : 0)
