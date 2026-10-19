// F27 balance bots — runs every bot × rank × seed headless on the real engine and the real tuning files,
// on each named tuning variant (VARIANTS below; --variants base,none to pick), plus breakdowns-off and the ±25% sensitivity runs, then writes e2e-shots/bots/results.json and the results page.
// Run: npm run bots            (all runs, ~1-2 min on many cores)
//      npm run bots -- --seeds 10   (fewer seeds, quicker)
// Tuning is read from content/tuning at start and never written. Same files + same seeds = the same numbers.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'

const root = new URL('../../', import.meta.url)
const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'))

const RANKS = [0, 2, 4, 6, 10]
// Named tuning variants, each a set of changes on top of content/tuning/shift.json (F27, 2026-10-19: drain halved + top bias).
// 'base' = the file as it is (today's default). The others are for comparison; `--variants base` runs only the file.
const VARIANTS = {
  played: { short: 'Played 10-19', label: 'What Muzzy played 2026-10-19 (band halfwayPerColumn + top bias 2)', set: { 'cracks.band': 'halfwayPerColumn' } },
  hillTight: { short: 'Hill · spread 0.2', label: 'Hill, spread 0.2', set: { 'cracks.spread': 0.2 } },
  base: { short: 'Hill · spread 0.3', label: 'Hill, reach 0.5, spread 0.3, neighbours 4 (the file)', set: {} },
  hillWide: { short: 'Hill · spread 0.4', label: 'Hill, spread 0.4', set: { 'cracks.spread': 0.4 } },
  hillAlone: { short: 'Hill · no neighbours', label: 'Hill, spread 0.3, no neighbour borrowing', set: { 'cracks.neighbourCols': 0 } },
}
const KNOBS = [['pressure', 'riseMsToFull']] // ±25% on the file's tuning (Muzzy steers with this one)
const SENSITIVITY_BOTS = ['focused', 'sharp']

// Apply 'section.key': value changes to a copy of the tuning.
function withChanges(shift, set) {
  const out = structuredClone(shift)
  for (const [path, value] of Object.entries(set)) {
    const [section, key] = path.split('.')
    out[section][key] = value
  }
  return out
}

// ---------------------------------------------------------------- worker: runs shifts it is sent

async function worker() {
  const { runShift } = await import('./runShift.ts')
  const tuning = workerData
  parentPort.on('message', (job) => {
    if (job === 'stop') return process.exit(0)
    const shift = withChanges(tuning.shift, VARIANTS[job.variant ?? 'base'].set)
    if (job.knob) shift[job.knob[0]][job.knob[1]] *= job.factor
    const r = runShift({
      bot: job.bot, skill: tuning.bots.bots[job.bot], seed: job.seed, rank: job.rank, shift,
      breakdowns: job.breakdowns ? tuning.breakdowns : undefined, spinRepeatMs: tuning.tank.spinRepeatMs,
      heldSpinSlowdown: tuning.breakdowns.controls.heldSpinSlowdown, frameMs: tuning.bots.frameMs,
      maxShiftMs: tuning.bots.maxShiftMs, progression: tuning.progression, timeline: job.timeline,
    })
    parentPort.postMessage({ job, r })
  })
}

// ---------------------------------------------------------------- main: the job list, the pool, the summary

