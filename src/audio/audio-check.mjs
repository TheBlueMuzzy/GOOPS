// AUDIO CHECK — is every sound in the game as loud as the others, and does it start on time? (framework F31)
// Run from the game folder:
//   npm run audio:check                 a table of every file in public/audio/, the off ones flagged
//   npm run audio:check -- --fix        …and evens out the flagged ones
//   node src/audio/audio-check.mjs [--fix] [game-folder]
// For each file: its folder (sfx · ui · stg · amb · mus), loudness, loudest peak, how late it starts, length, and a
// verdict: ✓ · "3.5 dB too quiet" · "starts 60 ms late" · "peaks 0.4 dB over -1 dB".
// The targets are content/audio.json "loudness" (default: every folder -18, ±3 dB, ceiling -1 dB, late = over 20 ms) —
// how they're measured: loudness.mjs, and the design (framework/.planning/design/audio.md "Loudness").
//
// --fix rewrites ONLY the flagged files, in place (same name, so content/audio.json needs no change): brought to
// target, spikes limited, and effects + menus trimmed to their onset. Before a file is first changed, it is copied to
// audio-originals/<same path> — outside public/, so it's never shipped to players. An original is never overwritten:
// the first one kept stays (to undo: copy it back). A file with a kept original isn't limited again (see loudness.mjs).
// A file that can't be brought closer (already limited: its loudness IS its spikes) is left as it was — its original is
// still kept, as the mark that it was tried, so the next report doesn't flag it again.
// It only ever writes inside public/audio/ and audio-originals/, and never deletes anything.
//
// Exit code: 0 = the report ran (even with flagged files — it's a report), 1 = it couldn't run (no ffmpeg, a broken
// file it couldn't read or write).
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { FFMPEG_MISSING, FOLDERS, findFfmpeg, judge, levelFile, measureFile, readLoudness } from './loudness.mjs'

export const AUDIO_DIR = 'public/audio'
export const ORIGINALS_DIR = 'audio-originals'
export const SOUND_TYPES = ['.mp3', '.ogg', '.oga', '.wav', '.m4a', '.flac', '.aac', '.webm', '.opus']

/** The game's content/audio.json, or null */
function readAudioJson(gameDir) {
  try { return JSON.parse(readFileSync(join(gameDir, 'content', 'audio.json'), 'utf8')) } catch { return null }
}

/**
 * Every sound file under public/audio/: [{ rel: 'sfx/sfx_pop_01.mp3', folder: 'sfx', file: <full path> }], A–Z.
 * Links (symlinks, junctions) are skipped, so nothing outside public/audio/ is ever read or written.
 */
export function listSounds(gameDir) {
  const root = join(gameDir, AUDIO_DIR)
  if (!existsSync(root)) return []
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return SOUND_TYPES.includes(extname(entry.name).toLowerCase()) ? [path] : []
  })
  return walk(root)
    .map((file) => {
      const rel = relative(root, file).replaceAll('\\', '/')
      return { rel, folder: rel.split('/')[0], file }
    })
    .sort((a, b) => a.rel.localeCompare(b.rel))
}

/**
 * The kept original of a sound, if there is one: audio-originals/<same folder>/<same name> first, else the same name
 * in another type (the Dev Kit drop keeps a dropped .wav as sfx_pop_01.wav beside the sfx_pop_01.mp3 it made) — but
 * never a file that is the original of ANOTHER sound in public/audio (hit.mp3 + hit.ogg each keep their own). null = none.
 */
export function originalOf(gameDir, rel) {
  const dir = join(gameDir, ORIGINALS_DIR, dirname(rel))
  if (!existsSync(dir)) return null
  if (existsSync(join(dir, basename(rel)))) return join(dir, basename(rel))
  const stem = basename(rel, extname(rel))
  const soundDir = join(gameDir, AUDIO_DIR, dirname(rel))
  const found = readdirSync(dir, { withFileTypes: true }).find((e) =>
    e.isFile() && basename(e.name, extname(e.name)) === stem && !existsSync(join(soundDir, e.name)))
  return found ? join(dir, found.name) : null
}

/**
 * Measures and judges every sound. → { rows, settings, warnings }
 * rows: [{ rel, folder, measured, verdict: { ok, problems, note }, fixedBefore }] — a file in an unknown folder
 * gets measured = null and a problem saying so (it can't have a target).
 */
