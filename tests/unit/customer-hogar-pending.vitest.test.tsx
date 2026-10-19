import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomerHogar } from '@/components/customer/hogar/customer-hogar'
import { selectUnitAddress, withLocationProvider } from './location-provider-fixture'
import { ClientAppShell } from '@/components/app-shell/client-app-shell'
import type { CustomerHome, CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { storePendingHomeOperation } from '@/lib/customer-homes/pending-operation'

// Keep the real controller and forms; jsdom cannot render the GPU boundary.
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/app/hogar' }))

const customerId = '20000000-0000-4000-8000-000000000001'
const otherCustomerId = '20000000-0000-4000-8000-000000000002'
const addressId = '20000000-0000-4000-8000-000000000003'
const homeId = '20000000-0000-4000-8000-000000000004'
const floorId = '20000000-0000-4000-8000-000000000005'
const roomId = '20000000-0000-4000-8000-000000000006'
const airId = '20000000-0000-4000-8000-000000000007'
const home: CustomerHome = {
  id: homeId,
  name: 'Mi casa',
  addressId,
  kind: 'house',
  building: null,
  features: { balcony: false, terrace: false, windows: 'large' },
  version: 1,
  placements: [],
  floors: [
    {
      id: floorId,
      name: 'Planta baja',
      order: 0,
      rooms: [
        {
          id: roomId,
          name: 'Living',
          kind: 'living',
          variant: 'compact',
          x: 0,
          z: 0,
          width: 4,
          depth: 4,
          rotation: 0,
          windows: 'large'
        }
      ]
    }
  ]
}
const empty = (): CustomerHomesSnapshot => ({ homes: [], addresses: [], equipment: [] })
const existing = (): CustomerHomesSnapshot =>
  structuredClone({ homes: [home], addresses: [], equipment: [] })
function placedExisting(): CustomerHomesSnapshot {
  const data = existing()
  data.homes[0].placements.push({ equipmentId: airId, roomId, wall: 'north', offset: 0.5, height: 2 })
  data.equipment.push({
    id: airId, nickname: 'Aire existente', addressId, equipmentType: 'split',
    brand: null, model: null, serialNumber: null, frigorias: null,
    version: 1, createdAt: '2026-10-13', archivedAt: null
  })
  return data
}
function recoverOperation(kind: 'create-home' | 'add-equipment' | 'malformed') {
  if (kind === 'malformed') {
    sessionStorage.setItem(key(), '{broken')
    return
  }
  const idempotencyKey = '20000000-0000-4000-8000-000000000008'
  storePendingHomeOperation(customerId, kind === 'create-home' ? {
    kind,
    input: {
      name: 'Casa pendiente', addressId, kind: 'house', building: null,
      features: home.features, floors: home.floors, placements: [], idempotencyKey
    }
  } : {
    kind,
    input: {
      homeId, expectedVersion: 1, idempotencyKey,
      equipment: { nickname: 'Aire pendiente', equipmentType: 'split' },
      placement: { roomId, wall: 'north', offset: 0.5, height: 2 }
    }
  })
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
let request: ReturnType<typeof vi.fn>
const key = (owner = customerId) => `lysto:hogar:pending:${owner}`
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const submitted = (index = 0) => JSON.parse(request.mock.calls[index][1].body)
async function beginHome() {
  render(<CustomerHogar initialData={empty()} customerId={customerId} />)
  click('Crear mi primer hogar')
  change('Nombre del hogar', 'Casa nueva')
  await selectUnitAddress()
  click('Crear hogar')
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
}
async function beginAir() {
  render(<CustomerHogar initialData={existing()} customerId={customerId} />)
  click('Añadir aire')
  change('Nombre del aire', 'Aire nuevo')
  click('Registrar y ubicar aire')
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
}
function createdHome(input: ReturnType<typeof submitted>) {
  return {
    ...input,
    id: homeId,
    addressId,
    version: 1,
    idempotencyKey: undefined,
    newAddress: undefined
  }
}
beforeEach(() => {
  sessionStorage.clear()
  request = vi.fn().mockRejectedValue(new TypeError('Network response lost'))
  vi.stubGlobal('fetch', withLocationProvider(request))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('Hogar pending operation identity', () => {
  it('renews proof A to B without changing the uncertain command identity', async () => {
    await beginHome()
    const first = submitted()
    const stored = sessionStorage.getItem(key())
    const provider = withLocationProvider(request)
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input) === '/api/location/renew') return response({ proof: 'renewed-proof-B' })
      return provider(input, options)
    })
    click('Reintentar creación')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(submitted(1)).toEqual({ ...first, newAddress: { ...first.newAddress, locationProof: 'renewed-proof-B' } })
    expect(sessionStorage.getItem(key())).toBe(stored)
  })

  it('retains the uncertain command without retrying its write when proof renewal fails', async () => {
    await beginHome()
    const stored = sessionStorage.getItem(key())
    const provider = withLocationProvider(request)
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, options?: RequestInit) => {
      if (String(input) === '/api/location/renew') return response({ code: 'unavailable' }, 503)
      return provider(input, options)
    })
    click('Reintentar creación')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar creación' })).toHaveProperty('disabled', false))
    expect(request).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(key())).toBe(stored)
  })

  it('opens the home shortcut without issuing a request or creating a record', () => {
    render(<CustomerHogar initialData={empty()} customerId={customerId} entry="hogar" />)
    expect(screen.getByLabelText('Nombre del hogar')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('opens the equipment shortcut in the existing home', () => {
    render(<CustomerHogar initialData={existing()} customerId={customerId} entry="equipo" />)
    expect(screen.getByLabelText('Nombre del aire')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('opens the visual room picker when the equipment shortcut has an empty home', () => {
    const data = existing()
    data.homes[0].floors[0].rooms = []
    render(<CustomerHogar initialData={data} customerId={customerId} entry="equipo" />)
    expect(screen.getByRole('dialog', { name: 'Nuevo ambiente' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Tipo de ambiente' })).toBeTruthy()
    expect(screen.queryByLabelText('Orientación')).toBeNull()
    click('Cancelar')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it.each(['create-home', 'add-equipment', 'malformed'] as const)('never overrides %s recovery with an entry shortcut', (kind) => {
    recoverOperation(kind)
    render(<CustomerHogar initialData={existing()} customerId={customerId} entry="equipo" />)
    expect(screen.queryByLabelText('Nombre del aire')).toBeNull()
    expect(screen.queryByLabelText('Nombre del hogar')).toBeNull()
    expect(request).not.toHaveBeenCalled()
  })
  it('binds fresh writes, recovery reads and exact replays to the rendered authenticated customer', async () => {
    await beginHome()
    expect(request.mock.calls[0][1].headers).toMatchObject({ 'X-Lysto-Customer-Id': customerId })
    cleanup()
    render(<CustomerHogar initialData={existing()} customerId={customerId} />)
    request.mockResolvedValueOnce(response(existing()))
    click('Recargar Hogar')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(request.mock.calls[1][1].headers).toMatchObject({ 'X-Lysto-Customer-Id': customerId })
    request.mockRejectedValueOnce(new TypeError('Still unavailable'))
    click('Reintentar guardado pendiente')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(request.mock.calls[2][1].headers).toMatchObject({ 'X-Lysto-Customer-Id': customerId })
    expect(submitted(2)).toEqual(submitted(0))
  })

  it.each(['create-home', 'add-equipment', 'malformed'] as const)(
    'blocks every editing entry when recovering %s without trapping read navigation',
    (kind) => {
      recoverOperation(kind)
      render(
        <ClientAppShell>
          <CustomerHogar initialData={placedExisting()} customerId={customerId} />
        </ClientAppShell>
      )
      for (const name of [
        'Añadir otro hogar', 'Configurar hogar', 'Plantas', 'Editar planta actual',
        'Ambientes', 'Editar Living', 'Quitar Living', 'Añadir aire',
        'Reubicar Aire existente', 'Quitar ubicación de Aire existente', 'Archivar hogar'
      ]) {
        const button = screen.getByRole('button', { name })
        expect(button, name).toHaveProperty('disabled', true)
        fireEvent.click(button)
        expect(screen.queryByRole('button', { name: 'Volver a Hogar' }), name).toBeNull()
        expect(screen.queryByRole('dialog'), name).toBeNull()
      }
      expect(screen.getByLabelText('Hogar actual')).toHaveProperty('disabled', false)
      expect(screen.getByLabelText('Planta actual')).toHaveProperty('disabled', false)
      expect(screen.getByRole('link', { name: 'Historial de Aire existente' })).toBeTruthy()
      expect(screen.getByRole('navigation')).toBeTruthy()
      click('Abrir Living')
      expect(screen.getByRole('button', { name: 'Volver a la planta' })).toBeTruthy()
      click('Volver a la planta')
      if (kind !== 'malformed') {
        expect(screen.getByRole('button', { name: 'Reintentar guardado pendiente' })).toHaveProperty('disabled', false)
      }
      expect(request).not.toHaveBeenCalled()
    }
  )

  it('keeps a recovered home retry reachable through read-only reloads', async () => {
    recoverOperation('create-home')
    const original = sessionStorage.getItem(key())
    render(<CustomerHogar initialData={existing()} customerId={customerId} />)
    request.mockResolvedValueOnce(response(existing()))
    click('Recargar Hogar')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Configurar hogar' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Reintentar guardado pendiente' })).toHaveProperty('disabled', false)
    expect(sessionStorage.getItem(key())).toBe(original)
    request.mockResolvedValueOnce(response({ home: { ...home, version: 2 } }))
    click('Reintentar guardado pendiente')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Configurar hogar' })).toHaveProperty('disabled', false))
    expect(submitted(1)).toEqual(JSON.parse(original!).input)
    expect(sessionStorage.getItem(key())).toBeNull()
  })

  it('blocks Cancel and Back after an uncertain atomic home creation', async () => {
    await beginHome()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Volver a Hogar' })).toHaveProperty('disabled', true)
    click('Cancelar')
    click('Volver a Hogar')
    expect(screen.getByLabelText('Nombre del hogar')).toHaveProperty('value', 'Casa nueva')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('keeps the same home command after Recargar Hogar finds no result yet', async () => {
    await beginHome()
    const first = submitted()
    request.mockResolvedValueOnce(response(empty()))
    click('Recargar Hogar')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Reintentar creación' })).toBeTruthy()
    request.mockResolvedValueOnce(response({ home: createdHome(first) }))
    click('Reintentar creación')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(submitted(2)).toEqual(first)
  })

  it('restores the home command after remount without automatically writing', async () => {
    await beginHome()
    const first = submitted()
    expect(sessionStorage.getItem(key())).not.toBeNull()
    cleanup()
    render(<CustomerHogar initialData={empty()} customerId={customerId} />)
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      true
    )
    request.mockResolvedValueOnce(response({ home: createdHome(first) }))
    click('Reintentar guardado pendiente')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toBeTruthy())
    expect(submitted(1)).toEqual(first)
    expect(sessionStorage.getItem(key())).toBeNull()
  })

  it('blocks abandoning an uncertain air registration and restores its exact command', async () => {
    await beginAir()
    const first = submitted()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Volver a Hogar' })).toHaveProperty('disabled', true)
    cleanup()
    render(<CustomerHogar initialData={existing()} customerId={customerId} />)
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Añadir aire' })).toHaveProperty('disabled', true)
    request.mockResolvedValueOnce(
      response({
        home: { ...home, version: 2, placements: [{ equipmentId: airId, ...first.placement }] },
        equipment: {
          id: airId,
          nickname: first.equipment.nickname,
          addressId,
          equipmentType: 'split',
          brand: null,
          model: null,
          serialNumber: null,
          frigorias: null,
          version: 1,
          createdAt: '',
          archivedAt: null
        }
      })
    )
    click('Reintentar guardado pendiente')
    await waitFor(() => expect(screen.getByText('Aire registrado y ubicado.')).toBeTruthy())
    expect(submitted(1)).toEqual(first)
    expect(sessionStorage.getItem(key())).toBeNull()
  })

  it('does not expose or replay another account command after a customer change', async () => {
    await beginHome()
    const pending = sessionStorage.getItem(key())
    cleanup()
    render(<CustomerHogar initialData={empty()} customerId={otherCustomerId} />)
    expect(screen.queryByRole('button', { name: 'Reintentar guardado pendiente' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      false
    )
    expect(sessionStorage.getItem(key())).toBe(pending)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('resets the visible pending flow when the authenticated customer changes without a page remount', async () => {
    await beginHome()
    expect(screen.getByLabelText('Nombre del hogar')).toHaveProperty('value', 'Casa nueva')
    cleanup()
    const mounted = render(<CustomerHogar initialData={empty()} customerId={customerId} />)
    expect(screen.getByRole('button', { name: 'Reintentar guardado pendiente' })).toBeTruthy()
    mounted.rerender(<CustomerHogar initialData={empty()} customerId={otherCustomerId} />)
    expect(screen.queryByRole('button', { name: 'Reintentar guardado pendiente' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      false
    )
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('still offers the exact air retry when a read no longer includes its original home', async () => {
    await beginAir()
    const first = submitted()
    request.mockResolvedValueOnce(response(empty()))
    click('Recargar Hogar')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    request.mockRejectedValueOnce(new TypeError('Still unavailable'))
    click('Reintentar guardado pendiente')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(submitted(2)).toEqual(first)
    expect(sessionStorage.getItem(key())).not.toBeNull()
  })

  it.each([401, 429, 500])(
    'retains an uncertain home command after HTTP %i',
    async (status) => {
      request.mockResolvedValueOnce(response({ code: 'conflict' }, status))
      await beginHome()
      expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(true)
      expect(sessionStorage.getItem(key())).not.toBeNull()
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true)
    }
  )

  it('releases a definitively aborted first air conflict so reload can start a fresh versioned command', async () => {
    request.mockResolvedValueOnce(response({ code: 'conflict' }, 409))
    await beginAir()
    const first = submitted()
    expect(sessionStorage.getItem(key())).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', false)
    const updated = existing()
    updated.homes[0].version = 2
    request.mockResolvedValueOnce(response(updated))
    click('Recargar Hogar')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir aire' })).toBeTruthy())
    click('Añadir aire')
    change('Nombre del aire', 'Aire corregido')
    request.mockResolvedValueOnce(response({ home: { ...home, version: 3 }, equipment: {
      id: airId, nickname: 'Aire corregido', addressId, equipmentType: 'split',
      brand: null, model: null, serialNumber: null, frigorias: null,
      version: 1, createdAt: '2026-10-13', archivedAt: null
    } }))
    click('Registrar y ubicar aire')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    expect(submitted(2)).toMatchObject({ expectedVersion: 2, equipment: { nickname: 'Aire corregido' } })
    expect(submitted(2).idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it('allows correcting an atomic new-address home creation after its first definite conflict', async () => {
    request.mockResolvedValueOnce(response({ code: 'conflict' }, 409))
    await beginHome()
    expect(sessionStorage.getItem(key())).toBeNull()
    expect(screen.getByLabelText('Número').matches(':disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', false)
    change('Número', '456')
    request.mockImplementationOnce(async (_path: string, options: { body: string }) =>
      response({ home: createdHome(JSON.parse(options.body)) })
    )
    click('Crear hogar')
    await waitFor(() => expect(screen.getByLabelText('Hogar actual')).toBeTruthy())
    expect(submitted(1)).toMatchObject({ newAddress: { number: '456' } })
    expect(sessionStorage.getItem(key())).toBeNull()
  })

  it('clears a definitively rejected command and allows corrected data', async () => {
    request.mockResolvedValueOnce(response({ code: 'invalid_input' }, 400))
    await beginHome()
    expect(sessionStorage.getItem(key())).toBeNull()
    expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(false)
    change('Nombre del hogar', 'Casa corregida')
    click('Crear hogar')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(submitted(1).name).toBe('Casa corregida')
  })

  it('does not discard the command when a separate read is rejected', async () => {
    await beginHome()
    const pending = sessionStorage.getItem(key())
    request.mockResolvedValueOnce(response({ code: 'invalid_input' }, 400))
    click('Recargar Hogar')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Reintentar creación' })).toBeTruthy()
    expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(true)
    expect(sessionStorage.getItem(key())).toBe(pending)
  })

  it.each([400, 409])('does not treat a HTTP %i replay as proof that the original uncertain write never committed', async (status) => {
    await beginHome()
    const original = sessionStorage.getItem(key())
    request.mockResolvedValueOnce(response({ code: status === 409 ? 'conflict' : 'invalid_input' }, status))
    click('Reintentar creación')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(true)
    expect(sessionStorage.getItem(key())).toBe(original)
  })

  it('retains a recovered command when a replay can no longer authorize the earlier result', async () => {
    await beginHome()
    const original = sessionStorage.getItem(key())
    cleanup()
    render(<CustomerHogar initialData={empty()} customerId={customerId} />)
    request.mockResolvedValueOnce(response({ code: 'forbidden' }, 403))
    click('Reintentar guardado pendiente')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      true
    )
    expect(sessionStorage.getItem(key())).toBe(original)
  })

  it('rejects malformed stored commands without sending or silently replacing them', () => {
    sessionStorage.setItem(
      key(),
      JSON.stringify({ kind: 'create-home', input: { idempotencyKey: 'broken' } })
    )
    render(<CustomerHogar initialData={empty()} customerId={customerId} />)
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByText(/No pudimos recuperar el guardado pendiente/)).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('does not send a creation when storage cannot retain its operation identity', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Unavailable', 'QuotaExceededError')
    })
    await beginHome()
    expect(screen.getByRole('alert').textContent).toContain('almacenamiento')
    expect(request).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Nombre del hogar').matches(':disabled')).toBe(false)
  })

  it('fails closed when a previously stored command cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    render(<CustomerHogar initialData={empty()} customerId={customerId} />)
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      true
    )
    expect(screen.getByRole('alert').textContent).toContain('No pudimos recuperar')
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps main navigation available when malformed storage prevents recovering a focused flow', () => {
    sessionStorage.setItem(key(), '{broken')
    render(
      <ClientAppShell>
        <CustomerHogar initialData={empty()} customerId={customerId} />
      </ClientAppShell>
    )
    expect(screen.getByRole('navigation')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Crear mi primer hogar' })).toHaveProperty(
      'disabled',
      true
    )
    expect(request).not.toHaveBeenCalled()
  })
})
