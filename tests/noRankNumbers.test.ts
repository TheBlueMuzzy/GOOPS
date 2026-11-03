// F79 — No rank numbers in code or tests: the guard. The ladder (content/tuning/ladder.json, asked through
// src/progress/ladder.ts) is the ONLY place a rank number lives, so a pivot (51 ranks → 31, a beat moved) is a
// content edit. Code, tests, e2e and the bots ask it: rankOf('wildGoop'), `?rank=${rankOf('wildGoop')}`, maxRank().
// This test reads the game's own files and fails on a bare rank number used as a rank, naming file:line.
//   Caught: rank >= 30 · 30 <= rank · rank === 50 · rank = 40 · rank: 31 · toRank: 5 · fromRank: 3 · ?rank=40 ·
//           progressAtRank(9) · "rank 40" in a string (a test name, a label) · "someRanks": [45, 50] in JSON.
//   Allowed: 0 and 1 (a fresh career, the first day) · a line with `// tuning-ok: <why>` · comments (they're read
//           by people; say the beat there too, but they can't break a pivot).
//   Not caught (the trial move — one beat moved in ladder.json, every check still green — is the backstop): a rank
//           passed by position (open(w, h, 40)), or held in a name without "rank" in it.
//   Not scanned: src/ui/kit + src/devkit (framework copies), src/ladder (the module; its tests use their own ladder).
// The framework will ship this as a real lint rule beside no-tuning-numbers (asked of framework-43, 2026-11-02);
// when Goops installs it, this test goes.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const SCAN = ['src', 'tests', 'e2e', 'scripts/bots', 'scripts/check-all.mjs']
// (sim-before.json is a record of past sim results, words not ranks asked)
const SKIP = ['src/ui/kit', 'src/devkit', 'src/ladder', 'tests/noRankNumbers.test.ts', 'scripts/bots/sim-before.json']
const EXT = /\.(ts|tsx|mjs|js|json)$/

/** Every file to scan, as repo-relative paths with forward slashes. */
export function filesToScan(root = ROOT): string[] {
  const out: string[] = []
  const walk = (abs: string) => {
    const rel = relative(root, abs).replace(/\\/g, '/')
    if (SKIP.some((s) => rel === s || rel.startsWith(`${s}/`))) return
    if (statSync(abs).isDirectory()) { for (const f of readdirSync(abs)) walk(join(abs, f)); return }
    if (EXT.test(rel)) out.push(rel)
  }
  for (const s of SCAN) walk(join(root, s))
  return out
}

/** The line without its comment (a whole-line comment → ''). Rough on purpose: `//` after a space starts one. */
const codeOf = (line: string) => {
  const t = line.trim()
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return ''
  if (/^"_\w*"\s*:/.test(t)) return '' // a JSON note ("_about": "…") is a comment too
  return line.replace(/\/\*.*?\*\//g, '').replace(/(^|\s)\/\/.*$/, '')
}

const N = String.raw`(\d+)(?![\d.]*\s*\*)` // a whole number (not one that's being multiplied: rank * 2)
// a name ending in rank: rank, toRank, fromRank, careerRank, progressAtRank, xpForRank, effectLateRanks (not
// xpIntoRank: that's XP)
const NAME = String.raw`\b(?!xpInto)\w*[Rr]anks?\b`
const PATTERNS: RegExp[] = [
  new RegExp(`${NAME}\\)?\\s*(?:===|!==|==|>=|<=|>|<|=(?![=>]))\\s*${N}`), // rank >= 30 · rank = 40 · ?rank=40
  new RegExp(`\\b${N}\\s*(?:===|!==|==|>=|<=|>|<)\\s*${NAME}`), // 30 <= rank
  new RegExp(`${NAME}['"]?\\s*:\\s*${N}`), // rank: 31 · toRank: 5 · "afterRank": 30
  new RegExp(`${NAME}\\(\\s*${N}`), // progressAtRank(9)
  new RegExp(`\\b[Rr]ank\\s+${N}`, 'i'), // 'rank 40 has wild goop' (a string: comments are stripped first)
  new RegExp(`${NAME}['"]?\\s*:\\s*\\[\\s*${N}`), // "effectLateRanks": [45, 50]
]

/** The bare rank numbers in one line of code (0 and 1 are fine). */
export function rankNumbersIn(line: string): number[] {
  if (line.includes('tuning-ok:')) return []
  const code = codeOf(line)
  const found: number[] = []
  for (const re of PATTERNS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    for (const m of code.matchAll(g)) {
      const n = Number(m[1])
      if (n > 1) found.push(n)
    }
  }
  return found
}

describe('no rank numbers in code or tests (F79 — they ask the ladder)', () => {
  it('the guard catches the old shapes and lets the rest through', () => {
    for (const bad of [
      'if (rank >= 30) grow()', 'expect(rank === 50)', 'while (state.rank < 40)', 'createShift(shift, { rank: 31 })',
      "page.goto(`${URL}?rank=40`)", 'runCareer({ toRank: 5 })', '"fromRank": 3', 'progressAtRank(9)',
      "it('rank 40 has wild goop', () => {", 'for (let rank = 2; rank <= 50; rank++)', '"effectLateRanks": [45, 50]',
      'if (30 <= rank) x()',
    ]) expect(rankNumbersIn(bad), bad).not.toEqual([])
    for (const ok of [
      'createShift(shift, { rank: 0 })', 'expect(p.rank).toBe(1)', "page.goto(`${URL}?rank=${rankOf('wildGoop')}`)",
      'const seed = 40', 'score: 30', '// the shop opens at rank 5', 'rank: 40, // tuning-ok: a made-up ladder',
      'xp: rank * 30', "it(`rank ${rankOf('wildGoop')} has wild goop`)", 'ranks.length >= 2',
      'toMatchObject({ xpIntoRank: 2000 })', 'const before = rank3(4000)',
    ]) expect(rankNumbersIn(ok), ok).toEqual([])
  })

  it('no file restates a rank — each asks the ladder (rankOf / maxRank in src/progress/ladder.ts)', () => {
    const problems: string[] = []
    for (const rel of filesToScan()) {
      readFileSync(join(ROOT, rel), 'utf8').split(/\r?\n/).forEach((line, i) => {
        const nums = rankNumbersIn(line)
        if (nums.length) problems.push(`${rel}:${i + 1} rank ${nums.join(', ')} — ${line.trim().slice(0, 120)}`)
      })
    }
    if (problems.length) console.log(`${problems.length} restated ranks:\n${problems.join('\n')}`) // (the diff below gets cut short)
    expect(problems, `Rank numbers restated outside the ladder (ask rankOf('<beat>') / maxRank(), or add // tuning-ok: <why>):\n${problems.join('\n')}`).toEqual([])
  })
})