export async function checkSounds(gameDir, { ffmpeg, audioJson = readAudioJson(gameDir) }) {
  const { settings, warnings } = readLoudness(audioJson)
  const rows = []
  for (const sound of listSounds(gameDir)) {
    if (!FOLDERS.includes(sound.folder)) {
      rows.push({ ...sound, measured: null, fixedBefore: false, verdict: { ok: false, problems: [`not in a sound folder (${FOLDERS.join(' · ')})`], note: '' } })
      continue
    }
    const fixedBefore = originalOf(gameDir, sound.rel) !== null
    const measured = await measureFile(ffmpeg, sound.file, sound.folder)
    rows.push({ ...sound, measured, fixedBefore, verdict: judge(measured, sound.folder, settings, { fixedBefore }) })
  }
  return { rows, settings, warnings }
}

/** Can --fix do something about this row? (not for silence or a file in an unknown folder) */
const fixable = (row) => row.measured && !row.verdict.ok && !row.verdict.problems.includes('silent')

/** Is `path` really inside `dir`? (both resolved, links followed for what exists — a path that doesn't exist yet is
 *  resolved through its nearest existing folder, so both sides are compared the same way) */
function isInside(dir, path) {
  const real = (p) => (existsSync(p) ? realpathSync(p) : dirname(p) === p ? resolve(p) : join(real(dirname(p)), basename(p)))
  return real(path).startsWith(real(dir) + sep)
}

/**
 * --fix: evens out every flagged row (see the top of this file). Returns one line per file saying what changed.
 * Throws (plain words) if a file can't be written — what was done before that stays done.
 */
