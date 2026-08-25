import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { customerScreenRoutes } from '@/features/customer/screen-contract'

describe('customer page layout boundary', () => {
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
})
