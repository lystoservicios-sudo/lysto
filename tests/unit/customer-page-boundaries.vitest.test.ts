import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { customerScreenRoutes } from '@/features/customer/screen-contract'

describe('customer page layout boundary', () => {
  it('mounts customer navigation exclusively through the cloned sidebar shell', () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), 'components/layout/page-shell.tsx'),
      'utf8'
    )

    expect(shellSource).toContain('<AppShellProvider')
    expect(shellSource).toContain('<AppSidebar role={role} />')
    expect(shellSource).toContain('<AppTopbar role={role} />')
    expect(shellSource).not.toContain('<AppNavigation')
  })

  it('registers the fourteen required customer routes', () => {
    expect(customerScreenRoutes).toHaveLength(14)
    expect(new Set(customerScreenRoutes.map((route) => route.href)).size).toBe(14)
  })

  it('keeps global navigation and viewport wrappers out of customer pages', () => {
    const violations = customerScreenRoutes.flatMap((route) => {
      const source = readFileSync(resolve(process.cwd(), route.file), 'utf8')
      const forbidden = [
        /AppSidebar/,
        /AppTopbar/,
        /AppShellProvider/,
        /<nav\b/i,
        /<aside\b/i,
        /min-h-screen/
      ]

      return forbidden.some((pattern) => pattern.test(source)) ? [route.href] : []
    })

    expect(violations).toEqual([])
  })

  it('keeps batch one pages independent from the global mock dataset', () => {
    const batchOneFiles = customerScreenRoutes
      .filter((route) => ['CUS-01', 'CUS-13', 'CUS-14'].includes(route.id))
      .map((route) => readFileSync(resolve(process.cwd(), route.file), 'utf8'))

    expect(batchOneFiles).toHaveLength(3)
    expect(batchOneFiles.every((source) => !source.includes('@/lib/mock/lysto-data'))).toBe(true)
  })
})
