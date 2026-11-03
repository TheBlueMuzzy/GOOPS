// F78 — ONE RANK LADDER FILE (content/tuning/ladder.json): every rank gate is a named beat the game asks by name.
// In a real browser with the real dev server, at 390x844 and 1440x900:
//   - each probed beat changes the game AT its rank and not the rank below (?rank=): the 5th colour (fifthColour), the
//     laser can break (laserBreaks), the white goop is in the tank (whiteGoop), wild goop falls (wildGoop — twists.json
//     wild.chance pushed to 1 the way the Dev Kit sends an edit, so it doesn't wait on luck)
//   - a LIVE move through the Dev Kit's Tuning tab: at rankOf('wildGoop') − 1, type that rank into beats.wildGoop's
//     box — the running shift's next pieces are wild, no reload
//   - no page errors anywhere. Shots: e2e-shots/ladder/ (the Tuning tab's ladder rows at both sizes).
// The ranks come from ladder.json — this script restates none.
// Run: node e2e/ladder.mjs  (own dev server on port 5397) · npm run e2e:ladder
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const PORT = 5397, OUT = 'e2e-shots/ladder'
const SIZES = [[390, 844], [1440, 900]]
const WILD = 255
const LADDER = JSON.parse(readFileSync('content/tuning/ladder.json', 'utf8'))
const TWISTS = JSON.parse(readFileSync('content/tuning/twists.json', 'utf8'))
const rankOf = (beat) => LADDER.beats[beat]
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
})
const browser = await chromium.launch()
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }
const until = (page, fn, arg, ms = 20000) => page.waitForFunction(fn, arg, { polling: 'raf', timeout: ms }).then(() => true, () => false)
const send = (page, file, data) => page.evaluate(([f, d]) => window.dispatchEvent(new CustomEvent('devkit:tuning', { detail: { file: f, data: d } })), [file, data])

async function open(w, h, rank) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?rank=${rank}&seed=11`)
  await startShift(page)
  await page.evaluate(() => {
    const e = window.__goops.engine
    e.growCracks = () => {} // (a calm board: no new cracks, no wear)
    e.machines.tick = () => {}
    window.__locks = []
    window.__sameDocument = true // gone if the page reloads
    const take = e.takeEvents.bind(e)
    e.takeEvents = () => { const ev = take(); for (const x of ev) if (x.type === 'lock') window.__locks.push(x); return ev }
  })
  return { page, errors }
}
const probe = (page) => page.evaluate(() => {
  const e = window.__goops.engine, s = e.state
  return { rank: s.rank, colours: e.colorCount, laser: s.machines.laser.unlocked, vet: !!s.vet }
})
// fast-drop `n` pieces; the colours of each one that locked
async function dropPieces(page, n) {
  const from = await page.evaluate(() => window.__locks.length)
  await page.evaluate(() => { window.__goops.engine.setPressure(0); window.__goops.fastDrop(true) })
  await until(page, ([from, n]) => window.__locks.length >= from + n, [from, n], 25000)
  await page.evaluate(() => window.__goops.fastDrop(false))
  return page.evaluate((from) => window.__locks.slice(from).map((l) => l.colors), from)
}
const someWild = (colors) => colors.some((c) => c.every((x) => x === 255)) // (corrupt pieces are never wild; the falling + next pieces were made before the edit)
const noneWild = (colors) => colors.length > 0 && colors.every((c) => !c.includes(255))

try {
  // ---- each beat at its rank, not the one below ----
  const [w, h] = SIZES[0]
  for (const [beat, what, value] of [
    ['fifthColour', 'colours in play', (p) => p.colours],
    ['laserBreaks', 'the laser can break', (p) => p.laser],
    ['whiteGoop', 'the white goop is in the tank', (p) => p.vet],
  ]) {
    const r = rankOf(beat)
    const below = await open(w, h, r - 1), at = await open(w, h, r)
    const a = await probe(below.page), b = await probe(at.page)
    check(`${beat} (${r}): ${what} changes at ${r}, not at ${r - 1}`, a.rank === r - 1 && b.rank === r && value(a) !== value(b),
      `${r - 1}: ${value(a)} · ${r}: ${value(b)}`)
    for (const x of [below, at]) { check(`${beat}: no page errors`, x.errors.length === 0, x.errors.join(' | ')); await x.page.close() }
  }
  {
    const r = rankOf('wildGoop'), always = { ...TWISTS, wild: { ...TWISTS.wild, chance: 1 } }
    const below = await open(w, h, r - 1), at = await open(w, h, r)
    for (const x of [below, at]) await send(x.page, 'twists', always)
    const before = await dropPieces(below.page, 5), after = await dropPieces(at.page, 5)
    check(`wildGoop (${r}): no wild piece at ${r - 1} (chance 1)`, noneWild(before), JSON.stringify(before))
    check(`wildGoop (${r}): wild pieces at ${r}`, someWild(after), JSON.stringify(after))
    for (const x of [below, at]) { check('wildGoop: no page errors', x.errors.length === 0, x.errors.join(' | ')); await x.page.close() }
  }

  // ---- a live move through the Dev Kit's Tuning tab ----
  for (const [w, h] of SIZES) {
    const r = rankOf('wildGoop')
    const { page, errors } = await open(w, h, r - 1)
    await send(page, 'twists', { ...TWISTS, wild: { ...TWISTS.wild, chance: 1 } })
    check(`${w}x${h}: at ${r - 1} nothing is wild yet`, noneWild(await dropPieces(page, 2)))
    await page.keyboard.press('Backquote')
    await page.locator('aside.devkit').waitFor({ timeout: 5000 })
    await page.locator('aside.devkit [role="tab"]', { hasText: 'Tuning' }).first().click()
    await page.locator('aside.devkit input[type="search"], aside.devkit input[placeholder^="Search"]').first().fill('wildGoop')
    const box = page.locator('aside.devkit input.tt-number[aria-label="beats.wildGoop"]')
    const found = await box.waitFor({ timeout: 5000 }).then(() => true, () => false)
    check(`${w}x${h}: the Tuning tab shows ladder.json's beats.wildGoop (${r})`, found && Number(await box.inputValue()) === r, found ? await box.inputValue() : 'not found')
    await page.screenshot({ path: `${OUT}/tuning-wildGoop-${w}x${h}.png` })
    if (found) {
      await box.fill(String(r - 1))
      await page.waitForTimeout(200)
      await page.keyboard.press('Backquote') // (the kit closes; the shift goes on)
      await page.waitForTimeout(300)
      const later = await dropPieces(page, 5)
      check(`${w}x${h}: moved to ${r - 1} live — the running shift's next pieces are wild`, someWild(later), JSON.stringify(later))
      check(`${w}x${h}: … without a reload`, await page.evaluate(() => window.__sameDocument === true))
    }
    check(`${w}x${h}: no page errors`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
} finally {
  await browser.close()
  server.kill()
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll ladder checks passed')
process.exit(failed ? 1 : 0)
