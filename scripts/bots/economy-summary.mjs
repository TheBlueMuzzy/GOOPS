// F51 the economy sim's numbers: careers, upgrade on/off runs and final shifts → the summary economy-page.mjs draws
// and results.json keeps. Plain statistics, no game rules (those are in career.ts).

const quantile = (xs, q) => {
  if (!xs.length) return null
  const a = [...xs].sort((x, y) => x - y)
  const i = (a.length - 1) * q
  const lo = Math.floor(i)
  return a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)
}
const median = (xs) => quantile(xs, 0.5)
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const r1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10)
const r3 = (n) => (n === null || n === undefined ? null : Math.round(n * 1000) / 1000)

/** Which baseline an upgrade's on/off runs share: owning nothing ('none'), or its own (a slot, or effectCompanions). */
export const baselineOf = (u, eco) => (u.feature === 'abilitySlots' || eco.effectCompanions[u.id] ? u.id : 'none')

/** The ranks an upgrade's on/off runs play at: the rank it opens, then economy.json effectLateRanks (the final shift = 50). */
export const effectRanks = (u, eco) => [...new Set([u.rank, ...eco.effectLateRanks.filter((r) => r >= u.rank)])]

export const BANDS =[[1, 9], [10, 19], [20, 29], [30, 39], [40, 49]]
const bandName = ([a, b]) => `${a}–${b}`
const CHECKPOINTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]

// ---------------------------------------------------------------- careers

function stallsOf(c) {
  // a stall = the same rank lost 3+ shifts in a row (the final shift counts as rank 50)
  const out = []
  let run = 0
  let at = -1
  for (const s of c.shifts.slice(1)) {
    if (s.rank !== at) { if (run >= 3) out.push({ rank: at, losses: run }); run = 0; at = s.rank }
    if (s.won) { if (run >= 3) out.push({ rank: at, losses: run }); run = 0 } else run++
  }
  if (run >= 3) out.push({ rank: at, losses: run })
  return out
}

function longestLosingRun(c) {
  let best = 0, run = 0
  for (const s of c.shifts.slice(1)) { run = s.won ? 0 : run + 1; best = Math.max(best, run) }
  return best
}

function careerRow(cs, label, upgrades, eco) {
  const normal = (c) => c.shifts.slice(1).filter((s) => s.outcome === undefined)
  const shiftsTo = (c, rank) => { const i = c.shifts.findIndex((s) => s.rank >= rank); return i < 0 ? null : i }
  const offered = upgrades.filter((u) => !eco.neverBuy.includes(u.id))
  const levelsOffered = offered.reduce((a, u) => a + u.maxLevel, 0)
  const ownedAt = (rank) => {
    const have = cs.map((c) => c.ownedAt[rank]).filter(Boolean)
    if (!have.length) return null
    const byId = Object.fromEntries(upgrades.map((u) => [u.id, r1(mean(have.map((o) => o[u.id] ?? 0)))]))
    return { levels: byId, total: r1(mean(have.map((o) => Object.values(o).reduce((a, b) => a + b, 0)))), equipped: cs.map((c) => c.equippedAt[rank]).filter(Boolean)[0] ?? [] }
  }
  const stalls = cs.flatMap(stallsOf)
  const finals = cs.flatMap((c) => c.shifts.filter((s) => s.outcome !== undefined))
  return {
    label, n: cs.length,
    reachedFinal: r3(cs.filter((c) => c.loadout50).length / cs.length),
    shiftsToFinal: r1(median(cs.map((c) => shiftsTo(c, 50)).filter((x) => x !== null))),
    shiftsToRank: Object.fromEntries(CHECKPOINTS.map((r) => [r, r1(median(cs.map((c) => shiftsTo(c, r)).filter((x) => x !== null)))])),
    winRate: r3(mean(cs.flatMap((c) => normal(c).map((s) => (s.won ? 1 : 0))))),
    bands: BANDS.map((b) => {
      const ss = cs.flatMap((c) => normal(c).filter((s) => s.rank >= b[0] && s.rank <= b[1]))
      const perCareer = cs.map((c) => normal(c).filter((s) => s.rank >= b[0] && s.rank <= b[1]).length)
      return { band: bandName(b), shifts: ss.length, shiftsPerRank: r1(median(perCareer) / (b[1] - b[0] + 1)), winRate: r3(mean(ss.map((s) => (s.won ? 1 : 0)))),
        quota: r3(mean(ss.map((s) => s.quota))), survivedS: r1(median(ss.map((s) => s.survivedS))), xp: Math.round(median(ss.map((s) => s.xp)) ?? 0),
        fired: r1(mean(ss.map((s) => s.fired))), repairs: r1(mean(ss.map((s) => s.repairs))) }
    }),
    stallsPerCareer: r1(stalls.length / cs.length),
    stallRanks: Object.entries(stalls.reduce((a, s) => ({ ...a, [s.rank]: (a[s.rank] ?? 0) + 1 }), {})).map(([rank, count]) => ({ rank: Number(rank), count })).sort((a, b) => a.rank - b.rank),
    longestLosingRun: r1(median(cs.map(longestLosingRun))),
    finalWonShare: cs.some((c) => c.loadout50) ? r3(cs.filter((c) => c.finalWon).length / cs.filter((c) => c.loadout50).length) : null,
    finalTries: r1(median(cs.filter((c) => c.finalWon).map((c) => c.finalTries))),
    finalOutcomes: finals.reduce((a, s) => ({ ...a, [s.outcome]: (a[s.outcome] ?? 0) + 1 }), {}),
    scraps: {
      earned: r1(mean(cs.map((c) => c.scrapsEarned))), spent: r1(mean(cs.map((c) => c.scrapsSpent))), levelsOffered,
      unspent: Object.fromEntries(CHECKPOINTS.map((r) => [r, r1(mean(cs.map((c) => c.unspentByRank[r]).filter((x) => x !== undefined)))])),
    },
    owned: { 10: ownedAt(10), 20: ownedAt(20), 30: ownedAt(30), 40: ownedAt(40), 50: ownedAt(50) },
  }
}

