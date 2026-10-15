import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { calculateServiceQuote, defaultQuotePolicy } from '@/lib/pricing/service-quote'
import { storePendingPayment, storeRequestPhotos } from '@/features/service-request/request-flow-client'

const actor = '00000000-0000-4000-8000-000000000001'
const addressId = '00000000-0000-4000-8000-000000000002'
const homeId = '00000000-0000-4000-8000-000000000003'
const floorId = '00000000-0000-4000-8000-000000000004'
const roomId = '00000000-0000-4000-8000-000000000005'
const airId = '00000000-0000-4000-8000-000000000006'
const secondAirId = '00000000-0000-4000-8000-000000000007'
const previewId = '00000000-0000-4000-8000-000000000008'
const jobId = '00000000-0000-4000-8000-000000000009'

export function requestSnapshot(): CustomerHomesSnapshot {
  return {
    addresses: [{ id: addressId, label: 'Casa', street: 'San Martín', number: '456', city: 'CABA', province: 'Buenos Aires', propertyType: 'house', access: { hasElevator: true }, isDefault: true, version: 2, createdAt: '2026-10-13T12:00:00Z', archivedAt: null }],
    equipment: [{ id: airId, nickname: 'Aire del living', addressId, equipmentType: 'inverter', brand: 'Marca declarada', model: null, serialNumber: null, frigorias: '3000', version: 2, createdAt: '2026-10-13T12:00:00Z', archivedAt: null }],
    homes: [{ id: homeId, name: 'Mi casa', addressId, kind: 'house', building: null, features: { balcony: false, terrace: false, windows: 'small' }, version: 3, floors: [{ id: floorId, name: 'Nivel principal', order: 0, rooms: [{ id: roomId, name: 'Living', kind: 'living', variant: 'family', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }], placements: [{ equipmentId: airId, roomId, wall: 'north', offset: .5, height: 2 }] }]
  }
}

beforeEach(() => { window.sessionStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function mount(data = requestSnapshot()) { return render(<AirConditioningWizard customerId={actor} initialData={data} />) }
function next() { fireEvent.click(screen.getByRole('button', { name: /^Continuar/ })) }
function reachSchedule() {
  fireEvent.click(screen.getByRole('radio', { name: /Pierde agua/ }))
  next()
  next()
  fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
  next()
  fireEvent.click(screen.getByRole('button', { name: 'Elegir horario preferido' }))
}
const quote = calculateServiceQuote({ issue: 'pierde_agua', timeSince: 'days', urgency: 'flexible', propertyType: 'house', access: {}, equipment: { capacity: 3000, technology: 'inverter' }, materialsConfirmed: false }, defaultQuotePolicy)

describe('Pedir approved contextual screens', () => {
  it('uses the selected real equipment and compact symptom illustration without inventing a room', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Aire del living' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Representación orientativa del aire/ }).getAttribute('src')).toContain('air-neutral.webp')
    expect(screen.queryByRole('button', { name: 'Siguiente aire' })).toBeNull()
    expect(screen.queryByLabelText('Planta')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /Pierde agua/ }))
    expect(screen.getByRole('img', { name: /Representación orientativa del aire/ }).getAttribute('src')).toContain('air-pierde-agua.webp')
  })

  it('loads the saved location in step two without writing or showing a selector for one floor', () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    mount()
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
    next()
    expect(screen.getByRole('heading', { name: 'Revisá dónde está tu aire' })).toBeTruthy()
    expect(screen.getByText('San Martín 456, CABA')).toBeTruthy()
    expect(screen.queryByLabelText('Planta')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Paso 2 de 7: Ubicación')
    next()
    expect(screen.getByRole('heading', { name: 'Contanos un poco más' })).toBeTruthy()
  })

  it('keeps each air symptom independent while navigating with arrows or swiping', () => {
    const snapshot = requestSnapshot()
    snapshot.equipment.push({ ...snapshot.equipment[0], id: secondAirId, nickname: 'Aire del dormitorio' })
    mount(snapshot)
    fireEvent.click(screen.getByRole('radio', { name: /Pierde agua/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente aire' }))
    expect(screen.getByRole('heading', { name: 'Aire del dormitorio' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Pierde agua/ }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(screen.getByRole('radio', { name: /Hace ruido/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Aire anterior' }))
    expect(screen.getByRole('radio', { name: /Pierde agua/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /Hace ruido/ }).getAttribute('aria-checked')).toBe('false')
  })

  it('uses real multi-floor names and only the active floor', () => {
    const snapshot = requestSnapshot()
    snapshot.homes[0].floors.push({ id: '00000000-0000-4000-8000-000000000020', name: 'Tercer nivel', order: 1, rooms: [] })
    mount(snapshot)
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ }))
    next()
    expect(screen.getByLabelText('Planta')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Tercer nivel' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'PB' })).toBeNull()
  })

  it('does not substitute a fault when the customer does not know the problem', () => {
    mount()
    fireEvent.click(screen.getByRole('radio', { name: 'No sé qué le pasa' }))
    next(); next()
    fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
    next()
    expect(screen.getByRole('heading', { name: 'Qué vamos a revisar' })).toBeTruthy()
    expect(screen.queryByText('Falta de gas')).toBeNull()
  })
  it('includes the unknown symptom in the same keyboard-navigable problem radio group', () => {
    mount()
    const group = screen.getByRole('radiogroup', { name: 'Problema del equipo' })
    const unknown = within(group).getByRole('radio', { name: 'No sé qué le pasa' })
    const first = within(group).getByRole('radio', { name: /No enfría/ })
    first.focus(); fireEvent.keyDown(first, { key: 'End' })
    expect(document.activeElement).toBe(unknown)
    expect(unknown.getAttribute('aria-checked')).toBe('true')
  })

  it.each(['Instalación', 'Mantenimiento'])('asks branch-specific details for %s', (purpose) => {
    mount()
    fireEvent.click(screen.getByRole('radio', { name: purpose }))
    next(); next()
    expect(screen.queryByRole('radiogroup', { name: 'Antigüedad del problema' })).toBeNull()
    expect(screen.getByRole('radiogroup', { name: purpose === 'Instalación' ? 'Tipo de instalación' : 'Último mantenimiento' })).toBeTruthy()
  })

  it('retains answers and calm extra-budget copy while offering only server-priced payment', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('/preview')
      ? new Response(JSON.stringify({ status: 'needs_review', quote, message: 'Necesitamos confirmar el traslado antes de ofrecerte este servicio.', exclusions: ['Repuestos no incluidos'] }), { status: 200 })
      : new Response('{}', { status: 503 })))
    mount(); reachSchedule()
    expect(screen.getByRole('heading', { name: '¿Cuándo podrías recibirnos?' })).toBeTruthy()
    expect(screen.getByText('Es una preferencia, no un turno confirmado.')).toBeTruthy()
    expect(screen.queryByText('Recomendado')).toBeNull()
    fireEvent.click(screen.getAllByRole('radio', { name: /oct|nov|dic|ene|feb|mar|abr|may|jun|jul|ago|sep/ })[0])
    fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }))
    expect(await screen.findByText('Necesitamos confirmar el traslado antes de ofrecerte este servicio.')).toBeTruthy()
    expect(screen.getByText('Si durante la visita se detectan otros problemas o hacen falta repuestos, el profesional te presentará un presupuesto adicional para que lo revises antes de decidir.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Editar detalles' }))
    expect(screen.getByRole('radio', { name: 'Hace días' }).getAttribute('aria-checked')).toBe('true')
  })

  it('clears private answers when the authenticated customer changes', () => {
    const { rerender } = mount()
    fireEvent.click(screen.getByRole('radio', { name: /Pierde agua/ }))
    rerender(<AirConditioningWizard customerId="00000000-0000-4000-8000-000000000099" initialData={requestSnapshot()} />)
    expect(screen.getByRole('radio', { name: /Pierde agua/ }).getAttribute('aria-checked')).toBe('false')
  })

  it('does not treat a forged payment return or a ready checkout as canonical approval', async () => {
    window.history.replaceState(null, '', '/?status=approved&collection_status=approved')
    storePendingPayment(actor, { previewId, commandId: '00000000-0000-4000-8000-000000000030', jobId, checkoutId: '00000000-0000-4000-8000-000000000031' })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('?jobId=')
      ? new Response(JSON.stringify({ checkouts: [{ id: '00000000-0000-4000-8000-000000000031', job_id: jobId, extra_id: null, status: 'ready' }], role: 'customer' }), { status: 200 })
      : new Response(JSON.stringify({ updated: true }), { status: 200 })))
    mount()
    expect(await screen.findByRole('heading', { name: 'Estamos comprobando tu pago' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Pago confirmado' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver servicio' }).getAttribute('href')).toBe(`/app/trabajos/${jobId}`)
    window.history.replaceState(null, '', '/')
  })

  it('restores the same submitted job and only announces payment after its canonical approval', async () => {
    storePendingPayment(actor, { previewId, commandId: '00000000-0000-4000-8000-000000000030', jobId, checkoutId: '00000000-0000-4000-8000-000000000031' })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('?jobId=')
      ? new Response(JSON.stringify({ checkouts: [{ id: '00000000-0000-4000-8000-000000000031', job_id: jobId, extra_id: null, status: 'approved' }], role: 'customer' }), { status: 200 })
      : new Response(JSON.stringify({ updated: true }), { status: 200 })))
    mount()
    expect(await screen.findByRole('heading', { name: 'Pago confirmado' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continuar el mismo pago' })).toBeNull()
    expect(window.sessionStorage.getItem(`lysto:pedir:payment:${actor}`)).toBeNull()
  })

  it('coalesces delayed automatic and manual payment checks so late ready responses cannot replace approval', async () => {
    const checkoutId = '00000000-0000-4000-8000-000000000031'
    storePendingPayment(actor, { previewId, commandId: '00000000-0000-4000-8000-000000000030', jobId, checkoutId })
    let finishInitial!: (response: Response) => void
    const initial = new Promise<Response>(resolve => { finishInitial = resolve })
    let reads = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (!String(input).includes('?jobId=')) return new Response(JSON.stringify({ updated: true }), { status: 200 })
      reads++
      if (reads === 1) return initial
      return new Response(JSON.stringify({ checkouts: [{ id: checkoutId, job_id: jobId, extra_id: null, status: 'approved' }], role: 'customer' }), { status: 200 })
    }))
    mount()
    await waitFor(() => expect(reads).toBe(1))
    const refresh = screen.getByRole('button', { name: 'Actualizar estado del pago' }) as HTMLButtonElement
    expect(refresh.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Continuar el mismo pago' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(refresh); fireEvent.click(refresh)
    await act(async () => { finishInitial(new Response(JSON.stringify({ checkouts: [{ id: checkoutId, job_id: jobId, extra_id: null, status: 'ready' }], role: 'customer' }), { status: 200 })) })
    expect(reads).toBe(1)
    await waitFor(() => expect(refresh.disabled).toBe(false))
    fireEvent.click(refresh)
    expect(await screen.findByRole('heading', { name: 'Pago confirmado' })).toBeTruthy()
    expect(reads).toBe(2)
    expect(screen.queryByRole('button', { name: 'Continuar el mismo pago' })).toBeNull()
  })

  it('allows a later canonical refund update after an approved payment rather than latching approval forever', async () => {
    const checkoutId = '00000000-0000-4000-8000-000000000031'
    storePendingPayment(actor, { previewId, commandId: '00000000-0000-4000-8000-000000000030', jobId, checkoutId })
    let reads = 0
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => !String(input).includes('?jobId=')
      ? new Response(JSON.stringify({ updated: true }), { status: 200 })
      : new Response(JSON.stringify({ checkouts: [{ id: checkoutId, job_id: jobId, extra_id: null, status: ++reads === 1 ? 'approved' : 'refunded' }], role: 'customer' }), { status: 200 })))
    mount()
    expect(await screen.findByRole('heading', { name: 'Pago confirmado' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado del pago' }))
    expect(await screen.findByRole('heading', { name: 'Estamos revisando el estado del pago' })).toBeTruthy()
    expect(reads).toBe(2)
    expect(screen.queryByRole('button', { name: 'Continuar el mismo pago' })).toBeNull()
  })

  it('locks an uncertain prepare command and explicitly retries the same request without inventing a job', async () => {
    const commands: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input).endsWith('/preview')) return new Response(JSON.stringify({ status: 'ready', previewId, quote, scope: 'Servicio cotizado' }), { status: 200 })
      if (String(input).endsWith('/prepare')) { commands.push(JSON.parse(options?.body as string)); return new Response('{}', { status: 503 }) }
      return new Response('{}', { status: 503 })
    }))
    mount(); reachSchedule()
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' }))
    fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2028-01-12' } })
    fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }))
    expect(await screen.findByRole('button', { name: 'Reintentar el mismo pedido' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Preparando el pago…')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar el mismo pedido' }))
    await waitFor(() => expect(commands.length).toBe(2))
    expect(commands[1]).toEqual(commands[0])
    expect(screen.queryByRole('heading', { name: 'Pago confirmado' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Ver servicio' })).toBeNull()
  })

  it('creates only an empty owned home inside the request and uses the canonical result ID', async () => {
    const persisted = requestSnapshot()
    persisted.equipment = []
    persisted.homes[0] = { ...persisted.homes[0], name: 'Oficina nueva', kind: 'office', floors: [{ id: floorId, name: 'Planta principal', order: 0, rooms: [] }], placements: [] }
    const submitted: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === 'POST') { submitted.push(JSON.parse(options.body as string)); return new Response(JSON.stringify({ home: persisted.homes[0], address: persisted.addresses[0] }), { status: 201 }) }
      return new Response(JSON.stringify(persisted), { status: 200 })
    }))
    mount({ homes: [], addresses: [], equipment: [] })
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ })); next()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir hogar' }))
    fireEvent.change(screen.getByLabelText('Nombre del hogar'), { target: { value: 'Oficina nueva' } })
    fireEvent.change(screen.getByLabelText('Tipo de lugar'), { target: { value: 'office' } })
    for (const [label, value] of [['Calle', 'San Martín'], ['Número', '456'], ['Ciudad', 'CABA'], ['Provincia', 'Buenos Aires']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar hogar' }))
    expect(await screen.findByRole('option', { name: 'Oficina nueva' })).toBeTruthy()
    expect(submitted).toHaveLength(1)
    expect(submitted[0].floors).toEqual([expect.objectContaining({ rooms: [] })])
    expect(submitted[0].placements).toEqual([])
    expect((screen.getByRole('button', { name: 'Continuar con los detalles' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('restores verified private photo references after reload without fabricating local files', () => {
    storeRequestPhotos(actor, { [airId]: [{ intentId: '00000000-0000-4000-8000-000000000041', name: 'Aire verificado.jpg', bytes: 2048 }] })
    mount(); fireEvent.click(screen.getByRole('radio', { name: /No enfría/ })); next(); next()
    expect(screen.getByText('Aire verificado.jpg')).toBeTruthy()
    expect(screen.getByText('Guardada de forma privada en tu borrador')).toBeTruthy()
    expect(screen.queryByText('Seleccionado en este dispositivo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar foto guardada Aire verificado.jpg' }))
    expect(screen.queryByText('Aire verificado.jpg')).toBeNull()
  })
  it('keeps an acknowledged home creation pending if its refresh subsequently loses authorization', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => options?.method === 'POST'
      ? new Response(JSON.stringify({ home: requestSnapshot().homes[0] }), { status: 201 })
      : new Response('{}', { status: 403 })))
    mount({ homes: [], addresses: [], equipment: [] })
    fireEvent.click(screen.getByRole('radio', { name: /No enfría/ })); next()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir hogar' }))
    fireEvent.change(screen.getByLabelText('Nombre del hogar'), { target: { value: 'Casa' } })
    for (const [label, value] of [['Calle', 'San Martín'], ['Número', '456'], ['Ciudad', 'CABA'], ['Provincia', 'Buenos Aires']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar hogar' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Guardado pendiente de confirmar')).toBeTruthy()
    expect(window.sessionStorage.getItem(`lysto:pedir:location:${actor}`)).toBeTruthy()
  })
  it('keeps an explicit unknown capacity empty rather than restoring the saved capacity', () => {
    mount(); fireEvent.click(screen.getByRole('radio', { name: /Pierde agua/ })); next(); next()
    fireEvent.click(screen.getByText('Revisar los datos del equipo'))
    const input = screen.getByLabelText('Capacidad del aire (frigorías/h)') as HTMLInputElement
    expect(input.value).toBe('3000')
    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })
  it('shows branch-specific answers and explicit characteristics in the editable review', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'needs_review', message: 'Pendiente de revisión' }), { status: 200 })))
    mount(); fireEvent.click(screen.getByRole('radio', { name: /Pierde agua/ })); next(); next()
    fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
    fireEvent.click(screen.getByRole('radio', { name: 'También cuando está apagado' }))
    fireEvent.click(screen.getByRole('radio', { name: 'A veces' }))
    fireEvent.change(screen.getByLabelText(/¿Querés agregar algo/), { target: { value: 'Gotea de noche' } })
    fireEvent.change(screen.getByLabelText('Capacidad del aire (frigorías/h)'), { target: { value: '' } })
    next(); fireEvent.click(screen.getByRole('button', { name: 'Elegir horario preferido' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' })); fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2028-01-12' } }); fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' })); fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }))
    expect(await screen.findByText('Pendiente de revisión')).toBeTruthy()
    expect(screen.getByText(/Hace días · También cuando está apagado · A veces · Gotea de noche/)).toBeTruthy()
    expect(screen.getByText('Capacidad y tecnología')).toBeTruthy()
    expect(screen.getByText(/Capacidad: No sé · Tecnología: Inverter/)).toBeTruthy()
  })
})
