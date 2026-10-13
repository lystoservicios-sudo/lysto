import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomerServiceSummary, CustomerServicesPage } from '@/features/customer/services-view-model'
import { CustomerServices } from '@/components/customer/customer-services'

const quote: CustomerServiceSummary = {
  id: 'quote:1', requestId: null, jobId: null, quoteId: 'quote-1',
  title: 'Reparación de aire', subject: 'Aire del dormitorio', statusLabel: 'Presupuesto listo',
  phase: 'attention', amount: 85000, createdAt: '2026-10-13T10:00:00Z', visit: null,
  action: { label: 'Revisar presupuesto', href: '/app/presupuestos?presupuesto=quote-1' }
}
const scheduled: CustomerServiceSummary = {
  ...quote, id: 'request:2', requestId: 'request-2', jobId: 'job-2', quoteId: null,
  title: 'Mantenimiento de aire', subject: 'Aire del living', statusLabel: 'Visita confirmada', phase: 'scheduled',
  visit: { startsAt: '2026-10-15T17:00:00Z', endsAt: '2026-10-15T19:00:00Z', timezone: 'America/Argentina/Buenos_Aires', professionalName: 'Martín C.' },
  action: { label: 'Ver visita', href: '/app/trabajos/job-2' }
}
const pending: CustomerServiceSummary = {
  ...scheduled, id: 'request:3', requestId: 'request-3', jobId: 'job-3', title: 'Reparación del living',
  statusLabel: 'Pendiente de tu confirmación', phase: 'attention', visit: null,
  action: { label: 'Revisar y confirmar', href: '/app/trabajos/job-3' }
}
const finished: CustomerServiceSummary = {
  ...scheduled, id: 'request:4', requestId: 'request-4', jobId: 'job-4', title: 'Instalación de aire',
  statusLabel: 'Finalizado', phase: 'finished', visit: null, completedAt: '2026-10-07T18:00:00Z',
  action: { label: 'Ver resultado', href: '/app/trabajos/job-4' }
}
const page = (items: CustomerServiceSummary[], extra: Partial<CustomerServicesPage> = {}): CustomerServicesPage => ({
  items, nextServiceCursor: null, nextQuoteCursor: null, unavailableSections: [], ...extra
})
const response = (data: CustomerServicesPage) => ({ ok: true, json: async () => data })

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('approved customer Services screen', () => {
  it('shows one primary decision and keeps every other pending action accessible', () => {
    render(<CustomerServices initialPage={page([quote, scheduled, pending, finished])} />)
    expect(screen.getByRole('heading', { name: 'Servicios', level: 1 })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Revisar presupuesto/ }).getAttribute('href')).toContain('presupuesto=quote-1')
    expect(screen.getByRole('link', { name: /Reparación del living/ }).getAttribute('href')).toBe('/app/trabajos/job-3')
    expect(screen.getByText('Pendiente de tu confirmación')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Finalizados' })).toBeTruthy()
  })

  it('fetches a fresh server-filtered history rather than filtering only the first page', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page([finished])))
    vi.stubGlobal('fetch', fetcher)
    render(<CustomerServices initialPage={page([quote, scheduled])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Finalizados' }))
    await screen.findByText('Instalación de aire')
    expect(fetcher.mock.calls[0][0]).toContain('filter=finished')
    expect(screen.queryByText('Presupuesto listo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Finalizados' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('loads earlier cases without duplicate rows and keeps quote pagination separate', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page([scheduled, finished], { nextQuoteCursor: 'quotes-next' })))
    vi.stubGlobal('fetch', fetcher)
    render(<CustomerServices initialPage={page([scheduled], { nextServiceCursor: 'services-next', nextQuoteCursor: 'quotes-next' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver servicios anteriores' }))
    await screen.findByText('Instalación de aire')
    expect(screen.getAllByText('Mantenimiento de aire')).toHaveLength(1)
    expect(fetcher.mock.calls[0][0]).toContain('source=services')
    expect(fetcher.mock.calls[0][0]).toContain('serviceCursor=services-next')
    expect(screen.getByRole('button', { name: 'Ver presupuestos anteriores' })).toBeTruthy()
  })

  it('does not present an empty scan with a continuation cursor as an empty history', () => {
    render(<CustomerServices initialPage={page([], { nextServiceCursor: 'scan-next' })} />)
    expect(screen.queryByText('Todavía no tenés servicios')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver servicios anteriores' })).toBeTruthy()
  })

  it('offers a real request destination when the history is truly empty', () => {
    render(<CustomerServices initialPage={page([])} />)
    expect(screen.getByText('Todavía no tenés servicios')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pedir un servicio' }).getAttribute('href')).toBe('/app/solicitar/aire-acondicionado')
  })

  it('keeps loaded cases and exposes an error when an older page fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<CustomerServices initialPage={page([scheduled], { nextServiceCursor: 'next' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver servicios anteriores' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No pudimos'))
    expect(screen.getByText('Mantenimiento de aire')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver servicios anteriores' })).toBeTruthy()
  })

  it('does not label cancelled cases as finalized', () => {
    render(<CustomerServices initialPage={page([{ ...finished, phase: 'cancelled', statusLabel: 'Cancelado' }])} />)
    expect(screen.queryByRole('heading', { name: 'Finalizados' })).toBeNull()
    expect(screen.getByText('Cancelado')).toBeTruthy()
  })

  it('describes a read-only draft once without pretending it can be continued', () => {
    render(<CustomerServices initialPage={page([{ ...scheduled, visit: null, action: null, description: 'Este borrador no tiene un trabajo asociado.' }])} />)
    expect(screen.getAllByText('Este borrador no tiene un trabajo asociado.')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /Mantenimiento de aire/ })).toBeNull()
  })

  it('updates the list when navigation supplies a new server page and filter', () => {
    const { rerender } = render(<CustomerServices initialPage={page([quote])} />)
    rerender(<CustomerServices initialPage={page([finished])} initialFilter="finished" />)
    expect(screen.getByText('Instalación de aire')).toBeTruthy()
    expect(screen.queryByText('Presupuesto listo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Finalizados' }).getAttribute('aria-pressed')).toBe('true')
  })
})
