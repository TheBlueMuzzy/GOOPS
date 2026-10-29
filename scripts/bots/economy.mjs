// F51 THE ECONOMY SIM — whole careers (rank 0 → the final shift) for every bot skill × buy style, every upgrade on vs
// off, and the final shift with a real career's upgrades. Headless, on the real engine + the real content files (the
// rules: scripts/bots/career.ts; the settings: scripts/bots/economy.json). Writes e2e-shots/sim/results.json + index.html.
// Run: npm run sim:economy                  (the full run, a few minutes on many cores)
//      npm run sim:economy -- --quick       (check:full: careers cut at a low rank, 1 seed — proves it runs + repeats)
//      npm run sim:economy -- --seeds 4     (fewer career seeds)
// Content files are read, never written. Same files + same seeds = the same numbers.
import './ts-register.mjs' // (the engine's .ts files and the tuning .json in plain Node — before anything imports them)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'

const root = new URL('../../', import.meta.url)
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : fallback
}

// ---------------------------------------------------------------- worker: runs the jobs it is sent

async function worker() {
  const career = await import('./career.ts')
  const { runFinal } = await import('./runFinal.ts')
  const t = { shift: readJson('content/tuning/shift.json'), breakdowns: readJson('content/tuning/breakdowns.json'), whiteGoop: readJson('content/tuning/whiteGoop.json'),
    twists: readJson('content/tuning/twists.json'), finalShift: readJson('content/tuning/finalShift.json'), tank: readJson('content/tuning/tank.json'), bots: readJson('scripts/bots/bots.json') }
  parentPort.on('message', (job) => {
    if (job === 'stop') return process.exit(0)
    let r
    if (job.kind === 'career') r = career.runCareer(job.input)
    else if (job.kind === 'shift') r = career.playShift(job.input)
    else r = runFinal({ bot: job.bot, skill: t.bots.bots[job.bot], seed: job.seed, shift: t.shift, breakdowns: t.breakdowns, whiteGoop: t.whiteGoop, twists: t.twists,
      finalShift: t.finalShift, spinRepeatMs: t.tank.spinRepeatMs, frameMs: t.bots.frameMs, maxShiftMs: t.bots.maxShiftMs, repairSec: t.bots.consoleRepairSec ?? 4 })
    parentPort.postMessage({ job, r })
  })
}

// Runs every job on a pool of worker threads; results come back in job order.
async function runPool(jobs, label) {
  const threads = Math.max(1, Math.min(availableParallelism() - 2, 24, jobs.length))
  const out = new Array(jobs.length)
  let next = 0
  let done = 0
  const started = Date.now()
  await new Promise((resolve, reject) => {
    let live = threads
    for (let k = 0; k < threads; k++) {
      const w = new Worker(fileURLToPath(import.meta.url)) // (it registers the .ts hooks itself, first line)
      const feed = () => {
        if (next < jobs.length) { const i = next++; w.postMessage({ ...jobs[i], i }) }
        else { w.postMessage('stop'); if (--live === 0) resolve() }
      }
      w.on('message', ({ job, r }) => {
        out[job.i] = r
        if (++done % 500 === 0) console.log(`  ${label}: ${done}/${jobs.length}…`)
        feed()
      })
      w.on('error', reject)
      feed()
    }
  })
  console.log(`${label}: ${jobs.length} in ${((Date.now() - started) / 1000).toFixed(1)} s on ${threads} threads`)
  return out
}

// ---------------------------------------------------------------- main

