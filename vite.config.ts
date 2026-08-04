/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  // The About dialog and the card footer both show the version the build
  // actually produced. about-data.js carries one baked at sync time as a
  // fallback and goes stale the moment a release is tagged; this is the one
  // that is always right.
  define: { __APP_VERSION__: JSON.stringify(`v${pkg.version}`) },
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  test: {
    // Node by default: layout maths, the ZIP writer and filename handling are
    // all pure and need no DOM. The icon suite opts into jsdom with its own
    // `@vitest-environment jsdom` docblock, which keeps the common case fast.
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
