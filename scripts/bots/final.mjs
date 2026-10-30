// F64 balance bots for THE FINAL SHIFT (rank 50): every bot × seed headless on the real engine + the real tuning
// (shift, breakdowns, whiteGoop, twists, finalShift.json), console stand-ins as runFinal.ts says. Prints win rate,
// length and how the bots lose — F75: and how often they save the Veteran (won with him alive = the happy ending);
// writes e2e-shots/bots/final.json.
// Run: npm run bots:final                         (50 seeds from 1)
//      npm run bots:final -- --seeds 200 --from 1001   (fresh seeds)
//      npm run bots:final -- --set pressureRiseMult=2 --set vet.wearPerIntegrity=1.5   (try numbers without editing the file)
//      npm run bots:final -- --bots focused,sharp
// Tuning is read from content/tuning at start and never written.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'

const root = new URL('../../', import.meta.url)
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : fallback
}
const args = (name) => process.argv.flatMap((a, i) => (a === name ? [process.argv[i + 1]] : []))

// 'a.b=3' → finalShift.a.b = 3 (a number, true/false, or a word)
function withSets(final, sets) {
  const out = structuredClone(final)
  for (const set of sets) {
    const [path, raw] = set.split('=')
    const keys = path.split('.')
    let o = out
    for (const k of keys.slice(0, -1)) o = o[k]
    o[keys.at(-1)] = raw === 'true' ? true : raw === 'false' ? false : raw.startsWith('[') ? JSON.parse(raw) : Number.isNaN(Number(raw)) ? raw : Number(raw)
  }
  return out
}

async function worker() {
  const { runFinal } = await import('./runFinal.ts')
  const t = workerData
  parentPort.on('message', (job) => {
    if (job === 'stop') return process.exit(0)
    const r = runFinal({
      bot: job.bot, skill: t.bots.bots[job.bot], seed: job.seed, shift: t.shift, breakdowns: t.breakdowns, whiteGoop: t.whiteGoop,
      twists: t.twists, finalShift: t.finalShift, spinRepeatMs: t.tank.spinRepeatMs, frameMs: t.bots.frameMs,
      maxShiftMs: t.bots.maxShiftMs, repairSec: t.bots.consoleRepairSec ?? 4,
    })
    parentPort.postMessage(r)
  })
}

async function main() {
  const seeds = Number(arg('--seeds', 50))
  const from = Number(arg('--from', 1))
  const tuning = {
    shift: readJson('content/tuning/shift.json'),
    breakdowns: readJson('content/tuning/breakdowns.json'),
    whiteGoop: readJson('content/tuning/whiteGoop.json'),
    twists: readJson('content/tuning/twists.json'),
    finalShift: withSets(readJson('content/tuning/finalShift.json'), args('--set')),
    tank: readJson('content/tuning/tank.json'),
    bots: readJson('scripts/bots/bots.json'),
  }
  const botNames = arg('--bots', Object.keys(tuning.bots.bots).filter((b) => tuning.bots.bots[b].acts).join(',')).split(',')
  const jobs = botNames.flatMap((bot) => Array.from({ length: seeds }, (_, k) => ({ bot, seed: from + k })))
  const threads = Math.max(1, Math.min(availableParallelism() - 2, 24, jobs.length))
  const register = new URL('./ts-register.mjs', import.meta.url).href
  const started = Date.now()
  const results = []
  let next = 0
  await new Promise((resolve, reject) => {
    let live = threads
    for (let k = 0; k < threads; k++) {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: tuning, execArgv: ['--import', register] })
      const feed = () => {
        if (next < jobs.length) w.postMessage(jobs[next++])
        else {
          w.postMessage('stop')
          if (--live === 0) resolve()
        }
      }
      w.on('message', (r) => { results.push(r); feed() })
      w.on('error', reject)
      feed()
    }
  })
  const sets = args('--set')
  console.log(`final shift · seeds ${from}–${from + seeds - 1} · ${results.length} shifts in ${((Date.now() - started) / 1000).toFixed(1)} s${sets.length ? ' · ' + sets.join(' ') : ''}`)
  const summary = {}
  for (const bot of botNames) {
    const rs = results.filter((r) => r.bot === bot)
    const n = rs.length
    const pct = (pred) => Math.round((100 * rs.filter(pred).length) / n)
    const med = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null }
    const secs = (ms) => (ms === null ? '—' : `${Math.round(ms / 1000)}s`)
    const won = rs.filter((r) => r.outcome === 'won')
    const row = {
      win: pct((r) => r.outcome === 'won'),
      saved: pct((r) => r.outcome === 'won' && r.vetAlive), // F75: won with him alive (the happy ending)
      vetGone: pct((r) => !r.vetAlive), // F75: worn out at some point (not a loss)
      vetGoneMs: med(rs.filter((r) => r.vetGoneAt !== null).map((r) => r.vetGoneAt)),
      lose: { overflow: pct((r) => r.outcome === 'overflow'), integrity: pct((r) => r.outcome === 'integrity'), timeout: pct((r) => r.outcome === 'timeout') },
      stages: [0, 1, 2, 3].map((k) => pct((r) => r.stage === k)),
      medianMs: med(rs.map((r) => r.realMs)),
      medianWinMs: med(won.map((r) => r.realMs)),
      vetShare: Math.round((100 * rs.reduce((a, r) => a + r.vetSeals, 0)) / Math.max(1, rs.reduce((a, r) => a + r.vetSeals + r.playerSeals, 0))),
      vetLeft: med(rs.map((r) => r.vetSize)),
      repairs: med(rs.map((r) => r.repairs)),
    }
    summary[bot] = row
    console.log(`  ${bot.padEnd(8)} win ${String(row.win).padStart(3)}% · saved him ${String(row.saved).padStart(3)}% (worn out in ${row.vetGone}%, at ${secs(row.vetGoneMs)}) · lose: over ${row.lose.overflow}% integ ${row.lose.integrity}% timeout ${row.lose.timeout}%` +
      ` · stages 0/1/2/3 ${row.stages.join('/')}% · length ${secs(row.medianMs)} (wins ${secs(row.medianWinMs)}) · his seals ${row.vetShare}% · he ends at ${row.vetLeft?.toFixed(2)} · repairs ${row.repairs}`)
  }
  const out = new URL('e2e-shots/bots/', root)
  mkdirSync(out, { recursive: true })
  writeFileSync(new URL('final.json', out), JSON.stringify({ seeds, from, sets, summary, results }, null, 1))
}

if (isMainThread) main()
else worker()
