'use client'

import Link from 'next/link'
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from 'react'
import {
  adminRequestSchema, calculateAdminRequestAmounts,
  type AdminRequestCommand, type AdminRequestOptions, type AdminRequestRecord
} from '@/lib/admin/service-request-contract'
import { Button, Header, Panel } from './admin-ui'
import styles from './managed-service-request-form.module.css'

type Values = {
  customerId: string; addressId: string; equipmentId: string; categoryId: string; issueTypeId: string
  professionalId: string; serviceTitle: string; description: string; dateTime: string
  durationMinutes: string; travelBufferMinutes: string; total: string
  commissionMode: 'percentage' | 'amount'; commissionValue: string
}
const ars = (value: number) => value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
const formNumber = (value: string) => value.trim() ? Number(value) : Number.NaN
const emptyValues = (customerId = '', categoryId = ''): Values => ({
  customerId, categoryId, addressId: '', equipmentId: '', issueTypeId: '', professionalId: '',
  serviceTitle: '', description: '', dateTime: '', durationMinutes: '60', travelBufferMinutes: '15',
  total: '', commissionMode: 'percentage', commissionValue: '18'
})
function fromInput(input: AdminRequestRecord['input']): Values {
  const dateTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(input.startsAt)).replace(' ', 'T')
  return {
    customerId: input.customerId, addressId: input.addressId, equipmentId: input.equipmentId ?? '',
    categoryId: input.categoryId, issueTypeId: input.issueTypeId, professionalId: input.professionalId,
    serviceTitle: input.serviceTitle, description: input.description, dateTime,
    durationMinutes: String(input.durationMinutes), travelBufferMinutes: String(input.travelBufferMinutes),
    total: String(input.total), commissionMode: input.commission.mode, commissionValue: String(input.commission.value)
  }
}
function commandInput(command: AdminRequestCommand) {
  const { id: unusedId, action: unusedAction, expectedVersion: unusedVersion, ...input } = command
  void unusedId; void unusedAction; void unusedVersion
  return input
}
function readRecord(value: unknown, id: string): AdminRequestRecord {
  const record = value as AdminRequestRecord | undefined
  if (!record || record.id !== id || !Number.isInteger(record.version) || record.version < 1 ||
      !['draft', 'sent'].includes(record.state) || (record.state === 'sent' && !record.jobId)) throw new Error('invalid_record')
  adminRequestSchema.parse({ ...record.input, id, expectedVersion: record.version, action: 'draft' })
  return record
}
function Field({ label, children, hint }: { label: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }>; hint?: string }) {
  const id = useId()
  return <div className="adm-field"><label htmlFor={id} className={styles.fieldLabel}>{label}</label>{cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}{hint ? <small id={`${id}-hint`}>{hint}</small> : null}</div>
}