async function main() {
  const seedsArg = process.argv.indexOf('--seeds')
  const SEEDS = seedsArg > 0 ? Number(process.argv[seedsArg + 1]) : 50
  const tuning = {
    shift: readJson('content/tuning/shift.json'),
    breakdowns: readJson('content/tuning/breakdowns.json'),
    tank: readJson('content/tuning/tank.json'),
    progression: readJson('content/tuning/progression.json'),
    bots: readJson('scripts/bots/bots.json'),
  }
  const variantsArg = process.argv.indexOf('--variants')
  const variantNames = variantsArg > 0 ? process.argv[variantsArg + 1].split(',') : Object.keys(VARIANTS)
  const jobs = []
  for (const bot of Object.keys(tuning.bots.bots)) {
    for (const rank of RANKS) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        for (const variant of variantNames) jobs.push({ set: variant, variant, bot, rank, seed, breakdowns: true, timeline: variant === 'base' })
        jobs.push({ set: 'noBreakdowns', bot, rank, seed, breakdowns: false, timeline: false })
      }
    }
  }
  for (const bot of SENSITIVITY_BOTS) {
    for (const knob of KNOBS) {
      for (const factor of [0.75, 1.25]) {
        for (const rank of RANKS) {
          for (let seed = 1; seed <= SEEDS; seed++) jobs.push({ set: `${knob.join('.')}×${factor}`, knob, factor, bot, rank, seed, breakdowns: true, timeline: false })
        }
      }
    }
  }

  const started = Date.now()
  const threadsArg = process.argv.indexOf('--threads')
  const threads = threadsArg > 0 ? Number(process.argv[threadsArg + 1]) : Math.max(1, Math.min(availableParallelism() - 2, 24))
  const register = new URL('./ts-register.mjs', import.meta.url).href // --import wants a file:// URL on Windows
  const results = []
  let next = 0
  await new Promise((resolve, reject) => {
    let live = threads
    for (let t = 0; t < threads; t++) {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: tuning, execArgv: ['--import', register] })
      const feed = () => {
        if (next < jobs.length) w.postMessage(jobs[next++])
        else {
          w.postMessage('stop')
          if (--live === 0) resolve()
        }
      }
      w.on('message', ({ job, r }) => {
        results.push({ job, r })
        if (results.length % 500 === 0) console.log(`  ${results.length}/${jobs.length} shifts…`)
        feed()
      })
      w.on('error', reject)
      feed()
    }
  })
  const seconds = (Date.now() - started) / 1000
  console.log(`${results.length} shifts in ${seconds.toFixed(1)} s on ${threads} threads`)

  const summary = summarise(results, tuning, SEEDS, seconds, threads, variantNames)
  const out = new URL('e2e-shots/bots/', root)
  mkdirSync(out, { recursive: true })
  writeFileSync(new URL('results.json', out), JSON.stringify(summary, null, 1))
  const { writePage } = await import('./page.mjs')
  writePage(summary, new URL('index.html', out))
  printHeadlines(summary)
}

// ---------------------------------------------------------------- statistics

const quantile = (xs, q) => {
  if (!xs.length) return null
  const a = [...xs].sort((x, y) => x - y)
  const i = (a.length - 1) * q
  const lo = Math.floor(i)
  return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)
}
const spread = (xs) => ({ p10: quantile(xs, 0.1), median: quantile(xs, 0.5), p90: quantile(xs, 0.9) })
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const share = (xs, pred) => (xs.length ? xs.filter(pred).length / xs.length : null)
const r1 = (n) => (n === null ? null : Math.round(n * 10) / 10)
const r3 = (n) => (n === null ? null : Math.round(n * 1000) / 1000)

