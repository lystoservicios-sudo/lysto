import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CustomerRequestDetail } from '@/components/customer/customer-request-detail'
import { CustomerRequestList } from '@/components/customer/customer-request-list'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import type { CustomerRequestViewModel } from '@/features/customer/view-models'

afterEach(() => cleanup())

const pendingRequest = customerDemoFixtures.requests[0]
const draftRequest: CustomerRequestViewModel = {
  ...pendingRequest,
  id: 'req_demo_draft',
  issue: 'mantenimiento',
  issueLabel: 'Mantenimiento',
  status: 'draft',
  statusView: { label: 'Borrador', tone: 'neutral' },
  preliminaryDiagnosis: 'Todavía faltan datos para generar el diagnóstico preliminar.',
  preliminaryPrice: null,
  nextStep: 'Continuar la solicitud'
}

describe('customer request pages', () => {
  it('filters demo requests without importing the global operational dataset', () => {
    render(<CustomerRequestList requests={[pendingRequest, draftRequest]} />)

    expect(screen.getByRole('button', { name: 'Todas 2' })).toBeTruthy()
    expect(screen.getByText('No enfría')).toBeTruthy()
    expect(screen.getByText('Mantenimiento')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Borradores 1' }))
    expect(screen.queryByText('No enfría')).toBeNull()
    expect(screen.getByText('Mantenimiento')).toBeTruthy()
  })

  it('presents customer-safe request detail and the deferred payment next step', () => {
    render(<CustomerRequestDetail request={pendingRequest} />)

    expect(screen.getByRole('heading', { name: 'No enfría' })).toBeTruthy()
    expect(screen.getByText('Revisión preliminar pendiente de confirmación profesional.')).toBeTruthy()
    expect(screen.getByText('Dirección de demostración, CABA')).toBeTruthy()
    expect(screen.getByText('La integración de Mercado Pago se incorporará en la etapa final')).toBeTruthy()
    expect(screen.queryByText('Informe interno')).toBeNull()
  })

  it('covers loading, empty and recoverable error states for the list', () => {
    const retry = vi.fn()
    const { rerender } = render(<CustomerRequestList requests={[]} state="loading" />)
    expect(screen.getByRole('status').textContent).toContain('Cargando solicitudes')

    rerender(<CustomerRequestList requests={[]} state="empty" />)
    expect(screen.getByText('Todavía no tenés solicitudes')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Solicitar un servicio' })).toBeTruthy()

    rerender(<CustomerRequestList requests={[]} state="error" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
