import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LiveProfessionalDashboard, LiveProfessionalJobs } from '@/components/pro/live-professional'
import { buildCustomerDashboardViewModel } from '@/features/customer/dashboard-view-model'
import type { ProfessionalLiveJob } from '@/lib/professional/live-model'
import type { CustomerJobViewModel } from '@/features/customer/view-models'

const job = { id: 'expired-job', status: 'confirmed', statusLabel: 'Solicitud vencida', scheduledDate: '2026-10-16',
  timeWindow: '14:00-18:00', issueLabel: 'Pierde agua', address: 'Corrientes 999, CABA', finalAmount: 40000,
  contractSource: 'automatic_customer_request', requestStatus: 'expired' } as ProfessionalLiveJob
afterEach(cleanup)
describe('expired automatic contracts in dashboard reads', () => {
  it('does not count an expired reservation as an active technician visit', () => {
    render(<LiveProfessionalDashboard name="Ana" rating={null} jobs={[job]} />)
    expect(screen.queryByRole('link', { name: 'Abrir trabajo' })).toBeNull()
    expect(screen.getByText('0')).toBeTruthy()
  })
  it('keeps an expired technician reservation in history, not the active list', () => {
    render(<LiveProfessionalJobs jobs={[job]} />)
    expect(screen.queryByRole('link', { name: 'Abrir trabajo' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Finalizados/ }))
    expect(screen.getByRole('link', { name: 'Abrir trabajo' }).getAttribute('href')).toBe('/pro/trabajos/expired-job')
    expect(screen.getByText('Solicitud vencida')).toBeTruthy()
  })
  it('does not feature an expired reservation as an active customer visit', () => {
    const customerJob = { ...job, requestId: 'request', statusView: { label: 'Solicitud vencida', tone: 'neutral' },
      nextStep: 'La solicitud está cerrada', canReview: false, scheduledAt: '2026-10-16', amount: 40000 } as CustomerJobViewModel
    const model = buildCustomerDashboardViewModel({ customerName: 'Cliente', jobs: [customerJob], equipment: [], maintenance: [], warranties: [] })
    expect(model.activeJob).toBeNull()
    expect(model.metrics.find(metric => metric.id === 'active-jobs')?.value).toBe(0)
  })
})
