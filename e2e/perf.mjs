// In-game frame rate with a busy tank, for each goo style (headless Chromium on the real GPU via ANGLE), judged
// against the pass line in content/tuning/perf.json (F38): PASS when, in BOTH goo styles at 390x844@3x (a phone's
// pixels), the median frame rate is at least passMedianFps and no frame took longer than passWorstFrameMs.
// 1280x800@1x is measured too, for information. The page runs with ?fps, so the readout is on — shot at
// e2e-shots/perf-fps.png. Exit code 0 = PASS.
// Run: node e2e/perf.mjs  (own dev server on port 5464)
import { chromium } from 'playwright-core'
import { startShift } from './start.mjs'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
const PORT = 5464
const pass = JSON.parse(readFileSync('content/tuning/perf.json', 'utf8'))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((ok) => server.stdout.on('data', (d) => { if (String(d).includes('Local')) ok() }))
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] })
let failed = 0
try {
  for (const [w, h, dpr, judged] of [[390, 844, 3, true], [1280, 800, 1, false]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
    await p.goto(`http://localhost:${PORT}/?seed=7&fps`)
    await startShift(p)
    // a full tank: 34 pieces spun around the vat and dropped
    await p.evaluate(() => { const { engine } = window.__goops
      for (let i = 0; i < 34; i++) { for (let k = 0; k < (i * 7) % 11; k++) engine.act({ type: 'spin', dir: 1 }); engine.act({ type: 'softDrop', on: true }); engine.tick(2500) } })
    for (const style of ['Jelly', 'Particle']) {
      await p.evaluate((s) => window.__goops.gooStyle.setFromSetting(s), style)
      await p.waitForTimeout(1500)
      const r = await p.evaluate((sampleMs) => new Promise((res) => {
        const { engine } = window.__goops; const gaps = []; let last = performance.now(); const t0 = last
        const f = (now) => { gaps.push(now - last); last = now
          if (gaps.length % 20 === 0) engine.act({ type: 'spin', dir: 1 }) // keep the goo moving
          if (now - t0 < sampleMs) requestAnimationFrame(f)
          else { const sorted = [...gaps].sort((a, z) => a - z)
            res({ medianFps: Math.round(1000 / sorted[Math.floor(sorted.length / 2)]), avgFps: Math.round(gaps.length / ((now - t0) / 1000)),
              worstMs: Math.round(sorted.at(-1)), cells: engine.state.grid.filter(Boolean).length }) } }
        requestAnimationFrame(f) }), pass.sampleMs)
      const ok = r.medianFps >= pass.passMedianFps && r.worstMs <= pass.passWorstFrameMs
      if (judged && !ok) failed++
      console.log(`${judged ? (ok ? 'ok  ' : 'FAIL') : 'info'} ${w}x${h}@${dpr}x ${style.padEnd(8)} median ${r.medianFps} fps · avg ${r.avgFps} · worst frame ${r.worstMs} ms · ${r.cells} goop cells`)
      if (judged && style === 'Jelly') await p.screenshot({ path: 'e2e-shots/perf-fps.png' })
    }
    await p.close()
  }
} finally { await b.close(); server.kill() }
console.log(failed
  ? `FAIL — under the pass line (median ≥ ${pass.passMedianFps} fps, worst frame ≤ ${pass.passWorstFrameMs} ms; content/tuning/perf.json)`
  : `PASS — full tank, both goo styles at 390x844@3x: median ≥ ${pass.passMedianFps} fps, worst frame ≤ ${pass.passWorstFrameMs} ms`)
process.exit(failed ? 1 : 0)
