// DEPLOY GOOPS 2 — npm run deploy  (or: node scripts/deploy.js --dry-run)
// Goops 2 goes online at https://thebluemuzzy.github.io/GOOPS/ — the address v1 had (F54, TDD D33: v1 retired fully,
// no copy kept). The site is the repo's gh-pages branch, and after a deploy it holds exactly this build:
//   /GOOPS/        the game (dist/) — its worker goops-sw.js takes over from v1's
//   /GOOPS/alpha/  the forwarder only (dist/alpha/ from public/alpha/: index.html + the beta's last worker, sw.js)
// Steps:
//   1. builds (npm run build: type check + vite build → dist/)
//   2. refuses unless the build was made for /GOOPS/ (vite.config.ts base) — a build for anywhere else would load
//      nothing once it's online — and unless the forwarder is in it (installed beta players need it)
//   3. publishes dist/ as the WHOLE branch in one commit (`gh-pages -d dist`, no --add): every file not in the build
//      is removed — v1's root files and the old beta build in alpha/ — except dotfiles (gh-pages never removes those;
//      the only one is v1's harmless .gitignore)
//   (0. first it refuses while there are uncommitted changes — a dry run only warns)
// --dry-run: steps 1–2, then reads gh-pages (read only: git fetch + git ls-tree, nothing checked out or pushed) and
// prints exactly what is added, changed, removed and kept. gh-pages itself has no dry run. Going online (no --dry-run)
// is /deliver's job, with Muzzy.
import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const BASE = '/GOOPS/'
const BRANCH = 'gh-pages'
const LIVE = 'https://thebluemuzzy.github.io/GOOPS/'
const FORWARDER = ['alpha/index.html', 'alpha/sw.js'] // public/alpha/ — the beta's old address
const dryRun = process.argv.includes('--dry-run')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// 0. only committed work goes online: half-finished edits would ship under the committed version number
const dirty = git('status', '--porcelain').trim()
if (dirty && !dryRun) {
  console.error(`\nREFUSED: uncommitted changes — commit (or /save) first, then deploy. Nothing published.\n${dirty}`)
  process.exit(1)
}
if (dirty) console.log('(dry run with uncommitted changes — a real deploy would refuse)')

console.log('Building (npm run build)...')
execSync('npm run build', { stdio: 'inherit' })

// 2. the build's web path, from dist/index.html: <script src="/GOOPS/assets/…">
const html = readFileSync('dist/index.html', 'utf8')
const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1] ?? ''
if (!src.startsWith(`${BASE}assets/`)) {
  console.error(`\nREFUSED: this build was made for "${src.replace(/assets\/.*$/, '')}", not ${BASE} (vite.config.ts base). Nothing published.`)
  process.exit(1)
}
const missing = FORWARDER.filter((f) => !existsSync(join('dist', f)))
if (missing.length) {
  console.error(`\nREFUSED: the build has no ${missing.join(' / ')} (public/alpha/) — installed beta players would be stranded. Nothing published.`)
  process.exit(1)
}
const version = html.match(/<meta name="app-version" content="([^"]+)"/)?.[1] ?? '(no version)'
console.log(`Build ${version} is for ${BASE} ✓ (forwarder at ${BASE}alpha/ ✓)`)

const command = `npx gh-pages -d dist -m "Deploy Goops ${version}"`
if (!dryRun) {
  console.log(`Publishing dist/ as the whole ${BRANCH} branch (v1 and the old beta build removed)...`)
  execSync(command, { stdio: 'inherit' })
  console.log(`\nDeployed ${version}! Live at: ${LIVE} (GitHub Pages takes about a minute)`)
  process.exit(0)
}

// ---- dry run: what would change ----
try {
  git('fetch', '--quiet', 'origin', `${BRANCH}:refs/remotes/origin/${BRANCH}`)
} catch {
  console.log(`(couldn't fetch ${BRANCH} — comparing with the last copy this computer has)`)
}
// every file on gh-pages now, with its git blob id: "100644 blob <id>\t<path>"
const onBranch = new Map(git('ls-tree', '-r', `origin/${BRANCH}`).trim().split('\n').filter(Boolean).map((line) => {
  const [info, path] = line.split('\t')
  return [path, info.split(' ')[2]]
}))
// git's id for a file's contents — the same id means the file wouldn't change
const blobId = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const distFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? distFiles(path) : [relative('dist', path).split(sep).join('/')]
})

const added = [], changed = [], same = []
for (const file of distFiles('dist')) {
  const was = onBranch.get(file)
  const now = blobId(readFileSync(join('dist', file)))
  if (!was) added.push(file)
  else if (was !== now) changed.push(file)
  else same.push(file)
}
const fromDist = new Set([...added, ...changed, ...same])
const leaving = [...onBranch.keys()].filter((p) => !fromDist.has(p))
const isDotfile = (p) => p.split('/').some((part) => part.startsWith('.')) // gh-pages' file match skips these
const keptDotfiles = leaving.filter(isDotfile)
const removed = leaving.filter((p) => !isDotfile(p))
const removedV1 = removed.filter((p) => !p.startsWith('alpha/'))
const removedAlpha = removed.filter((p) => p.startsWith('alpha/'))

const list = (files, max = 12) => files.slice(0, max).map((f) => `      ${f}`).join('\n') + (files.length > max ? `\n      … and ${files.length - max} more` : '')
const block = (files, max) => (files.length ? `\n${list(files, max)}` : '')
console.log(`
DRY RUN — nothing pushed. Publishing ${version} would make ${BRANCH} exactly this build (origin/${BRANCH} @ ${git('rev-parse', '--short', `origin/${BRANCH}`).trim()}, ${onBranch.size} files now):
  added:     ${added.length} files${block(added)}
  changed:   ${changed.length} files${block(changed)}
  unchanged: ${same.length} files
  removed — v1 at the root (/GOOPS/): ${removedV1.length} files${block(removedV1, 20)}
  removed — the old beta build in alpha/ (only the forwarder stays there): ${removedAlpha.length} files${block(removedAlpha, 6)}
  kept (dotfiles — gh-pages never removes them): ${keptDotfiles.length}${block(keptDotfiles)}
  after: ${fromDist.size + keptDotfiles.length} files — /GOOPS/ = Goops 2, /GOOPS/alpha/ = ${FORWARDER.join(' + ')}
Command it would run: ${command}
Live link once deployed: ${LIVE}`)
