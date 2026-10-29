// F51 the economy sim's results page (e2e-shots/sim/index.html): one self-contained file, plain-word headings,
// tables with shaded cells and simple bars. Hover a cell or a bar for its exact number.
import { writeFileSync } from 'node:fs'

const esc = (t) => String(t ?? '–').replace(/&/g, '&amp;').replace(/</g, '&lt;')
const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}%`)
const signed = (x, unit = '') => (x === null || x === undefined ? '–' : `${x > 0 ? '+' : ''}${x}${unit}`)
const signedPct = (x) => (x === null || x === undefined ? '–' : `${x > 0 ? '+' : ''}${Math.round(x * 100)}%`)
// one blue hue, light → dark, for "more" (reference palette, dark surface)
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']
const shade = (v, max) => {
  if (v === null || v === undefined || !max) return ''
  const i = Math.min(RAMP.length - 1, Math.floor((Math.abs(v) / max) * RAMP.length))
  return ` style="background:${RAMP[i]};color:${i >= 3 ? '#fff' : '#0b0b0b'}"`
}
const SKILL_COLOUR = { casual: '#3987e5', focused: '#d95926', sharp: '#199e70' }

function bars(rows, value, fmt, max) {
  const top = max ?? Math.max(1, ...rows.map((r) => value(r) ?? 0))
  return `<div class="bars">${rows.map((r) => {
    const v = value(r)
    const w = v === null || v === undefined ? 0 : Math.max(0.5, (100 * v) / top)
    return `<div class="bar" title="${esc(r.label)}: ${esc(fmt(v))}"><span class="name"><i style="background:${SKILL_COLOUR[r.bot] ?? '#888'}"></i>${esc(r.label)}</span><span class="track"><span class="fill" style="width:${w}%;background:${SKILL_COLOUR[r.bot] ?? '#888'}"></span></span><span class="v">${esc(fmt(v))}</span></div>`
  }).join('')}</div>`
}

const VERDICT = {
  feelable: 'one level is big enough to notice',
  onlyAtMax: 'only noticeable at max level',
  none: 'no measurable effect',
  feltDirectly: 'felt in your hands, not judged by outcomes',
  notRun: 'not measured',
}

export function writeSimPage(s, url) {
  const t = s.settings.feelThreshold
  const legend = `<p class="legend">${['casual', 'focused', 'sharp'].map((b) => `<span><i style="background:${SKILL_COLOUR[b]}"></i>${b[0].toUpperCase() + b.slice(1)}</span>`).join('')}</p>`
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Goops — economy sim</title>
<style>
body{font:15px/1.45 system-ui,sans-serif;background:#1a1a19;color:#f0efec;margin:0;padding:20px;max-width:1200px}
h1{margin:0 0 4px}h2{margin:32px 0 6px;border-bottom:1px solid #383835;padding-bottom:4px}p,li{color:#c3c2b7}.note{font-size:13px}
table{border-collapse:collapse;margin:8px 0;font-size:13px}td,th{padding:4px 8px;border-bottom:1px solid #383835;text-align:right;white-space:nowrap}
th{color:#c3c2b7;font-weight:600}td:first-child,th:first-child{text-align:left}.scroll{overflow-x:auto}
.bars{display:grid;gap:4px;margin:8px 0;max-width:760px}.bar{display:grid;grid-template-columns:230px 1fr 70px;align-items:center;gap:8px;font-size:13px}
.track{background:#262624;height:12px;border-radius:0 4px 4px 0}.fill{display:block;height:12px;border-radius:0 4px 4px 0}.v{text-align:right}
i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}.legend span{margin-right:16px}
.tag{padding:1px 6px;border-radius:4px;background:#383835}.tag.none{background:#d03b3b;color:#fff}.tag.feelable{background:#0ca30c;color:#fff}.tag.onlyAtMax{background:#fab219;color:#0b0b0b}
</style>
<h1>Goops — the economy sim ${s.quick ? '(QUICK RUN — a check, not the numbers to read)' : ''}</h1>
<p>Bots play whole careers — rank 0 to the final shift — on the real game and the real tuning files, earning XP and scraps and buying upgrades three different ways. ${s.careerCount} careers (${s.careerSeeds} per bot × buy style), ${s.shiftsPlayed} shifts in all, ${s.seconds} s. Made ${esc(s.made)}. Same seeds = the same numbers.</p>
<p class="note">A <b>shift is won</b> when its crack quota (the cracks you must seal) is met; a lost shift still earns XP. A <b>stall</b> = the same rank lost 3 or more shifts in a row. <b>Scraps</b> = 1 per rank, spent on upgrade levels. Bots: Casual ignores cracks, Focused chases them, Sharp also vents pressure and keeps the stack low. They go to the console to repair, swap with a hold, fire their actives, and shop between shifts.</p>
${legend}

<h2>1. How many shifts each rank takes</h2>
<p>Shifts played to first reach each rank (median career). The first day counts as one.</p>
<div class="scroll"><table><tr><th>Bot · buy style</th>${s.checkpoints.map((r) => `<th>rank ${r}</th>`).join('')}</tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td>${s.checkpoints.map((c) => `<td>${esc(r.shiftsToRank[c])}</td>`).join('')}</tr>`).join('')}</table></div>
<p>Shifts per rank, by rank band (median career):</p>
<div class="scroll"><table><tr><th>Bot · buy style</th>${s.bands.map((b) => `<th>ranks ${b}</th>`).join('')}</tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td>${r.bands.map((b) => `<td>${esc(b.shiftsPerRank)}</td>`).join('')}</tr>`).join('')}</table></div>
${bars(s.careerRows, (r) => r.shiftsToFinal, (v) => `${v ?? '–'} shifts`)}

<h2>2. How often shifts are won, by rank band</h2>
<p>Share of shifts that met the quota (darker = more). Then the share of the quota sealed, how long the tank lasted, and XP a shift.</p>
<div class="scroll"><table><tr><th>Bot · buy style</th>${s.bands.map((b) => `<th>won ${b}</th>`).join('')}${s.bands.map((b) => `<th>quota ${b}</th>`).join('')}</tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td>${r.bands.map((b) => `<td${shade(b.winRate, 1)} title="${b.shifts} shifts">${pct(b.winRate)}</td>`).join('')}${r.bands.map((b) => `<td${shade(b.quota, 1)}>${pct(b.quota)}</td>`).join('')}</tr>`).join('')}</table></div>
<div class="scroll"><table><tr><th>Bot · buy style</th>${s.bands.map((b) => `<th>tank lasts ${b}</th>`).join('')}${s.bands.map((b) => `<th>XP a shift ${b}</th>`).join('')}${s.bands.map((b) => `<th>actives fired ${b}</th>`).join('')}</tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td>${r.bands.map((b) => `<td>${esc(b.survivedS)} s</td>`).join('')}${r.bands.map((b) => `<td>${esc(b.xp)}</td>`).join('')}${r.bands.map((b) => `<td>${esc(b.fired)}</td>`).join('')}</tr>`).join('')}</table></div>

<h2>3. Where careers get stuck</h2>
<table><tr><th>Bot · buy style</th><th>stalls a career</th><th>longest losing run (median)</th><th>ranks where stalls happened (how many)</th></tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.stallsPerCareer)}</td><td>${esc(r.longestLosingRun)}</td><td style="text-align:left;white-space:normal">${r.stallRanks.map((x) => `${x.rank} (${x.count})`).join(', ') || 'none'}</td></tr>`).join('')}</table>