// ---------------------------------------------------------------- upgrades on vs off

function effectRows({ eco, upgrades, effectJobs, effectResults }) {
  const base = new Map()
  const on = new Map()
  effectJobs.forEach((j, i) => {
    const k = j.key
    if (k.base !== undefined) base.set(`${k.base}|${k.rank}|${k.bot}|${k.seed}`, effectResults[i])
    else on.set(`${k.id}|${k.rank}|${k.bot}|${k.level}|${k.seed}`, effectResults[i])
  })
  const t = eco.feelThreshold
  const rows = []
  for (const u of upgrades) {
    const ranks = effectRanks(u, eco)
    const bk = baselineOf(u, eco)
    const cells = []
    for (const rank of ranks) for (const level of [...new Set([1, u.maxLevel])]) for (const bot of eco.effectSkills) {
      const pairs = []
      for (let seed = 1; ; seed++) {
        const a = base.get(`${bk}|${rank}|${bot}|${seed}`)
        const b = on.get(`${u.id}|${rank}|${bot}|${level}|${seed}`)
        if (!a || !b) break
        pairs.push([a, b])
      }
      if (!pairs.length) continue
      const d = (f) => r3(mean(pairs.map(([a, b]) => f(b) - f(a))))
      const cell = {
        rank, level, bot, n: pairs.length,
        offSurvivedS: r1(mean(pairs.map(([a]) => a.survivedMs / 1000))), offWin: r3(mean(pairs.map(([a]) => (a.won ? 1 : 0)))), offQuota: r3(mean(pairs.map(([a]) => a.quota))),
        dSurvivedS: r1(d((r) => r.survivedMs / 1000)), dLengthS: r1(d((r) => r.realMs / 1000)), dWin: d((r) => (r.won ? 1 : 0)), dQuota: d((r) => r.quota),
        dXp: Math.round(d((r) => r.score) ?? 0), changed: r3(pairs.filter(([a, b]) => a.score !== b.score || a.survivedMs !== b.survivedMs).length / pairs.length),
        fired: r1(mean(pairs.map(([, b]) => Object.values(b.fired).reduce((x, y) => x + y, 0)))),
      }
      // noise: any change reshuffles the whole shift (the same seed plays out differently), so a difference only counts
      // when it's bigger than twice its standard error over the seeds as well as over the feel line
      const se = (f) => {
        const ds = pairs.map(([a, b]) => f(b) - f(a))
        const m = mean(ds)
        return ds.length > 1 ? Math.sqrt(ds.reduce((x, v) => x + (v - m) ** 2, 0) / (ds.length - 1) / ds.length) : Infinity
      }
      cell.seSurvivedS = r1(se((r) => r.survivedMs / 1000))
      cell.seWin = r3(se((r) => (r.won ? 1 : 0)))
      cell.seQuota = r3(se((r) => r.quota))
      const clear = (v, s, line) => Math.abs(v) >= line && Math.abs(v) > 2 * s
      cell.feel = clear(cell.dSurvivedS, cell.seSurvivedS, t.seconds) || clear(cell.dWin, cell.seWin, t.winRate) || clear(cell.dQuota, cell.seQuota, t.quota)
      cells.push(cell)
    }
    const at = (level) => cells.filter((c) => c.level === level)
    const good = (c) => c.feel && (c.dQuota > 0 || c.dWin > 0 || (c.dQuota === 0 && c.dSurvivedS > 0))
    const verdict = eco.feltDirectly.includes(u.id) ? 'feltDirectly'
      : cells.some((c) => c.feel) && !cells.some(good) ? 'hurts'
      : at(1).some((c) => c.feel) ? 'feelable'
      : at(u.maxLevel).some((c) => c.feel) ? 'onlyAtMax'
      : cells.length ? 'none' : 'notRun'
    const best = (level) => cells.filter((c) => c.level === level).reduce((m, c) => (!m || Math.abs(c.dSurvivedS) + 100 * Math.abs(c.dQuota) > Math.abs(m.dSurvivedS) + 100 * Math.abs(m.dQuota) ? c : m), null)
    rows.push({ id: u.id, name: u.name, type: u.type, rank: u.rank, maxLevel: u.maxLevel, verdict, best1: best(1), bestMax: best(u.maxLevel), cells })
  }
  return rows
}

