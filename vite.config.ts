/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { devkit } from './vite-plugins/devkit/devkitVite'
import { versionPlugin } from './src/version/vitePlugin.mjs'

// Where the release build lives on the web: the alpha sits beside v1 on the same GitHub Pages site
// (v1 = /GOOPS/, the remake = /GOOPS/alpha/ — F37). scripts/deploy.js refuses a build made for anywhere else.
const RELEASE_BASE = '/GOOPS/alpha/'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? RELEASE_BASE : '/',
  plugins: [
    react(),
    devkit(),
    // The framework version module (F70): version.json → import.meta.env.APP_VERSION (src/version's versionLabel,
    // "vX.Y.Z.B") + <meta name="app-version"> for tests. VERSION_BUILD=<n> overrides the build (e2e/sw-update.mjs).
    versionPlugin(),
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
  // (not watched: helpers' worktrees and the checks' own output — any .html there made every open page reload, and
  // check:full's e2e pages died mid-test, Goops 2026-10-25)
  server: { host: true, watch: { ignored: ['**/.claude/**', '**/e2e-shots/**'] } },
  test: { include: ['tests/**/*.test.ts'] },
})
