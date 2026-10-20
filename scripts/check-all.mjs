// CHECK EVERYTHING, SIDE BY SIDE — the BMUZ check tiers in one command (BMUZ "Checks", PROJECT-FILES.md).
// TEMPLATE (~/.claude/config/bmuz/templates/check-all.mjs) — copy to <game>/scripts/check-all.mjs, then fill FAST and E2E
// for this game, and add to package.json: "check:fast": "node scripts/check-all.mjs fast", "check:full": "node scripts/check-all.mjs full".
// First proven in Glyphtender (19 checks: ~12 min side by side vs ~31 min one at a time). Put the slowest scripts FIRST in E2E.
//   npm run check:fast            the quick ones, together (~1 min): unit tests, type check + build, lint, golden games
//   npm run check:full            fast first; if green, every e2e script + the before/after screenshots, a few at a time
//   npm run check:full -- game online   only these e2e scripts (an "area" check: the scripts for what you touched)
// Each e2e script gets its OWN port (and the online ones their own wrangler port + storage), so they can run side by
// side; `--jobs 3` sets how many run at once (default 3 — more makes the animation-timed scripts flaky on a busy PC).
// Writes e2e-shots/checks.html: every check, pass/fail, how long, and its full log — the page Claude links for Muzzy
// (dev server: /e2e-shots/checks.html), next to golden.html and report.html. Exit code 0 = everything passed.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'

// [name, command] — fast checks don't use ports, so they all run at once
const FAST = [
  ['unit tests', 'npx vitest run'],
  ['build', 'npm run -s build'],
  ['lint', 'npm run -s lint'],
  ['ui rules', 'npm run -s check:ui'],
  // (Goops' Dev Kit has no check-framework.mjs yet — add 'framework (code)' when it does)
]
// e2e: [name, script, args] — every one on its own port, fixed in its own header (slowest first)
// Not here: art-shots / fonts-shots / art-sheet / perf (picture and timing tools, not pass/fail checks) and console-shots
// (red on a short desktop window: the kit's swipe rule — SPRINT 08 Notes; add it back once that's fixed).
const E2E = [
  ['first-day', 'e2e/first-day.mjs', ''],      // 5347
  ['lessons', 'e2e/lessons.mjs', ''],          // 5341
  ['unlocks', 'e2e/unlocks.mjs', ''],          // 5344
  ['devkit-live', 'e2e/devkit-live.mjs', ''],  // 5282
  ['day', 'e2e/day.mjs', ''],                  // 5263
  ['repairs', 'e2e/repairs.mjs', ''],          // 5267
  ['cracks-look', 'e2e/cracks-look.mjs', ''],  // 5331
  ['crack-spread', 'e2e/crack-spread.mjs', ''],// 5291
  ['sound', 'e2e/sound.mjs', ''],              // 5321
  ['hud-shots', 'e2e/hud-shots.mjs', ''],      // 5254
  ['poke', 'e2e/poke.mjs', ''],                // 5268
  ['visor', 'e2e/visor.mjs', ''],              // 5265
  ['gestures', 'e2e/gestures.mjs', ''],        // 5391
  ['controls', 'e2e/controls.mjs', ''],        // 5251
  ['shift-smoke', 'e2e/shift-smoke.mjs', ''],  // 5250
  ['portrait', 'e2e/portrait.mjs', ''],        // 5343
]

const args = process.argv.slice(2)
const tier = args[0] === 'full' ? 'full' : 'fast'
const jobsAt = args.indexOf('--jobs')
const JOBS = jobsAt >= 0 ? Number(args[jobsAt + 1]) : 3
const only = args.slice(1).filter((a, i, all) => a !== '--jobs' && all[i - 1] !== '--jobs')
const e2e = only.length ? E2E.filter(([name]) => only.includes(name)) : E2E
const unknown = only.filter((n) => !E2E.some(([name]) => name === n))
if (unknown.length) {
  console.log(`Unknown e2e name(s): ${unknown.join(', ')}. Known: ${E2E.map(([n]) => n).join(', ')}`)
  process.exit(1)
}
mkdirSync('e2e-shots/logs', { recursive: true })

