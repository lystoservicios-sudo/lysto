import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.vitest.{test,spec}.ts', 'tests/**/*.vitest.{test,spec}.tsx'],
    exclude: ['tests/unit/marketplace-ledger.vitest.test.ts', 'tests/unit/marketplace-storage.vitest.test.ts'],
    minWorkers: 1,
    maxWorkers: 2
  }
})
