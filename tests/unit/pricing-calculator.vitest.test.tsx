import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PricingCalculator } from '@/components/pricing/pricing-calculator'
import { defaultQuotePolicy, type QuotePolicy } from '@/lib/pricing/service-quote'
import { selectUnitAddress, withLocationProvider } from './location-provider-fixture'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function mountCalculator(canFinance = true) {
  const legacyPolicy: QuotePolicy = { ...defaultQuotePolicy, version: 'legacy-fixture-policy', source: 'Referencia de prueba sin aprobación',
    approvedUntil: null, platformFeeRate: .18, paymentCostRate: .06 }
  const writes: Array<{ path: string; body: { policy: QuotePolicy; expectedRevision: number; reason: string } }> = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/pricing/policy' && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)); writes.push({ path, body })
      return Response.json({ policy: body.policy, revision: 8 })
    }
    if (init?.method && init.method !== 'GET') throw new Error(`Unexpected financial mutation: ${path}`)
    if (path === '/api/pricing/policy') return Response.json({ policy: legacyPolicy, revision: 7 })
    if (path === '/api/pricing/quotes') return Response.json({ quotes: [], nextCursor: null })
    if (path === '/api/pricing/offers') return Response.json({ jobs: [], offers: [], role: 'admin' })
    throw new Error(`Unexpected pricing request: ${path}`)
  }))
  const view = render(<PricingCalculator canFinance={canFinance} />)
  return { ...view, legacyPolicy, writes }
}

describe('pricing calculator gross split configuration', () => {
  it('only sends the selected canonical address when calculating or saving a new quote', async () => {
    const writes: Array<Record<string, unknown>> = []
    const domain = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      if (path === '/api/pricing/policy') return Response.json({ policy: defaultQuotePolicy, revision: 1 })
      if (path === '/api/pricing/quotes') return Response.json({ quotes: [], nextCursor: null })
      if (path === '/api/pricing/offers') return Response.json({ jobs: [], offers: [], role: 'admin' })
      if (path === '/api/pricing/quote') {
        writes.push(JSON.parse(String(init?.body)))
        return Response.json({ error: 'Respuesta de prueba' }, { status: 422 })
      }
      throw new Error(`Unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', withLocationProvider(domain))
    const { container } = render(<PricingCalculator />)
    await waitFor(() => expect((container.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false))
    fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Corrientes 456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Calcular con datos del servidor' }))
    expect(writes).toHaveLength(0)
    expect(screen.getByText('Elegí una dirección de las opciones para confirmar la ubicación.')).toBeTruthy()
    await selectUnitAddress()
    fireEvent.change(screen.getByLabelText('Identificador del cliente (para guardar)'), { target: { value: '10000000-0000-4000-8000-000000000001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar presupuesto' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toMatchObject({ save: true, address: { street: 'Corrientes', number: '456', city: 'Buenos Aires', province: 'Buenos Aires' } })
  })
  it('loads a legacy policy without exposing a six-percent provider estimate or saving/approving anything', async () => {
    const { container, legacyPolicy, writes } = mountCalculator()
    await waitFor(() => expect((container.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false))
    expect(screen.queryByText(/Costo estimado Mercado Pago/)).toBeNull()
    expect(screen.queryByText(/0,06 = 6%/)).toBeNull()
    expect(screen.getAllByText(/Los cargos reales de Mercado Pago se registran por separado cuando confirma el pago/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Neto estimado del profesional')).toBeNull()
    expect(screen.queryByText(/Hay tarifas sin guardar/)).toBeNull()
    expect(writes).toEqual([])
    expect(legacyPolicy).toMatchObject({ approvedUntil: null, platformFeeRate: .18, paymentCostRate: .06 })
  })

  it('normalizes only the obsolete provider rate on an explicitly justified Finance save', async () => {
    const { container, legacyPolicy, writes } = mountCalculator()
    await waitFor(() => expect((container.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(false))
    fireEvent.click(screen.getByText('Tarifas y parámetros de la calculadora'))
    const save = screen.getByRole('button', { name: 'Guardar configuración validada' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(writes).toEqual([])
    const reason = 'Retiro de la provisión de cobro según la política de reparto bruto'
    fireEvent.change(screen.getByLabelText('Motivo y evidencia de la decisión financiera'), { target: { value: reason } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body).toMatchObject({ expectedRevision: 7, reason,
      policy: { ...legacyPolicy, version: expect.stringMatching(/^lysto-/), paymentCostRate: 0 } })
    expect(writes[0].body.policy.approvedUntil).toBeNull()
    expect(writes[0].body.policy.platformFeeRate).toBe(.18)
    expect(writes[0].body.policy.safetyRate).toBe(.3)
    expect(legacyPolicy.paymentCostRate).toBe(.06)
    expect(await screen.findByText(/los aceptados conservan sus importes/)).toBeTruthy()
  })
})
