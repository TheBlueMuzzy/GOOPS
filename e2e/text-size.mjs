// F76 — TEXT SIZE ON THE CONSOLE (B005): Settings → Accessibility → Text size 100 / 125 / 150 / 200% at every portrait
// size, in Playwright's own Chromium (never the user's Chrome), with the real dev server (a Dev Kit build: RANK SELECT shows).
// Portrait only (Goops never plays sideways): 390x844, 360x780, 1100x800, 1440x900, 1920x1080.
// Two saves: rank 0 (the bug's "Operator rank 0 · 3,500 DUE", Upgrades greyed) and the ladder's noVoices (wider numbers, Upgrades open).
// Each console, checked:
//   the words drawn on the art (version, credit, RANK SELECT) stay inside their art spots (art.json console.words.*.at),
//     and the three on the bottom row never touch each other
//   the rank meter's words stay inside the meter's spot (label and numbers apart, nothing past the window)
//   the monitor's words stay on its screen
//   the Settings gear's centre is the gear (el.contains(elementFromPoint(centre))) — Upgrades never covers it — and the
//     Upgrades button's centre is Upgrades
//   the page is no wider than the window
// And a lesson's line on the monitor (the Upgrades unlock): on the screen, the screen in the window, its words
// growing with Text size (reading text: at least art.json console.crt.wordsMinRem).
// It also prints each one's font size, so a run shows what grew with Text size (reading text) and what kept the art's size.
// Screenshots: e2e-shots/text-size/<size>-<text>-r<rank>.png
// Run: node e2e/text-size.mjs  (own dev server on port 5376; E2E_PORT=… runs it on another)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { checkVersion, skipFirstDay } from './start.mjs'
import { rankOf } from './ladder-ranks.mjs'

const PORT = Number(process.env.E2E_PORT) || 5376, OUT = 'e2e-shots/text-size'
const SIZES = [[390, 844], [360, 780], [1100, 800], [1440, 900], [1920, 1080]]
const settings = JSON.parse(readFileSync('content/ui/settings.json', 'utf8'))
const TEXT_SIZES = settings.tabs.flatMap((tab) => tab.rows).find((row) => row.id === 'textSize').options // 100% … 200%
const prog = JSON.parse(readFileSync('content/tuning/progression.json', 'utf8'))
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += prog.xpBase + prog.xpPerRank * r; return xp }
const MONITOR_MIN_REM = JSON.parse(readFileSync('content/ui/art.json', 'utf8')).console.crt.wordsMinRem ?? 1 // F76: the monitor's words at least this
const HINT = JSON.parse(readFileSync('content/text/en.json', 'utf8')).console.hint // the monitor's words with no lesson up
// (the later save: a two-digit rank past the shop, the ladder's noVoices — F79: asked, not restated)
const LATER = rankOf('noVoices')
const SAVES = [{ rank: 0, totalXp: 0 }, { rank: LATER, totalXp: xpFor(LATER) + 1000 }]
const HAD = ['lesson:first-day', 'lesson:unlock-window', 'lesson:unlock-swap', 'lesson:unlock-upgrades']
mkdirSync(OUT, { recursive: true })

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok, fail) => {
  const t = setTimeout(() => { server.kill(); fail(new Error('dev server did not start')) }, 60000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error(`dev server stopped (port ${PORT} busy?)`)))
})
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0, count = 0
const table = {} // "390x844 r0" → { "200%": failures }
const check = (name, ok, detail = '') => {
  count++
  const [size, text, rank] = name.split(':')[0].split(' '), key = `${size} ${rank}`
  table[key] ??= {}; table[key][text] ??= 0
  if (!ok) { failed++; table[key][text]++; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Everything measured on the console, in the page (px)
function measure() {
  const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom } }
  const words = (el) => { const range = document.createRange(); range.selectNodeContents(el); return r(range) }
  const size = (el) => parseFloat(getComputedStyle(el).fontSize)
  const layers = [...document.querySelectorAll('.kit-art-layer[data-text]')]
  // the words layers (not the meter's, not the monitor's): version, RANK SELECT, credit
  const plain = layers.filter((l) => !l.querySelector('.kit-level-meter, .crt')).map((l) => {
    const button = l.querySelector('button')
    // (a button's words are its label; its tap area is its whole box — 44 px tall, it may spill past a short spot)
    return { name: (button ?? l).textContent.trim(), spot: r(l), words: words(button ?? l), tap: button ? r(button) : null, size: size(button ?? l) }
  })
  const meterLayer = layers.find((l) => l.querySelector('.kit-level-meter'))
  const meter = meterLayer && { spot: r(meterLayer), label: words(meterLayer.querySelector('.kit-level-meter-label')),
    value: words(meterLayer.querySelector('.kit-level-meter-value')), size: size(meterLayer) }
  const crt = document.querySelector('.crt'), lessonWords = crt?.querySelector('.lesson-words')
  const monitor = crt && lessonWords && { screen: r(crt), words: words(lessonWords), size: size(lessonWords) }
  // a button's centre answers as that button (nothing on top of it)
  const hit = (el) => { if (!el) return null; const b = r(el); const at = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); return { box: b, ok: !!at && el.contains(at), at: at ? `${at.tagName.toLowerCase()}.${at.className}` : 'nothing' } }
  return { w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, root: size(document.documentElement), plain, meter, monitor,
    gear: hit(document.querySelector('[data-slot="bottom-right"] button')), upgrades: hit(document.querySelector('[data-tag="upgrades"]')),
    title: r(document.querySelector('.kit-title-art')), gearArt: r(document.querySelector('[data-slot="bottom-right"] button img')) }
}

