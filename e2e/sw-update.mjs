// THE RELEASE BUILD, SERVED LIKE GITHUB PAGES (F38) — no dev server anywhere. Builds the game twice into a scratch
// site laid out like the real gh-pages branch, serves it with a tiny static server, and checks in Playwright's own
// Chromium (never the user's Chrome):
//   Install + offline (TDD D17)
//     · a stand-in v1 at /GOOPS/ registers ITS service worker first (scope /GOOPS/, like the live v1)
//     · the alpha at /GOOPS/alpha/ registers its own (scope /GOOPS/alpha/) and that one runs the alpha page
//     · the manifest says scope / id /GOOPS/alpha/, full screen, a maskable icon
//     · with the network off, a reload still opens the game (the offline cache)
//     · a new build published underneath (another build number) reaches a returning player on their FIRST visit
//       (registerSW immediate — BMUZ GitHub Pages recipe, Roll Better B020)
//   The Dev Kit in the release build (content/devkit.json "inReleaseBuilds")
//     · ` opens it; every tab is clicked through; NO failed requests (e.g. /__devkit/* that only the dev server has)
//       and NO console errors the whole time
//     · bug capture with no dev server: ● Record, 📍 Mark, a note, Copy for Claude → the clipboard holds the bug file
//       text, with the version in it
// Run: node e2e/sw-update.mjs   (static server on port 5462; builds into e2e-shots/sw-site/, nothing else touched)
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { expectedVersion, skipFirstDay } from './start.mjs'

const PORT = 5462
const SITE = 'e2e-shots/sw-site' // the gh-pages branch, in miniature: / → v1 stand-in at GOOPS/, the alpha at GOOPS/alpha/
const ALPHA = `http://localhost:${PORT}/GOOPS/alpha/`
const OUT = 'e2e-shots/sw-update'
let failed = 0
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++ }

