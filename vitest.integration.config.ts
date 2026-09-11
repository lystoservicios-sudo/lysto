import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)), 'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts', 'tests/unit/marketplace-ledger.vitest.test.ts', 'tests/unit/marketplace-storage.vitest.test.ts'],
    maxWorkers: 1, minWorkers: 1, fileParallelism: false,
    testTimeout: 30_000, hookTimeout: 180_000,
    passWithNoTests: false
  }
})
