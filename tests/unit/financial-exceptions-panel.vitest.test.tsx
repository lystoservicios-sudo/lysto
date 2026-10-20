import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FinancialExceptionsPanel } from '@/components/payments/financial-exceptions-panel'

const jobId = '92000000-0000-4000-8000-000000000001'
const paymentId = '92000000-0000-4000-8000-000000000003'
const context = { commissionRate: 0.18, jobs: [{
  id: jobId, version: 7, status: 'confirmed', canCharge: true,
  customerName: 'Cliente de prueba', professionalName: 'Técnico de prueba', issueLabel: 'Mantenimiento'
}] }
const queue = { cases: [], refunds: [], refundablePayments: [{
  id: paymentId, jobId, amount: 100, currency: 'ARS', status: 'approved', reservedAmount: 0, availableAmount: 100
}] }
const fetcher = vi.fn()
const posts = () => fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')
beforeEach(() => {
  sessionStorage.clear()
  fetcher.mockReset().mockImplementation(async (url, options) =>
    Response.json(options?.method === 'POST' ? { ok: true } : url.includes('admin-charges') ? context : queue))
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function mount() {
  render(<FinancialExceptionsPanel actorKey="admin-test" canFinance canOperate />)
  await screen.findByLabelText(`Importe a devolver ${paymentId}`)
}
async function reviewRefund(amount: number) {
  await mount()
  fireEvent.change(screen.getByLabelText(`Importe a devolver ${paymentId}`), { target: { value: String(amount) } })
  fireEvent.change(screen.getByLabelText(`Motivo de devolución ${paymentId}`), { target: { value: 'Devolución acordada con el cliente.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar devolución' }))
}
it.each([25.50, 100])('reviews the recipient and amount before a refund of %s', async amount => {
  await reviewRefund(amount)
  const dialog = screen.getByRole('dialog', { name: 'Confirmar operación administrativa' })
  expect(within(dialog).getByText(/Cliente de prueba/)).toBeTruthy()
  expect(within(dialog).getByText(/medio de pago original/)).toBeTruthy()
  expect(posts()).toHaveLength(0)
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar operación' }))
  await screen.findByText(/Solicitud de devolución registrada/)
  expect(JSON.parse(posts()[0][1].body)).toMatchObject({ action: 'requestRefund', paymentId, amount })
})
it('reuses a refund key after an uncertain response', async () => {
  await reviewRefund(25)
  fetcher.mockRejectedValueOnce(new Error('Respuesta interrumpida'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
  await waitFor(() => expect(screen.getAllByText('Respuesta interrumpida').length).toBeGreaterThan(0))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
  await screen.findByText(/Solicitud de devolución registrada/)
  expect(posts()).toHaveLength(2)
  expect(JSON.parse(posts()[0][1].body).idempotencyKey).toBe(JSON.parse(posts()[1][1].body).idempotencyKey)
})
it('uses the selected service version and does not refund on cancellation', async () => {
  await mount()
  fireEvent.change(screen.getByLabelText('Servicio para cancelar o reasignar'), { target: { value: jobId } })
  fireEvent.change(screen.getByLabelText('Motivo de cancelación o cambio'), { target: { value: 'Cancelación solicitada por el cliente.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Revisar cancelación' }))
  expect(screen.getByText(/No se devuelve dinero automáticamente/)).toBeTruthy()
  expect(posts()).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
  await screen.findByText(/Operación registrada/)
  expect(posts()).toHaveLength(1)
  expect(posts()[0][0]).toBe('/api/jobs/cancel')
  expect(JSON.parse(posts()[0][1].body)).toMatchObject({ action: 'cancel', jobId, expectedVersion: 7 })
})
it('identifies the selected case and client when several cases are listed', async () => {
  const otherJob = '92000000-0000-4000-8000-000000000004'
  const readyCase = '92000000-0000-4000-8000-000000000005'
  const cases = [
    { id: 'case-pending', jobId, kind: 'cancellation', status: 'waiting_reconciliation', reason: 'Caso del primer cliente', version: 1 },
    { id: readyCase, jobId: otherJob, kind: 'cancellation', status: 'ready', reason: 'Caso del segundo cliente', version: 2 }
  ]
  fetcher.mockImplementation(async (url) => Response.json(url.includes('admin-charges')
    ? { ...context, jobs: [...context.jobs, { ...context.jobs[0], id: otherJob, customerName: 'Otro cliente' }] }
    : { ...queue, cases }))
  await mount()
  fireEvent.change(screen.getByPlaceholderText('Motivo de resolución operativa'), { target: { value: 'Resolver el caso ya conciliado.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Resolver caso' }))
  const dialog = screen.getByRole('dialog', { name: 'Confirmar operación administrativa' })
  expect(within(dialog).getByText(/Otro cliente/)).toBeTruthy()
  expect(within(dialog).queryByText(/Cliente de prueba/)).toBeNull()
  expect(posts()).toHaveLength(0)
  expect(fetcher.mock.calls.find(([url]) => url.includes('admin-charges'))?.[0]).toContain(encodeURIComponent(otherJob))
})