function groupStats(runs) {
  const rs = runs.map((x) => x.r)
  const cracks = rs.flatMap((r) => r.cracks)
  const crackSec = (pred) => cracks.filter(pred).reduce((a, c) => a + c.openMs / 1000, 0)
  const totalCrackSec = crackSec(() => true)
  const sealed = cracks.filter((c) => c.sealedAt !== null)
  const pressureBins = [0, 0.2, 0.4, 0.6, 0.8].map((lo) => ({ from: lo, count: cracks.filter((c) => c.pressure >= lo && c.pressure < lo + 0.2 + (lo === 0.8 ? 1e-9 : 0)).length / rs.length }))
  return {
    n: rs.length,
    endedBy: { integrity: share(rs, (r) => r.ruptureReason === 'integrity'), overflow: share(rs, (r) => r.ruptureReason === 'overflow'), timedOut: share(rs, (r) => r.timedOut) },
    ruptureS: mapSpread(rs.filter((r) => r.ruptureAt !== null).map((r) => r.ruptureAt / 1000)),
    endS: mapSpread(rs.map((r) => r.endAt / 1000)),
    pressureAtRupture: mapSpread(rs.filter((r) => r.pressureAtRupture !== null).map((r) => r.pressureAtRupture), r3),
    reached100Before: share(rs, (r) => r.reached100At !== null && (r.ruptureAt === null || r.reached100At <= r.ruptureAt)),
    peakPressure: mapSpread(rs.map((r) => r.peakPressure), r3),
    meanPressure: r3(mean(rs.map((r) => r.meanPressure))),
    quotaRate: share(rs, (r) => r.quotaMet),
    quotaS: mapSpread(rs.filter((r) => r.quotaAt !== null).map((r) => r.quotaAt / 1000)),
    quotaBeforeRupture: share(rs, (r) => r.quotaAt !== null && r.ruptureAt !== null && r.quotaAt <= r.ruptureAt),
    sealed: mapSpread(rs.map((r) => r.cracksSealed)),
    needed: rs[0]?.cracksNeeded ?? null,
    formed: mapSpread(rs.map((r) => r.cracksFormed)),
    crackEveryS: r1(mean(rs.map((r) => (r.ruptureAt ?? r.endAt) / 1000 / Math.max(1, r.cracksFormed)))),
    score: mapSpread(rs.map((r) => r.score), Math.round),
    xp: mapSpread(rs.map((r) => r.xp), Math.round),
    pieces: r1(mean(rs.map((r) => r.pieces))),
    pops: r1(mean(rs.map((r) => r.pops))),
    breakdowns: Object.fromEntries(['laser', 'visor', 'controls'].map((m) => [m, r1(mean(rs.map((r) => r.breakdownsCount[m])))])),
    firstBreakS: Object.fromEntries(['laser', 'visor', 'controls'].map((m) => [m, r1(quantile(rs.filter((r) => r.firstBreakAt[m] !== null).map((r) => r.firstBreakAt[m] / 1000), 0.5))])),
    integrityPerCrackSecond: r3(totalCrackSec ? (mean(rs.map((r) => r.integrityLost)) * rs.length) / totalCrackSec : null) ,
    crackOpenS: r1(mean(cracks.map((c) => c.openMs / 1000))),
    sealS: mapSpread(sealed.map((c) => (c.sealedAt - c.formedAt) / 1000)),
    sealedShare: r3(share(cracks, (c) => c.sealedAt !== null)),
    spots: {
      surface: r3(share(cracks, (c) => c.spot === 'surface')),
      air: r3(share(cracks, (c) => c.spot === 'air')),
      under: r3(share(cracks, (c) => c.spot === 'under')),
      visible: r3(share(cracks, (c) => c.visible)),
    },
    sealedBySpot: Object.fromEntries(['surface', 'air', 'under'].map((k) => [k, r3(share(cracks.filter((c) => c.spot === k), (c) => c.sealedAt !== null))])),
    sealedByVisible: { visible: r3(share(cracks.filter((c) => c.visible), (c) => c.sealedAt !== null)), offscreen: r3(share(cracks.filter((c) => !c.visible), (c) => c.sealedAt !== null)) },
    crackSecondsShare: {
      neverSealed: r3(totalCrackSec ? crackSec((c) => c.sealedAt === null) / totalCrackSec : null),
      air: r3(totalCrackSec ? crackSec((c) => c.spot === 'air') / totalCrackSec : null),
      under: r3(totalCrackSec ? crackSec((c) => c.spot === 'under') / totalCrackSec : null),
      offscreen: r3(totalCrackSec ? crackSec((c) => !c.visible) / totalCrackSec : null),
      aboveLine: r3(totalCrackSec ? cracks.reduce((a, c) => a + c.aboveLineMs / 1000, 0) / totalCrackSec : null),
    },
    crackSecondsPerShift: r1(totalCrackSec / rs.length),
    // how high above the goop under them cracks form (empty cells between the crack and what's below it)
    gap: { mean: r1(mean(cracks.map((c) => c.gap))), p90: r1(quantile(cracks.map((c) => c.gap), 0.9)), atLeast3: r3(share(cracks, (c) => c.gap >= 3)) },
    crackRow: { mean: r1(mean(cracks.map((c) => c.row))), p90: r1(quantile(cracks.map((c) => c.row), 0.9)) },
    cracksByPressure: pressureBins.map((b) => ({ from: b.from, count: r1(b.count) })),
  }
}

function mapSpread(xs, round = r1) {
  const s = spread(xs)
  return { p10: s.p10 === null ? null : round(s.p10), median: s.median === null ? null : round(s.median), p90: s.p90 === null ? null : round(s.p90), n: xs.length }
}

// Per-second median of each timeline value across seeds, while at least half the shifts are still going.
function medianTimeline(runs) {
  const tls = runs.map((x) => x.r.timeline).filter(Boolean)
  const out = []
  for (let t = 0; ; t++) {
    const rows = tls.map((tl) => tl[t]).filter(Boolean)
    if (rows.length < tls.length / 2) break
    const med = (k) => r3(quantile(rows.map((row) => row[k]), 0.5))
    out.push({ t, pressure: med('pressure'), integrity: med('integrity'), open: med('open'), stack: med('stack'), formed: med('formed'), sealed: med('sealed') })
  }
  return out
}

