import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaUploader } from '@/components/customer/media-uploader'
import { PaymentDeferredPanel } from '@/components/customer/payment-deferred-panel'
import { AirConditioningWizard } from '@/features/service-request/air-conditioning-wizard'
import type { CustomerHomesSnapshot } from '@/lib/customer-homes/contracts'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import { generateDiagnosis } from '@/lib/diagnosis/rules'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/uploads/client', () => ({ uploadPrivateFile: upload }))

const actor = '10000000-0000-4000-8000-000000000001'
const addressId = '10000000-0000-4000-8000-000000000002'
const homeId = '10000000-0000-4000-8000-000000000003'
const floorId = '10000000-0000-4000-8000-000000000004'
const roomId = '10000000-0000-4000-8000-000000000005'
const equipmentId = '10000000-0000-4000-8000-000000000006'
function inventory(): CustomerHomesSnapshot {
  return { addresses: [{ id: addressId, label: 'Mi oficina', street: 'San Martín', number: '456', floor: '2', apartment: null, city: 'CABA', province: 'Buenos Aires', propertyType: 'office', isDefault: true, access: { hasElevator: true, stairsRequired: true }, version: 2, createdAt: '2026-09-11T12:00:00Z', archivedAt: null }], equipment: [{ id: equipmentId, addressId, nickname: 'Aire oficina', equipmentType: 'split', brand: null, model: null, serialNumber: null, frigorias: null, version: 1, createdAt: '2026-09-11T12:00:00Z', archivedAt: null }], homes: [{ id: homeId, addressId, name: 'Mi oficina', kind: 'office', building: null, features: { balcony: false, terrace: false, windows: 'small' }, floors: [{ id: floorId, name: 'Planta de oficina', order: 0, rooms: [{ id: roomId, name: 'Oficina', kind: 'office', variant: 'individual', x: 0, z: 0, width: 4, depth: 4, rotation: 0, windows: 'small' }] }], placements: [{ equipmentId, roomId, wall: 'north', offset: .5, height: 2 }], version: 1 }] }
}
function mount(initialIssue?: typeof AIR_CONDITIONING_ISSUES[number]['slug']) { render(<AirConditioningWizard customerId={actor} initialData={inventory()} initialIssue={initialIssue} />) }
function next() { fireEvent.click(screen.getByRole('button', { name: /^Continuar/ })) }
function details() { next(); next() }
beforeEach(() => { window.sessionStorage.clear(); upload.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('customer request wizard', () => {
  it('saves selected photos automatically and waits for verification before reaching the price', async () => {
    let finish!: (value: unknown) => void
    upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const fetcher = vi.fn(async () => Response.json({ status: 'ready', previewId: 'photo-preview', quote: { total: 100 }, expiresAt: '2028-01-12T12:00:00Z' }))
    vi.stubGlobal('fetch', fetcher)
    mount('no_enfria'); details()
    fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
    const photo = new File(['photo'], 'aire.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [photo] } })
    expect(upload).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetcher).not.toHaveBeenCalled()
    await act(async () => finish({ intentId: 'saved-photo', attachmentId: 'attachment', draftId: 'draft', entityId: null }))
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false)
    next(); fireEvent.click(screen.getByRole('button', { name: 'Elegir horario preferido' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' }))
    fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2028-01-12' } })
    fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(false))
    const [, options] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0]
    expect(JSON.parse(String(options.body)).uploadIntentIds).toEqual(['saved-photo'])
    expect(screen.queryByText('El precio todavía no está confirmado.')).toBeNull()
  })
  it('keeps a failed photo at Details with an explicit retry instead of a dead-end price', async () => {
    upload.mockRejectedValueOnce(new Error('No se pudo verificar la foto.')).mockResolvedValue({ intentId: 'saved-photo', attachmentId: 'attachment', draftId: 'draft', entityId: null })
    mount('no_enfria'); details(); fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [new File(['photo'], 'aire.jpg', { type: 'image/jpeg' })] } })
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo verificar la foto.')
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(upload).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar guardar fotos' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false))
    expect(upload).toHaveBeenCalledTimes(2)
  })
  it('lets the customer remove a failed optional photo and continue without losing answers', async () => {
    upload.mockRejectedValue(new Error('No se pudo verificar la foto.'))
    mount('no_enfria'); details(); fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [new File(['photo'], 'aire.jpg', { type: 'image/jpeg' })] } })
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Quitar aire.jpg' }))
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('radio', { name: 'Hace días' }).getAttribute('aria-checked')).toBe('true')
    next()
    expect(screen.getByRole('heading', { name: 'Qué puede estar pasando' })).toBeTruthy()
  })
  it.each(AIR_CONDITIONING_ISSUES)('starts with $title selected from Inicio without skipping the first step', ({ slug, title }) => {
    mount(slug)
    expect(screen.getByText(/Paso 1 de 7/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: new RegExp(title) }).getAttribute('aria-checked')).toBe('true')
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Contanos un poco más' })).toBeNull()
  })
  it('lets the customer change an issue selected from Inicio before continuing', () => {
    mount('no_enfria')
    fireEvent.click(screen.getByRole('radio', { name: 'Mantenimiento' }))
    expect(screen.getByRole('radio', { name: /No enfría/ }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('radio', { name: 'Mantenimiento' }).getAttribute('aria-checked')).toBe('true')
    next()
    expect(screen.getByRole('heading', { name: 'Revisá dónde está tu aire' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByRole('radio', { name: 'Mantenimiento' }).getAttribute('aria-checked')).toBe('true')
  })
  it('prefills the real active address and preserves its access conditions when explicitly editing', () => {
    mount('no_enfria'); next()
    expect(screen.getByText('San Martín 456 · Piso 2, CABA')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect((screen.getByLabelText('Calle') as HTMLInputElement).value).toBe('San Martín')
    expect((screen.getByLabelText('Piso de la dirección') as HTMLInputElement).value).toBe('2')
    expect((screen.getByRole('button', { name: 'Continuar con los detalles' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect((screen.getByRole('button', { name: 'Continuar con los detalles' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('guides the first choice without presenting a validation error before interaction', () => {
    mount()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Elegí una opción para continuar.')).toBeTruthy()
  })
  it.each(AIR_CONDITIONING_ISSUES.filter(i => !['instalacion', 'mantenimiento'].includes(i.slug)))('explains every existing cause for $title without presenting a confirmed diagnosis', ({ slug }) => {
    mount(slug); details()
    fireEvent.click(screen.getByRole('radio', { name: 'Hace días' })); next()
    expect(screen.getByRole('heading', { name: 'Qué puede estar pasando' })).toBeTruthy()
    for (const cause of generateDiagnosis({ issue: slug, timeSince: 'days' }).causes) expect(screen.getByText(cause.customerHint)).toBeTruthy()
    expect(screen.getByText('El técnico confirmará qué está pasando antes de indicarte la solución.')).toBeTruthy()
  })
  it.each(['Instalación', 'Mantenimiento'])('presents %s as a service review, not as a fault', title => {
    mount(); fireEvent.click(screen.getByRole('radio', { name: title })); details()
    const group = title === 'Instalación' ? 'Tipo de instalación' : 'Último mantenimiento'
    expect(screen.getByRole('radiogroup', { name: group })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Antigüedad del problema' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: title === 'Instalación' ? 'Instalación nueva' : 'Nunca' })); next()
    expect(screen.getByRole('heading', { name: 'Qué vamos a revisar' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Revisión del servicio' }).children).toHaveLength(4)
    expect(screen.queryByText(/Posible causa/)).toBeNull()
    expect(screen.getByText('El profesional confirmará el alcance y los materiales necesarios antes de realizar el trabajo.')).toBeTruthy()
  })
  it('announces each new step, labels missing characteristics and retains answers on back navigation', () => {
    mount('no_enfria'); details()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Paso 3 de 7: Detalles')
    expect(screen.getByRole('spinbutton', { name: 'Capacidad del aire (frigorías/h)' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Tecnología del equipo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Hace días' })); next()
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByRole('radio', { name: 'Hace días' }).getAttribute('aria-checked')).toBe('true')
  })
  it('shows visit context and requires a future date when choosing another day', () => {
    mount('no_enfria'); details(); fireEvent.click(screen.getByRole('radio', { name: 'Hace días' })); next()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir horario preferido' }))
    expect(screen.getByText('Dirección de visita')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' }))
    fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' }))
    expect((screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2028-01-12' } })
    expect((screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('asks branch-specific questions again when switching from a fault to planned service', () => {
    mount('no_enfria'); details(); fireEvent.click(screen.getByRole('radio', { name: 'Hace días' }))
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' })); fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Instalación' })); details()
    expect(screen.getByRole('radio', { name: 'Instalación nueva' }).getAttribute('aria-checked')).toBe('false')
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('moves and selects radio choices with arrow keys', () => {
    mount()
    const first = screen.getByRole('radio', { name: /No enfría/ }); const second = screen.getByRole('radio', { name: /Pierde agua/ })
    first.focus(); fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(second)
    expect(second.getAttribute('aria-checked')).toBe('true')
  })
  it('keeps payment unavailable without a server-approved price and assignment instead of inventing a job', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'needs_review', message: 'Necesitamos completar el precio antes de continuar.' }), { status: 200 })))
    mount('no_enfria'); details(); fireEvent.click(screen.getByRole('radio', { name: 'Hace días' })); next()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir horario preferido' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' })); fireEvent.change(screen.getByLabelText('Fecha de visita'), { target: { value: '2028-01-12' } }); fireEvent.click(screen.getByRole('radio', { name: '10:00 – 12:00' })); fireEvent.click(screen.getByRole('button', { name: 'Revisar pedido y presupuesto' }))
    expect(await screen.findByText('Necesitamos completar el precio antes de continuar.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('Buscando el mejor profesional...')).toBeNull()
    expect(screen.queryByText('Trabajo creado')).toBeNull()
  })
  it('retains the legacy deferred-payment panel for other callers without enabling financial actions', () => {
    render(<PaymentDeferredPanel amount={43750} planLabel="Prioridad" />)
    expect(screen.getByText('La integración de Mercado Pago se incorporará en la etapa final')).toBeTruthy()
    expect(screen.getByText('$ 43.750')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Pagar con Mercado Pago' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/pago aprobado/i)).toBeNull()
  })
  it('shows selected evidence locally, allows removal and never claims an upload completed', () => {
    const onFilesChange = vi.fn(); const createObjectUrl = vi.fn(() => 'blob:equipo-preview'); const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    const photo = new File(['photo'], 'equipo.jpg', { type: 'image/jpeg' })
    const { rerender, unmount } = render(<MediaUploader files={[]} onFilesChange={onFilesChange} />)
    fireEvent.change(screen.getByLabelText('Agregar fotos'), { target: { files: [photo] } }); expect(onFilesChange).toHaveBeenCalledWith([photo])
    rerender(<MediaUploader files={[photo]} onFilesChange={onFilesChange} />)
    expect(screen.getByText('equipo.jpg')).toBeTruthy(); expect(screen.getByText('Seleccionado en este dispositivo')).toBeTruthy(); expect(screen.getByRole('img', { name: 'Vista previa de equipo.jpg' })).toBeTruthy(); expect(screen.queryByText(/subida completada/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar equipo.jpg' })); expect(onFilesChange).toHaveBeenLastCalledWith([])
    unmount(); expect(createObjectUrl).toHaveBeenCalledWith(photo); expect(revokeObjectUrl).toHaveBeenCalledWith('blob:equipo-preview')
  })
})
