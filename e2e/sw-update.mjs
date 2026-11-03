// THE 1.0 SWITCH, SERVED LIKE GITHUB PAGES (F38 → F54) — no dev server anywhere. A scratch site laid out like the
// real gh-pages branch, a tiny static server, and Playwright's own Chromium (never the user's Chrome):
//   BEFORE = the real gh-pages as it was before the switch (commit LIVE_BEFORE: v1 at /GOOPS/ + the beta v0.2.0.0 at
//   /GOOPS/alpha/, unpacked from git) · AFTER = this build at /GOOPS/, with the forwarder in alpha/ — exactly what
//   scripts/deploy.js publishes (TDD D33).
//   A v1 player (fresh browser, v1's own worker /GOOPS/sw.js + a v1 save)
//     · opens /GOOPS/ after the switch → Goops 2, under ITS worker (goops-sw.js, scope /GOOPS/) — v1's worker
//       replaced, v1's cache deleted, ONE page load (no reload, no loop), a fresh start (v1's save ignored), no errors
//     · the manifest: id / scope / start_url /GOOPS/, full screen, portrait, a maskable icon; iPhone tags
//     · offline: a reload still opens the game (the offline cache)
//     · a new build published underneath (another build number) reaches them on their FIRST visit (registerSW
//       immediate — BMUZ GitHub Pages recipe, Roll Better B020)
//     · the old beta link /GOOPS/alpha/ opened from Goops 2 → back on /GOOPS/ (the forwarder, never the cached game)
//   An installed beta player (fresh browser, the beta's worker at /GOOPS/alpha/ + a rank-7 save)
//     · opens /GOOPS/alpha/ after the switch → their phone shows the old beta a moment, then lands on Goops 2 at
//       /GOOPS/ with rank 7 — the beta's worker unregistered, its caches deleted, settled (no loop), no errors there
//   A newcomer with nothing installed opens /GOOPS/alpha/ → /GOOPS/
//   The Dev Kit in the release build (content/devkit.json "inReleaseBuilds")
//     · ` opens it; every tab is clicked through; NO failed requests (e.g. /__devkit/* that only the dev server has)
//       and NO console errors the whole time
//     · bug capture with no dev server: ● Record, 📍 Mark, a note, Copy for Claude → the clipboard holds the bug file
//       text, with the version in it
// Run: node e2e/sw-update.mjs   (static server on port 5462; builds into e2e-shots/sw-site/, nothing else touched)
// Needs the gh-pages commit LIVE_BEFORE on this computer (git fetch origin gh-pages — deploy.js --dry-run does it).
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { expectedVersion, skipFirstDay } from './start.mjs'
import prog from '../content/tuning/progression.json' with { type: 'json' }

const PORT = 5462
const SITE = 'e2e-shots/sw-site' // the gh-pages branch, in miniature: its files sit under GOOPS/
const BUILDS = 'e2e-shots/sw-builds' // this run's release builds, copied into the site by deploy()
const ROOT = `http://localhost:${PORT}/GOOPS/`
const ALPHA = `${ROOT}alpha/`
const LIVE_BEFORE = 'c5a3187' // gh-pages "Deploy alpha v0.2.0.0" (2026-10-29): the last layout before the switch
const OUT = 'e2e-shots/sw-update'
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

/** The site as it was before the switch: the real gh-pages files at LIVE_BEFORE under GOOPS/. */
function siteBefore() {
  rmSync(SITE, { recursive: true, force: true })
  mkdirSync(`${SITE}/GOOPS`, { recursive: true })
  try {
    execFileSync('git', ['archive', '--format=tar', '-o', `${SITE}/before.tar`, LIVE_BEFORE], { stdio: 'pipe' })
  } catch {
    console.log(`FAIL — gh-pages commit ${LIVE_BEFORE} isn't on this computer: git fetch origin gh-pages:refs/remotes/origin/gh-pages`)
    process.exit(1)
  }
  execFileSync('tar', ['-xf', `${SITE}/before.tar`, '-C', `${SITE}/GOOPS`], { stdio: 'pipe' })
  rmSync(`${SITE}/before.tar`)
}