// ---------------------------------------------------------------- the final shift

function finalRows({ eco, finalJobs, finalResults, styles }) {
  const rows = []
  const pick = (pred) => finalJobs.map((j, i) => [j, finalResults[i]]).filter(([j]) => pred(j.key)).map(([, r]) => r)
  const winOf = (rs) => (rs.length ? r3(rs.filter((r) => r.outcome === 'won').length / rs.length) : null)
  for (const bot of eco.skills) {
    for (const style of styles) {
      const rs = pick((k) => k.with && k.bot === bot && k.style === style)
      rows.push({ label: `${bot} · ${eco.buyStyles[style].label}`, bot, style, upgrades: 'career', n: rs.length, winRate: winOf(rs), stages: r1(mean(rs.map((r) => r.stage))) })
    }
    const raw = pick((k) => k.raw && k.bot === bot)
    rows.push({ label: `${bot} · career, ${eco.finalLeaveOut.join(' + ')} still on`, bot, upgrades: 'raw', n: raw.length, winRate: winOf(raw), stages: r1(mean(raw.map((r) => r.stage))) })
    const none = pick((k) => k.with === false && k.bot === bot)
    rows.push({ label: `${bot} · no upgrades`, bot, upgrades: 'none', n: none.length, winRate: winOf(none), stages: r1(mean(none.map((r) => r.stage))) })
    const old = pick((k) => k.path === 'runFinal' && k.bot === bot)
    rows.push({ label: `${bot} · no upgrades (F64 bot)`, bot, upgrades: 'runFinal', n: old.length, winRate: winOf(old), stages: r1(mean(old.map((r) => r.stage))) })
  }
  return rows
}

// ---------------------------------------------------------------- all of it

export function summarise(d) {
  const { eco, upgrades, careers, quick, careerSeeds, effectSeeds, finalSeeds, seconds } = d
  const styles = Object.keys(eco.buyStyles)
  const careerRows = []
  for (const bot of eco.skills) for (const style of styles) {
    const cs = careers.filter((c) => c.bot === bot && c.style === style)
    careerRows.push({ bot, style, ...careerRow(cs, `${d.bots[bot].label} · ${eco.buyStyles[style].label}`, upgrades, eco) })
  }
  const effects = effectRows(d)
  return {
    made: new Date().toISOString(), quick, seconds: r1(seconds), careerSeeds, effectSeeds, finalSeeds,
    careerCount: careers.length,
    shiftsPlayed: careers.reduce((a, c) => a + c.shifts.length, 0) + d.effectResults.length + d.finalResults.length,
    settings: eco, bands: BANDS.map(bandName), checkpoints: CHECKPOINTS,
    careerRows, effects,
    dead: effects.filter((e) => e.verdict === 'none').map((e) => ({ id: e.id, name: e.name })),
    finalRows: finalRows({ ...d, styles }),
    careers: careers.map((c) => ({ bot: c.bot, style: c.style, seed: c.seed, reachedRank: c.reachedRank, finalWon: c.finalWon, finalTries: c.finalTries, shifts: c.shifts.length,
      ranks: c.shifts.map((s) => s.rank), won: c.shifts.map((s) => (s.won ? 1 : 0)), stalls: stallsOf(c) })),
  }
}
