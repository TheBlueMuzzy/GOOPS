// The bots' results page (e2e-shots/bots/index.html): one self-contained file, inline SVG, no CDN.
// Written by run.mjs from results.json; `node scripts/bots/page.mjs` rebuilds it from the last results.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BOTS = ['idle', 'casual', 'focused', 'sharp']
const LABEL = { idle: 'Idle', casual: 'Casual', focused: 'Focused', sharp: 'Sharp' }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`)
const num = (x) => (x === null || x === undefined ? '–' : String(x))

// ---------------------------------------------------------------- charts

// Lines over time, one per bot (median of the seeds). y = one measure only.
function lineChart(s, rank, key, { title, yMax, yFmt = (v) => v, note = '' }) {
  const W = 340, H = 190, L = 38, R = 10, T = 12, B = 26
  const series = BOTS.map((b) => ({ b, pts: s.timelines[b][rank].map((p) => [p.t, p[key]]) }))
  const xMax = Math.max(30, ...series.flatMap((x) => x.pts.map((p) => p[0])))
  const max = yMax ?? Math.max(1, ...series.flatMap((x) => x.pts.map((p) => p[1])))
  const X = (t) => L + (t / xMax) * (W - L - R)
  const Y = (v) => T + (1 - v / max) * (H - T - B)
  const grid = [0, 0.5, 1].map((f) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(max * f)}" y2="${Y(max * f)}"/><text class="tick" x="${L - 5}" y="${Y(max * f) + 4}" text-anchor="end">${yFmt(max * f)}</text>`).join('')
  const xt = [0, 30, 60, 90, 120, 150, 180].filter((t) => t <= xMax).map((t) => `<text class="tick" x="${X(t)}" y="${H - 8}" text-anchor="middle">${t}s</text>`).join('')
  const lines = series.map(({ b, pts }) => pts.length ? `<polyline class="ln s-${b}" points="${pts.map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"><title>${LABEL[b]}: ends ~${pts.at(-1)[0]} s at ${yFmt(pts.at(-1)[1])}</title></polyline>` : '').join('')
  return `<figure><figcaption>${esc(title)}${note ? `<span class="note"> ${esc(note)}</span>` : ''}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${grid}${xt}${lines}</svg></figure>`
}

// Rupture time: median dot + p10–p90 whisker, per rank, per bot.
function ruptureChart(s) {
  const W = 700, rowH = 15, L = 70, R = 20, T = 20
  const ranks = s.ranks
  const H = T + ranks.length * (BOTS.length * rowH + 14) + 24
  const xMax = Math.ceil(Math.max(...BOTS.flatMap((b) => ranks.map((r) => s.base[b][r].ruptureS.p90 ?? 0))) / 10) * 10 + 10
  const xMin = Math.max(0, Math.floor(Math.min(...BOTS.flatMap((b) => ranks.map((r) => s.base[b][r].ruptureS.p10 ?? 0))) / 10) * 10 - 10)
  const X = (v) => L + ((v - xMin) / (xMax - xMin)) * (W - L - R)
  let y = T
  let out = ''
  for (let v = xMin; v <= xMax; v += 10) out += `<line class="grid" x1="${X(v)}" x2="${X(v)}" y1="${T - 8}" y2="${H - 22}"/><text class="tick" x="${X(v)}" y="${H - 6}" text-anchor="middle">${v}s</text>`
  for (const r of ranks) {
    out += `<text class="lab" x="4" y="${y + (BOTS.length * rowH) / 2 + 4}">Rank ${r}</text>`
    for (const b of BOTS) {
      const g = s.base[b][r].ruptureS
      const cy = y + rowH / 2
      out += `<g><title>${LABEL[b]}, rank ${r}: rupture median ${g.median} s (10–90%: ${g.p10}–${g.p90} s)</title><rect x="${L}" y="${y}" width="${W - L - R}" height="${rowH}" fill="transparent"/><line class="wh s-${b}" x1="${X(g.p10)}" x2="${X(g.p90)}" y1="${cy}" y2="${cy}"/><circle class="dot s-${b}" cx="${X(g.median)}" cy="${cy}" r="4.5"/></g>`
      y += rowH
    }
    y += 14
  }
  return `<figure class="wide"><figcaption>When the tank ruptures — median (dot) and 10–90% of seeds (line); the axis starts at ${xMin} s</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rupture time by bot and rank">${out}</svg></figure>`
}

