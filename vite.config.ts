/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { devkit } from './vite-plugins/devkit/devkitVite'
import { versionPlugin } from './src/version/vitePlugin.mjs'

// Where the release build lives on the web: /GOOPS/, the address v1 had — Goops 2 replaces it at 1.0 (F54, TDD D33;
// the alpha/beta lived at /GOOPS/alpha/, which becomes a forwarder: public/alpha/). scripts/deploy.js refuses a build
// made for anywhere else.
const RELEASE_BASE = '/GOOPS/'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? RELEASE_BASE : '/',
  plugins: [
    react(),
    devkit(),
    // The framework version module (F70): version.json → import.meta.env.APP_VERSION (src/version's versionLabel,
    // "vX.Y.Z.B") + <meta name="app-version"> for tests. VERSION_BUILD=<n> overrides the build (e2e/sw-update.mjs).
    versionPlugin(),
    // The offline cache + install (TDD D17, D33). Its service worker is dist/goops-sw.js, served at /GOOPS/goops-sw.js,
    // scope /GOOPS/ — the same scope as v1's worker, so registering it replaces v1's. A NEW file name on purpose: v1's
    // is /GOOPS/sw.js, and main.tsx tells "a page that already ran under our worker" by the worker's address — with
    // the same name a v1 player's first visit would reload once. Its activate also deletes v1's cache by name
    // (public/retire-v1.js). The forwarder at /GOOPS/alpha/ (public/alpha/) is the network's: never cached, never
    // answered with this game's index.html.
    // autoUpdate + registerSW({ immediate: true }) in main.tsx: a returning player gets the new version on their
    // first visit (the page swaps itself as it opens) — the BMUZ GitHub Pages recipe, step 5.
    // Builds only: the dev server (and the Dev Kit's Save) never has a service worker.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // main.tsx registers it
      manifest: false, // public/manifest.json is the manifest (index.html links it)
      filename: 'goops-sw.js',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,mp3,ttf,woff2,json}'], // (woff2: a game font in public/fonts may be one)
        // a font's read-me page, the alpha forwarder, and the v1 clean-up (the worker loads that itself)
        // The kit's own fonts (assets/*.woff2) stay out too: every text role in content/ui/style.json uses the
        // game's Nokia font (public/fonts), so a player never loads them — ~227 KB off the first visit (F71).
        // tests/offlineFonts.test.ts goes red if a role ever names a kit font; drop the ignore then.
        globIgnores: ['fonts/**/*.html', 'alpha/**', 'retire-v1.js', 'assets/*.woff2'],
        importScripts: ['retire-v1.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/alpha\//],
        cleanupOutdatedCaches: true,
        skipWaiting: true, // a new worker takes over at once (e2e/sw-update.mjs: without these it sat "waiting")
        clientsClaim: true,
      },
    }),
  ],
  // (not watched: helpers' worktrees and the checks' own output — any .html there made every open page reload, and
  // check:full's e2e pages died mid-test, Goops 2026-10-25)
  server: { host: true, watch: { ignored: ['**/.claude/**', '**/e2e-shots/**'] } },
  test: { include: ['tests/**/*.test.ts'] },
})
