import { defineConfig, devices } from '@playwright/test'

const target = new URL(process.env.LYSTO_E2E_BASE_URL ?? 'http://127.0.0.1:3100')
if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) || !target.port || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('Playwright requires an explicit local test origin')
}
const baseURL = target.origin

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 14'] } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'node scripts/playwright-server.mjs',
    url: baseURL,
    env: { LYSTO_E2E_BASE_URL: baseURL },
    timeout: 600_000,
    reuseExistingServer: false
  }
})
