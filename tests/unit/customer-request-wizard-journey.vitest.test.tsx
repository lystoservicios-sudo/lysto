import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import { readPendingPayment } from '@/features/service-request/request-flow-client'
import { addHomeEquipmentSchema, createHomeSchema, saveHomeSchema, type CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { money } from '@/lib/pricing/service-quote'
import { journeyActor, journeyIds as ids, journeyNow, journeyService, journeySnapshot } from '../fixtures/pedir-journey'

const boundary = vi.hoisted(() => ({ service: null as unknown as ReturnType<typeof journeyService>['service'], actor: null as unknown as typeof journeyActor }))
vi.mock('@/lib/customer-requests/service', async importActual => {
  const actual = await importActual<typeof import('@/lib/customer-requests/service')>()
  return { ...actual, customerRequestService: { preview: (...args: Parameters<typeof actual.customerRequestService.preview>) => boundary.service.preview(...args),
    prepare: (...args: Parameters<typeof actual.customerRequestService.prepare>) => boundary.service.prepare(...args) } }
})
vi.mock('@/lib/auth/session', async importActual => ({ ...await importActual<typeof import('@/lib/auth/session')>(), requireSession: async () => boundary.actor }))
vi.mock('@/lib/observability/logger', () => ({ logEvent: () => undefined }))
import { POST as preview } from '@/app/api/customer/requests/preview/route'
import { POST as prepare } from '@/app/api/customer/requests/prepare/route'

beforeEach(() => {
  window.sessionStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(journeyNow)
  boundary.actor = journeyActor
  for (const [name, value] of Object.entries({ APP_ENV: 'test', NEXT_PUBLIC_APP_URL: 'https://lysto.test', RATE_LIMIT_HASH_KEY: '',
    PAYMENTS_PROVIDER: 'mercadopago_split', LYSTO_ACCEPT_NEW_REQUESTS: 'true', LYSTO_ALLOW_NEW_CHECKOUTS: 'true' })) vi.stubEnv(name, value)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

describe('Pedir seven-step component journey with the real quote/preparation service', () => {
  it.each([
    { branch: 'repair with saved air', issue: 'pierde_agua', scenario: 'maintenance', serviceRadio: /Pierde agua/, detailRadio: 'Hace días',
      timeSince: 'days', answers: {}, orientation: 'Qué puede estar pasando', inline: false },
    { branch: 'maintenance with saved air', issue: 'mantenimiento', scenario: 'maintenance', serviceRadio: 'Mantenimiento', detailRadio: 'Hace más de un año',
      timeSince: 'today', answers: { last_maintenance: 'over_1_year' }, orientation: 'Qué vamos a revisar', inline: false },
    { branch: 'installation with saved air', issue: 'instalacion', scenario: 'installation', serviceRadio: 'Instalación', detailRadio: 'Instalación nueva',
      timeSince: 'today', answers: { installation_type: 'new' }, orientation: 'Qué vamos a revisar', inline: false },
    { branch: 'repair with inline home, room and air registration', issue: 'pierde_agua', scenario: 'maintenance', serviceRadio: /Pierde agua/, detailRadio: 'Hace días',
      timeSince: 'days', answers: {}, orientation: 'Qué puede estar pasando', inline: true }
  ] as const)('$branch reaches price, preparation and canonical confirmation with the 18/82 split', async branch => {
    let inventory: CustomerHomesSnapshot = branch.inline ? { homes: [], addresses: [], equipment: [] } : journeySnapshot()
    const fixture = journeyService({ issue: branch.issue, scenario: branch.scenario, snapshot: () => inventory }); boundary.service = fixture.service
    let canonicalStatus = 'pending'
    const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = []
    const assign = vi.fn()
    const nativeWindow = window
    // Capture the redirect without opening a browser or asking jsdom to navigate.
    vi.stubGlobal('window', new Proxy(nativeWindow, { get(target, key) {
      if (key === 'location') return { ...nativeWindow.location, assign }
      return Reflect.get(target, key, target)
    } }))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'https://lysto.test'), method = init?.method ?? 'GET'
      expect(url.origin).toBe('https://lysto.test')
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ path: url.pathname, method, body })
      expect(new Headers(init?.headers).get('X-Lysto-Customer-Id')).toBe(ids.customer)
      const request = new Request(url, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), Origin: url.origin } })
      // Inline inventory uses actual form/client schemas. Only its external persistence is a fixture.
      if (url.pathname === '/api/customer/homes' && method === 'POST') {
        const parsed = createHomeSchema.parse(body)
        expect(parsed.addressId).toBeNull(); expect(parsed.newAddress).toBeDefined()
        expect(parsed.floors).toHaveLength(1); expect(parsed.floors[0].rooms).toEqual([]); expect(parsed.placements).toEqual([])
        const { idempotencyKey, newAddress, addressId, ...configuration } = parsed
        void idempotencyKey; void addressId
        const address = { ...newAddress!, id: ids.address, version: 1, createdAt: journeyNow.toISOString(), archivedAt: null }
        const home = { ...configuration, id: ids.home, addressId: ids.address, version: 1 }
        inventory = { homes: [home], addresses: [address], equipment: [] }
        return Response.json({ home, address }, { status: 201 })
      }
      if (url.pathname === '/api/customer/homes' && method === 'PUT') {
        const parsed = saveHomeSchema.parse(body)
        expect(parsed.id).toBe(ids.home); expect(parsed.expectedVersion).toBe(inventory.homes[0].version)
        const { expectedVersion, ...configuration } = parsed
        const home = { ...configuration, version: expectedVersion + 1 }
        inventory = { ...inventory, homes: [home] }
        return Response.json({ home })
      }
      if (url.pathname === '/api/customer/homes/equipment' && method === 'POST') {
        const parsed = addHomeEquipmentSchema.parse(body)
        expect(parsed.homeId).toBe(ids.home); expect(parsed.expectedVersion).toBe(inventory.homes[0].version)
        expect(parsed.equipment).toMatchObject({ nickname: 'Aire del living', equipmentType: 'inverter', frigorias: 3000 })
        expect(parsed.placement).toMatchObject({ wall: 'west', offset: .35, height: 1.9 })
        const equipment = { ...parsed.equipment, id: ids.equipment, addressId: ids.address,
          brand: parsed.equipment.brand ?? null, model: parsed.equipment.model ?? null, serialNumber: parsed.equipment.serialNumber ?? null,
          frigorias: parsed.equipment.frigorias?.toString() ?? null, version: 1, createdAt: journeyNow.toISOString(), archivedAt: null }
        const home = { ...inventory.homes[0], version: parsed.expectedVersion + 1, placements: [{ ...parsed.placement, equipmentId: equipment.id }] }
        inventory = { ...inventory, homes: [home], equipment: [equipment] }
        return Response.json({ home, equipment }, { status: 201 })
      }
      if (url.pathname === '/api/customer/homes' && method === 'GET') return Response.json(inventory)
      if (url.pathname === '/api/customer/requests/preview') return preview(request)
      if (url.pathname === '/api/customer/requests/prepare') return prepare(request)
      // Payment transport fixtures are separate from the real SDK/ledger journey suite.
      if (url.pathname === '/api/mercadopago/create-preference') {
        expect(body).toEqual({ jobId: ids.job })
        expect(fixture.committed?.quote?.paymentCostBudget).toBe(0)
        return Response.json({ checkoutId: ids.checkout, status: 'ready', initPoint: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fixture' })
      }
      if (url.pathname === '/api/mercadopago/checkouts' && method === 'POST') {
        expect(body).toEqual({ checkoutId: ids.checkout, action: 'reconcile_return' })
        return Response.json({ updated: true })
      }
      if (url.pathname === '/api/mercadopago/checkouts' && method === 'GET') {
        expect(url.searchParams.get('jobId')).toBe(ids.job)
        return Response.json({ checkouts: [{ id: ids.checkout, job_id: ids.job, extra_id: null, status: canonicalStatus }], role: 'customer' })
      }
      throw new Error(`Unexpected frontend request: ${method} ${url.pathname}`)
    }))
    render(<AirConditioningWizard customerId={ids.customer} initialData={inventory} />)
    const next = () => fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }))
    expect(screen.getByRole('heading', { name: branch.inline ? 'Otro aire o equipo nuevo' : 'Aire del living' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: branch.serviceRadio })); next()
    expect(screen.getByRole('heading', { name: 'Revisá dónde está tu aire' })).toBeTruthy()
    if (branch.inline) {
      fireEvent.click(screen.getByRole('button', { name: 'Añadir hogar' }))
      fireEvent.change(screen.getByLabelText('Nombre del hogar'), { target: { value: 'Mi casa' } })
      fireEvent.change(screen.getByLabelText('Tipo de lugar'), { target: { value: 'house' } })
      for (const [label, value] of [['Calle', 'Visita'], ['Número', '20'], ['Ciudad', 'CABA'], ['Provincia', 'CABA']])
        fireEvent.change(screen.getByLabelText(label), { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar hogar' }))
      expect(await screen.findByRole('option', { name: 'Mi casa' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Añadir ambiente' }))
      fireEvent.change(screen.getByLabelText('Nombre del ambiente'), { target: { value: 'Living' } })
      fireEvent.change(screen.getByLabelText('Tipo de ambiente'), { target: { value: 'living' } })
      fireEvent.change(screen.getByLabelText('Variante'), { target: { value: 'family' } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar ambiente' }))
      fireEvent.click(await screen.findByRole('radio', { name: 'Living' }))
      fireEvent.click(screen.getByRole('button', { name: 'Añadir aire aquí' }))
      fireEvent.change(screen.getByLabelText('Nombre del aire'), { target: { value: 'Aire del living' } })
      fireEvent.change(screen.getByLabelText('Tipo de aire'), { target: { value: 'inverter' } })
      fireEvent.change(screen.getByLabelText('Frigorías (opcional)'), { target: { value: '3000' } })
      fireEvent.change(screen.getByLabelText('Pared'), { target: { value: 'west' } })
      fireEvent.change(screen.getByLabelText('Posición sobre la pared'), { target: { value: '.35' } })
      fireEvent.change(screen.getByLabelText('Altura orientativa'), { target: { value: '1.9' } })
      fireEvent.click(screen.getByRole('button', { name: 'Registrar y ubicar aire' }))
      expect(await screen.findByText('Ubicación guardada')).toBeTruthy()
      await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar con los detalles' }) as HTMLButtonElement).disabled).toBe(false))
      expect(window.sessionStorage.getItem(`lysto:pedir:location:${ids.customer}`)).toBeNull()
    }
    expect(screen.queryByLabelText('Planta')).toBeNull(); next()
    expect(screen.getByRole('heading', { name: 'Contanos un poco más' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: branch.detailRadio }))
    const description = `Detalle declarado para ${branch.issue}`
    fireEvent.change(screen.getByLabelText(/¿Querés agregar algo/), { target: { value: description } }); next()
    expect(screen.getByRole('heading', { name: branch.orientation })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir horario preferido' }))
    expect(screen.getByRole('heading', { name: '¿Cuándo podrías recibirnos?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' }))
    fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2028-01-12' } })
    fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }))
    expect(await screen.findByRole('heading', { name: 'Revisá tu pedido' })).toBeTruthy()
    const pay = screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement
    await waitFor(() => expect(pay.disabled).toBe(false))
    expect(fixture.payload?.quote).toMatchObject({ paymentCostBudget: 0, readyToOffer: true, platformFeeRate: .18 })
    const quote = fixture.payload!.quote
    expect(quote.platformFee).toBe(money(quote.total * .18))
    expect(quote.professionalAmount).toBe(money(quote.total * .82))
    expect(money(quote.professionalAmount + quote.platformFee)).toBe(quote.total)
    expect(quote.laborReference).toBe(branch.issue === 'instalacion' ? 240000 : 140000)
    expect(fixture.payload?.scope.scenario).toBe(branch.scenario)
    expect(fixture.policy.paymentCostRate).toBe(.06)
    expect(screen.getByText('Si durante la visita se detectan otros problemas o hacen falta repuestos, el profesional te presentará un presupuesto adicional para que lo revises antes de decidir.')).toBeTruthy()
    fireEvent.click(pay)
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    expect(assign).toHaveBeenCalledWith('https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=fixture')
    expect(await screen.findByRole('heading', { name: 'Estamos comprobando tu pago' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Pago confirmado' })).toBeNull()
    expect(readPendingPayment(ids.customer).payment).toMatchObject({ previewId: ids.preview, jobId: ids.job, checkoutId: ids.checkout })

    // A new render reproduces returning/reloading without trusting any redirect status.
    cleanup()
    nativeWindow.history.replaceState(null, '', '/?status=approved&collection_status=approved')
    render(<AirConditioningWizard customerId={ids.customer} initialData={inventory} />)
    expect(await screen.findByRole('heading', { name: 'Estamos comprobando tu pago' })).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Actualizar estado del pago' }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByRole('heading', { name: 'Pago confirmado' })).toBeNull()
    canonicalStatus = 'approved'
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado del pago' }))
    expect(await screen.findByRole('heading', { name: 'Pago confirmado' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver servicio' }).getAttribute('href')).toBe(`/app/trabajos/${ids.job}`)
    expect(readPendingPayment(ids.customer).payment).toBeNull()
    expect(fixture.preparations).toBe(1)
    expect(calls.filter(call => call.path.endsWith('/prepare'))).toHaveLength(1)
    expect(calls.filter(call => call.path.endsWith('/create-preference'))).toHaveLength(1)
    expect(calls.find(call => call.path.endsWith('/preview'))?.body).toMatchObject({ equipmentId: ids.equipment, addressId: ids.address,
      homeId: ids.home, expectedHomeVersion: inventory.homes[0].version, expectedEquipmentVersion: inventory.equipment[0].version,
      floorId: inventory.homes[0].floors[0].id, roomId: inventory.homes[0].placements[0].roomId,
      issue: branch.issue, timeSince: branch.timeSince, description, answers: branch.answers, preferredDate: '2028-01-12', timeWindow: '10:00 – 12:00' })
    if (branch.inline) {
      expect(calls.filter(call => call.path === '/api/customer/homes' && call.method === 'POST')).toHaveLength(1)
      expect(calls.filter(call => call.path === '/api/customer/homes' && call.method === 'PUT')).toHaveLength(1)
      expect(calls.filter(call => call.path === '/api/customer/homes/equipment' && call.method === 'POST')).toHaveLength(1)
      expect(fixture.payload?.context.equipment.id).toBe(ids.equipment)
      expect(fixture.payload?.context.placement).toEqual(inventory.homes[0].placements[0])
    }
    nativeWindow.history.replaceState(null, '', '/')
  })
})
