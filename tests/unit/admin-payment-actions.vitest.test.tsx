import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AdminChargePanel } from '@/components/payments/admin-charge-panel'
const fetcher = vi.fn()
const jobId = '92000000-0000-4000-8000-000000000001'
const context = { commissionRate: 0.18, jobs: [{
  id: jobId, version: 3, status: 'confirmed', canCharge: true,
  customerName: 'Cliente de prueba', professionalName: 'Técnico de prueba', issueLabel: 'Mantenimiento'
}] }
beforeEach(() => {
  sessionStorage.clear()
  fetcher.mockReset().mockImplementation(async (_url, options) =>
    Response.json(options?.method === 'POST' ? { id: 'charge-1', status: 'proposed' } : context))
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function prepare() {
  render(<AdminChargePanel actorKey="admin-test" />)
  await screen.findByRole('option', { name: /Cliente de prueba/ })
  fireEvent.change(screen.getByLabelText('Servicio a cobrar'), { target: { value: jobId } })
  fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Visita adicional' } })
  fireEvent.change(screen.getByLabelText('Detalle para el cliente'), { target: { value: 'Una visita acordada con el cliente.' } })
  fireEvent.change(screen.getByLabelText('Importe final (ARS)'), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('Motivo administrativo'), { target: { value: 'Solicitud autorizada por operaciones.' } })
}
it('requires review before issuing a charge request, with no automatic payment', async () => {
  await prepare()
  fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud de cobro' }))
  expect(screen.getByRole('dialog', { name: 'Confirmar solicitud de cobro' })).toBeTruthy()
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Crear solicitud para el cliente' }))
  await screen.findByText(/Solicitud creada. El cliente debe aceptarla/)
  const body = JSON.parse(fetcher.mock.calls.find(([, options]) => options?.method === 'POST')![1].body)
  expect(body).toMatchObject({ jobId, amount: 100, commissionMode: 'standard', expectedCommissionRate: 0.18 })
  expect(fetcher.mock.calls.every(([url]) => url === '/api/payments/admin-charges')).toBe(true)
})
it('uses zero Lysto commission without promising zero provider fees', async () => {
  await prepare()
  fireEvent.change(screen.getByLabelText('Comisión de Lysto'), { target: { value: 'none' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud de cobro' }))
  expect(screen.getByText(/Mercado Pago puede descontar/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Crear solicitud para el cliente' }))
  await screen.findByText(/Solicitud creada/)
  expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options?.method === 'POST')![1].body))
    .toMatchObject({ commissionMode: 'none', expectedCommissionRate: 0 })
})
it('retries an uncertain request with the same idempotency key', async () => {
  await prepare()
  let failed = false
  fetcher.mockImplementation(async (_url, options) => {
    if (options?.method === 'POST' && !failed) { failed = true; throw new Error('Respuesta interrumpida') }
    return Response.json(options?.method === 'POST' ? { id: 'charge-1', status: 'proposed' } : context)
  })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar solicitud de cobro' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear solicitud para el cliente' }))
  await screen.findByText('Respuesta interrumpida')
  fireEvent.click(screen.getByRole('button', { name: 'Crear solicitud para el cliente' }))
  await waitFor(() => expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2))
  const bodies = fetcher.mock.calls.filter(([, options]) => options?.method === 'POST').map(([, options]) => JSON.parse(options.body))
  expect(bodies[0].idempotencyKey).toBe(bodies[1].idempotencyKey)
})
