import { readFileSync } from 'node:fs'
// Start a shift the way a player does since F21: the game opens on the console; tapping the periscope ("Start shift")
// pulls it, the console slides away, and the shift is running once the console is gone.
// F59: from rank 1 a device's first shifts start with an unlock lesson (the next-piece window, then swap) that waits
// for "Got it" with the shift stopped under it. Scripts about something else skip them, as a player who has had them
// would — marked seen on the device first ({ unlockLessons: true } keeps them: e2e/unlocks.mjs).
// F31: a fresh device at rank 0 plays "your first day" from the periscope pull — skipped the same way ({ firstDay: true }
// keeps it: e2e/first-day.mjs). Scripts that look at the rank-0 console BEFORE starting a shift call skipFirstDay(page)
// before page.goto (the day's first line would be on the monitor otherwise).
export async function startShift(page, { unlockLessons = false, firstDay = false } = {}) {
  await checkVersion(page)
  const seen = [...(unlockLessons ? [] : ['lesson:unlock-window', 'lesson:unlock-swap']), ...(firstDay ? [] : ['lesson:first-day'])]
  if (seen.length) await page.evaluate((ids) => window.__goopsSeen?.(ids), seen)
  await page.getByRole('button', { name: 'Start shift' }).click()
  await page.locator('.kit-art-stage').waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForFunction(() => window.__goops?.engine.state.status === 'playing')
}

// F31: this page's device has had its first day (every load, from before the game's own code runs) — the rank-0 console
// shows its own words, and a periscope pull starts a real shift.
export async function skipFirstDay(page) {
  await page.addInitScript(() => {
    const key = `kit-tips:${location.pathname.split('/').slice(1, -1)[0] ?? ''}`
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { /* a broken save: start a fresh one */ }
    const seen = Array.isArray(saved?.seen) ? saved.seen : []
    if (!seen.includes('lesson:first-day')) localStorage.setItem(key, JSON.stringify({ on: saved?.on !== false, seen: [...seen, 'lesson:first-day'] }))
  })
}

// F38: the page is the build we think it is — its <meta name="app-version"> (vite.config.ts) equals version.json
// (GOOPS_BUILD overrides the build number, as in vite.config.ts). A stale build or a service worker's cached copy fails
// here, by name, instead of as a strange test failure later. startShift does it; other scripts call it after page.goto.
export function expectedVersion() {
  const file = JSON.parse(readFileSync('version.json', 'utf8'))
  return `v${file.version}.${process.env.GOOPS_BUILD ?? file.build ?? 0}`
}
export async function checkVersion(page, want = expectedVersion()) {
  const shown = await page.locator('meta[name="app-version"]').getAttribute('content', { timeout: 10000 })
  if (shown !== want) throw new Error(`the page is version ${shown}, but version.json says ${want} — a stale build or a cached service worker?`)
  return shown
}