// One e2e run at a time: the Dev Kit scripts save + restore content files, which reloads every running dev server
// mid-test (Glyphtender sprint 23: a false "navigation destroyed"). A second full/area run waits for the first.
const LOCK = 'e2e-shots/.check-lock'
if (tier === 'full') {
  const held = existsSync(LOCK) && readFileSync(LOCK, 'utf8')
  const [pid, ...when] = held ? held.split(' ') : []
  if (held && isRunning(Number(pid))) {
    console.log(`Another check run is still going (process ${pid}, started ${when.join(' ')}). Wait for it — two at once break each other. (If it died, delete ${LOCK}.)`)
    process.exit(1)
  }
  writeFileSync(LOCK, `${process.pid} ${new Date().toLocaleTimeString()}`)
  process.on('exit', () => { try { rmSync(LOCK) } catch {} })
  process.on('SIGINT', () => process.exit(130)) // Ctrl+C still frees the lock
}
function isRunning(pid) {
  try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' }
}

/** Runs one check; resolves with { name, ok, seconds, log }. */
function run(name, command) {
  return new Promise((done) => {
    const started = Date.now()
    let log = ''
    const child = spawn(command, { shell: true, env: { ...process.env, FORCE_COLOR: '0' } })
    child.stdout.on('data', (d) => (log += d))
    child.stderr.on('data', (d) => (log += d))
    child.on('close', (code) => {
      const result = { name, ok: code === 0, seconds: Math.round((Date.now() - started) / 1000), log }
      writeFileSync(`e2e-shots/logs/${name}.log`, log)
      console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${name.padEnd(14)} ${String(result.seconds).padStart(4)} s`)
      done(result)
    })
  })
}

/** Runs checks at most `jobs` at a time, in order. */
async function pool(checks, jobs) {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < checks.length) {
      const [name, command] = checks[next++]
      results.push(await run(name, command))
    }
  }
  await Promise.all(Array.from({ length: Math.min(jobs, checks.length) }, worker))
  return results
}

const started = Date.now()
// All at once on a big PC; on a small machine (GitHub's has 4 cores) half as many as it has cores — five at once there
// starved Glyphtender's whole-AI-game unit tests past their 5 s limit (F70, 2026-10-19). 32 threads → all; 4 cores → 2.
const FAST_JOBS = Math.max(1, Math.min(FAST.length, Math.floor(availableParallelism() / 2)))
console.log(`Fast checks (${FAST.length}, ${FAST_JOBS >= FAST.length ? 'together' : `${FAST_JOBS} at a time`}):`)
const results = await pool(FAST, FAST_JOBS)
if (tier === 'full') {
  if (results.every((r) => r.ok)) {
    console.log(`\nFull checks (${e2e.length}, ${JOBS} at a time):`)
    results.push(...(await pool(e2e.map(([name, script, a]) => [name, `node ${script} ${a}`]), JOBS)))
  } else {
    console.log('\nA fast check failed — fix that first (the e2e scripts would only repeat it).')
  }
}
const minutes = ((Date.now() - started) / 60000).toFixed(1)
const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length ? `NOT OK — ${failed.length} failed: ${failed.map((r) => r.name).join(', ')}` : `ALL PASS — ${results.length} checks`} (${minutes} min). Page: e2e-shots/checks.html`)
writeReport()
process.exit(failed.length ? 1 : 0)

function writeReport() {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const rows = results.map((r) => `<tr class="${r.ok ? '' : 'no'}"><td>${r.ok ? '✓' : '✗'} ${esc(r.name)}</td><td>${r.seconds} s</td><td><a href="logs/${encodeURIComponent(r.name)}.log">log</a></td></tr>`)
  const extra = results.some((r) => r.name === 'screenshots') ? ' · <a href="report.html">screenshots before | now</a>' : ''
  writeFileSync('e2e-shots/checks.html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Checks</title><style>body{font:16px system-ui;background:#0f1729;color:#eee;margin:0;padding:16px}h1{margin:0 0 4px}p{margin:0 0 16px;color:#aab}
.ok{color:#7d7}.no,.no a{color:#f77}a{color:#9cf}table{border-collapse:collapse}td{padding:6px 12px;border-bottom:1px solid #334}</style>
<h1 class="${failed.length ? 'no' : 'ok'}">${failed.length ? `Not OK — ${failed.length} of ${results.length} failed` : `All ${results.length} checks pass`}</h1>
<p>${tier} check · ${new Date().toLocaleString()} · ${minutes} min · <a href="golden.html">golden games</a>${extra}</p>
<table>${rows.join('')}</table>`)
}
