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

  it('keeps batch two pages independent from global mocks and resolves detail by route id', () => {
    const batchTwoRoutes = customerScreenRoutes.filter((route) => ['CUS-02', 'CUS-03', 'CUS-04'].includes(route.id))
    const batchTwoSources = batchTwoRoutes.map((route) => readFileSync(resolve(process.cwd(), route.file), 'utf8'))
    const detailSource = batchTwoSources[2]

    expect(batchTwoSources).toHaveLength(3)
    expect(batchTwoSources.every((source) => !source.includes('@/lib/mock/lysto-data'))).toBe(true)
    expect(detailSource).toContain('findCustomerRecordById')
    expect(detailSource).toMatch(/params/)
    expect(detailSource).toContain('notFound()')
  })

  it('keeps batch three pages independent from global mocks and resolves job routes by id', () => {
    const batchThreeRoutes = customerScreenRoutes.filter((route) => ['CUS-05', 'CUS-06', 'CUS-07'].includes(route.id))
    const batchThreeSources = batchThreeRoutes.map((route) => readFileSync(resolve(process.cwd(), route.file), 'utf8'))

    expect(batchThreeSources).toHaveLength(3)
    expect(batchThreeSources.every((source) => !source.includes('@/lib/mock/lysto-data'))).toBe(true)
    expect(batchThreeSources[1]).toContain('findCustomerRecordById')
    expect(batchThreeSources[1]).toMatch(/params/)
    expect(batchThreeSources[1]).toContain('notFound()')
    expect(batchThreeSources[2]).toContain('findCustomerRecordById')
    expect(batchThreeSources[2]).toMatch(/params/)
    expect(batchThreeSources[2]).toContain('notFound()')
  })

  it('keeps batch four pages independent from global mocks and resolves equipment by id', () => {
    const batchFourRoutes = customerScreenRoutes.filter((route) => ['CUS-08', 'CUS-09', 'CUS-10'].includes(route.id))
    const batchFourSources = batchFourRoutes.map((route) => readFileSync(resolve(process.cwd(), route.file), 'utf8'))

    expect(batchFourSources).toHaveLength(3)
    expect(batchFourSources.every((source) => !source.includes('@/lib/mock/lysto-data'))).toBe(true)
    expect(batchFourSources[1]).toContain('findCustomerRecordById')
    expect(batchFourSources[1]).toMatch(/params/)
    expect(batchFourSources[1]).toContain('notFound()')
    expect(batchFourSources[1]).toMatch(/const warranty = .*\.find\(\(item\) => item\.equipmentId === equipment\.id\)/)
  })

  it('keeps the batch five warranty page independent from global mocks', () => {
    const warrantyRoute = customerScreenRoutes.find((route) => route.id === 'CUS-11')
    expect(warrantyRoute).toBeTruthy()
    const source = readFileSync(resolve(process.cwd(), warrantyRoute!.file), 'utf8')

    expect(source).not.toContain('@/lib/mock/lysto-data')
    expect(source).toContain('CustomerWarrantyCenter')
    expect(source).toContain('customerDemoFixtures')
  })
})