<h2>4. Scraps: earned vs spent, and what each buy style owns</h2>
<p>${s.careerRows[0]?.scraps.levelsOffered ?? '–'} upgrade levels are on offer (not counting ${esc(s.settings.neverBuy.join(', '))}, which no bot buys); a whole career earns ${s.careerRows[0]?.scraps.earned ?? '–'} scraps or fewer.</p>
<table><tr><th>Bot · buy style</th><th>earned</th><th>spent</th>${s.checkpoints.map((c) => `<th>unspent at ${c}</th>`).join('')}</tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.scraps.earned)}</td><td>${esc(r.scraps.spent)}</td>${s.checkpoints.map((c) => `<td>${esc(r.scraps.unspent[c])}</td>`).join('')}</tr>`).join('')}</table>
${[40, 50].map((at) => {
    const rows = s.careerRows.filter((r) => r.owned[at])
    if (!rows.length) return `<p>No career reached rank ${at} in this run.</p>`
    const ids = Object.keys(rows[0].owned[at].levels)
    const styles = [...new Set(rows.map((r) => r.style))]
    const one = styles.map((st) => rows.find((r) => r.style === st && r.bot === 'sharp') ?? rows.find((r) => r.style === st))
    return `<p>Levels owned at rank ${at} (average over careers; Sharp bot, or the first that got there):</p><div class="scroll"><table><tr><th>Upgrade</th>${one.map((r) => `<th>${esc(r.label)}</th>`).join('')}</tr>