/** A release build (the same vite build `npm run build` makes, without the type check) into the scratch site. */
function build(buildNumber) {
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', `${SITE}/GOOPS/alpha`, '--emptyOutDir', '--logLevel', 'warn'],
    { stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production', ...(buildNumber === undefined ? {} : { GOOPS_BUILD: String(buildNumber) }) } })
}

// A stand-in for v1 at /GOOPS/: like the live one, it registers ./sw.js (scope /GOOPS/), which answers every
// request under /GOOPS/ network-first and caches it — so without its own worker the alpha would run under it.
rmSync(SITE, { recursive: true, force: true })
mkdirSync(`${SITE}/GOOPS`, { recursive: true })
writeFileSync(`${SITE}/GOOPS/index.html`, `<!doctype html><title>v1 stand-in</title><p>v1</p>
<script>navigator.serviceWorker.register('./sw.js')</script>`)
writeFileSync(`${SITE}/GOOPS/sw.js`, `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open('v1').then((c) => c.put(e.request, copy)); return r }).catch(() => caches.match(e.request))))`)

const first = expectedVersion() // the build number from version.json
const next = `${first.slice(0, first.lastIndexOf('.'))}.9999`
build()

// The static server: files only, like GitHub Pages (no /__devkit/* — those exist only on the dev server)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' }
const server = createServer((req, res) => {
  let path = normalize(join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(normalize(SITE))) { res.writeHead(403); res.end(); return }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  if (!existsSync(path)) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  res.end(readFileSync(path))
})
await new Promise((ok) => server.listen(PORT, ok))

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  permissions: ['clipboard-read', 'clipboard-write'] })
const version = (page) => page.locator('meta[name="app-version"]').getAttribute('content', { timeout: 10000 }).catch(() => null)
try {
  const page = await context.newPage()
  await skipFirstDay(page)
  const failedRequests = [], errors = []
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`) })
  page.on('requestfailed', (r) => { if (!r.url().startsWith('data:')) failedRequests.push(`failed ${r.url()} (${r.failure()?.errorText})`) })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  // ---- v1 first, the way a returning v1 player arrives ----
  await page.goto(`http://localhost:${PORT}/GOOPS/`)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 })
  const v1Scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope)
  check('the v1 stand-in has its service worker at /GOOPS/', v1Scope === `http://localhost:${PORT}/GOOPS/`, v1Scope)

  // ---- the alpha: its own worker, scope /GOOPS/alpha/ ----
  await page.goto(ALPHA)
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/GOOPS/alpha/sw.js'), null, { timeout: 30000 })
    .catch(() => { /* reported below */ })
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration()
    return { scope: reg?.scope, controller: navigator.serviceWorker.controller?.scriptURL }
  })
  check('the alpha registers its own service worker, scope /GOOPS/alpha/', sw.scope === ALPHA, sw.scope)
  check('the alpha page runs under the alpha worker (not v1\'s)', sw.controller === `${ALPHA}sw.js`, sw.controller)
  check(`first visit shows the build's version (${first})`, (await version(page)) === first, await version(page))
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href
    return { href, ...(await (await fetch(href)).json()) }
  })
  const resolve = (u) => new URL(u, manifest.href).href
  check('manifest: scope and start_url are /GOOPS/alpha/', resolve(manifest.scope) === ALPHA && resolve(manifest.start_url) === ALPHA, `${manifest.scope} → ${resolve(manifest.scope)}`)
  check('manifest: id is /GOOPS/alpha/ (its own app, not v1)', resolve(manifest.id) === ALPHA, manifest.id)
  check('manifest: full screen, portrait, a maskable icon', manifest.display === 'fullscreen' && manifest.orientation === 'portrait' && manifest.icons.some((i) => i.purpose === 'maskable'))
  const apple = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')
  check('iPhone tags: apple-mobile-web-app-capable', apple === 'yes')
  await page.waitForTimeout(2000) // let the precache finish
  await page.screenshot({ path: `${OUT}-online.png` })

  // ---- offline: the cache opens the game ----
  await context.setOffline(true)
  await page.reload()
  await page.locator('.kit-art-stage').waitFor({ timeout: 15000 }).catch(() => {})
  const offlineVersion = await version(page)
  check('offline: a reload still opens the game (console on screen)', await page.locator('.kit-art-stage').isVisible() && offlineVersion === first, offlineVersion)
  await page.screenshot({ path: `${OUT}-offline.png` })
  await context.setOffline(false)
  check('first visit + offline: no failed requests', failedRequests.length === 0, failedRequests.join(' · '))
  check('first visit + offline: no console errors', errors.length === 0, errors.join(' · '))

  // ---- a new release published underneath; the player opens the link again ----
  // (Not counted: the old page's last second — its idle-time Dev Kit chunk can be gone from the new build when it
  // asks; the page swaps itself to the new version straight after anyway.)
  build(9999)
  await page.goto(ALPHA)
  let shown = await version(page)
  for (let i = 0; i < 30 && shown !== next; i++) { await page.waitForTimeout(500); shown = await version(page) }
  if (shown !== next) console.log('debug', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return JSON.stringify({ a: r?.active?.state, w: r?.waiting?.state, i: r?.installing?.state, c: navigator.serviceWorker.controller?.scriptURL }) }))
  check(`returning player gets the new build on their first visit (${first} → ${next})`, shown === next, shown)
  await page.locator('.kit-art-stage').waitFor({ timeout: 15000 })

  // ---- the Dev Kit in the release build (no dev server) ----
  const before = { requests: failedRequests.length, errors: errors.length }
  await page.waitForTimeout(1500) // the Dev Kit loads once the page is idle (main.tsx)
  await page.keyboard.press('Backquote')
  const kit = page.locator('aside.devkit')
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
  await page.screenshot({ path: `${OUT}-devkit.png` })

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

  const newRequests = failedRequests.slice(before.requests), newErrors = errors.slice(before.errors)
  check('Dev Kit: no failed requests', newRequests.length === 0, newRequests.join(' · '))
  check('Dev Kit: no console errors', newErrors.length === 0, newErrors.join(' · '))
} catch (e) {
  check('ran to the end', false, e.message.split('\n')[0])
} finally {
  await browser.close()
  server.close()
}
console.log(failed ? `FAIL — ${failed} check(s)` : 'PASS — the alpha installs with its own worker, opens offline, updates on the first visit, and its Dev Kit works with no dev server')
process.exit(failed ? 1 : 0)
