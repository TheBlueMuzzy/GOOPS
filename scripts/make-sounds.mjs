// THROWAWAY ONLY: play uses recorded CC0 sounds (content/credits.json) — this makes code-made placeholders and OVERWRITES them in public/audio/; don't run it on the game.
// PLACEHOLDER SOUNDS, MADE IN CODE (F29) — every sound in content/audio.json, synthesised here and written to
// public/audio/{sfx,ui}/ as mp3 (named category_object_action_01). Placeholders until real recordings replace them:
// swap a file in public/audio/ (or in the Dev Kit's Sound tab) and this script is no longer needed for it.
//   node scripts/make-sounds.mjs            (needs ffmpeg on the PATH — Windows: winget install Gyan.FFmpeg)
//   node scripts/make-sounds.mjs goop_pop   (only the files whose name has "goop_pop" in it)
// A tiny synth with no library: sine / triangle / square / saw / noise, envelopes, pitch slides and swept filters.
// Goo = bubbles (a sine that rises fast as it fades — how real bubbles sound) + wet filtered noise; the console = clicks.
// Seeded, so every run makes the same files.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const RATE = 44100
const only = process.argv[2] ?? ''

// ---- the synth ----
function rng(seed) { // mulberry32
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE))
const lerp = (a, b, t) => a + (b - a) * t
// a value that moves from a to b over the sound: curve > 1 = fast at the end, < 1 = fast at the start
const slide = (a, b, curve = 1) => (t) => lerp(a, b, Math.pow(Math.min(1, Math.max(0, t)), curve))
const expSlide = (a, b) => (t) => a * Math.pow(b / a, Math.min(1, Math.max(0, t)))
// attack (s), then an exponential fade to silence by the end
const env = (attack, length, power = 1) => (s) => (s < attack ? s / attack : Math.pow(Math.max(0, 1 - (s - attack) / (length - attack)), power))

const wave = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  square: (p) => ((p % 1) < 0.5 ? 1 : -1) * 0.6,
  saw: (p) => (2 * (p % 1) - 1) * 0.6,
}

/** Adds a tone into out from `at` (s): freq(t 0..1) Hz, amp(seconds) 0..1, optional vibrato */
function tone(out, { at = 0, length, freq, amp, gain = 1, shape = 'sine', vibratoHz = 0, vibrato = 0 }) {
  const start = Math.floor(at * RATE), n = Math.floor(length * RATE)
  let phase = 0
  for (let i = 0; i < n && start + i < out.length; i++) {
    const s = i / RATE, t = i / n
    const f = freq(t) * (1 + vibrato * Math.sin(2 * Math.PI * vibratoHz * s))
    phase += f / RATE
    out[start + i] += wave[shape](phase) * amp(s) * gain
  }
}

/** A bubble: a sine whose pitch rises as it fades (f0 → f0 × rise) */
function bubble(out, { at = 0, f0, rise = 2.2, length = 0.08, gain = 1 }) {
  tone(out, { at, length, gain, freq: slide(f0, f0 * rise, 0.6), amp: env(0.002, length, 2) })
}

// RBJ biquad, cutoff swept over the sound (recomputed every 16 samples)
function filtered(src, { type, freq, q = 0.8 }) {
  const out = new Float32Array(src.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0
  for (let i = 0; i < src.length; i++) {
    if (i % 16 === 0) {
      const f = Math.min(RATE * 0.45, Math.max(20, freq(i / src.length)))
      const w = (2 * Math.PI * f) / RATE, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q)
      let c0, c1, c2
      if (type === 'low') [c0, c1, c2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
      else if (type === 'high') [c0, c1, c2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
      else [c0, c1, c2] = [alpha, 0, -alpha] // band
      const a0 = 1 + alpha
      b0 = c0 / a0; b1 = c1 / a0; b2 = c2 / a0; a1 = (-2 * cos) / a0; a2 = (1 - alpha) / a0
    }
    const x = src[i]
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x; y2 = y1; y1 = y
    out[i] = y
  }
  return out
}

/** Adds filtered noise into out: a filter { type, freq(t), q }, amp(seconds), optional gate(seconds) 0/1 for static */
function noise(out, { at = 0, length, amp, gain = 1, filter, random, gate }) {
  const n = Math.floor(length * RATE), raw = new Float32Array(n)
  for (let i = 0; i < n; i++) raw[i] = random() * 2 - 1
  const shaped = filter ? filtered(raw, filter) : raw
  const start = Math.floor(at * RATE)
  for (let i = 0; i < n && start + i < out.length; i++) {
    const s = i / RATE
    out[start + i] += shaped[i] * amp(s) * gain * (gate ? gate(s) : 1)
  }
}

// peak to -2 dBFS (room for the mp3's own overshoot), a 3 ms fade-in (no click, still instant) and a short fade-out
function finish(out) {
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  const scale = peak > 0 ? 0.79 / peak : 1
  const fadeIn = Math.floor(0.003 * RATE), fadeOut = Math.floor(0.01 * RATE)
  for (let i = 0; i < out.length; i++) {
    let g = scale
    if (i < fadeIn) g *= i / fadeIn
    if (i > out.length - fadeOut) g *= (out.length - i) / fadeOut
    out[i] *= g
  }
  return out
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2)
  const head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8)
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22)
  head.writeUInt32LE(RATE, 24); head.writeUInt32LE(RATE * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34)
  head.write('data', 36); head.writeUInt32LE(data.length, 40)
  return Buffer.concat([head, data])
}

