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
// Run: node e2e/upgrades.mjs  (own dev server on port 5345)
import { chromium } from 'playwright-core'
import { checkVersion, skipFirstDay } from './start.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT = 5345, OUT = 'e2e-shots/upgrades', SCRATCH = join(homedir(), 'Documents', 'dev', '.scratch', 'goops-upgrades')
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

try {
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
} finally {
  await browser.close()
  try { server.kill() } catch { /* gone */ }
}
console.log(failed ? `\nFAIL ${failed} check(s)` : '\nok — the Upgrades screen buys, saves, takes back and equips')
process.exit(failed ? 1 : 0)