export function ManagedServiceRequestForm({
  initialOptions, initialRecord, initialCustomerId, storageScope = 'new'
}: {
  initialOptions: AdminRequestOptions; initialRecord?: AdminRequestRecord
  initialCustomerId?: string; storageScope?: string
}) {
  const [record, setRecord] = useState(initialRecord)
  const [options, setOptions] = useState(initialOptions)
  const [values, setValues] = useState<Values>(() => initialRecord ? fromInput(initialRecord.input) : emptyValues(initialCustomerId, initialOptions.categories[0]?.id))
  const [search, setSearch] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [needsRecovery, setNeedsRecovery] = useState(false)
  const [conflictingRecord, setConflictingRecord] = useState<AdminRequestRecord | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const idRef = useRef(initialRecord?.id ?? '')
  const pendingCommand = useRef<AdminRequestCommand | null>(null)
  const pending = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(false)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const storageKey = `lysto:admin-request:pending:${storageScope}`
  const sent = record?.state === 'sent'

  const loadOptions = useCallback(async (customerId: string, query = '') => {
    const current = ++generation.current
    setLoadingOptions(true); setOptionsError(false); setError('')
    try {
      const params = new URLSearchParams({ search: query })
      if (customerId) params.set('customerId', customerId)
      const response = await fetch(`/api/admin/service-requests/options?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
      const body = await response.json()
      if (!response.ok || !body || !['customers', 'addresses', 'equipment', 'categories', 'issues', 'professionals', 'quotes'].every(key => Array.isArray(body[key])) || !Number.isFinite(body.paymentCostRate)) throw new Error('options_unavailable')
      if (mounted.current && generation.current === current) setOptions(body)
    } catch {
      if (mounted.current && generation.current === current) {
        setOptionsError(true)
        setError('No pudimos consultar los datos del cliente. Volvé a consultar antes de guardar.')
      }
    } finally {
      if (mounted.current && generation.current === current) setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    try {
      const stored = sessionStorage.getItem(storageKey)
      const parsed = stored ? adminRequestSchema.safeParse(JSON.parse(stored)) : null
      if (parsed?.success && initialRecord?.id === parsed.data.id && initialRecord.state === 'sent') {
        sessionStorage.removeItem(storageKey)
      } else if (parsed?.success && (!initialRecord || (initialRecord.id === parsed.data.id && initialRecord.state !== 'sent'))) {
        pendingCommand.current = parsed.data; idRef.current = parsed.data.id
        setValues(fromInput(commandInput(parsed.data)))
        setNeedsRecovery(true)
        setError('Hay un guardado pendiente de verificar. Consultá su estado antes de continuar.')
        if (parsed.data.customerId !== (initialRecord?.customerId ?? initialCustomerId)) void loadOptions(parsed.data.customerId)
      }
    } catch { /* Device storage is optional; the server remains authoritative. */ }
    return () => { mounted.current = false; generation.current += 1 }
  }, [initialRecord, initialCustomerId, loadOptions, storageKey])

  useEffect(() => { if (preview) reviewHeading.current?.focus() }, [preview])

  function change<K extends keyof Values>(key: K, value: Values[K]) {
    setValues(previous => ({ ...previous, [key]: value }))
    setPreview(false); setMessage(''); setError('')
  }
  function selectCustomer(customerId: string) {
    setValues(previous => ({ ...previous, customerId, addressId: '', equipmentId: '' }))
    setOptions(previous => ({ ...previous, addresses: [], equipment: [], quotes: [] }))
    setPreview(false); setMessage(''); setError('')
    void loadOptions(customerId, search)
  }
  function buildCommand(action: AdminRequestCommand['action']) {
    if (!idRef.current) idRef.current = crypto.randomUUID()
    const date = new Date(`${values.dateTime}:00-03:00`)
    if (!Number.isFinite(date.getTime())) throw new Error('Elegí una fecha y hora válidas para la visita.')
    const parsed = adminRequestSchema.safeParse({
      id: idRef.current, expectedVersion: record?.version ?? 0, action,
      customerId: values.customerId, addressId: values.addressId, equipmentId: values.equipmentId || null,
      categoryId: values.categoryId, issueTypeId: values.issueTypeId, professionalId: values.professionalId,
      serviceTitle: values.serviceTitle, description: values.description, startsAt: date.toISOString(),
      durationMinutes: formNumber(values.durationMinutes), travelBufferMinutes: formNumber(values.travelBufferMinutes),
      total: formNumber(values.total), commission: { mode: values.commissionMode, value: formNumber(values.commissionValue) }
    })
    if (!parsed.success) throw new Error('Completá cliente, domicilio, servicio, técnico y agenda. Revisá el alcance, el precio y la comisión.')
    return parsed.data
  }
  function clearPending() {
    pendingCommand.current = null
    try { sessionStorage.removeItem(storageKey) } catch { /* Optional device storage. */ }
    setNeedsRecovery(false)
  }
  function applySaved(saved: AdminRequestRecord) {
    setRecord(saved); setValues(fromInput(saved.input)); setPreview(false); setConflictingRecord(null)
    clearPending(); setError('')
    setMessage(saved.state === 'sent' ? '' : 'Borrador guardado. Todavía no se enviaron notificaciones.')
    if (window.location.pathname === '/admin/solicitudes/nueva') {
      window.history.replaceState(window.history.state, '', `/admin/solicitudes/nueva?draft=${saved.id}`)
    }
  }
  async function recover(command: AdminRequestCommand) {
    const response = await fetch(`/api/admin/service-requests?id=${command.id}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!mounted.current) return
    if (response.status === 404) {
      clearPending()
      setError('No encontramos un guardado para esta solicitud. Conservamos los datos para que puedas volver a intentar.')
      return
    }
    if (!response.ok) throw new Error('recovery_unavailable')
    const saved = readRecord(await response.json(), command.id)
    if (!mounted.current) return
    if (saved.state === 'sent') { applySaved(saved); return }
    const savedInput = { ...saved.input, equipmentId: saved.input.equipmentId ?? null }
    const intendedInput = { ...commandInput(command), equipmentId: command.equipmentId ?? null }
    const sameInput = Object.keys(intendedInput).every(key => JSON.stringify(savedInput[key as keyof typeof savedInput]) === JSON.stringify(intendedInput[key as keyof typeof intendedInput]))
    if (command.action === 'draft' && saved.version > command.expectedVersion && sameInput) { applySaved(saved); return }
    clearPending()
    if (saved.version > command.expectedVersion) {
      setConflictingRecord(saved)
      setError('El borrador cambió en el servidor. Conservamos tus datos; cargá la versión actual antes de volver a guardar.')
    } else {
      setRecord(saved)
      setError(command.action === 'send' ? 'El envío no quedó registrado. Conservamos los datos para que revises y vuelvas a intentar.' : 'El guardado no quedó registrado. Conservamos tus cambios para que puedas volver a intentar.')
    }
  }
  async function consult() {
    const command = pendingCommand.current
    if (!command || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await recover(command) }
    catch { setNeedsRecovery(true); setError('No pudimos verificar el guardado. Consultá el estado antes de volver a enviar.') }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  async function save(action: AdminRequestCommand['action']) {
    if (pending.current || needsRecovery || conflictingRecord || loadingOptions || optionsError || sent) return
    let command: AdminRequestCommand
    try { command = buildCommand(action) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Revisá los datos de la solicitud.'); return }
    if (action === 'send' && new Date(command.startsAt).getTime() <= Date.now() + 10 * 60_000) {
      setError('Elegí un horario de visita con más de 10 minutos de anticipación.'); return
    }
    pending.current = true; pendingCommand.current = command
    setBusy(true); setError(''); setMessage('')
    try { sessionStorage.setItem(storageKey, JSON.stringify(command)) } catch { /* Server idempotency does not depend on device storage. */ }
    try {
      const response = await fetch('/api/admin/service-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(15000)
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 409) {
          clearPending(); setError(body.error ?? 'Revisá los datos de la solicitud.'); return
        }
        throw new Error('save_unconfirmed')
      }
      const saved = readRecord(body.record, command.id)
      if (mounted.current) applySaved(saved)
    } catch {
      if (mounted.current) {
        try { await recover(command) }
        catch { setNeedsRecovery(true); setError('No pudimos verificar el guardado. Consultá el estado antes de volver a enviar.') }
      }
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  function review(event: FormEvent) {
    event.preventDefault()
    if (needsRecovery || conflictingRecord || loadingOptions || optionsError || sent) return
    try { buildCommand('send'); setError(''); setPreview(true) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Revisá los datos de la solicitud.') }
  }

  let amounts: ReturnType<typeof calculateAdminRequestAmounts> | null = null
  try { amounts = calculateAdminRequestAmounts(formNumber(values.total), { mode: values.commissionMode, value: formNumber(values.commissionValue) }, options.paymentCostRate) } catch { /* Incomplete form. */ }
  const professional = options.professionals.find(item => item.id === values.professionalId)
  const customer = options.customers.find(item => item.id === values.customerId)
  const address = options.addresses.find(item => item.id === values.addressId)
  const equipment = options.equipment.filter(item => item.addressId === values.addressId && item.categoryId === values.categoryId)
  const disabled = busy || needsRecovery || Boolean(conflictingRecord) || Boolean(sent)
  const mutationBlocked = disabled || loadingOptions || optionsError

  if (sent) return <div className="adm-stack">
    <Header title="Solicitud enviada al técnico" description="El cliente podrá confirmar y pagar cuando el profesional acepte. Consultá el trabajo para ver la asignación y el pago actuales." back={{ href: '/admin/solicitudes', label: 'Solicitudes' }} />
    <Panel title={record.input.serviceTitle}><p>{record.input.description}</p><p className={styles.sentAmount}>{ars(record.input.total)}</p>
      <div className="adm-inline"><Link className="adm-button adm-button-primary" href={`/admin/trabajos/${record.jobId}`}>Ver trabajo</Link><Link className="adm-button adm-button-secondary" href="/admin/solicitudes">Volver a solicitudes</Link></div>
    </Panel>
  </div>

  return <div className="adm-stack">
    <Header title={initialRecord ? 'Editar solicitud' : 'Crear solicitud'} description="Prepará el servicio en nombre del cliente. El cliente solo revisa, confirma y paga cuando el técnico acepta." back={{ href: '/admin/solicitudes', label: 'Solicitudes' }} />
    {error ? <p className="adm-notice" role="alert">{error}</p> : null}
    {message ? <p className="adm-notice success" role="status">{message}</p> : null}
    {needsRecovery ? <Button disabled={busy} onClick={() => void consult()}>{busy ? 'Consultando…' : 'Consultar estado'}</Button> : null}
    {conflictingRecord ? <Button disabled={busy} onClick={() => { applySaved(conflictingRecord); void loadOptions(conflictingRecord.customerId) }}>Cargar versión actual del borrador</Button> : null}
    {optionsError ? <Button disabled={loadingOptions || busy} onClick={() => void loadOptions(values.customerId, search)}>Volver a consultar datos</Button> : null}
    <form className={`adm-two-col ${styles.layout}`} onSubmit={review} aria-busy={busy || loadingOptions}>
      <fieldset className={styles.fields} disabled={disabled}>
        <legend className={styles.srOnly}>Datos de la solicitud</legend>
        {preview ? <Panel title="Revisar antes de enviar">
          <h2 ref={reviewHeading} tabIndex={-1} className={styles.reviewTitle}>{values.serviceTitle}</h2>
          <p className={styles.scope}>{values.description}</p>
          <dl className="adm-facts">
            <div><dt>Cliente</dt><dd>{customer?.name}</dd></div><div><dt>Domicilio</dt><dd>{address?.label}</dd></div>
            {values.equipmentId ? <div><dt>Equipo</dt><dd>{equipment.find(item => item.id === values.equipmentId)?.name}</dd></div> : null}
            <div><dt>Técnico</dt><dd>{professional?.name}</dd></div>
            <div><dt>Visita</dt><dd>{values.dateTime.replace('T', ' · ')} · Buenos Aires</dd></div>
            <div><dt>Duración</dt><dd>{values.durationMinutes} minutos</dd></div>
            <div><dt>Total que paga el cliente</dt><dd>{amounts ? ars(amounts.total) : '—'}</dd></div>
            <div><dt>Comisión acordada</dt><dd>{amounts ? ars(amounts.platformFee) : '—'}</dd></div>
            <div><dt>Para el técnico antes de cargos</dt><dd>{amounts ? ars(amounts.professionalAmount) : '—'}</dd></div>
          </dl>
          <p className={styles.help}>Al enviar se guarda este alcance, precio y reparto. Primero recibe la propuesta el técnico; cuando acepta, el cliente recibe el resumen para confirmar y pagar.</p>
          {!professional?.paymentAccountConnected ? <p role="alert" className="adm-notice">El técnico debe vincular su cuenta de cobro antes de enviar esta solicitud.</p> : null}
          <div className="adm-save-bar"><Button onClick={() => setPreview(false)}>Volver a editar</Button><Button variant="primary" disabled={mutationBlocked || !professional?.paymentAccountConnected} onClick={() => void save('send')}>{busy ? 'Enviando…' : 'Enviar al técnico'}</Button></div>
        </Panel> : <>
          <Panel title="1. Cliente y domicilio" description="Usá los datos registrados en la cuenta del cliente.">
            <div className={styles.search}>
              <Field label="Buscar cliente"><input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void loadOptions(values.customerId, search) } }} placeholder="Nombre o correo electrónico" /></Field>
              <Button disabled={loadingOptions} onClick={() => void loadOptions(values.customerId, search)}>Buscar</Button>
            </div>
            <div className={`adm-form-grid ${styles.group}`}>
              <Field label="Cliente"><select required value={values.customerId} onChange={event => selectCustomer(event.target.value)}><option value="">Elegí un cliente</option>{options.customers.map(item => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></Field>
              <Field label="Domicilio"><select required value={values.addressId} disabled={loadingOptions || !values.customerId} onChange={event => { change('addressId', event.target.value); change('equipmentId', '') }}><option value="">Elegí un domicilio</option>{options.addresses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
            </div>
            {!loadingOptions && !options.customers.length ? <p className={styles.help}>No encontramos clientes con esa búsqueda. Probá con otro nombre o correo.</p> : null}
            {loadingOptions ? <p className={styles.help} role="status">Consultando datos del cliente…</p> : values.customerId && !options.addresses.length && !optionsError ? <p className={styles.help}>Este cliente necesita un domicilio registrado antes de crear una solicitud.</p> : null}
          </Panel>
          <Panel title="2. Servicio y alcance" description="Elegí el tipo de servicio y detallá exactamente qué incluye el precio.">
            <div className="adm-form-grid">
              <Field label="Categoría"><select required value={values.categoryId} onChange={event => { change('categoryId', event.target.value); change('issueTypeId', ''); change('equipmentId', '') }}><option value="">Elegí una categoría</option>{options.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Tipo de servicio"><select required value={values.issueTypeId} onChange={event => change('issueTypeId', event.target.value)}><option value="">Elegí un servicio</option>{options.issues.filter(item => item.categoryId === values.categoryId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Equipo" hint="Podés omitirlo al guardar el borrador. Es necesario seleccionarlo antes de enviar para que el técnico registre el diagnóstico y el cierre."><select value={values.equipmentId} disabled={!values.addressId || loadingOptions} onChange={event => change('equipmentId', event.target.value)}><option value="">Sin equipo seleccionado</option>{equipment.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
              <Field label="Nombre del servicio"><input required minLength={3} maxLength={120} value={values.serviceTitle} onChange={event => change('serviceTitle', event.target.value)} placeholder="Ej.: Mantenimiento completo de aire" /></Field>
            </div>
            <div className={styles.group}><Field label="Alcance personalizado" hint="Incluí tareas, materiales y condiciones acordadas con el cliente."><textarea required minLength={15} maxLength={2000} rows={4} value={values.description} onChange={event => change('description', event.target.value)} /></Field></div>
          </Panel>
          <Panel title="3. Técnico y visita" description="La disponibilidad se verifica nuevamente al enviar la propuesta.">
            {!options.professionals.length ? <p className={styles.help}>No hay técnicos habilitados para seleccionar. Revisá su aprobación en Profesionales antes de continuar.</p> : null}
            <div className="adm-form-grid">
              <Field label="Técnico"><select required value={values.professionalId} onChange={event => change('professionalId', event.target.value)}><option value="">Elegí un técnico</option>{options.professionals.map(item => <option key={item.id} value={item.id}>{item.name}{item.paymentAccountConnected ? '' : ' · cuenta de cobro pendiente'}</option>)}</select></Field>
              <Field label="Fecha y hora" hint="Horario de Buenos Aires."><input type="datetime-local" required value={values.dateTime} onChange={event => change('dateTime', event.target.value)} /></Field>
              <Field label="Duración de la visita (minutos)"><input type="number" required min={30} max={480} step={1} value={values.durationMinutes} onChange={event => change('durationMinutes', event.target.value)} /></Field>
              <Field label="Margen para traslado (minutos)"><input type="number" required min={0} max={180} step={1} value={values.travelBufferMinutes} onChange={event => change('travelBufferMinutes', event.target.value)} /></Field>
            </div>
          </Panel>
          <Panel title="4. Precio y comisión" description="El precio total ya incluye la comisión de Lysto.">
            {options.quotes.length ? <div className={styles.quoteReference}><Field label="Usar precio de un presupuesto" hint="Se copia como referencia. Podés ajustar el precio y la comisión para esta solicitud."><select value="" onChange={event => { const quote = options.quotes.find(item => item.id === event.target.value); if (quote) { change('total', String(quote.total)); change('commissionMode', 'percentage'); change('commissionValue', String(quote.commissionRate)) } }}><option value="">Elegí un presupuesto existente</option>{options.quotes.map(item => <option key={item.id} value={item.id}>{item.title} · {ars(item.total)}</option>)}</select></Field></div> : null}
            <div className="adm-form-grid">
              <Field label="Precio total al cliente (ARS)"><input type="number" required min={0.01} max={100000000} step={0.01} value={values.total} onChange={event => change('total', event.target.value)} /></Field>
              <Field label="Tipo de comisión"><select value={values.commissionMode} onChange={event => change('commissionMode', event.target.value as Values['commissionMode'])}><option value="percentage">Porcentaje del total</option><option value="amount">Monto fijo en ARS</option></select></Field>
              <Field label="Comisión de Lysto" hint={values.commissionMode === 'percentage' ? 'Porcentaje entre 0 y menos de 100.' : 'Importe incluido en el total del cliente.'}><input type="number" required min={0} max={values.commissionMode === 'percentage' ? 99.99 : 100000000} step={0.01} value={values.commissionValue} onChange={event => change('commissionValue', event.target.value)} /></Field>
            </div>
          </Panel>
          <div className="adm-save-bar"><div><p>El borrador queda guardado para continuar después.</p><p>Crear esta solicitud no acepta ni paga por el cliente.</p></div><div className="adm-inline"><Button disabled={mutationBlocked} onClick={() => void save('draft')}>{busy ? 'Guardando…' : 'Guardar borrador'}</Button><Button type="submit" variant="primary" disabled={mutationBlocked}>Revisar solicitud</Button></div></div>
        </>}
      </fieldset>
      <aside className={styles.summary} aria-label="Resumen económico interno">
        <Panel title="Reparto del servicio" description="Visible para administración y el técnico.">
          <p className={styles.totalLabel}>Total al cliente</p><p className="adm-money">{amounts ? ars(amounts.total) : '—'}</p>
          <dl className={`adm-facts ${styles.group}`}>
            <div><dt>Comisión de Lysto</dt><dd>{amounts ? ars(amounts.platformFee) : '—'}</dd></div>
            <div><dt>Participación del técnico</dt><dd data-testid="professional-amount">{amounts ? ars(amounts.professionalAmount) : '—'}</dd></div>
            <div><dt>Cargos estimados de Mercado Pago</dt><dd>{amounts ? ars(amounts.paymentCostBudget) : '—'}</dd></div>
            <div><dt>Neto estimado del técnico</dt><dd>{amounts ? ars(amounts.professionalNetEstimate) : '—'}</dd></div>
          </dl>
          <p className={styles.help}>Mercado Pago descuenta sus cargos de la parte del técnico. El costo real se conoce cuando se confirma el pago.</p>
          {amounts && amounts.professionalNetEstimate < 0 ? <p className="adm-notice" role="status">Los cargos estimados superan la participación del técnico. Revisá el reparto antes de enviar.</p> : null}
          {!amounts && values.total ? <p className="adm-notice" role="status">Revisá el precio y la comisión. El técnico debe conservar una participación positiva.</p> : null}
        </Panel>
      </aside>
    </form>
  </div>
}
