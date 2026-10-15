import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JobQuotePanel } from '@/components/pricing/job-quote-panel'
import { calculateServiceQuote, type QuoteInput } from '@/lib/pricing/service-quote'
const apiMocks = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock('@/lib/pricing/server', async () => ({ ...(await vi.importActual<typeof import('@/lib/pricing/server')>('@/lib/pricing/server')), getPricingSession: apiMocks.session }))
import { GET as getJobDetail } from '@/app/api/pricing/job/route'

const jobId = '75500000-0000-4000-8000-000000000001'
const photoId = '75500000-0000-4000-8000-000000000002'
const extraId = '75500000-0000-4000-8000-000000000003'
const input: QuoteInput = { issue: 'pierde_agua', timeSince: 'days', urgency: 'flexible', propertyType: 'apartment', access: {}, materials: [], materialsConfirmed: true }
const quote = calculateServiceQuote(input)
const visit = { scheduleVersion: 3, startsAt: '2030-10-15T17:00:00Z', endsAt: '2030-10-15T19:00:00Z', timezone: 'America/Argentina/Buenos_Aires', addressLabel: 'Av. Córdoba 1450, CABA', professionalName: 'Martín C.', durationMinutes: 120, travelBufferMinutes: 30, confirmed: true }
const finalReport = { id: photoId, real_diagnosis: 'Desagüe obstruido', work_done: 'Limpieza y prueba de drenaje', parts_used: null, final_state: 'requires_second_visit', maintenance_option: 'second_visit_recommended', after_photo_ids: [photoId], version: 1, created_at: '2030-10-15T20:00:00Z' }
function fixture(status = 'pending_assignment') {
  return { role: 'customer', job: { id: jobId, status, professionalName: null as string | null }, equipmentId: photoId, visit: null as typeof visit | null, onsiteDiagnosis: null as null | { id:string;actual_diagnosis:string;base_scope:string;evidence_ids:string[];status:string;version:number;decision_reason:null }, finalReport: null as typeof finalReport | null, savedQuote: { id: photoId, status: 'accepted', input, quote, address: { street: 'Av. Córdoba', number: '1450', city: 'CABA' } }, extras: [] as Array<{id:string;fault:string;description:string;amount:number;status:string}>, customerService: { issueLabel: 'Pierde agua', equipmentName: 'Aire del living', addressLabel: 'Av. Córdoba 1450, CABA' } }
}
let data = fixture()
let checkouts: Array<Record<string, unknown>> = []
let queryFailure = false
let queryDeferred: Promise<Response> | null = null
let mutate: (url:string, body:Record<string, unknown>) => Response | Promise<Response>
const fetcher = vi.fn(async (url: string | Request, init?: RequestInit) => {
  const target = String(url)
  if (init?.method === 'POST' || init?.method === 'PATCH') return mutate(target, JSON.parse(String(init.body)))
  if (target.startsWith('/api/pricing/job')) return queryDeferred ?? (queryFailure ? Response.json({error:'No se pudo actualizar el servicio.'},{status:503}) : Response.json(data))
  if (target.startsWith('/api/mercadopago/checkouts')) return Response.json({ role: 'customer', checkouts: checkouts.map(row => ({ amount:'100', marketplace_fee:'0', professional_amount:'100', live_mode:false, expires_at:'2030-10-20T20:00:00Z', review_reason:null, observations:[], ...row })) })
  throw new Error(`Unexpected URL ${target}`)
})

