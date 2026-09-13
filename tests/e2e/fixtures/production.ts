import { test as base, expect, type Page } from '@playwright/test'
import {
  createFixtureAccounts,
  type AccountName,
  type FixtureAccount
} from '../../integration/fixtures'
import { fixtureTotp } from '../../integration/mfa'

type WorkerFixtures = { accounts: Awaited<ReturnType<typeof createFixtureAccounts>> }
type TestFixtures = { stagingAccess: void }

export const test = base.extend<TestFixtures, WorkerFixtures>({
  stagingAccess: [
    async ({ page }, use) => {
      if (process.env.APP_ENV === 'staging') {
        const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        if (!bypass || !/^[A-Za-z0-9]{32}$/.test(bypass))
          throw new Error('A protected staging bypass is required')
        const response = await page.context().request.get('/?x-vercel-set-bypass-cookie=true', {
          headers: { 'x-vercel-protection-bypass': bypass }
        })
        if (!response.ok()) throw new Error('Unable to establish protected staging access')
        const bypassCookie = (await page.context().cookies()).some(
          (cookie) => cookie.name === '_vercel_jwt'
        )
        if (!bypassCookie) throw new Error('Protected staging cookie was not established')
      }
      await use()
    },
    { auto: true }
  ],
  accounts: [
    async ({}, use) => {
      const pending = createFixtureAccounts({ directSqlAuth: process.env.APP_ENV === 'staging' })
      const fixture = await pending
      try {
        await use(fixture)
      } finally {
        await pending.cleanup()
      }
    },
    { scope: 'worker' }
  ]
})

export { expect }

const destinations: Record<AccountName, string> = {
  customerA: '/app',
  customerB: '/app',
  professionalApproved: '/pro/dashboard',
  professionalSuspended: '/login',
  operations: '/admin/dashboard',
  finance: '/admin/pagos',
  quality: '/admin/calidad',
  owner: '/admin/dashboard'
}

export async function loginAs(page: Page, account: FixtureAccount, name: AccountName) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Contraseña').fill(account.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  if (account.mfaSecret) {
    await expect(page).toHaveURL(/\/seguridad/, { timeout: 15_000 })
    const code = page.getByLabel('Código del autenticador')
    await code.evaluate((element) => element.setAttribute('type', 'password'))
    let verified = false
    for (const offset of [0, -30_000, 30_000]) {
      const response = page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' &&
          /\/auth\/v1\/factors\/[^/]+\/verify$/.test(new URL(candidate.url()).pathname),
        { timeout: 15_000 }
      )
      await code.fill(fixtureTotp(account.mfaSecret, Date.now() + offset))
      await page.getByRole('button', { name: 'Verificar y continuar' }).click()
      if ((await response).ok()) {
        verified = true
        break
      }
    }
    if (!verified) throw new Error('MFA verification failed for the disposable test account')
  }
  await expect(page).toHaveURL(new RegExp(destinations[name].replaceAll('/', '\\/')), {
    timeout: 15_000
  })
}
