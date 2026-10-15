import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('keeps carousel indicators visually compact inside 44px minimum touch targets', () => {
  const css = readFileSync(resolve(process.cwd(), 'features/service-request/request-screens.module.css'), 'utf8')
  const target = css.match(/\.dots button \{([^}]+)\}/)?.[1] ?? ''
  const indicator = css.match(/\.dots button::before \{([^}]+)\}/)?.[1] ?? ''
  expect(target).toMatch(/min-width:\s*44px/)
  expect(target).toMatch(/min-height:\s*44px/)
  expect(indicator).toMatch(/width:\s*10px/)
  expect(indicator).toMatch(/height:\s*10px/)
})