function summarise(results, tuning, seeds, seconds, threads, variantNames) {
  const pick = (pred) => results.filter(({ job }) => pred(job))
  // Before / after: every variant, per bot — per rank, and all ranks pooled
  const variants = {}
  for (const v of variantNames) {
    variants[v] = { label: VARIANTS[v].label, short: VARIANTS[v].short, set: VARIANTS[v].set, bots: {} }
    for (const bot of Object.keys(tuning.bots.bots)) {
      const byRank = {}
      for (const rank of RANKS) byRank[rank] = groupStats(pick((j) => j.set === v && j.bot === bot && j.rank === rank))
      variants[v].bots[bot] = { all: groupStats(pick((j) => j.set === v && j.bot === bot)), byRank }
    }
  }
  const base = {}
  const noBreakdowns = {}
  const timelines = {}
  for (const bot of Object.keys(tuning.bots.bots)) {
    base[bot] = {}
    noBreakdowns[bot] = {}
    timelines[bot] = {}
    for (const rank of RANKS) {
      const b = pick((j) => j.set === 'base' && j.bot === bot && j.rank === rank)
      base[bot][rank] = groupStats(b)
      noBreakdowns[bot][rank] = groupStats(pick((j) => j.set === 'noBreakdowns' && j.bot === bot && j.rank === rank))
      timelines[bot][rank] = medianTimeline(b)
    }
  }
  const sensitivity = []
  for (const bot of SENSITIVITY_BOTS) {
    for (const knob of KNOBS) {
      const name = knob.join('.')
      const row = { bot, knob: name, base: tuning.shift[knob[0]][knob[1]], variants: {} }
      for (const factor of [0.75, 1.25]) {
        const byRank = {}
        for (const rank of RANKS) {
          const g = pick((j) => j.set === `${name}×${factor}` && j.bot === bot && j.rank === rank)
          byRank[rank] = {
            ruptureS: r1(quantile(g.map((x) => (x.r.ruptureAt ?? x.r.endAt) / 1000), 0.5)), quotaRate: r3(share(g.map((x) => x.r), (r) => r.quotaMet)), sealed: r1(quantile(g.map((x) => x.r.cracksSealed), 0.5)),
            peakPressure: r3(quantile(g.map((x) => x.r.peakPressure), 0.5)), peakPressureP90: r3(quantile(g.map((x) => x.r.peakPressure), 0.9)), formed: r1(quantile(g.map((x) => x.r.cracksFormed), 0.5)),
          }
        }
        row.variants[factor] = byRank
      }
      row.baseByRank = Object.fromEntries(RANKS.map((rank) => [rank, { ruptureS: base[bot][rank].ruptureS.median, quotaRate: r3(base[bot][rank].quotaRate), sealed: base[bot][rank].sealed.median, peakPressure: base[bot][rank].peakPressure.median, peakPressureP90: base[bot][rank].peakPressure.p90, formed: base[bot][rank].formed.median }]))
      sensitivity.push(row)
    }
  }
  return {
    made: new Date().toISOString(), seeds, ranks: RANKS, shifts: results.length, seconds: r1(seconds), threads,
    tuning: { shift: pickTuning(tuning.shift), bots: tuning.bots },
    base, noBreakdowns, timelines, sensitivity, variants,
  }
}

function pickTuning(shift) {
  return { pressure: shift.pressure, integrity: shift.integrity, cracks: shift.cracks, pop: shift.pop, rupture: shift.rupture }
}

function printHeadlines(s) {
  for (const [v, vs] of Object.entries(s.variants)) {
    console.log(`
== ${v}: ${vs.label}`)
    for (const [bot, b] of Object.entries(vs.bots)) {
      const g = b.all
      console.log(
        `${bot.padEnd(8)} rupture ${s.ranks.map((r) => b.byRank[r].ruptureS.median ?? '–').join('/')}s · quota ${s.ranks.map((r) => Math.round(b.byRank[r].quotaRate * 100)).join('/')}% · peak p ${g.peakPressure.median}/${g.peakPressure.p90} 100%:${Math.round(g.reached100Before * 100)}% · cracks ${g.formed.median} · air ${Math.round(g.spots.air * 100)}% gap ${g.gap.mean} · sealed ${Math.round(g.sealedShare * 100)}% · ends I/O/T ${Math.round(g.endedBy.integrity * 100)}/${Math.round(g.endedBy.overflow * 100)}/${Math.round(g.endedBy.timedOut * 100)}`,
      )
    }
  }
  console.log('')
  for (const bot of Object.keys(s.base)) {
    for (const rank of s.ranks) {
      const g = s.base[bot][rank]
      console.log(
        `${bot.padEnd(8)} r${String(rank).padEnd(2)} rupture ${g.ruptureS.median}s (${g.ruptureS.p10}–${g.ruptureS.p90}) by integrity ${Math.round(g.endedBy.integrity * 100)}% · pressure then ${g.pressureAtRupture.median} · quota ${Math.round(g.quotaRate * 100)}% at ${g.quotaS.median ?? '–'}s · sealed ${g.sealed.median}/${g.needed} of ${g.formed.median} · score ${g.score.median}`,
      )
    }
  }
}

// Start last, so every helper above is defined before it runs.
if (isMainThread) await main()
else await worker()