// ---- the sounds (variant = 0, 1, 2… for the _01, _02… files) ----
const D5 = 587.33, FS5 = 739.99, A5 = 880, D6 = 1174.66, A4 = 440, F4 = 349.23, D4 = 293.66

const sounds = {
  // a wet thud: low body + a soft splat + two small low bubbles
  'sfx/sfx_goop_land': [3, (v, r) => {
    const o = buffer(0.26), k = [1, 0.9, 1.12][v]
    tone(o, { length: 0.16, freq: expSlide(110 * k, 48 * k), amp: env(0.002, 0.16, 2), gain: 0.9 })
    noise(o, { length: 0.12, random: r, amp: env(0.001, 0.12, 3), gain: 0.6, filter: { type: 'low', freq: slide(900 * k, 250), q: 1.2 } })
    bubble(o, { at: 0.03, f0: 210 * k, rise: 1.8, length: 0.07, gain: 0.35 })
    bubble(o, { at: 0.07 + 0.02 * v, f0: 290 * k, rise: 1.6, length: 0.06, gain: 0.22 })
    return o
  }],
  // a squelch: resonant noise sweeping up, with a bubble in it
  'sfx/sfx_goop_merge': [2, (v, r) => {
    const o = buffer(0.2), k = [1, 1.15][v]
    noise(o, { length: 0.17, random: r, amp: env(0.01, 0.17, 1.5), gain: 1.4, filter: { type: 'band', freq: expSlide(320 * k, 1300 * k), q: 6 } })
    bubble(o, { at: 0.04, f0: 360 * k, rise: 2, length: 0.08, gain: 0.5 })
    return o
  }],
  // a soft bloop, tuned to D5 (the ladder's key: content/audio.json ladder.root)
  'sfx/sfx_goop_ready': [1, () => {
    const o = buffer(0.22)
    tone(o, { length: 0.2, freq: (t) => D5 * (t < 0.12 ? lerp(0.82, 1, t / 0.12) : 1), amp: env(0.004, 0.2, 2), gain: 0.8 })
    tone(o, { length: 0.12, freq: () => D5 * 2, amp: env(0.002, 0.12, 3), gain: 0.15 })
    return o
  }],
  // a wet pop: a sharp rising bubble, a splash and a low thump
  'sfx/sfx_goop_pop': [3, (v, r) => {
    const o = buffer(0.3), k = [1, 0.88, 1.1][v]
    bubble(o, { f0: 420 * k, rise: 3.2, length: 0.07, gain: 1 })
    bubble(o, { at: 0.035, f0: 620 * k, rise: 2.4, length: 0.05, gain: 0.45 })
    noise(o, { at: 0.01, length: 0.22, random: r, amp: env(0.004, 0.22, 3), gain: 0.55, filter: { type: 'band', freq: slide(2500 * k, 900), q: 1.5 } })
    tone(o, { length: 0.1, freq: expSlide(140 * k, 60), amp: env(0.002, 0.1, 2), gain: 0.5 })
    return o
  }],
  // a jiggle: a wobbling low blob
  'sfx/sfx_goop_poke': [2, (v) => {
    const o = buffer(0.24), k = [1, 1.2][v]
    tone(o, { length: 0.22, freq: () => 190 * k, vibratoHz: 16, vibrato: 0.18, amp: (s) => env(0.004, 0.22, 1.5)(s) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 16 * s)) })
    tone(o, { length: 0.1, freq: () => 380 * k, amp: env(0.002, 0.1, 2), gain: 0.2 })
    return o
  }],
  // a hiss of escaping pressure, then a clunk as the crack closes
  'sfx/sfx_crack_seal': [1, (v, r) => {
    const o = buffer(0.42)
    noise(o, { length: 0.22, random: r, amp: env(0.005, 0.22, 1.2), gain: 0.5, filter: { type: 'high', freq: slide(2500, 5000), q: 0.7 } })
    tone(o, { at: 0.17, length: 0.14, freq: expSlide(160, 90), amp: env(0.001, 0.14, 2), gain: 1 })
    tone(o, { at: 0.17, length: 0.08, freq: () => 640, amp: env(0.001, 0.08, 3), gain: 0.3, shape: 'tri' })
    noise(o, { at: 0.17, length: 0.03, random: r, amp: env(0.001, 0.03, 2), gain: 0.4, filter: { type: 'band', freq: () => 1800, q: 2 } })
    return o
  }],
  // a glassy crack: a click and two high pings
  'sfx/sfx_crack_form': [2, (v, r) => {
    const o = buffer(0.2), k = [1, 0.9][v]
    noise(o, { length: 0.02, random: r, amp: env(0.0005, 0.02, 2), gain: 1, filter: { type: 'high', freq: () => 3000, q: 0.7 } })
    tone(o, { length: 0.16, freq: () => 2700 * k, amp: env(0.001, 0.16, 4), gain: 0.35 })
    tone(o, { at: 0.012, length: 0.12, freq: () => 3930 * k, amp: env(0.001, 0.12, 4), gain: 0.25 })
    noise(o, { at: 0.03, length: 0.05, random: r, amp: env(0.0005, 0.05, 3), gain: 0.4, filter: { type: 'band', freq: () => 5200 * k, q: 3 } })
    return o
  }],
  // a short soft click-blip
  'sfx/sfx_piece_rotate': [1, (v, r) => {
    const o = buffer(0.07)
    tone(o, { length: 0.05, freq: slide(700, 1000), amp: env(0.001, 0.05, 3), gain: 0.6, shape: 'tri' })
    noise(o, { length: 0.012, random: r, amp: env(0.0005, 0.012, 2), gain: 0.5, filter: { type: 'band', freq: () => 2500, q: 1.5 } })
    return o
  }],
  // a ratchet tick
  'sfx/sfx_tank_spin': [2, (v, r) => {
    const o = buffer(0.04), k = [1, 1.18][v]
    noise(o, { length: 0.025, random: r, amp: env(0.0005, 0.025, 3), gain: 1, filter: { type: 'band', freq: () => 1900 * k, q: 4 } })
    tone(o, { length: 0.02, freq: () => 950 * k, amp: env(0.0005, 0.02, 3), gain: 0.3 })
    return o
  }],
  // a swish
  'sfx/sfx_piece_swap': [1, (v, r) => {
    const o = buffer(0.2)
    noise(o, { length: 0.18, random: r, amp: (s) => Math.sin(Math.PI * Math.min(1, s / 0.18)), gain: 1, filter: { type: 'band', freq: expSlide(700, 3200), q: 2.5 } })
    tone(o, { length: 0.1, freq: slide(500, 800), amp: env(0.003, 0.1, 2), gain: 0.25, shape: 'tri' })
    return o
  }],
  // a downward whoosh
  'sfx/sfx_piece_drop': [1, (v, r) => {
    const o = buffer(0.24)
    noise(o, { length: 0.22, random: r, amp: env(0.004, 0.22, 1.2), gain: 1, filter: { type: 'band', freq: expSlide(2600, 380), q: 2.5 } })
    return o
  }],
  // the laser powers down with a fizz
  'sfx/sfx_laser_break': [1, (v, r) => {
    const o = buffer(0.75)
    const saw = buffer(0.7)
    tone(saw, { length: 0.7, freq: expSlide(900, 70), amp: env(0.003, 0.7, 1.3), shape: 'saw' })
    const low = filtered(saw, { type: 'low', freq: expSlide(4000, 400), q: 2 })
    for (let i = 0; i < low.length; i++) o[i] += low[i]
    noise(o, { length: 0.5, random: r, amp: env(0.002, 0.5, 1.5), gain: 0.35, filter: { type: 'high', freq: () => 3000, q: 0.7 },
      gate: (s) => (Math.sin(s * 310) * Math.sin(s * 77) > 0.2 ? 1 : 0) })
    return o
  }],
  // the visor: a burst of static
  'sfx/sfx_visor_break': [1, (v, r) => {
    const o = buffer(0.55)
    const g = rng(7)
    const gates = Array.from({ length: 40 }, () => (g() > 0.35 ? 1 : 0.15))
    noise(o, { length: 0.52, random: r, amp: env(0.002, 0.52, 1), gain: 1, filter: { type: 'band', freq: (t) => 2200 + 1200 * Math.sin(t * 19), q: 1.2 },
      gate: (s) => gates[Math.floor(s * 75) % gates.length] })
    tone(o, { length: 0.3, freq: () => 60, amp: env(0.002, 0.3, 2), gain: 0.25, shape: 'square' })
    return o
  }],
  // the controls overheat: a sputtering motor and a hiss
  'sfx/sfx_controls_break': [1, (v, r) => {
    const o = buffer(0.7)
    const g = rng(11)
    const gates = Array.from({ length: 30 }, () => (g() > 0.4 ? 1 : 0))
    const motor = buffer(0.45)
    tone(motor, { length: 0.45, freq: expSlide(95, 55), amp: (s) => env(0.002, 0.45, 1)(s) * gates[Math.floor(s * 40) % gates.length], shape: 'square' })
    const low = filtered(motor, { type: 'low', freq: () => 900, q: 1 })
    for (let i = 0; i < low.length; i++) o[i] += low[i]
    noise(o, { at: 0.15, length: 0.55, random: r, amp: (s) => Math.min(1, s / 0.05) * Math.max(0, 1 - s / 0.55), gain: 0.35, filter: { type: 'high', freq: () => 4000, q: 0.7 } })
    return o
  }],
  // a machine powers back up, then a confirming double blip
  'sfx/sfx_machine_fix': [1, () => {
    const o = buffer(0.55)
    tone(o, { length: 0.32, freq: expSlide(180, 880), amp: (s) => Math.min(1, s / 0.25) * 0.7, shape: 'tri' })
    tone(o, { at: 0.33, length: 0.08, freq: () => A5, amp: env(0.002, 0.08, 2), gain: 0.6, shape: 'square' })
    tone(o, { at: 0.42, length: 0.12, freq: () => D6, amp: env(0.002, 0.12, 2), gain: 0.6, shape: 'square' })
    return o
  }],
  // the tank ruptures: a low two-tone alarm over a rumble
  'sfx/sfx_tank_rupture': [1, (v, r) => {
    const o = buffer(1.7)
    const siren = buffer(1.6)
    tone(siren, { length: 1.6, freq: (t) => (Math.floor(t * 6) % 2 ? 165 : 220), amp: (s) => (s < 0.01 ? s / 0.01 : s > 1.3 ? Math.max(0, (1.6 - s) / 0.3) : 1), shape: 'saw' })
    const low = filtered(siren, { type: 'low', freq: () => 1100, q: 1.5 })
    for (let i = 0; i < low.length; i++) o[i] += low[i] * 0.8
    noise(o, { length: 1.6, random: r, amp: env(0.01, 1.6, 1), gain: 0.9, filter: { type: 'low', freq: () => 160, q: 0.9 } })
    tone(o, { length: 0.5, freq: expSlide(80, 35), amp: env(0.002, 0.5, 2), gain: 0.8 })
    return o
  }],
  // the quota: a bright little arpeggio
  'sfx/sfx_shift_quota': [1, () => {
    const o = buffer(0.65)
    ;[D5, FS5, A5, D6].forEach((f, i) => {
      tone(o, { at: i * 0.08, length: 0.35, freq: () => f, amp: env(0.003, 0.35, 2), gain: 0.5, shape: 'tri' })
      tone(o, { at: i * 0.08, length: 0.2, freq: () => f * 2, amp: env(0.002, 0.2, 3), gain: 0.12 })
    })
    return o
  }],
  // the shift ends well: a rising call and a held chord
  'sfx/sfx_shift_won': [1, () => {
    const o = buffer(1.1)
    ;[D5, A5].forEach((f, i) => tone(o, { at: i * 0.12, length: 0.2, freq: () => f, amp: env(0.003, 0.2, 2), gain: 0.5, shape: 'tri' }))
    ;[D5, FS5, A5, D6].forEach((f) => tone(o, { at: 0.26, length: 0.8, freq: () => f, amp: env(0.01, 0.8, 1.5), gain: 0.3, shape: 'tri', vibratoHz: 5, vibrato: 0.004 }))
    return o
  }],
  // the shift ends short: a wobbly fall
  'sfx/sfx_shift_lost': [1, () => {
    const o = buffer(1.05)
    ;[A4, F4, D4].forEach((f, i) => tone(o, { at: i * 0.22, length: i === 2 ? 0.6 : 0.24, freq: (t) => f * (i === 2 ? lerp(1, 0.94, t) : 1),
      amp: env(0.004, i === 2 ? 0.6 : 0.24, 1.5), gain: 0.55, shape: 'tri', vibratoHz: 6, vibrato: i === 2 ? 0.02 : 0.006 }))
    return o
  }],
  // the periscope: a metal clank, a thud and a ratchet
  'ui/ui_periscope_pull': [1, (v, r) => {
    const o = buffer(0.4)
    ;[310, 487, 829, 1240].forEach((f, i) => tone(o, { length: 0.3 - i * 0.05, freq: () => f, amp: env(0.001, 0.3 - i * 0.05, 3), gain: 0.35 / (i + 1) }))
    tone(o, { length: 0.12, freq: expSlide(120, 60), amp: env(0.001, 0.12, 2), gain: 0.8 })
    for (let i = 0; i < 3; i++) noise(o, { at: 0.12 + i * 0.045, length: 0.02, random: r, amp: env(0.0005, 0.02, 2), gain: 0.35, filter: { type: 'band', freq: () => 1700, q: 3 } })
    return o
  }],
  // a repair step done right: a bright double blip
  'ui/ui_repair_step': [1, () => {
    const o = buffer(0.14)
    tone(o, { length: 0.05, freq: () => 1320, amp: env(0.001, 0.05, 2), gain: 0.5, shape: 'square' })
    tone(o, { at: 0.055, length: 0.07, freq: () => 1760, amp: env(0.001, 0.07, 2), gain: 0.5, shape: 'square' })
    return o
  }],
  // a wrong button: a short low buzz
  'ui/ui_repair_wrong': [1, () => {
    const o = buffer(0.2)
    const buzz = buffer(0.18)
    tone(buzz, { length: 0.18, freq: () => 110, amp: env(0.002, 0.18, 0.8), shape: 'square' })
    const low = filtered(buzz, { type: 'low', freq: () => 1400, q: 0.8 })
    for (let i = 0; i < low.length; i++) o[i] += low[i]
    return o
  }],
  // a crisp console click
  'ui/ui_button_tap': [1, (v, r) => {
    const o = buffer(0.05)
    noise(o, { length: 0.008, random: r, amp: env(0.0003, 0.008, 2), gain: 0.8, filter: { type: 'band', freq: () => 3500, q: 1.5 } })
    tone(o, { length: 0.035, freq: () => 2000, amp: env(0.0005, 0.035, 4), gain: 0.4, shape: 'tri' })
    return o
  }],
  // a lower click (back / close)
  'ui/ui_button_back': [1, (v, r) => {
    const o = buffer(0.05)
    noise(o, { length: 0.008, random: r, amp: env(0.0003, 0.008, 2), gain: 0.8, filter: { type: 'band', freq: () => 2400, q: 1.5 } })
    tone(o, { length: 0.04, freq: () => 1300, amp: env(0.0005, 0.04, 4), gain: 0.4, shape: 'tri' })
    return o
  }],
  // a switch on: rising; off: falling
  'ui/ui_toggle_on': [1, () => {
    const o = buffer(0.1)
    tone(o, { length: 0.035, freq: () => 880, amp: env(0.0005, 0.035, 2), gain: 0.5, shape: 'tri' })
    tone(o, { at: 0.04, length: 0.05, freq: () => 1320, amp: env(0.0005, 0.05, 2), gain: 0.5, shape: 'tri' })
    return o
  }],
  'ui/ui_toggle_off': [1, () => {
    const o = buffer(0.1)
    tone(o, { length: 0.035, freq: () => 1320, amp: env(0.0005, 0.035, 2), gain: 0.5, shape: 'tri' })
    tone(o, { at: 0.04, length: 0.05, freq: () => 880, amp: env(0.0005, 0.05, 2), gain: 0.5, shape: 'tri' })
    return o
  }],
}

// ---- render ----
const tmp = join(tmpdir(), `goops-sounds-${process.pid}`)
mkdirSync(tmp, { recursive: true })
let made = 0
try {
  for (const [name, [count, make]] of Object.entries(sounds)) {
    for (let v = 0; v < count; v++) {
      const file = `${name}_0${v + 1}`
      if (only && !file.includes(only)) continue
      const seed = [...file].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) // its own dice, by name
      const samples = finish(make(v, rng(seed)))
      const wavPath = join(tmp, `${file.replace('/', '_')}.wav`)
      writeFileSync(wavPath, wav(samples))
      const out = join('public', 'audio', `${file}.mp3`)
      mkdirSync(join('public', 'audio', name.split('/')[0]), { recursive: true })
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', out])
      made++
      console.log(`  ${out}  (${(samples.length / RATE).toFixed(2)} s)`)
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
console.log(`${made} sounds made`)
