/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// the game's version (package.json), shown on the console's footer
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/GOOPS/' : '/',
  plugins: [react()],
  define: { 'import.meta.env.GOOPS_VERSION': JSON.stringify(version) },
  server: { host: true },
  test: { include: ['tests/**/*.test.ts'] },
})
