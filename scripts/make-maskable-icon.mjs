// node scripts/make-maskable-icon.mjs — the maskable app icon = the existing Goops logo (public/icons/icon-512.png), shrunk into the 80% safe
// circle, on the game's dark background (#05070d, index.html theme-color). Rendered by Playwright's Chromium.
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const game = process.argv[2] ?? "."
const logo = readFileSync(`${game}/public/icons/icon-512.png`).toString('base64')
const browser = await chromium.launch()
for (const size of [512, 192]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const logoSize = Math.round(size * 0.70) // half-diagonal of the logo's drawn part stays inside the 40% safe radius
  await page.setContent(`<body style="margin:0;background:#05070d;width:${size}px;height:${size}px;display:grid;place-items:center">
    <img src="data:image/png;base64,${logo}" style="width:${logoSize}px;height:${logoSize}px"></body>`)
  await page.screenshot({ path: `${game}/public/icons/icon-maskable-${size}.png` })
  await page.close()
}
await browser.close()
console.log('made icon-maskable-512.png + icon-maskable-192.png')
