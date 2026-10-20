/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devkit } from './vite-plugins/devkit/devkitVite'

// The game's version, shown on the console's footer as vX.Y.Z.B — version.json (BMUZ versioning: /save bumps
// "build", /deliver bumps "version"). GOOPS_BUILD=<n> overrides the build number for one build (e2e/sw-update.mjs
// uses it to make a "next release" without touching version.json).
const versionFile = JSON.parse(readFileSync(new URL('./version.json', import.meta.url), 'utf8'))
const version = `${versionFile.version}.${process.env.GOOPS_BUILD ?? versionFile.build ?? 0}`

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/GOOPS/' : '/',
  plugins: [react(), devkit()],
  define: { 'import.meta.env.GOOPS_VERSION': JSON.stringify(version) },
  server: { host: true },
  test: { include: ['tests/**/*.test.ts'] },
})
