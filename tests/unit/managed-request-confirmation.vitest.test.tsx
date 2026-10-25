import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ManagedRequestConfirmation } from '@/components/customer/managed-request-confirmation'
import type { ManagedRequestSummary } from '@/lib/admin/service-request-contract'

const request: ManagedRequestSummary = { id: '00000000-0000-4000-8000-000000000001', version: 3,
  title: 'Mantenimiento acordado', description: 'Limpieza de ambas unidades y verificación completa.', total: 100000,
  startsAt: '2027-01-10T13:00:00Z', durationMinutes: 60, acceptedAt: null, canAccept: false,
  assignmentVersion: 1, scheduleVersion: 2 }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('does not allow confirmation or payment before professional acceptance', () => {
  render(<ManagedRequestConfirmation summary={request} onConfirmed={vi.fn()} onRefresh={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Confirmar y pagar' })).toBeNull()
  expect(screen.getByText(/terminando de coordinar/)).toBeTruthy()
})
it('submits explicit consent tied to the displayed quote, professional and schedule versions', async () => {
  const confirmed = vi.fn()
  const fetcher = vi.fn().mockResolvedValue(Response.json({ managedRequest: { summary: { ...request, acceptedAt: '2026-10-25T20:00:00Z' } } }))
  vi.stubGlobal('fetch', fetcher)
  render(<ManagedRequestConfirmation summary={{ ...request, canAccept: true }} onConfirmed={confirmed} onRefresh={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Confirmar y pagar' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el servicio/ }))
  fireEvent.click(button)
  await screen.findByText(/Servicio confirmado/)
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ id: request.id, expectedVersion: 3, assignmentVersion: 1, scheduleVersion: 2 })
  expect(confirmed).toHaveBeenCalledOnce()
  expect(screen.queryByText(/Comisión/)).toBeNull()
})
it('requires a refresh after a lost confirmation response and prevents another submission', async () => {
  const refresh = vi.fn()
  const fetcher = vi.fn().mockRejectedValue(new Error('timeout'))
  vi.stubGlobal('fetch', fetcher)
  render(<ManagedRequestConfirmation summary={{ ...request, canAccept: true }} onConfirmed={vi.fn()} onRefresh={refresh} />)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y pagar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Consultar estado' }))
  expect(refresh).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenCalledOnce()
  expect((screen.getByRole('button', { name: 'Confirmar y pagar' }) as HTMLButtonElement).disabled).toBe(true)
})
it('does not initiate or redirect a payment after the customer leaves the service', async () => {
  let release!: (value: Response) => void
  const deferred = new Promise<Response>(resolve => { release = resolve })
  const fetcher = vi.fn().mockReturnValueOnce(deferred)
  vi.stubGlobal('fetch', fetcher)
  const confirmed = vi.fn()
  const view = render(<ManagedRequestConfirmation summary={{ ...request, canAccept: true }} jobId="job-a" onConfirmed={confirmed} onRefresh={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y pagar' }))
  view.unmount()
  await act(async () => { release({ ok: true, json: async () => ({ managedRequest: { summary: { ...request, acceptedAt: '2026-10-25T20:00:00Z' } } }) } as Response) })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(confirmed).not.toHaveBeenCalled()
})
