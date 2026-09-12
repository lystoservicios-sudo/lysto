import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

describe('professional production route contracts', () => {
  it('has no fixture or demonstration dependency in professional production sources', () => {
    const sources: string[] = []
    for (const base of ['app/(professional)', 'components/pro']) {
      const visit = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name)
          if (entry.isDirectory()) visit(file)
          else if (/\.(ts|tsx)$/.test(entry.name)) sources.push(fs.readFileSync(file, 'utf8'))
        }
      }
      visit(path.join(root, base))
    }
    expect(sources.join('\n')).not.toMatch(
      /@\/lib\/mock|Vista de demostraci[oó]n|datos demostrativos|perfil demostrativo/i
    )
  })

  it('loads dashboard, jobs, profile and equipment with the approved session', () => {
    for (const file of [
      'app/(professional)/pro/dashboard/page.tsx',
      'app/(professional)/pro/trabajos/page.tsx',
      'app/(professional)/pro/perfil/page.tsx',
      'app/(professional)/pro/equipos/[id]/page.tsx'
    ]) {
      expect(read(file), file).toContain("requirePageSession('professional')")
    }
  })

  it('uses live offer, payment, support and scheduling contracts', () => {
    expect(read('app/(professional)/pro/solicitudes/page.tsx')).toContain('ServiceOffers')
    expect(read('app/(professional)/pro/presupuestos/page.tsx')).toContain('ServiceOffers')
    expect(read('app/(professional)/pro/pagos/page.tsx')).toContain('PaymentPanel')
    expect(read('app/(professional)/pro/agenda/page.tsx')).toContain('getScheduleAvailability')
    expect(read('app/(professional)/pro/soporte/page.tsx')).toContain(
      'ConnectedProfessionalSupport'
    )
  })

  it('rejects legacy identifiers in request and job details', () => {
    for (const file of [
      'app/(professional)/pro/solicitudes/[id]/page.tsx',
      'app/(professional)/pro/trabajos/[id]/page.tsx'
    ]) {
      const source = read(file)
      expect(source).toContain('z.string().uuid().safeParse(id)')
      expect(source).toContain('notFound()')
      expect(source).toContain('JobQuotePanel')
    }
  })
})
