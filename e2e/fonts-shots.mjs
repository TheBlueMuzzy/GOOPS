// The Dev Kit's Fonts tab over the console, at a desktop and a phone size, then the console and a shift with a pixel
// font picked for each role (live — nothing is saved, so no file changes). Also tries a font straight from the font
// library (when this computer has one) and checks nothing in the tab is wider than the panel.
// Shots: e2e-shots/fonts/<size>-<n>-<step>.png. Playwright's own Chromium (never the user's Chrome).
// Run: node e2e/fonts-shots.mjs   (its own dev server on port 5281; only that server is stopped)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { startShift } from './start.mjs'

const PORT = 5281, OUT = 'e2e-shots/fonts'
mkdirSync(OUT, { recursive: true })
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
const stop = () => { try { server.kill() } catch { /* already gone */ } }
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('dev server did not start')), 30000)
  server.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); ok() } })
  server.on('exit', () => fail(new Error('dev server stopped (port busy?)')))
})

// One font per role, to see them all at once in the game
const PICKS = { Title: 'After Burner Neue', Heading: 'Press Start DX', Body: 'Nokia Cellphone FC', Numbers: 'Edit Undo' }

const problems = []
const browser = await chromium.launch()
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const size = `${w}x${h}`
    const page = await browser.newPage({ viewport: { width: w, height: h } })
    page.on('pageerror', (e) => problems.push(`${size} page error: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${size} console error: ${m.text()}`) })
    await page.goto(`http://localhost:${PORT}/`)
    await page.getByRole('button', { name: 'Start shift' }).waitFor()
    await page.waitForFunction(() => document.fonts.status === 'loaded')
    await page.locator('[data-devkit]').waitFor({ state: 'attached' }) // the Dev Kit loads just after the game
    const shot = (n, step) => page.screenshot({ path: `${OUT}/${size}-${n}-${step}.png` })

    // Open the Dev Kit → Fonts
    await page.keyboard.press('Backquote')
    await page.getByRole('tab', { name: 'Fonts' }).click()
    await page.waitForTimeout(300)
    await shot(1, 'fonts-tab')

    // Pick a font for each role (tap its sample) — live in the game
    for (const [role, font] of Object.entries(PICKS)) {
      const section = page.locator(`[data-dk-section="fonts:${role}"]`)
      if (!(await section.getAttribute('data-open'))) await section.locator('.dk-section-btn').click()
      const sample = section.locator('.ft-sample', { has: page.locator('.ft-sample-name', { hasText: new RegExp(`^${font}$`) }) })
      await sample.scrollIntoViewIfNeeded()
      await sample.click()
      const value = await page.evaluate((t) => document.documentElement.style.getPropertyValue(t), `--font-${role.toLowerCase()}`)
      if (!value.startsWith(`'${font}'`)) problems.push(`${size} ${role}: picked ${font} but the page says ${value}`)
      if ((await sample.getAttribute('aria-pressed')) !== 'true') problems.push(`${size} ${role}: ${font} not marked in use`)
    }
    await page.locator('[data-dk-section="fonts:Title"]').scrollIntoViewIfNeeded()
    await shot(2, 'picked')

    // Nothing in the tab wider than the panel
    const wide = await page.evaluate(() => {
      const panel = document.querySelector('.devkit')
      const right = panel.getBoundingClientRect().right
      return [...panel.querySelectorAll('.ft *')].filter((el) => el.getBoundingClientRect().right > right + 1).map((el) => el.className || el.tagName).slice(0, 5)
    })
    if (wide.length) problems.push(`${size} Fonts tab wider than the panel: ${wide.join(', ')}`)

    // The font library (this computer's): try one font, if there is a library
    const lib = page.locator('[data-dk-section="fonts:Library"]')
    await lib.locator('.dk-section-btn').click()
    await page.waitForTimeout(500)
    const rows = await lib.locator('.ft-lib-row').count()
    if (rows > 0) {
      const tryButton = lib.getByRole('button', { name: 'Try' }).first()
      if (await tryButton.count()) {
        await tryButton.scrollIntoViewIfNeeded()
        await tryButton.click()
        await page.getByText(/is in the comparisons now/).waitFor({ timeout: 5000 })
      }
      await lib.scrollIntoViewIfNeeded()
      await shot(3, 'library')
    }
    console.log(`${size} Fonts tab ok · library: ${rows} fonts shown`)

    // Close the Dev Kit: the console with the picked fonts, then a shift
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await shot(4, 'console')
    const fontsInUse = await page.evaluate(() => ({
      title: getComputedStyle(document.documentElement).getPropertyValue('--font-title'),
      body: getComputedStyle(document.body).fontFamily,
    }))
    console.log(`${size} console:`, JSON.stringify(fontsInUse))
    await startShift(page)
    await page.waitForTimeout(1500)
    await shot(5, 'shift')
    await page.close()
  }
} finally {
  await browser.close()
  stop()
}
if (problems.length) {
  console.log(`✗ ${problems.length} problems:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('✓ Fonts tab at desktop + phone; picks live in the game')
