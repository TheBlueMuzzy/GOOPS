// In-game frame rate with a busy tank, for each goo style (headless Chromium on the real GPU via ANGLE).
// Run: node e2e/perf.mjs  (own dev server on port 5253)
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
const PORT = 5253
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok) => server.stdout.on('data', (d) => { if (String(d).includes('Local')) ok() }))
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
try {
  for (const [w, h, dpr] of [[390, 844, 3], [1280, 800, 1]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
    await p.goto(`http://localhost:${PORT}/?seed=7`)
    await p.getByRole('button', { name: 'Start shift' }).click()
    await p.waitForTimeout(400)
    await p.evaluate(() => { const { engine } = window.__goops
      for (let i = 0; i < 34; i++) { for (let k = 0; k < (i * 7) % 11; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'hardDrop' }); engine.tick(700) } })
    for (const style of ['Jelly', 'Particle']) {
      await p.evaluate((s) => window.__goops.gooStyle.setFromSetting(s), style)
      await p.waitForTimeout(1500)
      const r = await p.evaluate(() => new Promise((res) => {
        const { engine } = window.__goops; let n = 0, worst = 0, last = performance.now(); const t0 = last
        const f = (now) => { worst = Math.max(worst, now - last); last = now; n++
          if (n % 20 === 0) engine.act({ type: 'spin', dir: 1 }) // keep the goo moving
          if (now - t0 < 3000) requestAnimationFrame(f); else res({ fps: Math.round(n / ((now - t0) / 1000)), worstMs: Math.round(worst), cells: engine.state.grid.filter(Boolean).length }) }
        requestAnimationFrame(f) }))
      console.log(`${w}x${h}@${dpr}x`, style.padEnd(8), JSON.stringify(r))
    }
    await p.close()
  }
} finally { await b.close(); server.kill() }