/** "Deploy": this build (the same vite build `npm run build` makes, without the type check) becomes the whole site —
 *  like deploy.js, nothing of the old site is left (dist/alpha/ = the forwarder). Each build is made once per run. */
function deploy(buildNumber) {
  const built = `${BUILDS}/${buildNumber ?? 'first'}`
  if (!existsSync(built)) {
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', built, '--emptyOutDir', '--logLevel', 'warn'],
      { stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production', ...(buildNumber === undefined ? {} : { VERSION_BUILD: String(buildNumber) }) } })
  }
  rmSync(`${SITE}/GOOPS`, { recursive: true, force: true })
  cpSync(built, `${SITE}/GOOPS`, { recursive: true })
}
rmSync(BUILDS, { recursive: true, force: true })

const first = expectedVersion() // the build number from version.json
const next = `${first.slice(0, first.lastIndexOf('.'))}.9999`
// all the XP to reach a rank (progression.json: xpBase + xpPerRank × rank per rank)
const xpFor = (rank) => { let xp = 0; for (let r = 0; r < rank; r++) xp += prog.xpBase + prog.xpPerRank * r; return xp }
// v1's own save (archive/goops-v1 utils/storage.ts) — Goops 2 never reads it
const V1_SAVE = JSON.stringify({ careerRank: 12, careerScore: 90210, scraps: 4, powerUps: {}, equippedActives: [], unlockedUpgrades: [], firstRunComplete: true, // tuning-ok: a v1 save's own rank
  milestonesReached: [], tutorialProgress: { completedSteps: [] }, settings: { masterVolume: 50, musicVolume: 80, sfxVolume: 100, invertRotation: false } })
// the beta v0.2.0.0's save (version 4 then) at BETA_RANK — a frozen build's player, shown by the beta's own code
const BETA_RANK = 7 // tuning-ok: the beta v0.2.0.0's own save (a frozen build), not the ladder's
const BETA_XP = xpFor(BETA_RANK)
const BETA_SAVE = JSON.stringify({ v: 4, totalXp: BETA_XP, scrapsSpent: 0, owned: {}, equipped: [], badge: null, name: 'Beta', careers: 0 })

// The static server: files only, like GitHub Pages (no /__devkit/* — those exist only on the dev server)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' }
// slowWorkerCheck: ms the beta's worker address (/GOOPS/alpha/sw.js) takes to answer — a phone's network is slower
// than its cache, so on a real phone the old beta usually opens before the new worker arrives
let slowWorkerCheck = 0
const server = createServer((req, res) => {
  let path = normalize(join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(normalize(SITE))) { res.writeHead(403); res.end(); return }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  if (!existsSync(path)) { res.writeHead(404); res.end('not found'); return }
  const body = readFileSync(path)
  const send = () => { res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body) }
  if (slowWorkerCheck && req.url.endsWith('/GOOPS/alpha/sw.js')) setTimeout(send, slowWorkerCheck)
  else send()
})
await new Promise((ok) => {
  server.once('error', (e) => { console.log(`FAIL — port ${PORT} is busy (${e.code}): another sw-update run still going? node ~/.claude/config/bmuz/scripts/stop-servers.mjs ${PORT}`); process.exit(1) })
  server.listen(PORT, ok)
})