// words inside a spot: across, all of them (±1 px); down, their middle (one line of letters may stand a px or two
// taller than a thin spot — the letters' own box includes the font's top and bottom room)
const inside = (a, b, slack = 1) => a.left >= b.left - slack && a.right <= b.right + slack && (a.top + a.bottom) / 2 >= b.top && (a.top + a.bottom) / 2 <= b.bottom
const insideAll = (a, b, slack = 1) => a.left >= b.left - slack && a.right <= b.right + slack && a.top >= b.top - slack && a.bottom <= b.bottom + slack
const apart = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
const px = (n) => Math.round(n * 10) / 10
const fonts = {} // `${size} r${rank}` → { text size: font sizes }

try {
  for (const [width, height] of SIZES) {
    for (const save of SAVES) {
      for (const textSize of TEXT_SIZES) {
        const name = `${width}x${height} ${textSize} r${save.rank}`
        const context = await browser.newContext({ viewport: { width, height } })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
        // the device's saved settings (the kit's own slot, as Settings → Text size saves it) and progress, before the game runs
        await page.addInitScript(([textSize, totalXp, seen]) => {
          const folder = location.pathname.split('/').slice(1, -1)[0] ?? ''
          localStorage.setItem(`kit-settings:${folder}`, JSON.stringify({ textSize }))
          localStorage.setItem('goops-progress', JSON.stringify({ v: 2, totalXp, scrapsSpent: 0, owned: {}, equipped: [] }))
          localStorage.setItem(`kit-tips:${folder}`, JSON.stringify({ on: true, seen }))
        }, [textSize, save.totalXp, HAD])
        await skipFirstDay(page)
        await page.goto(`http://localhost:${PORT}/?seed=7`)
        if (width === 390 && textSize === TEXT_SIZES[0] && save.rank === 0) await checkVersion(page)
        await page.locator('.kit-art-stage').waitFor()
        await page.evaluate(() => document.fonts.ready)
        await sleep(2200) // the monitor's words type out, the meter settles
        const m = await page.evaluate(measure)
        await page.screenshot({ path: `${OUT}/${width}x${height}-${textSize.replace('%', '')}-r${save.rank}.png` })

        check(`${name}: Text size is on (root font ${m.root}px)`, Math.abs(m.root - 16 * parseFloat(textSize) / 100) < 0.5, String(m.root))
        check(`${name}: page no wider than the window`, m.scrollW <= m.w, `${m.scrollW} > ${m.w}`)
        for (const p of m.plain) check(`${name}: "${p.name}" inside its art spot`, inside(p.words, p.spot), JSON.stringify({ words: [px(p.words.left), px(p.words.right)], spot: [px(p.spot.left), px(p.spot.right)] }))
        for (let i = 0; i < m.plain.length; i++) for (let j = i + 1; j < m.plain.length; j++)
          check(`${name}: "${m.plain[i].name}" and "${m.plain[j].name}" don't touch`, apart(m.plain[i].tap ?? m.plain[i].words, m.plain[j].tap ?? m.plain[j].words))
        if (m.meter) {
          check(`${name}: the meter's words inside its spot`, inside(m.meter.label, m.meter.spot) && inside(m.meter.value, m.meter.spot), JSON.stringify({ label: px(m.meter.label.right), value: px(m.meter.value.right), spot: px(m.meter.spot.right) }))
          check(`${name}: the meter's label and numbers apart`, m.meter.label.right + 2 <= m.meter.value.left, `${px(m.meter.label.right)} vs ${px(m.meter.value.left)}`)
          check(`${name}: the meter inside the window`, m.meter.value.right <= m.w - 4, `${px(m.meter.value.right)} > ${m.w - 4}`)
        } else check(`${name}: the meter is there`, false)
        if (m.monitor) check(`${name}: the monitor's words on its screen`, insideAll(m.monitor.words, m.monitor.screen), JSON.stringify({ words: m.monitor.words, screen: m.monitor.screen }))
        else check(`${name}: the monitor's words are there`, false)
        check(`${name}: the gear's centre is the gear`, !!m.gear?.ok, m.gear?.at)
        // breathing room on the bottom row: the gear's picture 4 px+ from Upgrades and from the title (measured to the
        // drawn edges), their tap areas never overlapping, all inside the window
        const room = (a, b) => apart({ left: a.left - 4, right: a.right + 4, top: a.top - 4, bottom: a.bottom + 4 }, b)
        if (m.gear && m.upgrades) {
          check(`${name}: the gear and Upgrades 4 px+ apart`, room(m.gearArt, m.upgrades.box), JSON.stringify({ gear: m.gearArt, upgrades: m.upgrades.box }))
          check(`${name}: the gear's and Upgrades' tap areas don't overlap`, apart(m.gear.box, m.upgrades.box), JSON.stringify({ gear: m.gear.box, upgrades: m.upgrades.box }))
        }
        if (m.gear) check(`${name}: the gear and the title 4 px+ apart`, room(m.gearArt, m.title), JSON.stringify({ gear: m.gearArt, title: m.title }))
        for (const [part, b] of [['gear', m.gear?.box], ['Upgrades', m.upgrades?.box], ['title', m.title]])
          if (b) check(`${name}: the ${part} inside the window`, b.left >= 4 && b.right <= m.w - 4 && b.bottom <= m.h - 4, JSON.stringify(b))
        check(`${name}: the Upgrades button's centre is Upgrades`, !!m.upgrades?.ok, m.upgrades?.at)
        check(`${name}: no page errors`, !errors.length, errors.join(' | '))
        const key = `${width}x${height} r${save.rank}`
        fonts[key] ??= {}
        fonts[key][textSize] = [...m.plain.map((p) => px(p.size)), px(m.meter?.size ?? 0), px(m.monitor?.size ?? 0)].join('/')
        await context.close()
      }
    }
    // a lesson's line on the monitor (the Upgrades unlock, at the later save, not seen yet — it outlines the button): a long line;
    // the reading text grows with Text size, the screen slides down to hold it; its words (and a Got it, if one shows)
    // stay on the screen
    for (const textSize of TEXT_SIZES) {
      const name = `${width}x${height} ${textSize} lesson`
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.addInitScript(([textSize, totalXp, seen]) => {
        const folder = location.pathname.split('/').slice(1, -1)[0] ?? ''
        localStorage.setItem(`kit-settings:${folder}`, JSON.stringify({ textSize }))
        localStorage.setItem('goops-progress', JSON.stringify({ v: 2, totalXp, scrapsSpent: 0, owned: {}, equipped: [] }))
        localStorage.setItem(`kit-tips:${folder}`, JSON.stringify({ on: true, seen }))
      }, [textSize, SAVES[1].totalXp, HAD.filter((id) => id !== 'lesson:unlock-upgrades')])
      await page.goto(`http://localhost:${PORT}/?seed=7`)
      await page.locator('.crt .lesson-words').waitFor({ timeout: 15000 }).catch(() => {})
      await sleep(4000) // the line types out
      const l = await page.evaluate((hint) => {
        const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom } }
        const crt = document.querySelector('.crt'), words = crt?.querySelector('.lesson-words'), gotIt = crt?.querySelector('.kit-button')
        if (!crt || !words || words.textContent.trim() === hint) return null // (the hint = the lesson isn't up)
        const range = document.createRange(); range.selectNodeContents(words)
        return { screen: r(crt), words: r(range), gotIt: gotIt ? r(gotIt) : null, size: parseFloat(getComputedStyle(words).fontSize), w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth }
      }, HINT)
      await page.screenshot({ path: `${OUT}/${width}x${height}-${textSize.replace('%', '')}-lesson.png` })
      check(`${name}: the lesson's line is on the monitor`, !!l)
      if (l) {
        check(`${name}: the lesson's words on the screen`, insideAll(l.words, l.screen), JSON.stringify({ words: l.words, screen: l.screen }))
        if (l.gotIt) check(`${name}: Got it on the screen`, insideAll(l.gotIt, l.screen), JSON.stringify({ gotIt: l.gotIt, screen: l.screen }))
        check(`${name}: the screen inside the window`, l.screen.bottom <= l.h - 4 && l.scrollW <= l.w, JSON.stringify({ bottom: l.screen.bottom, h: l.h }))
        check(`${name}: the lesson's words grow with Text size (${l.size}px)`, l.size >= MONITOR_MIN_REM * 16 * parseFloat(textSize) / 100 - 0.1, String(l.size))
      }
      check(`${name}: no page errors`, !errors.length, errors.join(' | '))
      await context.close()
    }
  }
} finally {
  await browser.close()
  server.kill()
}
// what grew with Text size: font px of version / RANK SELECT / credit / meter / monitor at each Text size
console.log('font px (version/RANK SELECT/credit/meter/monitor):')
for (const [key, row] of Object.entries(fonts)) console.log(`  ${key}: ${TEXT_SIZES.map((t) => `${t} ${row[t]}`).join(' · ')}`)
console.log('failures by size and Text size:')
for (const [key, row] of Object.entries(table)) console.log(`  ${key}: ${TEXT_SIZES.map((t) => `${t} ${row[t] ? `${row[t]} ✗` : 'ok'}`).join(' · ')}`)
console.log(failed ? `${failed} of ${count} checks FAILED` : `ALL PASS (${count} checks)`)
process.exit(failed ? 1 : 0)