${ids.map((id) => `<tr><td>${esc(id)}</td>${one.map((r) => `<td${shade(r.owned[at].levels[id], 8)}>${esc(r.owned[at].levels[id])}</td>`).join('')}</tr>`).join('')}
<tr><td><b>all levels</b></td>${one.map((r) => `<td><b>${esc(r.owned[at].total)}</b></td>`).join('')}</tr><tr><td>actives taken in</td>${one.map((r) => `<td>${esc(r.owned[at].equipped.join(', ') || 'none')}</td>`).join('')}</tr></table></div>`
  }).join('')}

<h2>5. What every upgrade really does</h2>
<p>Each upgrade on vs owning nothing, the same seeds both ways, at the rank it opens and at rank ${s.settings.effectLateRank} (late game). "Noticeable" uses a <b>placeholder</b> line until Muzzy calibrates it: ${t.seconds} s longer before the tank breaks, or ${Math.round(t.winRate * 100)}% more shifts won, or ${Math.round(t.quota * 100)}% more of the quota sealed. The best bot × rank is shown; hover for the seeds that changed at all.</p>
<div class="scroll"><table><tr><th>Upgrade (opens at)</th><th>verdict</th><th>1 level: tank lasts</th><th>won</th><th>quota</th><th>XP</th><th>max level: tank lasts</th><th>won</th><th>quota</th><th>XP</th><th>shift length (max)</th></tr>
${s.effects.map((e) => `<tr><td>${esc(e.name)} (${e.rank})</td><td><span class="tag ${e.verdict}">${esc(VERDICT[e.verdict])}</span></td>${[e.best1, e.bestMax].map((c) => c
    ? `<td title="${c.bot}, rank ${c.rank}: ${pct(c.changed)} of seeds changed">${signed(c.dSurvivedS, ' s')}</td><td>${signedPct(c.dWin)}</td><td>${signedPct(c.dQuota)}</td><td>${signed(c.dXp)}</td>`
    : '<td>–</td><td>–</td><td>–</td><td>–</td>').join('')}<td>${e.bestMax ? signed(e.bestMax.dLengthS, ' s') : '–'}</td></tr>`).join('')}</table></div>
<details><summary>Every bot, rank and level</summary><div class="scroll"><table><tr><th>Upgrade</th><th>rank</th><th>level</th><th>bot</th><th>without: lasts</th><th>won</th><th>quota</th><th>change: lasts</th><th>length</th><th>won</th><th>quota</th><th>XP</th><th>seeds changed</th><th>actives fired</th></tr>
${s.effects.flatMap((e) => e.cells.map((c) => `<tr><td>${esc(e.name)}</td><td>${c.rank}</td><td>${c.level}</td><td>${c.bot}</td><td>${c.offSurvivedS} s</td><td>${pct(c.offWin)}</td><td>${pct(c.offQuota)}</td><td>${signed(c.dSurvivedS, ' s')}</td><td>${signed(c.dLengthS, ' s')}</td><td>${signedPct(c.dWin)}</td><td>${signedPct(c.dQuota)}</td><td>${signed(c.dXp)}</td><td>${pct(c.changed)}</td><td>${c.fired}</td></tr>`)).join('')}</table></div></details>

<h2>6. The final shift (rank 50)</h2>
<p>Win rate with the upgrades each career really had when it got there, vs none (the same seeds). The F64 bot row is the old final-shift bot path (no swap hold, no actives) for comparison.</p>
${bars(s.finalRows.filter((r) => r.n), (r) => r.winRate, (v) => pct(v), 1)}
<table><tr><th>Bot · upgrades</th><th>shifts</th><th>won</th><th>valve stages opened (avg)</th></tr>
${s.finalRows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.n}</td><td>${pct(r.winRate)}</td><td>${esc(r.stages)}</td></tr>`).join('')}</table>
<table><tr><th>Bot · buy style</th><th>careers that reached it</th><th>careers that won it</th><th>tries to win (median)</th><th>how final shifts ended</th></tr>
${s.careerRows.map((r) => `<tr><td>${esc(r.label)}</td><td>${pct(r.reachedFinal)}</td><td>${pct(r.finalWonShare)}</td><td>${esc(r.finalTries)}</td><td style="text-align:left">${Object.entries(r.finalOutcomes).map(([k, v]) => `${k} ${v}`).join(' · ') || '–'}</td></tr>`).join('')}</table>
<p class="note">Raw numbers: results.json next to this page. Re-run: npm run sim:economy.</p>
</html>`
  writeFileSync(url, html)
}
