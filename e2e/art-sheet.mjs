// Contact sheet of every SVG in art/ — each drawn inline with Muzzy's fonts loaded, so text shows as he drew it.
// Uses Playwright's own Chromium (never the user's Chrome). Run: node e2e/art-sheet.mjs → e2e-shots/art/sheet.png (+ one PNG per file)
import { chromium } from 'playwright-core'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const OUT = 'e2e-shots/art'
mkdirSync(`${OUT}/files`, { recursive: true })
const files = readdirSync('art').filter((f) => f.endsWith('.svg')).sort()
const font = (name, file, weight) => `@font-face{font-family:'${name}';src:url('${pathToFileURL(resolve('fonts', file))}');font-weight:${weight}}`
const fonts = [
  font('From Where You Are', 'FromWhereYouAre-4Y86.ttf', 400),
  font('Amazon Ember', 'Amazon Ember.ttf', 400),
  font('Amazon Ember', 'Amazon Ember Bold.ttf', 700),
  font('Amazon Ember', 'Amazon Ember Heavy.ttf', 800),
].join('\n')
const cell = (f) => {
  const svg = readFileSync(`art/${f}`, 'utf8').replace(/<\?xml[^>]*>/, '')
  // each file's classes (.cls-1…) clash when inlined together, so scope each one in its own iframe-free shadow root later
  return `<figure data-file="${f}"><div class="art" data-svg="${encodeURIComponent(svg)}"></div><figcaption>${f}</figcaption></figure>`
}
const html = `<!doctype html><html><head><style>${fonts}
body{margin:0;padding:16px;background:#888;font:13px sans-serif;display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
figure{margin:0;background:#bbb;padding:8px;display:flex;flex-direction:column;gap:6px}
.art{height:200px;display:flex;align-items:center;justify-content:center}
figcaption{text-align:center}</style></head><body>${files.map(cell).join('')}
<script>for (const d of document.querySelectorAll('.art')) { const r = d.attachShadow({ mode: 'open' }); r.innerHTML = '<style>svg{max-width:100%;max-height:200px;display:block}</style>' + decodeURIComponent(d.dataset.svg) }</script>
</body></html>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/sheet.png`, fullPage: true })
  // one big render per file, for a closer look
  for (const f of files) {
    await page.setContent(`<!doctype html><style>${fonts} body{margin:0;background:#888} svg{width:100%;height:auto;display:block}</style>${readFileSync(`art/${f}`, 'utf8').replace(/<\?xml[^>]*>/, '')}`)
    await page.evaluate(() => document.fonts.ready)
    await page.setViewportSize({ width: 700, height: 700 })
    await page.screenshot({ path: `${OUT}/files/${f.replace('.svg', '.png')}`, fullPage: true })
  }
  console.log(`sheet: ${files.length} files → ${OUT}/sheet.png`)
} finally {
  await browser.close()
}