describe('customer-only detail metadata projection', () => {
  function apiSession(role = 'customer', equipmentOwner = photoId, requestOverrides: Record<string, unknown> = {}, failedRequest = false) {
    const queried: Array<{table:string;fields:string;filters:Array<[string,unknown]>}> = []
    const session = { role, customerId: photoId, client: {
      rpc: vi.fn(async () => ({ data:null, error:null })),
      from: (table:string) => {
        const track = { table, fields:'', filters:[] as Array<[string,unknown]> }; queried.push(track)
        const row = () => {
          if (table === 'jobs') return { id:jobId, request_id:photoId }
          if (table === 'service_quotes') return data.savedQuote
          if (table === 'service_requests') return { equipment_id:photoId, address_id:photoId, issue_type_id:photoId, ...requestOverrides }
          if (table === 'service_issue_types') return { name:'Pierde agua',slug:'pierde_agua' }
          if (table === 'customer_addresses') return { street:'Av. Córdoba',number:'1450',floor:'2',apartment:'B',city:'CABA' }
          if (table === 'customer_equipment') return equipmentOwner === photoId && track.filters.some(([field,value]) => field === 'customer_id' && value === photoId) ? { nickname:'Aire del living' } : null
          return null
        }
        const query = { select:(fields:string) => { track.fields=fields; return query }, eq:(field:string,value:unknown) => { track.filters.push([field,value]); return query }, single:async () => ({data:failedRequest && table === 'service_requests' ? null : row(),error:failedRequest && table === 'service_requests' ? {code:'08006'} : null}), maybeSingle:async () => ({data:row(),error:null}), order:async () => ({data:[],error:null}) }
        return query
      }
    } }
    apiMocks.session.mockResolvedValue(session)
    return queried
  }
  it('does not turn an unreadable request provenance into an apparently payable legacy job', async () => {
    apiSession('professional', photoId, {}, true)
    const response=await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))
    expect(response.status).toBe(503)
    expect(await response.json()).not.toHaveProperty('job')
  })
  it('prefers the actual visit snapshot over a historical asset address', async () => {
    apiSession('customer', photoId, { contract_source:'automatic_customer_request',status:'pending_payment',
      visit_address_snapshot:{street:'Corrientes',number:'999',floor:'5',apartment:'A',city:'CABA'} })
    const response = await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))
    const body = await response.json()
    expect(body.customerService.addressLabel).toBe('Corrientes 999, Piso 5 Depto. A, CABA')
    expect(body.job).toMatchObject({ contractSource:'automatic_customer_request',requestStatus:'pending_payment' })
  })
  it.each([null, {}, {street:'Destino',number:999,city:'CABA'}])('does not fall back to a historical destination for invalid automatic %j', async (snapshot) => {
    const queried = apiSession('customer', photoId, { contract_source:'automatic_customer_request',status:'pending_payment',visit_address_snapshot:snapshot })
    const body = await (await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))).json()
    expect(body.customerService.addressLabel).toBeNull()
    expect(queried.some(item => item.table === 'customer_addresses')).toBe(false)
  })
  it('provides only the immutable contracted address to the professional detail', async () => {
    apiSession('professional', photoId, { contract_source:'automatic_customer_request',status:'expired',
      visit_address_snapshot:{street:'Corrientes',number:'999',city:'CABA'} })
    const body = await (await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))).json()
    expect(body.visitAddressLabel).toBe('Corrientes 999, CABA')
    expect(body.job).toMatchObject({ contractSource:'automatic_customer_request',requestStatus:'expired' })
    expect(body).not.toHaveProperty('customerService')
  })
  it('returns only real metadata and scopes equipment/address to the authenticated customer', async () => {
    const queried = apiSession()
    const response = await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))
    expect(response.status).toBe(200)
    expect((await response.json()).customerService).toEqual({ issueLabel:'Pierde agua',equipmentName:'Aire del living',addressLabel:'Av. Córdoba 1450, Piso 2 Depto. B, CABA' })
    expect(queried.find(row => row.table === 'customer_equipment')?.filters).toContainEqual(['customer_id',photoId])
    expect(queried.find(row => row.table === 'customer_addresses')?.filters).toContainEqual(['customer_id',photoId])
  })
  it('does not expose customer-only asset metadata to professional/admin projections', async () => {
    const queried = apiSession('professional')
    const response = await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))
    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('customerService')
    expect(queried.some(row => ['customer_equipment','customer_addresses'].includes(row.table))).toBe(false)
  })
  it('does not fill equipment details from another customer', async () => {
    apiSession('customer',jobId)
    const response = await getJobDetail(new Request(`http://localhost/api/pricing/job?jobId=${jobId}`))
    expect((await response.json()).customerService?.equipmentName).toBeNull()
  })
})
beforeEach(() => {
  data = fixture(); checkouts = []; queryFailure=false; queryDeferred=null; mutate = () => Response.json({ ok: true })
  fetcher.mockClear(); vi.stubGlobal('fetch', fetcher); sessionStorage.clear()
  window.history.replaceState({}, '', `/app/trabajos/${jobId}`)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function open() { render(<JobQuotePanel jobId={jobId} />); await screen.findByRole('heading', { level: 1, name: /Reparación de aire|Pago del servicio/ }) }

describe('customer adaptive service detail', () => {
  it('uses neutral confirmation copy for an automatically assigned service', async () => {
    data = fixture('confirmed')
    Object.assign(data.job, {contractSource:'automatic_customer_request',requestStatus:'pending_payment'})
    await open()
    await screen.findByText('El profesional está confirmado. El pago se verifica con Mercado Pago.')
    expect(screen.queryByText(/El profesional aceptó/)).toBeNull()
  })
  it('does not replace a missing automatic destination with quote or visit history', async () => {
    data = fixture('confirmed'); data.visit=visit; data.customerService.addressLabel=null as unknown as string
    Object.assign(data.job, {contractSource:'automatic_customer_request',requestStatus:'pending_payment'})
    await open()
    expect(screen.queryByText('Av. Córdoba 1450, CABA')).toBeNull()
    expect(screen.getByText('Domicilio no disponible')).toBeTruthy()
  })
  it('keeps an expired automatic service closed and payment read-only even on its payment deep link', async () => {
    data = fixture('confirmed'); data.visit=visit
    Object.assign(data.job, {contractSource:'automatic_customer_request',requestStatus:'expired'})
    await open()
    await screen.findByRole('heading', {name:'Solicitud vencida'})
    expect(screen.queryByRole('button', {name:'Pagar servicio'})).toBeNull()
    expect(screen.queryByRole('button', {name:'Solicitar reprogramación'})).toBeNull()
    fireEvent.click(screen.getByRole('button', {name:'Consultar pagos'}))
    await screen.findByRole('heading', {level:1,name:'Pago del servicio'})
    expect(screen.queryByRole('button', {name:/^Pagar/})).toBeNull()
  })
  it('does not offer technician arrival for an expired automatic contract', async () => {
    data = fixture('confirmed'); data.role='professional'
    Object.assign(data.job, {contractSource:'automatic_customer_request',requestStatus:'expired'})
    Object.assign(data, {visitAddressLabel:'Corrientes 999, CABA'})
    render(<JobQuotePanel jobId={jobId} />)
    await screen.findByText('Corrientes 999, CABA')
    expect(screen.getByText(/Solicitud vencida/)).toBeTruthy()
    expect(screen.queryByRole('button', {name:'Marcar en camino'})).toBeNull()
    expect(screen.queryByText(/Av. Córdoba 1450/)).toBeNull()
  })
  it.each(['review', 'pending', 'in_process'])('shows canonical %s without reopening an expired reservation', async (status) => {
    data=fixture('confirmed');data.visit=visit
    Object.assign(data.job,{contractSource:'automatic_customer_request',requestStatus:'expired'})
    checkouts=[{id:extraId,job_id:jobId,extra_id:null,status}]
    await open()
    await screen.findByRole('heading',{name:status==='review'?'Pago en revisión':'Pago en proceso'})
    expect(screen.getByText(/La reserva de la visita venció/)).toBeTruthy()
    expect(screen.getByRole('button',{name:'Consultar pagos'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Pagar servicio'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Solicitar reprogramación'})).toBeNull()
  })
  it('retains approved payment information when an automatic reservation expires', async () => {
    data=fixture('confirmed');data.visit=visit
    Object.assign(data.job,{contractSource:'automatic_customer_request',requestStatus:'expired'})
    checkouts=[{id:extraId,job_id:jobId,extra_id:null,status:'approved'}]
    await open()
    await screen.findByText('Pago aprobado')
    expect(screen.queryByRole('heading',{name:'Visita confirmada'})).toBeNull()
    expect(screen.getByRole('button',{name:'Ver pagos del servicio'})).toBeTruthy()
  })
  it('uses the real problem, equipment and address without the shared internal panel', async () => {
    await open()
    expect(screen.getByRole('heading', { level: 1, name: 'Reparación de aire' })).toBeTruthy()
    expect(screen.getByText('Pierde agua')).toBeTruthy()
    expect(screen.getByText('Av. Córdoba 1450, CABA')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Presupuesto y adicionales' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Buscando un profesional' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Pagar/ })).toBeNull()
  })
  it('does not treat professional confirmation as payment approval', async () => {
    data = fixture('confirmed'); data.job.professionalName = 'Martín C.'
    await open()
    await screen.findByRole('button', { name: 'Pagar servicio' })
    expect(screen.queryByText('Pago aprobado')).toBeNull()
    expect(screen.queryByText('Visita confirmada')).toBeNull()
  })
  it('shows a confirmed visit and payment only from canonical checkout', async () => {
    data = fixture('confirmed'); data.visit = visit
    checkouts = [{ id: photoId, job_id: jobId, extra_id: null, status: 'approved' }]
    await open()
    await screen.findByText('Pago aprobado')
    expect(screen.getByText('Visita confirmada')).toBeTruthy()
    expect(screen.getByText('14:00 a 16:00')).toBeTruthy()
    expect(screen.getByText('Martín C.')).toBeTruthy()
  })
  it('preserves a failed reschedule form and sends the strict existing payload', async () => {
    data = fixture('confirmed'); data.visit = visit
    checkouts = [{ id: photoId, job_id: jobId, extra_id: null, status: 'approved' }]
    mutate = () => Response.json({ error: 'La fecha no está disponible.' }, { status: 409 })
    await open()
    fireEvent.click(await screen.findByRole('button', { name: /^Solicitar reprogramación/ }))
    fireEvent.change(screen.getByLabelText('Nueva fecha y hora'), { target: { value: '2030-10-20T14:30' } })
    fireEvent.change(screen.getByLabelText('Motivo de la reprogramación'), { target: { value: 'Tengo un compromiso familiar.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }))
    await screen.findByText('La fecha no está disponible.')
    expect((screen.getByLabelText('Motivo de la reprogramación') as HTMLTextAreaElement).value).toBe('Tengo un compromiso familiar.')
    const sent = fetcher.mock.calls.find(([url]) => url === '/api/jobs/reschedule')!
    expect(JSON.parse(String(sent[1]?.body))).toEqual({ action: 'request', jobId, startsAt: '2030-10-20T17:30:00.000Z', durationMinutes: 120, travelBufferMinutes: 30, reason: 'Tengo un compromiso familiar.', expectedVersion: 3 })
  })
  it('keeps outcome pending until explicit confirmation and reloads the completed state', async () => {
    data = fixture('completed_pending_customer_confirmation'); data.finalReport = finalReport
    mutate = (url) => { if (url === '/api/jobs/confirm') { data = { ...data, job: { ...data.job, status: 'completed' } }; return Response.json({ decision: { status: 'completed' } }) } return Response.json({}) }
    await open()
    expect(screen.getByText('Pendiente de tu confirmación')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Calificar servicio' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y confirmar' }))
    expect(screen.getByText('Segunda visita necesaria')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar servicio' }))
    await screen.findByRole('link', { name: 'Calificar servicio' })
    const sent = fetcher.mock.calls.find(([url]) => url === '/api/jobs/confirm')!
    expect(JSON.parse(String(sent[1]?.body))).toMatchObject({ jobId, decision: 'confirmed', idempotencyKey: expect.any(String) })
    expect(JSON.parse(String(sent[1]?.body))).not.toHaveProperty('reason')
  })
  it('requires a reason for disagreement and keeps an ambiguous command recoverable', async () => {
    data = fixture('completed_pending_customer_confirmation'); data.finalReport = finalReport
    mutate = () => { throw new Error('lost response') }
    await open(); fireEvent.click(screen.getByRole('button', { name: 'Informar un desacuerdo' }))
    const send = screen.getByRole('button', { name: 'Enviar desacuerdo' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Motivo del desacuerdo'), { target: { value: 'El equipo sigue perdiendo agua.' } })
    fireEvent.click(send)
    await screen.findByText(/No pudimos confirmar la decisión/)
    expect(sessionStorage.getItem(`lysto:command:${jobId}:customer-decision`)).not.toBeNull()
    const sent = fetcher.mock.calls.find(([url]) => url === '/api/jobs/confirm')!
    expect(JSON.parse(String(sent[1]?.body))).toMatchObject({ jobId, decision: 'disputed', reason: 'El equipo sigue perdiendo agua.' })
  })
  it('opens private report photos on demand and permits reopening an expired preview', async () => {
    data = fixture('completed'); data.finalReport = finalReport
    mutate = () => Response.json({ url: 'https://example.test/signed-photo', expiresIn: 60, filename: 'foto.webp' })
    await open(); fireEvent.click(screen.getByRole('button', { name: 'Ver informe y fotos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver foto 1' }))
    const image = await screen.findByRole('img', { name: 'Foto del informe 1' })
    fireEvent.error(image)
    await screen.findByText(/La foto venció o no está disponible/)
    fireEvent.click(screen.getByRole('button', { name: 'Ver foto 1' }))
    await screen.findByRole('img', { name: 'Foto del informe 1' })
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/uploads/read')).toHaveLength(2)
  })
  it('keeps simultaneous scope and extras decisions accessible and uses existing contracts', async () => {
    data = fixture('waiting_customer_approval')
    data.onsiteDiagnosis = { id: photoId, actual_diagnosis: 'Desagüe con obstrucción', base_scope: 'Limpieza de desagüe y pruebas', evidence_ids: [photoId], status: 'submitted', version: 2, decision_reason: null }
    data.extras = [{ id: extraId, fault: 'Manguera rota', description: 'Reemplazar manguera de drenaje', amount: 5000, status: 'proposed' }]
    await open()
    expect(screen.getByRole('button', { name: 'Revisar adicional: Manguera rota' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar diagnóstico y alcance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar alcance' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/pricing/job/status')).toBe(true))
    const scope = fetcher.mock.calls.find(([url]) => url === '/api/pricing/job/status')!
    expect(JSON.parse(String(scope[1]?.body))).toMatchObject({ action: 'decideScope', jobId, decision: 'accepted', expectedVersion: 2, idempotencyKey: expect.any(String) })
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar adicional: Manguera rota' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar adicional' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/jobs/extras')).toBe(true))
    const extra = fetcher.mock.calls.find(([url]) => url === '/api/jobs/extras')!
    expect(extra[1]?.method).toBe('PATCH')
    expect(JSON.parse(String(extra[1]?.body))).toMatchObject({ action: 'decide', extraId, decision: 'rejected', idempotencyKey: expect.any(String) })
  })
  it('automatically mounts the existing payment return reconciler', async () => {
    data = fixture('confirmed')
    checkouts = [{ id: photoId, job_id: jobId, extra_id: null, status: 'pending', amount: '100', marketplace_fee: '0', professional_amount: '100', live_mode: false, expires_at: '2030-10-20T20:00:00Z', review_reason: null, observations: [] }]
    window.history.replaceState({}, '', `/app/trabajos/${jobId}?pago=retorno&checkout=${photoId}`)
    await open()
    await screen.findByRole('heading', { level: 1, name: 'Pago del servicio' })
    await waitFor(() => expect(fetcher.mock.calls.some(([url, init]) => url === '/api/mercadopago/checkouts' && init?.method === 'POST')).toBe(true))
  })
  it.each(['cancelled_by_customer', 'disputed'])('shows an honest %s state without a fabricated contextual support destination', async (status) => {
    data = fixture(status); data.finalReport = finalReport
    await open()
    expect(screen.queryByRole('link', { name: 'Ayuda con este servicio' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Garantías y reclamos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirmar servicio' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Calificar servicio' })).toBeNull()
  })
  it('keeps a payment deep-link closed after returning to the service', async () => {
    data = fixture('confirmed')
    window.history.replaceState({}, '', `/app/trabajos/${jobId}#pagos`)
    await open()
    await screen.findByRole('heading', { name:'Pago del servicio',level:1 })
    fireEvent.click(screen.getByRole('button', { name: 'Volver al servicio' }))
    await screen.findByRole('heading', { name: 'Reparación de aire', level:1 })
    await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith('/api/pricing/job')).length).toBeGreaterThan(1))
    expect(screen.queryByRole('heading', { name:'Pago del servicio',level:1 })).toBeNull()
  })
  it('restores focus to the equivalent action after closing a focused view', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name:'Ver presupuesto aceptado' }))
    expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Presupuesto del servicio',level:1}))
    fireEvent.click(screen.getByRole('button', { name:'Volver al servicio' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button',{name:'Ver presupuesto aceptado'})))
  })
  it('recovers an outcome whose response was lost from the canonical completed status', async () => {
    data = fixture('completed_pending_customer_confirmation'); data.finalReport=finalReport
    mutate = () => { data={...data,job:{...data.job,status:'completed'}}; throw new Error('network error') }
    await open(); fireEvent.click(screen.getByRole('button',{name:'Revisar y confirmar'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar servicio'}))
    await screen.findByRole('link',{name:'Calificar servicio'})
    expect(screen.queryByRole('button',{name:'Confirmar servicio'})).toBeNull()
  })
  it('does not offer operational decisions when a warranty case is in progress', async () => {
    data=fixture('warranty_claim'); data.onsiteDiagnosis={id:photoId,actual_diagnosis:'Registro del diagnóstico',base_scope:'Registro del alcance',evidence_ids:[],status:'submitted',version:1,decision_reason:null}
    await open()
    expect(screen.getByRole('heading',{name:'Garantía en seguimiento'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Revisar diagnóstico y alcance'})).toBeNull()
    expect(screen.getByRole('link',{name:'Garantías y reclamos'}).getAttribute('href')).toBe('/app/garantias')
  })
  it('does not reuse a committed decision or focused view when navigating to another job', async () => {
    data=fixture('completed_pending_customer_confirmation'); data.finalReport=finalReport
    mutate=()=>{ data={...data,job:{...data.job,status:'completed'}}; return Response.json({decision:{status:'completed'}}) }
    const page=render(<JobQuotePanel jobId={jobId}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Revisar y confirmar'}))
    fireEvent.click(screen.getByRole('button',{name:'Confirmar servicio'}))
    await screen.findByRole('link',{name:'Calificar servicio'})
    data=fixture('completed_pending_customer_confirmation'); data.job.id=extraId; data.finalReport=finalReport
    page.rerender(<JobQuotePanel jobId={extraId}/>)
    const action=await screen.findByRole('button',{name:'Revisar y confirmar'})
    expect((action as HTMLButtonElement).disabled).toBe(false)
  })
  it.each(['disputed','warranty_claim'])('keeps payments read-only for %s instead of offering a new checkout', async (status) => {
    data=fixture(status)
    await open(); fireEvent.click(screen.getByRole('button',{name:'Ver pagos del servicio'}))
    await screen.findByRole('heading',{name:'Pago del servicio',level:1})
    expect(screen.queryByRole('button',{name:/^Pagar/})).toBeNull()
    expect(screen.getByText('Los pagos de este servicio se consultan sin iniciar un nuevo cobro.')).toBeTruthy()
  })
  it('keeps the regular payment action available for a confirmed payable service', async () => {
    data=fixture('confirmed')
    await open(); fireEvent.click(await screen.findByRole('button',{name:'Pagar servicio'}))
    await screen.findByRole('button',{name:/^Pagar .* con Mercado Pago/})
    expect(screen.queryByText('Los pagos de este servicio se consultan sin iniciar un nuevo cobro.')).toBeNull()
  })
  it('preserves a focused disagreement after an ambiguous command and failed canonical reload', async () => {
    data=fixture('completed_pending_customer_confirmation'); data.finalReport=finalReport
    mutate=()=>{ queryFailure=true; throw new Error('network error') }
    await open(); fireEvent.click(screen.getByRole('button',{name:'Informar un desacuerdo'}))
    fireEvent.change(screen.getByLabelText('Motivo del desacuerdo'),{target:{value:'El equipo sigue perdiendo agua.'}})
    fireEvent.click(screen.getByRole('button',{name:'Enviar desacuerdo'}))
    await screen.findByText('No se pudo actualizar el servicio.')
    expect((screen.getByLabelText('Motivo del desacuerdo') as HTMLTextAreaElement).value).toBe('El equipo sigue perdiendo agua.')
    expect((screen.getByRole('button',{name:'Enviar desacuerdo'}) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('heading',{name:'Presupuesto y adicionales'})).toBeNull()
    queryFailure=false; fireEvent.click(screen.getByRole('button',{name:'Volver a consultar el servicio'}))
    await waitFor(()=>expect((screen.getByRole('button',{name:'Enviar desacuerdo'}) as HTMLButtonElement).disabled).toBe(false))
  })
  it('blocks old decisions while the canonical recovery GET remains pending after an ambiguous POST', async () => {
    data=fixture('completed_pending_customer_confirmation'); data.finalReport=finalReport
    let finishRead!: (response:Response)=>void
    mutate=()=>{ queryDeferred=new Promise<Response>(resolve=>{finishRead=resolve}); throw new Error('network error') }
    await open(); fireEvent.click(screen.getByRole('button',{name:'Informar un desacuerdo'}))
    fireEvent.change(screen.getByLabelText('Motivo del desacuerdo'),{target:{value:'El equipo sigue perdiendo agua.'}})
    fireEvent.click(screen.getByRole('button',{name:'Enviar desacuerdo'}))
    await waitFor(()=>expect(fetcher.mock.calls.filter(([url])=>String(url).startsWith('/api/pricing/job')).length).toBeGreaterThan(1))
    expect((screen.getByRole('button',{name:'Enviar desacuerdo'}) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button',{name:'Enviar desacuerdo'}))
    expect(fetcher.mock.calls.filter(([url])=>url==='/api/jobs/confirm')).toHaveLength(1)
    queryDeferred=null; finishRead(Response.json(data))
    await waitFor(()=>expect((screen.getByRole('button',{name:'Enviar desacuerdo'}) as HTMLButtonElement).disabled).toBe(false))
    expect((screen.getByLabelText('Motivo del desacuerdo') as HTMLTextAreaElement).value).toBe('El equipo sigue perdiendo agua.')
  })
  it('links completed service coverage to the existing general guarantees screen without claiming contextual support', async () => {
    data=fixture('completed'); data.finalReport=finalReport
    await open()
    expect(screen.getByRole('link',{name:'Garantías y reclamos'}).getAttribute('href')).toBe('/app/garantias')
    expect(screen.getByText('Este resultado requiere seguimiento; no lo tratamos como resuelto.')).toBeTruthy()
    expect(screen.queryByRole('link',{name:'Ayuda con este servicio'})).toBeNull()
  })
  it('keeps the payment preparation mounted and blocks Back/Escape until its pending request finishes', async () => {
    data=fixture('confirmed')
    let finishPay!: (response:Response)=>void
    mutate=()=>new Promise<Response>(resolve=>{finishPay=resolve})
    await open(); fireEvent.click(await screen.findByRole('button',{name:'Pagar servicio'}))
    fireEvent.click(await screen.findByRole('button',{name:/^Pagar .* con Mercado Pago/}))
    await waitFor(()=>expect(fetcher.mock.calls.some(([url])=>url==='/api/mercadopago/create-preference')).toBe(true))
    expect((screen.getByRole('button',{name:'Volver al servicio'}) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(window,{key:'Escape'})
    expect(screen.getByRole('heading',{name:'Pago del servicio',level:1})).toBeTruthy()
    finishPay(Response.json({status:'approved'}))
    await waitFor(()=>expect((screen.getByRole('button',{name:'Volver al servicio'}) as HTMLButtonElement).disabled).toBe(false))
  })
  it.each(['job','request'] as const)('does not allow old customer decisions under a different %s route identity', async (kind) => {
    data=fixture('completed_pending_customer_confirmation'); data.finalReport=finalReport
    const page=render(kind==='job'?<JobQuotePanel jobId={jobId}/>:<JobQuotePanel requestId={jobId}/>)
    await screen.findByRole('button',{name:'Revisar y confirmar'})
    let finishRead!: (response:Response)=>void
    queryDeferred=new Promise<Response>(resolve=>{finishRead=resolve})
    page.rerender(kind==='job'?<JobQuotePanel jobId={extraId}/>:<JobQuotePanel requestId={extraId}/>)
    expect(screen.queryByRole('button',{name:'Revisar y confirmar'})).toBeNull()
    expect(screen.queryByRole('button',{name:'Informar un desacuerdo'})).toBeNull()
    queryDeferred=null; finishRead(Response.json({...data,job:{...data.job,id:extraId}}))
    await screen.findByRole('button',{name:'Revisar y confirmar'})
  })
  it('consults contradictory initial checkout records instead of asserting payment approval or a visit', async () => {
    data=fixture('confirmed'); data.visit=visit
    checkouts=[{id:photoId,job_id:jobId,extra_id:null,status:'approved'},{id:extraId,job_id:jobId,extra_id:null,status:'review'}]
    await open()
    await screen.findByRole('heading',{name:'Pago por verificar'})
    expect(screen.queryByText('Pago aprobado')).toBeNull()
    expect(screen.queryByRole('heading',{name:'Visita confirmada'})).toBeNull()
    expect(screen.queryByRole('heading',{name:'Ya podés pagar'})).toBeNull()
  })
})
