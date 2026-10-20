// DEPLOY THE ALPHA — npm run deploy  (or: node scripts/deploy.js --dry-run)
// The remake goes online at https://thebluemuzzy.github.io/GOOPS/alpha/, BESIDE v1 (which stays at /GOOPS/ until the
// remake replaces it). Both live on the repo's gh-pages branch: v1's files at its root, the alpha in alpha/.
//   1. builds (npm run build: type check + vite build → dist/)
//   2. refuses unless the build was made for /GOOPS/alpha/ (vite.config.ts base) — a build for anywhere else
//      would load nothing once it's online
//   3. publishes dist/ as alpha/ on gh-pages with `--dest alpha --add`: nothing outside alpha/ is touched (v1's root
//      stays), and earlier alpha files stay too (an old page still open can load its chunks while it swaps itself)
// --dry-run: steps 1–2, then reads gh-pages (read only: git fetch + git ls-tree, nothing checked out or pushed) and
// prints exactly what would go where — v1's root untouched, what alpha/ gains, changes and keeps. gh-pages itself has
// no dry run. Going online (no --dry-run) is /deliver's job, with Muzzy.
import { execFileSync, execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const BASE = '/GOOPS/alpha/'
const DEST = 'alpha'
const BRANCH = 'gh-pages'
const LIVE = 'https://thebluemuzzy.github.io/GOOPS/alpha/'
const dryRun = process.argv.includes('--dry-run')
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

console.log('Building (npm run build)...')
execSync('npm run build', { stdio: 'inherit' })

// 2. the build's web path, from dist/index.html: <script src="/GOOPS/alpha/assets/…">
const html = readFileSync('dist/index.html', 'utf8')
const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1] ?? ''
if (!src.startsWith(`${BASE}assets/`)) {
  console.error(`\nREFUSED: this build was made for "${src.replace(/assets\/.*$/, '')}", not ${BASE} (vite.config.ts base). Nothing published.`)
  process.exit(1)
}
const version = html.match(/<meta name="app-version" content="([^"]+)"/)?.[1] ?? '(no version)'
console.log(`Build ${version} is for ${BASE} ✓`)

if (!dryRun) {
  console.log(`Publishing dist/ as ${DEST}/ on ${BRANCH} (v1's root kept)...`)
  execSync(`npx gh-pages -d dist --dest ${DEST} --add -m "Deploy alpha ${version}"`, { stdio: 'inherit' })
  console.log(`\nDeployed ${version}! Live at: ${LIVE} (GitHub Pages takes about a minute)`)
  process.exit(0)
}

// ---- dry run: what would go where ----
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

const root = [...onBranch.keys()].filter((p) => !p.startsWith(`${DEST}/`))
const added = [], changed = [], same = []
for (const file of distFiles('dist')) {
  const was = onBranch.get(`${DEST}/${file}`)
  const now = blobId(readFileSync(join('dist', file)))
  if (!was) added.push(file)
  else if (was !== now) changed.push(file)
  else same.push(file)
}
const fromDist = new Set([...added, ...changed, ...same].map((f) => `${DEST}/${f}`))
const kept = [...onBranch.keys()].filter((p) => p.startsWith(`${DEST}/`) && !fromDist.has(p))

const list = (files, max = 12) => files.slice(0, max).map((f) => `      ${f}`).join('\n') + (files.length > max ? `\n      … and ${files.length - max} more` : '')
console.log(`
DRY RUN — nothing pushed. Publishing ${version} would do this to ${BRANCH} (origin/${BRANCH} @ ${git('rev-parse', '--short', `origin/${BRANCH}`).trim()}):
  v1 at the root (/GOOPS/): ${root.length} files — UNTOUCHED (nothing outside ${DEST}/ is written or removed)
${list(root, 8)}
  ${DEST}/ (/GOOPS/alpha/):
    added:     ${added.length} files
${list(added)}
    changed:   ${changed.length} files${changed.length ? `\n${list(changed)}` : ''}
    unchanged: ${same.length} files
    kept from earlier alpha deploys (--add): ${kept.length} files
Command it would run: npx gh-pages -d dist --dest ${DEST} --add -m "Deploy alpha ${version}"
Live link once deployed: ${LIVE}`)