const browser = await chromium.launch()
// a fresh browser = a fresh phone; only this site — v1's page asks the internet for Tailwind + Google Fonts
const newPhone = async ({ offTheInternet = false } = {}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] })
  if (offTheInternet) await context.route((url) => !url.href.startsWith(`http://localhost:${PORT}/`), (route) => route.abort())
  return context
}
/** A page's failed requests, errors and main-frame page loads, from now on. */
function watch(page) {
  const w = { failedRequests: [], errors: [], loads: [] }
  page.on('response', (r) => { if (r.status() >= 400) w.failedRequests.push(`${r.status()} ${r.url()}`) })
  page.on('requestfailed', (r) => { if (!r.url().startsWith('data:')) w.failedRequests.push(`failed ${r.url()} (${r.failure()?.errorText})`) })
  page.on('pageerror', (e) => w.errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') w.errors.push(m.text()) })
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) w.loads.push(f.url()) })
  return w
}
const version = (page) => page.locator('meta[name="app-version"]').getAttribute('content', { timeout: 10000 }).catch(() => null)
const consoleRank = (page) => page.locator('.kit-level-meter-level').first().textContent({ timeout: 10000 }).then(Number).catch(() => null)
/** What this browser holds for the site: worker registrations and cache names. */
const onDevice = (page) => page.evaluate(async () => ({
  workers: (await navigator.serviceWorker.getRegistrations()).map((r) => ({ scope: r.scope, script: (r.active ?? r.waiting ?? r.installing)?.scriptURL })),
  caches: await caches.keys(),
  controller: navigator.serviceWorker.controller?.scriptURL ?? null,
}))
const workerIs = (page, file) => page.waitForFunction((f) => navigator.serviceWorker.controller?.scriptURL.endsWith(f), file, { timeout: 30000 }).then(() => true, () => false)

/** An installed beta player: the beta at rank 7 on the old site, then the switch, then they open the beta's address.
 *  slow = ms the new beta worker takes to arrive. On a phone (slow) the old beta opens from the cache first and the
 *  new worker moves it on; on a fast network the new worker can win the race, and the forwarder page moves it on. */
async function betaPlayer({ slow }) {
  const as = slow ? `installed beta (phone network, worker arrives after ${slow} ms)` : 'installed beta (fast network)'
  siteBefore()
  const betaPhone = await newPhone()
  const old = await betaPhone.newPage()
  await skipFirstDay(old)
  await old.goto(ALPHA)
  const betaWorker = await workerIs(old, '/GOOPS/alpha/sw.js')
  await old.evaluate((save) => localStorage.setItem('goops-progress', save), BETA_SAVE)
  await old.reload()
  check(`before: the beta (v0.2.0.0) runs under its own worker at /GOOPS/alpha/ and shows rank ${BETA_RANK}`,
    betaWorker && (await version(old)) === 'v0.2.0.0' && (await consoleRank(old)) === BETA_RANK, `${await version(old)}, rank ${await consoleRank(old)}`)
  await old.waitForTimeout(1500) // its precache is complete (it opens from the phone's cache from now on)
  await old.close()

  deploy()
  slowWorkerCheck = slow
  const beta = await betaPhone.newPage()
  const bw = watch(beta)
  let opened = null // the first page at /GOOPS/alpha/: the old beta from the phone's cache (its worker) or the forwarder
  beta.on('response', (r) => { if (opened === null && r.url() === ALPHA && r.request().isNavigationRequest()) opened = r.fromServiceWorker() ? 'the old beta, from its worker\'s cache' : 'the forwarder, from the network' })
  let landedAt = null // the errors so far belong to the old beta's last moment, not Goops 2
  beta.on('framenavigated', (f) => { if (f === beta.mainFrame() && f.url() === ROOT && landedAt === null) landedAt = bw.errors.length })
  await beta.goto(ALPHA) // the home-screen icon opens the beta's address
  await beta.waitForURL(ROOT, { timeout: 30000 }).catch(() => {})
  await beta.locator('.kit-level-meter-level').first().waitFor({ timeout: 15000 }).catch(() => {})
  await beta.waitForTimeout(3000) // settled?
  const loadsThen = bw.loads.length
  await beta.waitForTimeout(2000)
  slowWorkerCheck = 0
  const betaAfter = await onDevice(beta)
  const betaSave = await beta.evaluate(() => JSON.parse(localStorage.getItem('goops-progress') ?? 'null'))
  if (slow) check(`${as}: the icon opens the old beta from the phone's cache first — the beta's new worker moves it on`, opened === 'the old beta, from its worker\'s cache', opened)
  else console.log(`     (${as}: the first page was ${opened})`)
  check(`${as}: opening /GOOPS/alpha/ lands on Goops 2 at /GOOPS/ (${first})`, beta.url() === ROOT && (await version(beta)) === first, `${beta.url()} ${await version(beta)} · loads: ${bw.loads.join(' → ')}`)
  check(`${as}: the same rank (${BETA_RANK}) — the save came along`, (await consoleRank(beta)) === BETA_RANK && betaSave?.totalXp === BETA_XP, `rank ${await consoleRank(beta)}, totalXp ${betaSave?.totalXp}`)
  check(`${as}: the beta's worker is unregistered and its caches deleted`, !betaAfter.workers.some((r) => r.scope === ALPHA) && !betaAfter.caches.some((k) => k.includes('/GOOPS/alpha/')),
    `${JSON.stringify(betaAfter.workers)} · ${betaAfter.caches.join(', ')}`)
  check(`${as}: settles on /GOOPS/ — no more page loads (no loop)`, bw.loads.length === loadsThen && bw.loads.filter((u) => u === ROOT).length <= 2, bw.loads.join(' → '))
  const goopsErrors = landedAt === null ? bw.errors : bw.errors.slice(landedAt)
  check(`${as}: no errors on Goops 2`, goopsErrors.length === 0, goopsErrors.join(' · '))
  if (landedAt) console.log(`     (the old beta's last moment logged ${landedAt} error(s) before the move — its files are gone from the site: ${bw.errors.slice(0, landedAt).join(' · ').slice(0, 200)})`)
  await beta.screenshot({ path: `${OUT}-beta-player${slow ? '' : '-fast'}.png` })
  await betaPhone.close()
}

