import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfessionalJobEquipment, ProfessionalJobPhotos } from '@/components/pro/job-workspace-media'
import type { ProfessionalJobContext } from '@/lib/professional/job-context-contract'
import type { CustomerHome } from '@/lib/customer-homes/contracts'

vi.mock('next/dynamic', () => ({ default: () => ({ floorId, roomId, onUnavailable }: { floorId: string; roomId: string | null; onUnavailable: () => void }) => <div><p>Escena {floorId} / {roomId}</p><button onClick={onUnavailable}>Simular falta de WebGL</button></div> }))

const id = (n: number) => `75500000-0000-4000-8000-${String(n).padStart(12, '0')}`
const fetcher = vi.fn()
function home(): CustomerHome {
  const room = (n: number, name: string) => ({ id: id(n), name, kind: 'living' as const, variant: 'compact', x: 0, z: 0, width: 4, depth: 4, rotation: 0 as const, windows: 'small' as const })
  return { id: id(10), name: 'Casa', version: 1, addressId: id(11), kind: 'house', building: null,
    features: { balcony: false, terrace: false, windows: 'small' },
    floors: [{ id: id(12), name: 'Planta baja', order: 0, rooms: [room(13, 'Living')] }, { id: id(14), name: 'Primer piso', order: 1, rooms: [room(15, 'Estudio')] }],
    placements: [{ equipmentId: id(2), roomId: id(13), wall: 'north', offset: .5, height: 2 }]
  }
}
function context(): ProfessionalJobContext {
  return { jobId: id(1), issueLabel: 'No enfría', reportedProblem: null, accessInstructions: null, initialPaymentStatus: 'approved', extraPayments: [], history: [],
    equipment: { id: id(2), nickname: 'Aire del living', addressId: id(11), equipmentType: 'split', brand: null, model: null, serialNumber: null, frigorias: '3000', version: 1, createdAt: '2026-10-15T12:00:00Z', archivedAt: null }, home: home() }
}
beforeEach(() => { fetcher.mockReset(); vi.stubGlobal('fetch', fetcher) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('assigned professional equipment and evidence', () => {
  it('keeps the equipment facts at the saved placement after exploring another floor', () => {
    render(<ProfessionalJobEquipment context={context()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Primer piso' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.getByText('Planta baja · Living')).toBeTruthy()
    expect(screen.queryByText('Primer piso · Estudio')).toBeNull()
  })

  it('repositions the scene when the same assigned equipment has a newer saved placement', () => {
    const first = context()
    const view = render(<ProfessionalJobEquipment context={first} />)
    const next = context()
    next.home!.version = 2
    next.home!.placements[0].roomId = id(15)
    view.rerender(<ProfessionalJobEquipment context={next} />)
    expect(screen.getByText(`Escena ${id(14)} / ${id(15)}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.getByText('Primer piso · Estudio')).toBeTruthy()
  })

  it.each([['split', 'Split de pared'], ['inverter', 'Inverter'], ['on_off', 'Convencional (on/off)'], ['window', 'De ventana'], ['floor_ceiling', 'Piso-techo'], ['central', 'Central']])('shows the Spanish equipment label for %s', (code, label) => {
    const value = context(); value.equipment!.equipmentType = code
    render(<ProfessionalJobEquipment context={value} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('provides an honest no-home fallback without inventing a saved room', () => {
    const value = context(); value.home = null
    render(<ProfessionalJobEquipment context={value} />)
    expect(screen.getByText('El cliente todavía no ubicó este equipo en un ambiente.')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Ilustración orientativa de un aire acondicionado' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enfocar equipo' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.getAllByText('No informado').length).toBeGreaterThan(0)
  })

  it('retains the location and facts when WebGL is unavailable', () => {
    render(<ProfessionalJobEquipment context={context()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Simular falta de WebGL' }))
    expect(screen.getByText(/El 3D no está disponible/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.getByText('Planta baja · Living')).toBeTruthy()
  })

  it('keeps the authorized photo visible when another photo cannot be read, and retries only the failure', async () => {
    let secondWorks = false
    fetcher.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body)
      return body.intentId === id(21) || secondWorks ? Response.json({ url: `https://storage.example.test/${body.intentId}.webp` }) : Response.json({ error: 'No disponible' }, { status: 403 })
    })
    render(<ProfessionalJobPhotos ids={[id(21), id(22)]} label="Fotos del diagnóstico" />)
    const first = screen.getByRole('button', { name: 'Abrir foto 1 de fotos del diagnóstico' }) as HTMLButtonElement
    await waitFor(() => expect(first.disabled).toBe(false))
    expect((screen.getByRole('button', { name: 'Abrir foto 2 de fotos del diagnóstico' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('img', { name: 'Foto 1 de fotos del diagnóstico' })).toBeTruthy()
    secondWorks = true
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar fotos' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Abrir foto 2 de fotos del diagnóstico' }) as HTMLButtonElement).disabled).toBe(false))
    expect(fetcher.mock.calls.filter(([, init]) => JSON.parse(init.body).intentId === id(21))).toHaveLength(1)
  })

  it('ignores a stale photo response after the evidence identity changes', async () => {
    let finish!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(Response.json({ url: 'https://storage.example.test/new.webp' }))
    const view = render(<ProfessionalJobPhotos ids={[id(21)]} label="Fotos del diagnóstico" />)
    view.rerender(<ProfessionalJobPhotos ids={[id(22)]} label="Fotos del diagnóstico" />)
    await waitFor(() => expect((screen.getByRole('button', { name: 'Abrir foto 1 de fotos del diagnóstico' }) as HTMLButtonElement).disabled).toBe(false))
    finish(Response.json({ url: 'https://storage.example.test/old.webp' }))
    await waitFor(() => expect((screen.getByRole('img', { name: 'Foto 1 de fotos del diagnóstico' }) as HTMLImageElement).getAttribute('src')).toBe('https://storage.example.test/new.webp'))
  })

  it('keeps a newly expired photo retryable while another failed photo is being refreshed', async () => {
    fetcher.mockImplementation(async (_url, init) => Response.json({ url: `https://storage.example.test/${JSON.parse(init.body).intentId}.webp` }))
    render(<ProfessionalJobPhotos ids={[id(21), id(22)]} label="Fotos del diagnóstico" />)
    await screen.findByRole('img', { name: 'Foto 2 de fotos del diagnóstico' })
    fireEvent.error(screen.getByRole('img', { name: 'Foto 1 de fotos del diagnóstico' }))
    let finish!: (value: Response) => void
    fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar fotos' }))
    fireEvent.error(screen.getByRole('img', { name: 'Foto 2 de fotos del diagnóstico' }))
    await act(async () => finish(Response.json({ url: 'https://storage.example.test/renewed-first.webp' })))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Volver a consultar fotos' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar fotos' }))
    await screen.findByRole('img', { name: 'Foto 2 de fotos del diagnóstico' })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})