export async function fixSounds(gameDir, rows, { ffmpeg, settings }) {
  const audioDir = join(gameDir, AUDIO_DIR)
  const originalsDir = join(gameDir, ORIGINALS_DIR)
  const changes = []
  const work = mkdtempSync(join(tmpdir(), 'audio-check-'))
  try {
    for (const row of rows.filter(fixable)) {
      const target = join(audioDir, row.rel)
      if (!isInside(audioDir, target)) throw new Error(`Not allowed: ${row.rel} is outside ${AUDIO_DIR}/`)
      const temp = join(work, `fixed${extname(row.rel)}`)
      const fix = await levelFile(ffmpeg, target, temp, row.folder, settings, { fixedBefore: row.fixedBefore })
      // keep the original first — only if this sound has none yet (never overwritten)
      let kept = originalOf(gameDir, row.rel)
      if (!kept) {
        kept = join(originalsDir, row.rel)
        if (!isInside(originalsDir, kept)) throw new Error(`Not allowed: ${row.rel} would be kept outside ${ORIGINALS_DIR}/`)
        mkdirSync(dirname(kept), { recursive: true })
        // checked again now its folder exists: a linked folder inside audio-originals/ can't lead the copy elsewhere
        if (!isInside(originalsDir, dirname(kept))) throw new Error(`Not allowed: audio-originals/${dirname(row.rel)} points outside ${ORIGINALS_DIR}/`)
        copyFileSync(target, kept, constants.COPYFILE_EXCL) // never over an existing file
      }
      const keptAt = relative(gameDir, kept).replaceAll('\\', '/')
      // never make it worse: a result no closer to the target (a file whose loudness IS its spikes — already limited)
      // is thrown away. Its original is still kept, which marks it as tried: the next report says "as loud as its
      // spikes allow" instead of flagging it again.
      // (a file whose only problem was a peak over the ceiling counts as better once the peak is under it)
      const distance = (m) => Math.abs(m.loudnessDb - settings.targets[row.folder])
      const overCeiling = (m) => m.peakDb > settings.ceilingDb + 0.05
      const peakFixed = overCeiling(row.measured) && !overCeiling(fix.after)
      if (!peakFixed && distance(fix.after) > distance(row.measured) - 0.3 && fix.trimMs < 1) {
        const verdict = judge(row.measured, row.folder, settings, { fixedBefore: true })
        changes.push({ rel: row.rel, before: row.measured, after: row.measured, verdict, line: `${row.rel}: left as it was — as loud as its spikes allow (original: ${keptAt})` })
        continue
      }
      copyFileSync(temp, target)
      const after = fix.after
      const trimmed = fix.trimMs >= 1 ? `, trimmed ${Math.round(fix.trimMs)} ms` : ''
      const verdict = judge(after, row.folder, settings, { fixedBefore: true })
      changes.push({
        rel: row.rel, before: row.measured, after, verdict,
        line: `${row.rel}: ${db(row.measured.loudnessDb)} → ${db(after.loudnessDb)} dB${trimmed} · original: ${keptAt}${verdict.ok ? '' : ` · still: ${verdict.problems.join(', ')}`}`,
      })
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return changes
}

// ---------- the report ----------
const db = (x) => (Number.isFinite(x) ? x.toFixed(1) : 'silent')

/** The table: one line per file, then nothing else (the summary is separate). */
export function formatTable(rows) {
  const lines = [['File', 'Folder', 'Loudness', 'Peak', 'Onset', 'Length', 'Verdict']]
  for (const r of rows) {
    const m = r.measured
    const verdict = r.verdict.ok ? (r.verdict.note ? `✓ (${r.verdict.note})` : '✓') : r.verdict.problems.join(', ')
    lines.push(m
      ? [r.rel, r.folder, `${db(m.loudnessDb)} dB${m.method === 'lufs' ? ' LUFS' : ''}`, `${db(m.peakDb)} dB`, `${Math.round(m.onsetMs)} ms`, `${(m.lengthMs / 1000).toFixed(2)} s`, verdict]
      : [r.rel, r.folder, '', '', '', '', verdict])
  }
  const widths = lines[0].map((_, i) => Math.max(...lines.map((l) => l[i].length)))
  return lines.map((l) => l.map((cell, i) => (i === l.length - 1 ? cell : cell.padEnd(widths[i]))).join('  ').trimEnd()).join('\n')
}

/** "34 sounds · 6 to even out (5 too quiet, 1 starts late)" */
export function summarize(rows, settings) {
  const off = rows.filter((r) => !r.verdict.ok)
  const count = (word) => off.filter((r) => r.verdict.problems.some((p) => p.includes(word))).length
  const kinds = [['too quiet', count('too quiet')], ['too loud', count('too loud')], ['peaks over the ceiling', count('peaks')], [count('late') === 1 ? 'starts late' : 'start late', count('late')], ['silent', count('silent')], ['in no sound folder', count('sound folder')]]
    .filter(([, n]) => n).map(([word, n]) => `${n} ${word}`)
  const targets = [...new Set(Object.values(settings.targets))].length === 1
    ? `target ${settings.targets.sfx} dB` : `targets ${FOLDERS.map((f) => `${f} ${settings.targets[f]}`).join(', ')} dB`
  const head = `${rows.length} sound${rows.length === 1 ? '' : 's'} · ${targets} ±${settings.toleranceDb} · ceiling ${settings.ceilingDb} dB`
  return off.length ? `${head} · ${off.length} to even out (${kinds.join(', ')})` : `${head} · all even ✓`
}

/** The command line. Returns the exit code. */
export async function main(args, { log = console.log, ffmpeg = findFfmpeg() } = {}) {
  const fix = args.includes('--fix')
  const gameDir = resolve(args.find((a) => !a.startsWith('--')) ?? '.')
  if (!ffmpeg) { log(FFMPEG_MISSING); return 1 }
  if (!listSounds(gameDir).length) { log(`No sound files in ${AUDIO_DIR}/ yet (${gameDir}) — nothing to check.`); return 0 }
  try {
    const { rows, settings, warnings } = await checkSounds(gameDir, { ffmpeg })
    for (const w of warnings) log(`! content/audio.json: ${w}`)
    log(formatTable(rows))
    log('')
    log(summarize(rows, settings))
    if (!fix) {
      if (rows.some(fixable)) log('Even them out: npm run audio:check -- --fix   (originals kept in audio-originals/)')
      return 0
    }
    const changes = await fixSounds(gameDir, rows, { ffmpeg, settings })
    log('')
    if (!changes.length) log('--fix: nothing to change.')
    else {
      log(`--fix changed ${changes.length} file${changes.length === 1 ? '' : 's'}:`)
      for (const c of changes) log(`  ${c.line}`)
      const still = changes.filter((c) => !c.verdict.ok).length
      log(still ? `${still} still off — listen to them (a sound can be too short or too odd to level by numbers).` : 'All of them are even now ✓')
    }
    return 0
  } catch (e) {
    log(`audio-check stopped: ${e?.message ?? e}`)
    return 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2))
}