try {
  // ======== A v1 player ========
  siteBefore()
  const phone = await newPhone()
  const page = await phone.newPage()
  await skipFirstDay(page) // (the Dev Kit part below wants the plain console; the progress save stays fresh)
  await page.goto(ROOT)
  check('before: v1 runs under its own worker, /GOOPS/sw.js', await workerIs(page, '/GOOPS/sw.js'))
  await page.evaluate((save) => localStorage.setItem('gooptris_save_v3', save), V1_SAVE)
  await page.reload() // a v1 player has been back: v1's worker caches what it serves (the first visit ran without it)
  await page.waitForFunction(async () => (await caches.keys()).some((k) => /^goops-\d+$/.test(k)), null, { timeout: 10000 }).catch(() => {})
  const v1Before = await onDevice(page)
  check('before: v1 keeps its cache "goops-<n>"', v1Before.caches.some((k) => /^goops-\d+$/.test(k)), v1Before.caches.join(', '))

  deploy()
  const w = watch(page)
  await page.goto(ROOT)
  const tookOver = await workerIs(page, '/GOOPS/goops-sw.js')
  await page.locator('.kit-art-stage').waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(3000) // a reload (or a loop) would have shown by now
  const v1After = await onDevice(page)
  check(`v1 player: Goops 2 opens at /GOOPS/ (${first})`, page.url() === ROOT && (await version(page)) === first && await page.locator('.kit-art-stage').isVisible(), `${page.url()} ${await version(page)}`)
  check('v1 player: Goops 2\'s worker took over the /GOOPS/ scope (goops-sw.js) — v1\'s replaced', tookOver && v1After.workers.length === 1
    && v1After.workers[0].scope === ROOT && v1After.workers[0].script === `${ROOT}goops-sw.js`, JSON.stringify(v1After.workers))
  check('v1 player: v1\'s cache is deleted (Goops 2\'s own kept)', !v1After.caches.some((k) => /^goops-\d+$/.test(k)) && v1After.caches.some((k) => k.includes('precache')), v1After.caches.join(', '))
  check('v1 player: ONE page load — no reload, no loop', w.loads.length === 1, w.loads.join(' → '))
  const fresh = await page.evaluate(() => ({ progress: localStorage.getItem('goops-progress'), v1: localStorage.getItem('gooptris_save_v3') }))
  check('v1 player: a fresh start — rank 0, v1\'s save ignored (left as it was)', (await consoleRank(page)) === 0 && fresh.progress === null && fresh.v1 === V1_SAVE, `rank ${await consoleRank(page)}, goops-progress ${fresh.progress}`)

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href
    return { href, ...(await (await fetch(href)).json()) }
  })
  const resolve = (u) => new URL(u, manifest.href).href
  check('manifest: scope and start_url are /GOOPS/', resolve(manifest.scope) === ROOT && resolve(manifest.start_url) === ROOT, `${manifest.scope} → ${resolve(manifest.scope)}`)
  check('manifest: id is /GOOPS/ (v1\'s id — an installed v1 app becomes Goops 2)', resolve(manifest.id) === ROOT, manifest.id)
  check('manifest: full screen, portrait, a maskable icon', manifest.display === 'fullscreen' && manifest.orientation === 'portrait' && manifest.icons.some((i) => i.purpose === 'maskable'))
  check('iPhone tags: apple-mobile-web-app-capable', (await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')) === 'yes')
  await page.waitForTimeout(1000) // let the precache finish
  await page.screenshot({ path: `${OUT}-v1-player.png` })

  // ---- offline: the cache opens the game ----
  await phone.setOffline(true)
  await page.reload()
  await page.locator('.kit-art-stage').waitFor({ timeout: 15000 }).catch(() => {})
  const offlineVersion = await version(page)
  check('offline: a reload still opens the game (console on screen)', await page.locator('.kit-art-stage').isVisible() && offlineVersion === first, offlineVersion)
  await page.screenshot({ path: `${OUT}-offline.png` })
  await phone.setOffline(false)
  check('v1 player + offline: no failed requests', w.failedRequests.length === 0, w.failedRequests.join(' · '))
  check('v1 player + offline: no console errors', w.errors.length === 0, w.errors.join(' · '))

  // ---- a new release published underneath; the player opens the link again ----
  // (Not counted: the old page's last second — its idle-time Dev Kit chunk can be gone from the new build when it
  // asks; the page swaps itself to the new version straight after anyway.)
  deploy(9999)
  await page.goto(ROOT)
  let shown = await version(page)
  const t0 = Date.now()
  for (let i = 0; i < 40 && shown !== next; i++) { await page.waitForTimeout(500); shown = await version(page) }
  // (a worker still "waiting" = the new one never took over: workbox skipWaiting / clientsClaim in vite.config.ts)
  const workers = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return `active ${r?.active?.state}, waiting ${r?.waiting?.state ?? 'none'}` }).catch(() => '?')
  check(`returning player gets the new build on their first visit (${first} → ${next})`, shown === next, `${shown} after ${((Date.now() - t0) / 1000).toFixed(1)} s; ${workers}`)
  await page.locator('.kit-art-stage').waitFor({ timeout: 15000 })

  // ---- the Dev Kit in the release build (no dev server) ----
  const before = { requests: w.failedRequests.length, errors: w.errors.length }
  // the Dev Kit loads once the page is idle (main.tsx, at most 3 s) — wait for it to be there, then press its key (F56:
  // the console now makes the next shift's tank at start-up, so it mounts ~2.1 s in; a fixed 1.5 s wait pressed too soon)
  const kit = page.locator('aside.devkit')
  await kit.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {})
  await page.keyboard.press('Backquote')
  await kit.waitFor({ timeout: 10000 }).catch(() => {})
  check('` opens the Dev Kit in the release build', await kit.isVisible())
  const tabs = kit.locator('[role="tab"]')
  const names = await tabs.allInnerTexts()
  for (let i = 0; i < names.length; i++) {
    await tabs.nth(i).evaluate((tab) => { tab.scrollIntoView({ inline: 'center' }); tab.click() }) // the tab strip scrolls on a phone
    await page.waitForTimeout(400)
    if (await tabs.nth(i).getAttribute('aria-selected') !== 'true') check(`Dev Kit tab "${names[i].trim()}" opens`, false)
  }
  check(`every Dev Kit tab opens (${names.length}: ${names.map((n) => n.trim()).join(', ')})`, names.length >= 5)
  // the Perf tab switches the frame-rate readout on (F38)
  await tabs.filter({ hasText: 'Perf' }).evaluate((tab) => { tab.scrollIntoView({ inline: 'center' }); tab.click() })
  await kit.getByRole('button', { name: 'Show frame rate' }).click()
  await page.waitForTimeout(1200)
  const fps = await page.locator('.fps-meter').textContent().catch(() => null)
  check('Dev Kit Perf tab shows the frame-rate readout', /\d+ fps · worst \d+ ms/.test(fps ?? ''), fps)
  await page.screenshot({ path: `${OUT}-devkit.png` })
  await kit.getByRole('button', { name: 'Hide frame rate' }).click()

  // bug capture: Record → Mark → note → Copy for Claude → the clipboard has the bug file
  await tabs.filter({ hasText: /bug/i }).first().click()
  await kit.getByRole('button', { name: /Record/ }).click()
  await page.waitForTimeout(1500)
  await kit.getByRole('button', { name: /Mark/ }).click()
  await kit.locator('textarea.bc-note').fill('e2e: release-build bug capture')
  await kit.getByRole('button', { name: 'Copy for Claude' }).click()
  await page.waitForTimeout(500)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('bug capture with no dev server: Copy for Claude puts the bug file on the clipboard',
    clip.includes('e2e: release-build bug capture') && clip.includes(next), `${clip.length} chars, has ${next}: ${clip.includes(next)}`)
  check('no Send to /bug button (it needs the dev server)', await kit.getByRole('button', { name: 'Send to /bug' }).count() === 0)
  await kit.getByRole('button', { name: /Stop recording/ }).click().catch(() => {})
  await page.screenshot({ path: `${OUT}-bug.png` })

  const newRequests = w.failedRequests.slice(before.requests), newErrors = w.errors.slice(before.errors)
  check('Dev Kit: no failed requests', newRequests.length === 0, newRequests.join(' · '))
  check('Dev Kit: no console errors', newErrors.length === 0, newErrors.join(' · '))

  // ---- the old beta link from a Goops 2 phone: the forwarder, not the game cached at /GOOPS/ ----
  await page.goto(ALPHA)
  await page.waitForURL(ROOT, { timeout: 15000 }).catch(() => {})
  check('the old link /GOOPS/alpha/ (Goops 2 installed) → back on /GOOPS/', page.url() === ROOT, page.url())
  await phone.close()

  // ======== An installed beta player — on a phone network, and on a fast one ========
  await betaPlayer({ slow: 1500 })
  await betaPlayer({ slow: 0 })

  // ======== A newcomer opens the old link ========
  const newcomer = await newPhone()
  const fresh2 = await newcomer.newPage()
  await fresh2.goto(ALPHA)
  await fresh2.waitForURL(ROOT, { timeout: 15000 }).catch(() => {})
  check('newcomer: /GOOPS/alpha/ → /GOOPS/', fresh2.url() === ROOT && (await version(fresh2)) === first, fresh2.url())
  await newcomer.close()
} catch (e) {
  check('ran to the end', false, `${e.message.split('\n')[0]} (${e.stack?.match(/sw-update\.mjs:\d+/)?.[0] ?? '?'})`)
} finally {
  await browser.close()
  server.close()
}
console.log(failed ? `FAIL — ${failed} check(s)` : 'PASS — v1 players and installed beta players both land on Goops 2 at /GOOPS/ (beta rank kept, v1 retired), it opens offline, updates on the first visit, and its Dev Kit works with no dev server')
process.exit(failed ? 1 : 0)
