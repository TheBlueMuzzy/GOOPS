/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { devkit } from './vite-plugins/devkit/devkitVite'

// The game's version, shown on the console's footer as vX.Y.Z.B — version.json (BMUZ versioning: /save bumps
// "build", /deliver bumps "version"). GOOPS_BUILD=<n> overrides the build number for one build (e2e/sw-update.mjs
// uses it to make a "next release" without touching version.json).
const versionFile = JSON.parse(readFileSync(new URL('./version.json', import.meta.url), 'utf8'))
const version = `${versionFile.version}.${process.env.GOOPS_BUILD ?? versionFile.build ?? 0}`

// Where the release build lives on the web: the alpha sits beside v1 on the same GitHub Pages site
// (v1 = /GOOPS/, the remake = /GOOPS/alpha/ — F37). scripts/deploy.js refuses a build made for anywhere else.
const RELEASE_BASE = '/GOOPS/alpha/'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? RELEASE_BASE : '/',
  plugins: [
    react(),
    devkit(),
    // <meta name="app-version" content="vX.Y.Z.B"> — what tests read (e2e/start.mjs checks it equals version.json,
    // so a test never runs against a stale build or a cached service worker). Same words as src/version.ts.
    { name: 'goops-version-meta', transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'app-version', content: `v${version}` }, injectTo: 'head' }] },
    // The offline cache + install (TDD D17). Its service worker is dist/sw.js, served at /GOOPS/alpha/sw.js, so its
    // scope is /GOOPS/alpha/ — narrower than v1's /GOOPS/ one, so it (not v1's) runs the alpha.
    // autoUpdate + registerSW({ immediate: true }) in main.tsx: a returning player gets the new version on their
    // first visit (the page swaps itself as it opens) — the BMUZ GitHub Pages recipe, step 5.
    // Builds only: the dev server (and the Dev Kit's Save) never has a service worker.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // main.tsx registers it
      manifest: false, // public/manifest.json is the manifest (index.html links it)
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,mp3,ttf,woff2,json}'], // (woff2: the kit's own fonts — offline missed them)
        globIgnores: ['fonts/**/*.html'], // a font's read-me page, not part of the game
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: true, // a new worker takes over at once (e2e/sw-update.mjs: without these it sat "waiting")
        clientsClaim: true,
      },
    }),
  ],
  define: { 'import.meta.env.GOOPS_VERSION': JSON.stringify(version) },
  server: { host: true },
  test: { include: ['tests/**/*.test.ts'] },
})
