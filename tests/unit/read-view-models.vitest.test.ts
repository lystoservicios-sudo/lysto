import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { JobDto } from '@/lib/data-access/read-contracts'
import { toCustomerJobSummary } from '@/features/customer/view-models'
import { buildCustomerReadDashboard } from '@/features/customer/dashboard-view-model'
import { toProfessionalJobSummary } from '@/components/pro/pro-model'
import { toAdminJobSummary } from '@/components/admin/admin-model'
const job: JobDto = {
  id: 'job-id',
  requestId: 'request-id',
  createdAt: '2026-09-11T10:00:00.123456Z',
  status: 'confirmed',
  professionalId: null,
  scheduledDate: null,
  timeWindow: null,
  completedAt: null,
  finalAmount: null
}
describe('pure view models from authorized DTOs', () => {
  it('keeps missing persisted values absent instead of inserting demo content', () => {
    expect(toCustomerJobSummary(job)).toMatchObject({
      id: job.id,
      scheduledDate: null,
      finalAmount: null,
      statusLabel: 'Técnico confirmado'
    })
    expect(toProfessionalJobSummary(job)).toMatchObject({ id: job.id, group: 'active', stage: 0 })
    expect(toAdminJobSummary(job)).toMatchObject({ id: job.id, statusLabel: 'Confirmado' })
  })
  it('uses database totals rather than counting a preview page', () => {
    const result = buildCustomerReadDashboard({
      customerName: 'Ana',
      metrics: {
        activeJobs: 137,
        jobs: 150,
        requests: 180,
        equipment: 70,
        claims: 2,
        payments: 148
      },
      jobs: { items: [job], total: 150, nextCursor: 'next' },
      equipment: { items: [], total: 70, nextCursor: 'equipment-next' }
    })
    expect(result.counts).toMatchObject({
      activeJobs: 137,
      equipment: 70,
      requests: 180,
      claims: 2
    })
    expect(result.jobs.total).toBe(150)
    expect(result.jobs.nextCursor).toBe('next')
  })
  it('keeps production read models free of demonstration imports', () => {
    for (const path of [
      'components/pro/pro-model.ts',
      'components/admin/admin-model.ts',
      'features/customer/view-models.ts',
      'features/customer/dashboard-view-model.ts'
    ])
      expect(readFileSync(path, 'utf8')).not.toMatch(/from\s+['"][^'"]*(?:mock|fixtures)[^'"]*['"]/)
  })
})
