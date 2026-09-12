import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const productionRoots = ['app/(customer)', 'components/customer']

function productionSources() {
  const files: string[] = []
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolute)
    }
  }
  productionRoots.forEach((directory) => visit(path.join(root, directory)))
  return files.map((file) => ({ file, source: fs.readFileSync(file, 'utf8') }))
}

describe('customer production pages', () => {
  it('never imports demo fixtures or labels real records as demonstrations', () => {
    for (const { file, source } of productionSources()) {
      expect(source, file).not.toContain('customer-demo-fixtures')
      expect(source, file).not.toMatch(
        /Demostraci[oó]n|Datos de demostraci[oó]n|Perfil de demostraci[oó]n/
      )
    }
  })

  it('loads each history surface through an authenticated live model', () => {
    const pages = [
      'app/(customer)/app/page.tsx',
      'app/(customer)/app/solicitudes/page.tsx',
      'app/(customer)/app/trabajos/page.tsx',
      'app/(customer)/app/garantias/page.tsx',
      'app/(customer)/app/trabajos/[id]/review/page.tsx'
    ]
    for (const page of pages) {
      const source = fs.readFileSync(path.join(root, page), 'utf8')
      expect(source, page).toContain("requirePageSession('customer')")
      expect(source, page).toMatch(
        /customerLiveData|listCustomerRequestsLive|listCustomerJobsLive|customerReviewEligibility/
      )
    }
  })

  it('rejects non-UUID detail routes instead of falling back to fake records', () => {
    for (const page of [
      'app/(customer)/app/solicitudes/[id]/page.tsx',
      'app/(customer)/app/trabajos/[id]/page.tsx'
    ]) {
      const source = fs.readFileSync(path.join(root, page), 'utf8')
      expect(source, page).toContain('z.string().uuid().safeParse(id)')
      expect(source, page).toContain('notFound()')
      expect(source, page).toContain('JobQuotePanel')
    }
  })
})