// Quota met: share of shifts, bars per rank, per bot.
function quotaChart(s) {
  const W = 700, H = 200, L = 40, R = 10, T = 14, B = 28
  const groupW = (W - L - R) / s.ranks.length
  const barW = (groupW - 24) / BOTS.length
  const Y = (v) => T + (1 - v) * (H - T - B)
  let out = [0, 0.5, 1].map((f) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(f)}" y2="${Y(f)}"/><text class="tick" x="${L - 5}" y="${Y(f) + 4}" text-anchor="end">${f * 100}%</text>`).join('')
  s.ranks.forEach((r, gi) => {
    const x0 = L + gi * groupW + 12
    BOTS.forEach((b, bi) => {
      const g = s.base[b][r]
      const v = g.quotaRate ?? 0
      const h = Math.max(0, Y(0) - Y(v))
      const x = x0 + bi * barW + 1
      out += `<g><title>${LABEL[b]}, rank ${r}: quota met in ${pct(v)} of shifts${g.quotaS.median !== null ? `, median at ${g.quotaS.median} s` : ''} (needs ${g.needed})</title><rect x="${x}" y="${T}" width="${barW - 2}" height="${H - T - B}" fill="transparent"/><rect class="bar s-${b}" x="${x}" y="${Y(v)}" width="${barW - 2}" height="${h}" rx="3"/></g>`
    })
    out += `<text class="tick" x="${x0 + (groupW - 24) / 2}" y="${H - 8}" text-anchor="middle">Rank ${r} · needs ${s.base.focused[r].needed}</text>`
  })
  return `<figure class="wide"><figcaption>Quota met (share of shifts)</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Quota rate by bot and rank">${out}</svg></figure>`
}

// Sensitivity: change in median rupture time vs today's tuning, per knob, −25% and +25% (pooled over ranks).
function sensitivityChart(s, bot) {
  const rows = s.sensitivity.filter((x) => x.bot === bot)
  const W = 700, rowH = 30, L = 230, R = 30, T = 18
  const H = T + rows.length * rowH + 26
  const avg = (byRank) => s.ranks.reduce((a, r) => a + (byRank[r].ruptureS ?? 0), 0) / s.ranks.length
  const deltas = rows.map((x) => ({ knob: x.knob, base: avg(x.baseByRank), lo: avg(x.variants['0.75']) - avg(x.baseByRank), hi: avg(x.variants['1.25']) - avg(x.baseByRank) }))
  const m = Math.max(5, ...deltas.flatMap((d) => [Math.abs(d.lo), Math.abs(d.hi)]))
  const X = (v) => L + ((v + m) / (2 * m)) * (W - L - R)
  let out = `<line class="axis" x1="${X(0)}" x2="${X(0)}" y1="${T - 6}" y2="${H - 20}"/>`
  for (const v of [-m, -m / 2, m / 2, m]) out += `<text class="tick" x="${X(v)}" y="${H - 4}" text-anchor="middle">${v > 0 ? '+' : ''}${v.toFixed(0)}s</text>`
  deltas.forEach((d, i) => {
    const y = T + i * rowH
    out += `<text class="lab" x="${L - 8}" y="${y + 18}" text-anchor="end">${esc(d.knob)}</text>`
    for (const [k, v] of [['lo', d.lo], ['hi', d.hi]]) {
      const yy = y + (k === 'lo' ? 8 : 18)
      const x1 = Math.min(X(0), X(v)), w = Math.abs(X(v) - X(0))
      out += `<g><title>${esc(d.knob)} ${k === 'lo' ? '−25%' : '+25%'}: rupture ${v >= 0 ? '+' : ''}${v.toFixed(1)} s (today ${d.base.toFixed(1)} s, average of the rank medians)</title><rect class="bar ${k === 'lo' ? 'v-lo' : 'v-hi'}" x="${x1}" y="${yy - 4}" width="${Math.max(1, w)}" height="8" rx="2"/></g>`
    }
  })
  return `<figure class="wide"><figcaption>${LABEL[bot]}: what each knob does to rupture time <span class="key"><i class="sw v-lo"></i>−25% <i class="sw v-hi"></i>+25%</span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sensitivity for ${LABEL[bot]}">${out}</svg></figure>`
}

