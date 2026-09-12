import { test as base, expect, type Page } from '@playwright/test'
import {
  createFixtureAccounts,
  type AccountName,
  type FixtureAccount
} from '../../integration/fixtures'
import { fixtureTotp } from '../../integration/mfa'

type WorkerFixtures = { accounts: Awaited<ReturnType<typeof createFixtureAccounts>> }

export const test = base.extend<object, WorkerFixtures>({
  accounts: [
    async ({}, use) => {
      const pending = createFixtureAccounts()
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
    await expect(page).toHaveURL(/\/seguridad/)
    const code = page.getByLabel('Código del autenticador')
    await code.evaluate((element) => element.setAttribute('type', 'password'))
    await code.fill(fixtureTotp(account.mfaSecret))
    await page.getByRole('button', { name: 'Verificar y continuar' }).click()
  }
  await expect(page).toHaveURL(new RegExp(destinations[name].replaceAll('/', '\\/')))
}
