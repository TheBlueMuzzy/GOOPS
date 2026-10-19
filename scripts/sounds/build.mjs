// Build Goops' recorded sounds from CC0 pack files (F29, 2026-10-19). recipes.mjs = which recordings make each file.
// The packs (Kenney Impact / RPG / Casino Audio, OpenGameArt rubberduck CC0 packs — see content/credits.json) are not
// in the repo: download + unzip them into one folder first. Needs ffmpeg.
// usage: node scripts/sounds/build.mjs <packsDir> public/audio [filter]
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const [packs, outDir, only = ''] = process.argv.slice(2)
const R = 44100

function decode(src, af) {
  const args = ['-v', 'error', '-i', join(packs, src)]
  args.push('-af', ['aformat=channel_layouts=mono', af].filter(Boolean).join(','))
  args.push('-ar', String(R), '-f', 'f32le', '-')
  const buf = execFileSync('ffmpeg', args, { maxBuffer: 1 << 28 })
  return Float32Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4))
}
const peakOf = (s) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const onsetOf = (s) => { const p = peakOf(s); let i = 0; while (i < s.length && Math.abs(s[i]) < p * 0.1) i++; return i }
const db = (x) => 20 * Math.log10(x)
const TARGET = -18
function activeRms(s) {
  const w = Math.floor(0.02 * R), pw = []
  for (let i = 0; i < s.length; i += w) { let a = 0, n = 0; for (let j = i; j < i + w && j < s.length; j++) { a += s[j] * s[j]; n++ } pw.push(a / n) }
  const mx = Math.max(...pw)
  const act = pw.filter((p) => p > mx / 100)
  return 10 * Math.log10(act.reduce((a, p) => a + p, 0) / act.length)
}

// variable-rate playback (pitch+speed together, like the audio module's pitch): rate goes from a to b over the output
function resample(s, a, b = a) {
  if (a === 1 && b === 1) return s
  const out = []
  let pos = 0
  const approxLen = s.length / ((a + b) / 2)
  while (pos < s.length - 1) {
    const t = Math.min(1, out.length / approxLen)
    const i = Math.floor(pos), f = pos - i
    out.push(s[i] * (1 - f) + s[i + 1] * f)
    pos += a + (b - a) * t
  }
  return Float32Array.from(out)
}
const st = (n) => Math.pow(2, n / 12)

// pitch (Hz) by autocorrelation over the loudest 60 ms
function pitchOf(s) {
  const on = onsetOf(s), win = Math.floor(0.06 * R)
  const seg = s.subarray(on + Math.floor(0.01 * R), on + Math.floor(0.01 * R) + win)
  let best = 0, bestLag = 0
  for (let lag = Math.floor(R / 1500); lag < Math.floor(R / 80); lag++) {
    let c = 0
    for (let i = 0; i + lag < seg.length; i++) c += seg[i] * seg[i + lag]
    if (c > best) { best = c; bestLag = lag }
  }
  return R / bestLag
}

function layer(L) {
  let s = decode(L.src, L.af)
  if (L.start || L.dur) s = s.subarray(Math.floor((L.start ?? 0) * R), L.dur ? Math.floor(((L.start ?? 0) + L.dur) * R) : s.length)
  if (!L.keepLead) s = s.subarray(Math.max(0, onsetOf(s) - Math.floor(0.002 * R)))
  if (L.toD) {
    const hz = pitchOf(s)
    const n = 12 * Math.log2(hz / 293.66)
    const shift = -(n - 12 * Math.floor(n / 12)) // down to the D below: a deeper bloop, room for the ladder to climb
    console.log(`   ${L.src}: ${hz.toFixed(1)} Hz -> shift ${shift.toFixed(2)} st to D`)
    L.pitch = (L.pitch ?? 0) + shift
  }
  const a = st(L.pitch ?? 0), b = L.glideTo !== undefined ? st(L.glideTo) : a
  s = resample(s, a, b)
  if (L.fadeOutMs) { const n = Math.floor(L.fadeOutMs / 1000 * R); for (let i = 0; i < n && i < s.length; i++) s[s.length - 1 - i] *= i / n }
  const g = Math.pow(10, (L.gain ?? 0) / 20)
  const p = peakOf(s) || 1
  return { s: s.map((v) => (v / p) * g), at: Math.floor((L.at ?? 0) / 1000 * R) }
}

function build(name, recipe) {
  const ls = recipe.layers.map(layer)
  const len = Math.max(...ls.map((l) => l.at + l.s.length))
  let out = new Float32Array(len)
  for (const l of ls) for (let i = 0; i < l.s.length; i++) out[l.at + i] += l.s[i]
  // trim the start to the onset (10% of peak), keep 2 ms
  out = out.subarray(Math.max(0, onsetOf(out) - Math.floor(0.002 * R)))
  // trim the tail: last sample above -50 dB of peak
  const p = peakOf(out)
  let end = out.length - 1
  while (end > 0 && Math.abs(out[end]) < p * 0.00316) end--
  if (recipe.maxSec) end = Math.min(end, Math.floor(recipe.maxSec * R))
  out = Float32Array.from(out.subarray(0, end + 1))
  // 3 ms fade-in, fade-out
  const fi = Math.floor(0.003 * R)
  for (let i = 0; i < fi && i < out.length; i++) out[i] *= i / fi
  const fo = Math.min(Math.floor((recipe.fadeOutMs ?? 40) / 1000 * R), Math.floor(out.length / 2))
  for (let i = 0; i < fo; i++) out[out.length - 1 - i] *= i / fo
  // level: loudness-matched on the active part (RMS of the 20 ms windows within 20 dB of the loudest) to TARGET,
  // then a fast limiter keeps peaks under -1.5 dBFS (shaves the spikiest transients a few dB)
  // (never push a spike more than ~3.5 dB into the limiter: a very spiky file ends up a little quieter instead)
  const g = Math.pow(10, Math.min(TARGET - activeRms(out), 2 - db(peakOf(out))) / 20)
  for (let i = 0; i < out.length; i++) out[i] *= g
  const file = join(outDir, name)
  mkdirSync(dirname(file), { recursive: true })
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(R), '-ac', '1', '-i', '-', '-af', 'alimiter=limit=0.84:attack=0.5:release=40:level=disabled', '-c:a', 'libmp3lame', '-b:a', '96k', file], { input: Buffer.from(out.buffer) })
  console.log(`${name.padEnd(34)} ${(out.length / R).toFixed(2)}s  pre-limit peak ${db(peakOf(out)).toFixed(1)}  active rms ${activeRms(out).toFixed(1)}`)
}

const recipes = (await import('./recipes.mjs')).default
for (const [name, r] of Object.entries(recipes)) if (name.includes(only)) build(name, r)
