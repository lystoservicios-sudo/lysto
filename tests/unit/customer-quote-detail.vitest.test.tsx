import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateServiceQuote } from '@/lib/pricing/service-quote'
import { CustomerQuoteDetail } from '@/components/customer/customer-quote-detail'

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

const quoteId = '10000000-0000-4000-8000-000000000010'
const requestId = '10000000-0000-4000-8000-000000000011'
const quote = calculateServiceQuote({ issue: 'pierde_agua', urgency: 'flexible', propertyType: 'apartment', access: {}, materials: [] })
const row = (extra: Record<string, unknown> = {}) => ({
  id: quoteId, status: 'ready', version: 3, revision: 1, request_id: null,
  quote: { ...quote, readyToOffer: true, reviewReasons: [] },
  address: { street: 'Av. Córdoba', number: '1450', city: 'CABA' },
  expires_at: new Date(Date.now() + 3600_000).toISOString(), ...extra
})
const ok = (body: unknown) => ({ ok: true, json: async () => body })

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); sessionStorage.clear() })

describe('individual customer quote detail', () => {
  it('shows the approved pre-visit overview before any acceptance decision', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ quotes: [row()] })))
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    await screen.findByRole('button', { name: 'Revisar presupuesto' })
    expect(screen.getByText('Presupuesto listo')).toBeTruthy()
    expect(screen.getByText('Aceptar el presupuesto no realiza ningún cobro.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aceptar y solicitar profesional' })).toBeNull()
    expect(screen.queryByText('Visita confirmada')).toBeNull()
  })

  it('opens a focused review and only then allows acceptance with the strict payload', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok({ quotes: [row()] }))
      .mockResolvedValueOnce(ok({ accepted: true, result: { requestId } }))
      .mockResolvedValueOnce(ok({ quotes: [row({ status: 'accepted', request_id: requestId })] }))
    vi.stubGlobal('fetch', fetcher)
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar presupuesto' }))
    const accept = await screen.findByRole('button', { name: 'Aceptar y solicitar profesional' })
    fireEvent.click(accept)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/app/solicitudes/${requestId}`))
    const call = fetcher.mock.calls.find(([, options]) => options?.method === 'POST')!
    expect(call[0]).toBe('/api/customer/request/submit')
    expect(JSON.parse(call[1].body)).toEqual({ quoteId, expectedVersion: 3 })
    expect(fetcher.mock.calls.some(([url]) => String(url).includes('create-preference'))).toBe(false)
  })

  it.each(['needs_review', 'superseded'])('does not allow accepting a %s quote', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ quotes: [row({ status })] })))
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver presupuesto' }))
    expect((screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not allow accepting an expired quote', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ quotes: [row({ expires_at: '2020-01-01T00:00:00Z' })] })))
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver presupuesto' }))
    expect(screen.getByText('Presupuesto vencido')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('recovers a persisted acceptance after an ambiguous network failure instead of submitting twice', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok({ quotes: [row()] }))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(ok({ quotes: [row({ status: 'accepted', request_id: requestId })] }))
    vi.stubGlobal('fetch', fetcher)
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar presupuesto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/app/solicitudes/${requestId}`))
    expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
  })

  it('blocks a retry until server state can be recovered after an unknown outcome', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok({ quotes: [row()] })).mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', fetcher)
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar presupuesto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }))
    await screen.findByText(/No pudimos verificar el estado/)
    expect((screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Consultar estado' })).toBeTruthy()
  })

  it('recovers from a loading error without inventing a quote', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(ok({ quotes: [row()] }))
    vi.stubGlobal('fetch', fetcher)
    render(<CustomerQuoteDetail quoteId={quoteId} />)
    const retry = await screen.findByRole('button', { name: 'Volver a consultar' })
    expect(screen.queryByText('Presupuesto listo')).toBeNull()
    fireEvent.click(retry)
    await screen.findByText('Presupuesto listo')
  })

  it('does not leave the next quote locked when an earlier acceptance finishes after navigation', async () => {
    const nextQuoteId = '10000000-0000-4000-8000-000000000012'
    let finishAcceptance!: (value: ReturnType<typeof ok>) => void
    const acceptance = new Promise<ReturnType<typeof ok>>(resolve => { finishAcceptance = resolve })
    let accepted = false
    const fetcher = vi.fn((url: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return acceptance
      if (url.includes(nextQuoteId)) return Promise.resolve(ok({ quotes: [row({ id: nextQuoteId })] }))
      return Promise.resolve(ok({ quotes: [row(accepted ? { status: 'accepted', request_id: requestId } : {})] }))
    })
    vi.stubGlobal('fetch', fetcher)
    const { rerender } = render(<CustomerQuoteDetail quoteId={quoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar presupuesto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }))
    rerender(<CustomerQuoteDetail quoteId={nextQuoteId} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar presupuesto' }))
    await act(async () => { accepted = true; finishAcceptance(ok({ accepted: true })) })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Aceptar y solicitar profesional' }) as HTMLButtonElement).disabled).toBe(false))
    expect(router.replace).not.toHaveBeenCalled()
  })
})