// ---------------------------------------------------------------- tables

function baseTable(s, set, title) {
  let rows = ''
  for (const b of BOTS) {
    for (const r of s.ranks) {
      const g = s[set][b][r]
      rows += `<tr><td>${LABEL[b]}</td><td>${r}</td><td>${g.ruptureS.median} <small>(${g.ruptureS.p10}–${g.ruptureS.p90})</small></td><td>${pct(g.endedBy.integrity)} / ${pct(g.endedBy.overflow)}</td><td>${num(g.pressureAtRupture.median)}</td><td>${g.endS.median}</td><td>${pct(g.quotaRate)}${g.quotaS.median !== null ? ` <small>@${g.quotaS.median}s</small>` : ''}</td><td>${g.sealed.median}/${g.needed} <small>of ${g.formed.median}</small></td><td>${g.score.median}</td><td>${g.xp.median}</td><td>${g.breakdowns.laser}/${g.breakdowns.visor}/${g.breakdowns.controls}</td></tr>`
    }
  }
  return `<h3>${esc(title)}</h3><div class="tw"><table><thead><tr><th>Bot</th><th>Rank</th><th>Rupture s (10–90%)</th><th>By integrity / overflow</th><th>Pressure at rupture</th><th>End s</th><th>Quota</th><th>Sealed / needed</th><th>Score</th><th>XP</th><th>Breaks L/V/C</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

function crackTable(s) {
  let rows = ''
  for (const b of BOTS) {
    for (const r of [0, 6]) {
      const g = s.base[b][r]
      rows += `<tr><td>${LABEL[b]}</td><td>${r}</td><td>${g.crackEveryS}</td><td>${g.crackOpenS}</td><td>${num(g.sealS.median)}</td><td>${pct(g.sealedShare)}</td><td>${pct(g.spots.surface)} / ${pct(g.spots.air)} / ${pct(g.spots.under)}</td><td>${pct(g.sealedBySpot.surface)} / ${pct(g.sealedBySpot.air)} / ${pct(g.sealedBySpot.under)}</td><td>${pct(g.spots.visible)}</td><td>${pct(g.sealedByVisible.visible)} / ${pct(g.sealedByVisible.offscreen)}</td><td>${g.crackSecondsPerShift}</td><td>${pct(g.crackSecondsShare.neverSealed)}</td><td>${num(g.integrityPerCrackSecond)}</td></tr>`
    }
  }
  return `<div class="tw"><table><thead><tr><th>Bot</th><th>Rank</th><th>A crack every (s)</th><th>Crack open (s, avg)</th><th>Time to seal (s, median)</th><th>Sealed</th><th>Formed on surface / in air / under goop</th><th>Sealed: surface / air / under</th><th>Formed on screen</th><th>Sealed: on / off screen</th><th>Crack-seconds a shift</th><th>…from never-sealed cracks</th><th>Integrity per crack-second</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

function sensitivityTable(s) {
  let rows = ''
  for (const x of s.sensitivity) {
    const cell = (byRank) => s.ranks.map((r) => `${num(byRank[r].ruptureS)}s ${pct(byRank[r].quotaRate)}`).join('<br>')
    rows += `<tr><td>${LABEL[x.bot]}</td><td>${esc(x.knob)} <small>(${x.base})</small></td><td>${cell(x.variants['0.75'])}</td><td>${cell(x.baseByRank)}</td><td>${cell(x.variants['1.25'])}</td></tr>`
  }
  return `<div class="tw"><table><thead><tr><th>Bot</th><th>Knob (today)</th><th>−25%</th><th>Today</th><th>+25%</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">Each cell: rank ${s.ranks.join(' / ')} top to bottom — median rupture time, then share of shifts that met the quota.</p>`
}

// ---------------------------------------------------------------- page

export function writePage(s, url) {
  const legend = `<p class="legend">${BOTS.map((b) => `<span><i class="sw s-${b}"></i>${LABEL[b]}</span>`).join('')}</p>`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Goops Balance Bots</title>
<style>
:root{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e4e3df;--idle:#8a8984;--casual:#2a78d6;--focused:#eb6834;--sharp:#1baf7a;--lo:#2a78d6;--hi:#e34948;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#353532;--idle:#9a9993;--casual:#3987e5;--focused:#d95926;--sharp:#199e70;--lo:#3987e5;--hi:#e66767;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#353532;--idle:#9a9993;--casual:#3987e5;--focused:#d95926;--sharp:#199e70;--lo:#3987e5;--hi:#e66767;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:19px;margin:32px 0 8px}h3{font-size:16px;margin:20px 0 6px}
p{max-width:75ch;color:var(--ink2)}.note{color:var(--ink2);font-size:13px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
figure{margin:0;padding:10px 12px;border:1px solid var(--grid);border-radius:10px}figure.wide{margin:10px 0}
figcaption{font-weight:600;font-size:14px;margin-bottom:6px}svg{width:100%;height:auto;display:block}
.grid{stroke:var(--grid);stroke-width:1}.axis{stroke:var(--ink2);stroke-width:1}.tick{fill:var(--ink2);font-size:10px}.lab{fill:var(--ink);font-size:12px}
.ln{fill:none;stroke-width:2;stroke-linejoin:round}.wh{stroke-width:2;stroke-linecap:round}.dot{stroke:var(--bg);stroke-width:2}
${BOTS.map((b) => `.ln.s-${b},.wh.s-${b}{stroke:var(--${b})}.dot.s-${b},.bar.s-${b},.sw.s-${b}{fill:var(--${b});background:var(--${b})}`).join('')}
.v-lo{fill:var(--lo);background:var(--lo)}.v-hi{fill:var(--hi);background:var(--hi)}
.legend span,.key{margin-right:14px;font-size:13px;color:var(--ink2);font-weight:400}.sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin:0 5px 0 8px;vertical-align:-1px}
g:hover .dot,g:hover .bar{opacity:.75}
.tw{overflow-x:auto;border:1px solid var(--grid);border-radius:10px;margin:8px 0}
table{border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums;min-width:100%}
th,td{padding:5px 8px;border-bottom:1px solid var(--grid);text-align:left;white-space:nowrap}th{position:sticky;top:0;background:var(--bg);font-weight:600}
small{color:var(--ink2)}
</style></head><body><main>
<h1>Goops — balance bots</h1>
<p>${s.shifts} headless shifts on the real engine and today's tuning (${s.seeds} seeds per cell, ranks ${s.ranks.join(', ')}), made ${esc(s.made.slice(0, 16).replace('T', ' '))} UTC in ${s.seconds} s. Medians, with 10–90% spreads. Hover a mark for its numbers. Plain-English write-up: <code>.planning/research/balance-bots.md</code>.</p>
${legend}
<h2>How shifts end</h2>
${ruptureChart(s)}
${quotaChart(s)}
<h2>Inside a shift (median of the seeds, rank 0 and rank 6)</h2>
${[0, 6].map((r) => `<h3>Rank ${r}</h3><div class="grid2">${lineChart(s, r, 'integrity', { title: 'Tank integrity', yMax: 1, yFmt: (v) => `${Math.round(v * 100)}%` })}${lineChart(s, r, 'pressure', { title: 'Pressure', yMax: 1, yFmt: (v) => `${Math.round(v * 100)}%` })}${lineChart(s, r, 'open', { title: 'Open cracks', yFmt: (v) => Math.round(v) })}${lineChart(s, r, 'stack', { title: 'Stack height (rows)', yFmt: (v) => Math.round(v) })}</div>`).join('')}
<p class="note">Lines stop when fewer than half the seeds are still going (the shift had ended for the rest).</p>
<h2>Where the integrity goes</h2>
${crackTable(s)}
<p class="note">Surface = on the floor or on goop with open sky above (a piece can land on it now). In air = nothing under it yet. Under goop = buried. On screen = inside the 12 visible columns when it formed.</p>
<h2>Sensitivity (±25%, one knob at a time)</h2>
${sensitivityChart(s, 'focused')}
${sensitivityChart(s, 'sharp')}
${sensitivityTable(s)}
<h2>All runs</h2>
${baseTable(s, 'base', 'Breakdowns on (as the game plays)')}
${baseTable(s, 'noBreakdowns', 'Breakdowns off')}
</main></body></html>`
  writeFileSync(url, html)
}

// Rebuild the page from the last results.json without re-running the bots.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = new URL('../../e2e-shots/bots/', import.meta.url)
  writePage(JSON.parse(readFileSync(new URL('results.json', dir), 'utf8')), new URL('index.html', dir))
  console.log('page rebuilt')
}
