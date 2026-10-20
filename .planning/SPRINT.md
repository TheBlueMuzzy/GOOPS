# Sprint 11 — an alpha a friend can install from a link
Started 2026-10-20 · Milestone M4 Alpha · Features: F38
What changes for Muzzy: the console shows a version number, the phone offers to install Goops as a full-screen app (at /GOOPS/alpha/ once it's online), the broken-machine messages say "W / ↑ to fix" on PC instead of "swipe up", and the Dev Kit is on in the release build. Stays the same: the game itself, and v1 at /GOOPS/ (going online is /deliver, with Muzzy).

## F38 🧱 Alpha release kit
Check: version.json shown on the console · a release build at /GOOPS/alpha/ installs as a full-screen app with its own service worker (scope /GOOPS/alpha/, wins over v1's /GOOPS/ one) and an update test · the deploy script adds alpha/ and leaves v1's root untouched (dry run) · the Dev Kit works in the release build with no dev server (no failed requests; bug files copy / download) · GitHub checks run on push · perf.mjs reports fps with a pass line · Muzzy reads the fps on two real phones
- [ ] 🤖 1. version.json (0.0.0, build 0) read by the build, shown on the console as vX.Y.Z.B; STATE's Version line fixed — vite.config.ts, src/ui/Console.tsx
- [ ] 🤖 2. Installable full-screen app at /GOOPS/alpha/: base path, manifest scope / id / matching colours / maskable icon, apple tags, a service worker scoped to /GOOPS/alpha/ with a "new version" refresh, e2e update test — public/manifest.json, index.html, src/main.tsx
- [ ] 🤖 3. Deploy script: build, then add the build as alpha/ on gh-pages keeping v1's root (dry run only — going online is /deliver) — scripts/deploy.js
- [ ] 🤖 4. Dev Kit ON in the release build: audit calls that need the dev server (kit-copy problems go to the framework session, never edited here), bug files work offline, check on a release build — src/devkit-game/
- [ ] 🤖 5. Release plumbing: GitHub checks on every push, check:framework, the alpha release checklist — package.json, scripts/check-all.mjs
- [ ] 🤖 6. Frame-rate counter (Dev Kit / ?fps) and a pass line in the speed test, full tank, both goo styles — e2e/perf.mjs
- [ ] 🤖 7. Broken-machine messages in PC wording on PC ("swipe up to fix" logged in Sprint 10) — content/text/en.json
- [ ] 🙋 8. Install it on two real phones, fill the tank in both goo styles, read the fps (playtest log) — .planning/research/

## Notes
- Plan calls (Claude, 2026-10-20): v1's service worker is registered at /GOOPS/ (network-first, caches everything), so it would also control /GOOPS/alpha/ → alpha gets its own SW scoped to /GOOPS/alpha/ (the narrower scope wins) and a manifest scope/id of /GOOPS/alpha/. Deploy stays on the gh-pages branch (`--dest alpha --add`), not a GitHub Actions Pages deploy — that would replace the whole site and take v1 down. Going online waits for /deliver (Muzzy).
- From the Sprint 10 retro: anything a helper says about the look gets measured or seen first-hand before it becomes a question for Muzzy. Next free TDD decision: D17.
- No open P0/P1 bugs.
