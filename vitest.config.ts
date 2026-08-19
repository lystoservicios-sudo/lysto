import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.vitest.{test,spec}.ts', 'tests/**/*.vitest.{test,spec}.tsx']
  }
})