async function main() {
  const quick = process.argv.includes('--quick')
  const eco = readJson('scripts/bots/economy.json')
  const upgrades = readJson('content/tuning/upgrades.json').upgrades.filter((u) => !u.testOnly)
  const progression = readJson('content/tuning/progression.json')
  const bots = readJson('scripts/bots/bots.json').bots
  const careerSeeds = Number(arg('--seeds', quick ? eco.quick.careerSeeds : eco.careerSeeds))
  const effectSeeds = Number(arg('--effect-seeds', quick ? eco.quick.effectSeeds : eco.effectSeeds))
  const finalSeeds = quick ? eco.quick.finalSeeds : eco.finalSeeds
  const styles = Object.keys(eco.buyStyles)
  const started = Date.now()

  // 1. careers
  const careerJobs = []
  for (const bot of eco.skills) for (const style of styles) for (let seed = 1; seed <= careerSeeds; seed++) {
    careerJobs.push({ kind: 'career', input: { bot, style, seed, ...(quick ? { toRank: eco.quick.toRank } : {}) } })
  }
  const careers = await runPool(careerJobs, 'careers')

  // 2. every upgrade on vs off: at the rank it opens and late (effectLateRank), level 1 and max, the same seeds
  const { effectProgress, effectBaseline } = await import('./career.ts')
  const { effectRanks, baselineOf } = await import('./economy-summary.mjs')
  const effectList = quick ? upgrades.filter((u) => eco.quick.effectUpgrades.includes(u.id)) : upgrades
  const effectJobs = []
  const baselineKey = (u) => baselineOf(u, eco)
  const seen = new Set()
  for (const u of effectList) {
    for (const rank of effectRanks(u, eco)) {
      for (const bot of eco.effectSkills) for (let seed = 1; seed <= effectSeeds; seed++) {
        const input = (progress) => ({ bot, seed: 7_000_000 + seed, progress, rank })
        const base = `${baselineKey(u)}|${rank}|${bot}|${seed}`
        if (!seen.has(base)) { seen.add(base); effectJobs.push({ kind: 'shift', key: { base: baselineKey(u), rank, bot, seed, level: 0 }, input: input(effectBaseline(u.id)) }) }
        for (const level of [...new Set([1, u.maxLevel])]) effectJobs.push({ kind: 'shift', key: { id: u.id, rank, bot, seed, level }, input: input(effectProgress(u.id, level)) })
      }
    }
  }
  const effectResults = await runPool(effectJobs, 'upgrade on/off shifts')

  // 3. the final shift with each career's own upgrades (the loadout it took into its first final shift), and with none
  const finalJobs = []
  careers.forEach((c, ci) => {
    if (!c.loadout50) return
    for (let seed = 1; seed <= finalSeeds; seed++) {
      finalJobs.push({ kind: 'shift', key: { ci, bot: c.bot, style: c.style, with: true }, input: { bot: c.bot, seed: 9_000_000 + seed, progress: c.loadout50, rank: progression.maxRank } })
      const raw = JSON.stringify(c.loadout50Raw.equipped) !== JSON.stringify(c.loadout50.equipped)
      if (raw) finalJobs.push({ kind: 'shift', key: { ci, bot: c.bot, style: c.style, raw: true }, input: { bot: c.bot, seed: 9_000_000 + seed, progress: c.loadout50Raw, rank: progression.maxRank } })
    }
  })
  const { freshProgress } = await import('../../src/progress/progression.ts')
  for (const bot of eco.skills) for (let seed = 1; seed <= Math.max(finalSeeds, quick ? 0 : 20); seed++) {
    finalJobs.push({ kind: 'shift', key: { bot, with: false }, input: { bot, seed: 9_000_000 + seed, progress: freshProgress(), rank: progression.maxRank } })
    finalJobs.push({ kind: 'final', key: { bot, path: 'runFinal' }, bot, seed: 9_000_000 + seed })
  }
  const finalResults = await runPool(finalJobs, 'final shifts')

  const seconds = (Date.now() - started) / 1000
  const { summarise } = await import('./economy-summary.mjs')
  const summary = summarise({ eco, upgrades, progression, bots, careers, effectJobs, effectResults, finalJobs, finalResults, quick, careerSeeds, effectSeeds, finalSeeds, seconds })
  const out = new URL('e2e-shots/sim/', root)
  mkdirSync(out, { recursive: true })
  writeFileSync(new URL('results.json', out), JSON.stringify(summary, null, 1))
  const { writeSimPage } = await import('./economy-page.mjs')
  writeSimPage(summary, new URL('index.html', out))
  printHeadlines(summary)

  // quick mode is a check: every career must play, gain ranks and repeat
  if (quick) {
    const problems = []
    for (const c of careers) if (c.reachedRank < eco.quick.toRank) problems.push(`${c.bot}/${c.style} seed ${c.seed} stopped at rank ${c.reachedRank}`)
    const again = await runPool([careerJobs[0]], 'repeat check')
    if (JSON.stringify(again[0]) !== JSON.stringify(careers[0])) problems.push('the same career seed gave a different career the second time')
    if (!effectResults.every((r) => r && r.realMs > 0)) problems.push('an upgrade on/off shift did not play')
    if (problems.length) { console.log(`\nECONOMY SIM CHECK FAILED:\n  ${problems.join('\n  ')}`); process.exit(1) }
    console.log('\nECONOMY SIM CHECK OK (quick mode: careers played, gained ranks, repeated exactly)')
  }
}

function printHeadlines(s) {
  console.log(`\n${s.quick ? 'QUICK RUN' : 'FULL RUN'} · ${s.careerCount} careers · ${s.shiftsPlayed} shifts in ${s.seconds} s`)
  for (const row of s.careerRows) {
    console.log(`  ${row.label.padEnd(28)} shifts to the final ${String(row.shiftsToFinal ?? '–').padStart(4)} · won ${Math.round(row.winRate * 100)}% of shifts · stalls ${row.stallsPerCareer} · final won ${row.finalWonShare === null ? '–' : Math.round(row.finalWonShare * 100) + '%'} in ${row.finalTries ?? '–'} tries`)
  }
  for (const f of s.finalRows) console.log(`  final shift · ${f.label.padEnd(26)} win ${f.winRate === null ? '–' : Math.round(f.winRate * 100) + '%'} (${f.n} shifts)`)
  console.log(`  upgrades with no measurable effect: ${s.dead.map((d) => d.name).join(', ') || 'none'}`)
  console.log('  page: e2e-shots/sim/index.html')
}

if (isMainThread) await main()
else await worker()
