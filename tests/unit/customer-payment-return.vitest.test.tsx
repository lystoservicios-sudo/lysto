// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PaymentReturn } from '@/components/payments/payment-return'

const id = '8688db78-1b3d-4762-a239-0feb06b2878f'
const jobId = '7cc28175-00a1-4ba9-ae4f-c87ccc6ef2b5'
const paid = {
  id, jobId, status: 'approved', amount: 100, lystoFee: 18, extraId: null, extraLabel: null,
  service: 'Mantenimiento de aire acondicionado', professional: 'Quimey G.',
  scheduledDate: null, timeWindow: null, providerReferences: ['185181353476'],
  liveMode: true, expiresAt: '2026-10-20T16:45:48Z'
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('shows a verified receipt summary, work link and explicit home action without charging again', async () => {
  const fetcher = vi.fn(async () => json(paid))
  vi.stubGlobal('fetch', fetcher)
  render(<PaymentReturn checkoutId={id} />)
  expect(await screen.findByRole('heading', { name: 'Gracias, tu pago está confirmado' })).toBeTruthy()
  expect(screen.getByText('Mantenimiento de aire acondicionado')).toBeTruthy()
  expect(screen.getByText('Quimey G.')).toBeTruthy()
  expect(screen.getByText('A coordinar')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Ver mi trabajo' }).getAttribute('href')).toBe(`/app/trabajos/${jobId}`)
  expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/app')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('ignores an approved URL until the canonical reconciliation and reread confirm the payment', async () => {
  window.history.replaceState({}, '', `/app/pagos/resultado/${id}?status=approved&payment_id=forged`)
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ ...paid, status: 'ready', providerReferences: [] }))
    .mockResolvedValueOnce(json({ updated: true }))
    .mockResolvedValueOnce(json(paid))
  vi.stubGlobal('fetch', fetcher)
  render(<PaymentReturn checkoutId={id} />)
  expect(screen.queryByText('Gracias, tu pago está confirmado')).toBeNull()
  expect(await screen.findByText('Gracias, tu pago está confirmado')).toBeTruthy()
  expect(fetcher).toHaveBeenCalledWith('/api/mercadopago/checkouts', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ checkoutId: id, action: 'reconcile_return' })
  }))
})
it.each([401, 403, 404])('offers safe customer login on %s without reconciling or exposing details', async status => {
  const fetcher = vi.fn(async () => json({ code: 'unauthorized' }, status))
  vi.stubGlobal('fetch', fetcher)
  render(<PaymentReturn checkoutId={id} />)
  const login = await screen.findByRole('link', { name: 'Ingresar' })
  expect(login.getAttribute('href')).toBe(`/login?next=${encodeURIComponent(`/app/pagos/resultado/${id}`)}`)
  expect(screen.queryByText(paid.service)).toBeNull()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('keeps a pending payment unconfirmed with a status retry and no second payment action', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, init) =>
    json(init?.method === 'POST' ? { updated: true } : { ...paid, status: 'pending', providerReferences: [] })))
  render(<PaymentReturn checkoutId={id} />)
  expect(await screen.findByRole('heading', { name: 'Tu pago está pendiente' })).toBeTruthy()
  expect(screen.queryByText('Gracias, tu pago está confirmado')).toBeNull()
  expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Pagar' })).toBeNull()
})
it('allows retry after a provider failure without claiming payment success', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ ...paid, status: 'ready', providerReferences: [] }))
    .mockResolvedValueOnce(json({ code: 'payment_unavailable' }, 503))
    .mockResolvedValueOnce(json(paid))
  vi.stubGlobal('fetch', fetcher)
  render(<PaymentReturn checkoutId={id} />)
  expect(await screen.findByText('No pudimos verificar el pago en este momento.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
  await waitFor(() => expect(screen.getByText('Gracias, tu pago está confirmado')).toBeTruthy())
})
it('identifies the paid additional and zero Lysto fee without presenting it as another base service', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => json({
    ...paid, extraId: '725358cf-fd0a-4d8b-8ab3-abdf7372b26e', extraLabel: 'Limpieza adicional', lystoFee: 0
  })))
  render(<PaymentReturn checkoutId={id} />)
  expect(await screen.findByText('Limpieza adicional')).toBeTruthy()
  expect(screen.getByText('Comisión de Lysto: $0')).toBeTruthy()
})
it('does not show a confirmed state without a canonical payment reference', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, init) =>
    json(init?.method === 'POST' ? { updated: true } : { ...paid, providerReferences: [] })))
  render(<PaymentReturn checkoutId={id} />)
  await waitFor(() => expect(screen.getByText(paid.service)).toBeTruthy())
  expect(screen.getByRole('heading', { name: 'Estamos verificando tu pago' })).toBeTruthy()
  expect(screen.queryByText('Pago confirmado')).toBeNull()
})
it('reconciles a returned retry even if an earlier payment attempt was rejected', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ ...paid, status: 'rejected', providerReferences: [] }))
    .mockResolvedValueOnce(json({ updated: true })).mockResolvedValueOnce(json(paid))
  vi.stubGlobal('fetch', fetcher)
  render(<PaymentReturn checkoutId={id} />)
  expect(await screen.findByText('Gracias, tu pago está confirmado')).toBeTruthy()
})
it('shows the verified provider return without going through account login or customer APIs', async () => {
  const fetcher = vi.fn(async () => json(paid))
  vi.stubGlobal('fetch', fetcher)
  render(<PaymentReturn checkoutId={id} returnToken="signed-return" initialResult={paid} />)
  expect(screen.getByRole('heading', { name: 'Gracias, tu pago está confirmado' })).toBeTruthy()
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
    `/api/payments/return?checkoutId=${id}`,
    expect.objectContaining({ headers: { Authorization: 'Bearer signed-return' } })
  ))
  expect(screen.queryByRole('link', { name: 'Ingresar' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/')
})
