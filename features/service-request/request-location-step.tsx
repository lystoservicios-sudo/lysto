'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Building2, List, Plus } from 'lucide-react'
import { PlacementForm, addressLabel, type HomeFlow } from '@/components/customer/hogar/hogar-forms'
import { HOME_KIND_OPTIONS, ROOM_CATALOG, type CustomerHome, type CustomerHomesSnapshot, type HomeKind, type RoomKind } from '@/lib/customer-homes/contracts'
import { addHomeRoom, roomKindsForHome } from '@/lib/customer-homes/model'
import { readPendingHomeOperation } from '@/lib/customer-homes/pending-operation'
import { addressInputSchema, type CustomerAssetAddress } from '@/lib/customer-assets/contracts'
import { privateRequest, PrivateRequestError, requestError } from '@/lib/http/private-client'
import type { RequestLocationSelection } from './request-draft'
import { resolveRequestContext, selectRequestFloor } from './request-context'
import { clearRequestHomeCommand, homeSaveInput, locationCommandWasSuperseded, readRequestHomeCommand, replayRequestHomeCommand, sameRequestHomeCommand, storeRequestHomeCommand, type RequestHomeCommand } from './request-home-client'
import { Choice, Choices, ScreenHeading } from './request-screen-parts'
import styles from './request-screens.module.css'
import { AirPlacementTransition, type AirTransitionOrigin } from './request-air-transition'
import type { EquipmentScreenAnchor } from '@/components/customer/hogar/equipment-anchor'
import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'

const HomeScene = dynamic(() => import('@/components/customer/hogar/home-scene'), { ssr: false, loading: () => <p className={styles.status}>Preparando la vista del ambiente…</p> })
const blankAddress = { label: '', street: '', number: '', city: '', province: '', floor: '', apartment: '', postalCode: '', reference: '', propertyType: 'apartment' as CustomerAssetAddress['propertyType'], isDefault: false, access: {} as CustomerAssetAddress['access'] }
function addressDraft(address: CustomerAssetAddress) { return { label: address.label, street: address.street, number: address.number, city: address.city, province: address.province, floor: address.floor ?? '', apartment: address.apartment ?? '', postalCode: address.postalCode ?? '', reference: address.reference ?? '', propertyType: address.propertyType, isDefault: address.isDefault, access: address.access } }
type FormMode = 'home' | 'room' | 'air' | 'address' | 'floor' | null
export function RequestLocationStep({ customerId, data, equipmentId, selection, onData, onEquipmentCreated, onSelect, onLock, transition, onTransitionDone }: { customerId: string; data: CustomerHomesSnapshot; equipmentId: string | null; selection: RequestLocationSelection | null; onData: (data: CustomerHomesSnapshot) => void; onEquipmentCreated: (id: string) => void; onSelect: (value: RequestLocationSelection | null) => void; onLock: (locked: boolean) => void; transition?: { origin: AirTransitionOrigin; src: string; equipmentId: string } | null; onTransitionDone?: () => void }) {
  const context = resolveRequestContext(data, equipmentId)
  const [homeId, setHomeId] = useState(selection?.homeId ?? context.home?.id ?? '')
  const [floorId, setFloorId] = useState(selection?.floorId ?? (context.kind === 'located' ? context.floor.id : context.home?.floors[0]?.id) ?? '')
  const [roomId, setRoomId] = useState<string | null>(selection?.roomId ?? (context.kind === 'located' ? context.room.id : null))
  const [mode, setMode] = useState<FormMode>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<RequestHomeCommand | null>(null)
  const [recoveryError, setRecoveryError] = useState('')
  const [reviewNotice, setReviewNotice] = useState('')
  const [listOnly, setListOnly] = useState(false)
  const [gpuUnavailable, setGpuUnavailable] = useState(false)
  const [placementFlow, setPlacementFlow] = useState<Extract<HomeFlow, { type: 'placement' }> | null>(null)
  const [homeName, setHomeName] = useState('')
  const [kind, setKind] = useState<HomeKind>('apartment')
  const [building, setBuilding] = useState<'low' | 'high'>('low')
  const [balcony, setBalcony] = useState(false)
  const [terrace, setTerrace] = useState(false)
  const [windows, setWindows] = useState<'small' | 'large' | 'mixed'>('mixed')
  const [newAddress, setNewAddress] = useState(blankAddress)
  const [locationProof, setLocationProof] = useState('')
  const [selectedAddress, setSelectedAddress] = useState(context.address?.id ?? '')
  const [roomKind, setRoomKind] = useState<RoomKind>('living')
  const [roomVariant, setRoomVariant] = useState('compact')
  const [roomName, setRoomName] = useState('')
  const [floorName, setFloorName] = useState('')
  const alive = useRef(true)
  const pendingRef = useRef<RequestHomeCommand | null>(null)
  const uncertain = useRef(false)
  const busyRef = useRef(false)
  const sceneRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<EquipmentScreenAnchor | null>(null)
  const anchorReported = useCallback((value: EquipmentScreenAnchor | null) => {
    if (!transition || transition.equipmentId !== equipmentId || !value || !alive.current) return
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 40) return
    setAnchor(current => current ?? { ...value, x: value.x + rect.left, y: value.y + rect.top })
  }, [transition, equipmentId])
  const home = data.homes.find(h => h.id === homeId) ?? context.home
  const { floors, activeFloor: floor, showSelector } = home ? selectRequestFloor(home, floorId) : { floors: [], activeFloor: null, showSelector: false }
  const room = floor?.rooms.find(r => r.id === roomId)
  const address = data.addresses.find(a => a.id === home?.addressId)
  const equipment = data.equipment.find(e => e.id === equipmentId)
  const blocked = busy || !!pending || !!recoveryError
  useEffect(() => {
    alive.current = true
    const previous = readRequestHomeCommand(customerId)
    const hogarPending = readPendingHomeOperation(customerId)
    pendingRef.current = previous.command; uncertain.current = !!previous.command
    setPending(previous.command)
    setRecoveryError(previous.error || hogarPending.error || (hogarPending.operation ? 'Tenés un guardado pendiente en Hogar. Confirmalo allí antes de registrar otra ubicación.' : ''))
    return () => { alive.current = false }
  }, [customerId])
  useEffect(() => { onLock(blocked || mode !== null); return () => onLock(false) }, [blocked, mode, onLock])
  useEffect(() => {
    if (!home || !floor || !room) return
    const actual = home.placements.find(p => p.equipmentId === equipmentId)
    if (actual?.roomId === room.id) onSelect({ homeId: home.id, addressId: home.addressId, floorId: floor.id, roomId: room.id, homeVersion: home.version })
  }, [home, floor, room, equipmentId, onSelect])
  const unavailable = useCallback(() => { setGpuUnavailable(true); setListOnly(true) }, [])
  function chooseRoom(id: string) {
    setRoomId(id)
    if (home?.placements.find(p => p.equipmentId === equipmentId)?.roomId !== id) onSelect(null)
  }
  function pendingCommandIsCurrent(operation: RequestHomeCommand) {
    const stored = readRequestHomeCommand(customerId)
    if (!stored.error && sameRequestHomeCommand(stored.command, operation)) return true
    setError('')
    setRecoveryError(stored.error || 'El guardado pendiente cambió. Conservamos su referencia; recargá la pantalla para revisarlo antes de continuar.')
    return false
  }
  async function run(command?: RequestHomeCommand) {
    if (busyRef.current || recoveryError) return
    const operation = pendingRef.current ?? command
    if (!operation) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      if (!pendingRef.current) { storeRequestHomeCommand(customerId, operation); pendingRef.current = operation; setPending(operation) }
      if (!pendingCommandIsCurrent(operation)) return
      const result = await replayRequestHomeCommand(customerId, operation, uncertain.current)
      if (!alive.current || pendingRef.current !== operation || !pendingCommandIsCurrent(operation)) return
      // The mutation was acknowledged. A later read failure cannot erase its replay identity.
      uncertain.current = true
      const snapshot = await privateRequest<CustomerHomesSnapshot>('/api/customer/homes', 'GET', undefined, { 'X-Lysto-Customer-Id': customerId })
      if (!alive.current) return
      const nextHome = operation.kind === 'create-home' ? snapshot.homes.find(h => h.id === result.home?.id) : snapshot.homes.find(h => h.id === ('homeId' in operation.input ? operation.input.homeId : 'id' in operation.input && operation.kind === 'save-home' ? operation.input.id : home?.id))
      if (operation.kind === 'create-home' && !nextHome) throw new Error('El hogar se guardó, pero falta confirmar su información. Reintentá el mismo guardado.')
      if (operation.kind === 'add-equipment' && !snapshot.equipment.some(e => e.id === result.equipment?.id)) throw new Error('El aire se guardó, pero falta confirmar su información. Reintentá el mismo registro.')
      if (!pendingCommandIsCurrent(operation)) return
      clearRequestHomeCommand(customerId); pendingRef.current = null; uncertain.current = false; setPending(null)
      onData(snapshot)
      if (nextHome) {
        setHomeId(nextHome.id)
        setFloorId(current => nextHome.floors.some(f => f.id === current) ? current : nextHome.floors[0]?.id ?? '')
      }
      if (operation.kind === 'add-equipment' && nextHome) {
        // The idempotent result is reflected in the canonical snapshot; never invent an equipment ID.
        const created = snapshot.equipment.find(e => e.id === result.equipment?.id)
        if (created) { onEquipmentCreated(created.id); setRoomId(operation.input.placement.roomId) }
        else throw new Error('El aire quedó guardado. Elegilo desde los equipos antes de continuar.')
      }
      setMode(null); setPlacementFlow(null); setLocationProof('')
      setReviewNotice('')
    } catch (failure) {
      if (!alive.current) return
      if (pendingRef.current && !pendingCommandIsCurrent(operation)) return
      if (failure instanceof PrivateRequestError && failure.status >= 400 && failure.status < 500 && !uncertain.current) {
        clearRequestHomeCommand(customerId); pendingRef.current = null; setPending(null)
      } else if (pendingRef.current) uncertain.current = true
      setError(requestError(failure))
    } finally { if (alive.current) { busyRef.current = false; setBusy(false) } }
  }
  async function reviewCurrentLocation() {
    const operation = pendingRef.current
    if (busyRef.current || recoveryError || !uncertain.current || !operation ||
      (operation.kind !== 'save-home' && operation.kind !== 'save-address')) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      const snapshot = await privateRequest<CustomerHomesSnapshot>('/api/customer/homes', 'GET', undefined, { 'X-Lysto-Customer-Id': customerId })
      if (!alive.current || pendingRef.current !== operation) return
      const otherPending = readPendingHomeOperation(customerId)
      if (otherPending.error || otherPending.operation) {
        setRecoveryError(otherPending.error || 'Tenés un guardado pendiente en Hogar. Confirmalo allí antes de registrar otra ubicación.')
        return
      }
      if (!pendingCommandIsCurrent(operation)) return
      if (!locationCommandWasSuperseded(operation, snapshot))
        throw new Error('No pudimos confirmar que ese guardado ya no pueda aplicarse. Conservamos el pendiente; podés reintentar su confirmación.')
      const current = resolveRequestContext(snapshot, equipmentId)
      const actualHome = current.home ?? (operation.kind === 'save-home'
        ? snapshot.homes.find(value => value.id === operation.input.id)
        : snapshot.homes.find(value => [value.addressId, ...(value.addressIds ?? [])].includes(operation.input.id))) ?? null
      const actualFloor = current.kind === 'located' ? current.floor : actualHome ? selectRequestFloor(actualHome).activeFloor : null
      const actualRoom = current.kind === 'located' ? current.room : null
      // Refresh from the canonical placement, not from the old desired PUT.
      onSelect(null); onData(snapshot)
      setHomeId(actualHome?.id ?? ''); setFloorId(actualFloor?.id ?? ''); setRoomId(actualRoom?.id ?? null)
      setSelectedAddress(current.address?.id ?? actualHome?.addressId ?? '')
      setMode(null); setPlacementFlow(null); setAnchor(null); onTransitionDone?.()
      if (!pendingCommandIsCurrent(operation)) return
      clearRequestHomeCommand(customerId)
      const remaining = readRequestHomeCommand(customerId)
      if (remaining.error || remaining.command) {
        if (!pendingCommandIsCurrent(operation)) return
        throw new Error('No pudimos resolver el guardado pendiente en esta pestaña. Conservamos su referencia; volvé a revisar la ubicación actual.')
      }
      pendingRef.current = null; uncertain.current = false; setPending(null)
      setReviewNotice('Revisá la ubicación actual antes de continuar. No damos por confirmado el guardado anterior.')
      if (current.kind === 'located') onSelect({ homeId: current.home.id, addressId: current.address.id, floorId: current.floor.id, roomId: current.room.id, homeVersion: current.home.version })
    } catch (failure) { if (alive.current) setError(requestError(failure)) }
    finally { if (alive.current) { busyRef.current = false; setBusy(false) } }
  }
  function startAir() {
    if (!home || !room || blocked) return
    const actual = home.placements.find(p => p.equipmentId === equipmentId)
    setPlacementFlow({ type: 'placement', register: !equipment, key: crypto.randomUUID(), value: { equipmentId: equipment?.id ?? crypto.randomUUID(), roomId: room.id, wall: actual?.wall ?? 'north', offset: actual?.offset ?? .5, height: actual?.height ?? 2 }, equipment: { nickname: equipment?.nickname ?? '', equipmentType: (equipment?.equipmentType as 'split') ?? 'split', brand: equipment?.brand ?? '', model: equipment?.model ?? '', serialNumber: equipment?.serialNumber ?? '', frigorias: equipment?.frigorias ?? '' } })
    setMode('air')
  }
  async function saveAir() {
    if (!home || !placementFlow) return
    if (placementFlow.register) {
      const { nickname, equipmentType, brand, model, serialNumber, frigorias } = placementFlow.equipment
      const { roomId, wall, offset, height } = placementFlow.value
      const placement = { roomId, wall, offset, height }
      await run({ kind: 'add-equipment', input: { homeId: home.id, expectedVersion: home.version, idempotencyKey: placementFlow.key, equipment: { nickname, equipmentType, brand: brand || null, model: model || null, serialNumber: serialNumber || null, frigorias: frigorias ? Number(frigorias) : null }, placement } })
    } else await run({ kind: 'save-home', input: homeSaveInput({ ...home, placements: [...home.placements.filter(p => p.equipmentId !== equipmentId), placementFlow.value] }) })
  }
  async function createHome(event: FormEvent) {
    event.preventDefault()
    try {
      const inputAddress = selectedAddress ? undefined : addressInputSchema.parse({ ...newAddress, label: homeName, propertyType: kind === 'ph' ? 'house' : kind })
      await run({ kind: 'create-home', input: { name: homeName, kind, building: kind === 'apartment' ? building : null, features: { balcony, terrace, windows }, addressId: selectedAddress || null, ...(inputAddress ? { newAddress: { ...inputAddress, ...(locationProof ? { locationProof } : {}) } } : {}), floors: [{ id: crypto.randomUUID(), name: 'Planta principal', order: 0, rooms: [] }], placements: [], idempotencyKey: crypto.randomUUID() } })
    } catch { setError('Completá el nombre y los datos de la dirección para guardar el hogar.') }
  }
  async function saveRoom(event: FormEvent) {
    event.preventDefault()
    if (!home || !floor) return
    try {
      const next = addHomeRoom(floor, roomKind, roomVariant)
      const created = next.rooms.at(-1)!
      created.name = roomName.trim() || ROOM_CATALOG[roomKind].label
      const features = { ...home.features, ...(roomKind === 'balcony' ? { balcony: true } : {}), ...(roomKind === 'terrace' ? { terrace: true } : {}) }
      setRoomId(created.id)
      await run({ kind: 'save-home', input: homeSaveInput({ ...home, features, floors: home.floors.map(f => f.id === floor.id ? next : f) }) })
    } catch (failure) { setError(requestError(failure)) }
  }
  function openRoom() {
    const next = home ? roomKindsForHome(home.kind)[0] : 'living'
    setRoomKind(next); setRoomVariant(ROOM_CATALOG[next].variants[0].value); setRoomName(''); setMode('room')
  }
  function close() { if (!blocked) { setMode(null); setPlacementFlow(null); setLocationProof(''); setError('') } }
  function sceneHome(): CustomerHome | null {
    return home ?? null
  }
  const displayedHome = sceneHome()
  return <>
    <ScreenHeading title="Revisá dónde está tu aire" description={context.kind === 'located' ? 'Ya cargamos la ubicación que guardaste en Hogar.' : 'Completá solo el lugar y ambiente de este aire, sin salir del pedido.'} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {recoveryError && <p role="alert" className={styles.error}>{recoveryError}</p>}
    {reviewNotice && <p role="status" className={styles.note}>{reviewNotice}</p>}
    {pending && <div className={styles.note}><div><strong>Guardado pendiente de confirmar</strong><p>El reintento usa exactamente los mismos datos. No creará otro hogar ni otro aire.</p><button disabled={busy || !!recoveryError} className={styles.textButton} onClick={() => void run()}>Reintentar el guardado pendiente</button>{!recoveryError && uncertain.current && (pending.kind === 'save-home' || pending.kind === 'save-address') && <button disabled={busy} className={styles.textButton} onClick={() => void reviewCurrentLocation()}>Revisar ubicación actual</button>}</div></div>}
    {!mode && <>
      {data.homes.length > 0 && <div className={styles.selectRow}><Building2 size={22} aria-hidden /><select aria-label="Hogar del equipo" value={home?.id ?? ''} disabled={blocked} onChange={e => { const next = data.homes.find(h => h.id === e.target.value); setHomeId(e.target.value); setFloorId(next?.floors[0]?.id ?? ''); setRoomId(null); onSelect(null) }}><option value="">Elegí un hogar</option>{data.homes.filter(h => !equipment?.addressId || [h.addressId, ...(h.addressIds ?? [])].includes(equipment.addressId)).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>}
      {showSelector && <div className={styles.field}><label htmlFor="request-floor">Planta</label><select id="request-floor" value={floor?.id ?? ''} disabled={blocked} onChange={e => { setFloorId(e.target.value); setRoomId(null); onSelect(null) }}>{floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
      {displayedHome && floor && !listOnly && <div ref={sceneRef} className={styles.scene}><HomeScene home={displayedHome} floorId={floor.id} roomId={room?.id ?? null} focused={!!room} equipment={data.equipment} selectedEquipmentId={equipmentId} onSelectRoom={chooseRoom} onSelectEquipment={() => {}} onUnavailable={unavailable} onEquipmentAnchor={transition ? anchorReported : undefined} /></div>}
      {home && <p className={styles.sceneCaption}>Distribución orientativa, no plano técnico.</p>}
      {home && <button className={styles.textButton} disabled={gpuUnavailable} onClick={() => setListOnly(v => !v)}><List size={17} aria-hidden />{listOnly ? 'Ver 3D' : 'Ver lista'}</button>}
      {gpuUnavailable && <p className={styles.small}>Podés elegir el ambiente y ubicar el aire con los controles, sin 3D.</p>}
      {floor?.rooms.length ? <><h2 className={styles.sectionTitle}>Ambiente</h2><Choices label="Ambiente del equipo">{floor.rooms.map(r => <Choice key={r.id} selected={r.id === roomId} disabled={blocked} onClick={() => chooseRoom(r.id)}>{r.name}</Choice>)}</Choices></> : home ? <p className={styles.status}>Añadí el ambiente donde está el aire. No hace falta completar el resto del hogar.</p> : null}
      {address && <div className={styles.summaryRow}><div><p className={styles.small}>Dirección de visita</p><p>{addressLabel(address)}</p></div><button disabled={blocked} className={styles.textButton} onClick={() => { setLocationProof(''); setNewAddress(addressDraft(address)); setMode('address') }}>Editar</button></div>}
      {room && <div className={styles.summaryRow}><div><p className={styles.small}>Equipo</p><p>{equipment?.nickname ?? 'Aire por registrar'}</p><p className={styles.small}>{home?.placements.find(p => p.equipmentId === equipmentId)?.roomId === room.id ? 'Ubicación guardada' : 'Ubicación por confirmar'}</p></div><button disabled={blocked} className={styles.textButton} onClick={startAir}>{equipment ? 'Confirmar ubicación' : 'Añadir aire aquí'}</button></div>}
      <div className={styles.section}>{(!equipment?.addressId || !context.home) && <button disabled={blocked} className={styles.textButton} onClick={() => { setLocationProof(''); setMode('home') }}><Plus size={17} aria-hidden />Añadir hogar</button>}{home && <><button disabled={blocked} className={styles.textButton} onClick={openRoom}><Plus size={17} aria-hidden />Añadir ambiente</button><button disabled={blocked || home.floors.length >= 12} className={styles.textButton} onClick={() => { setFloorName(''); setMode('floor') }}><Plus size={17} aria-hidden />Añadir planta</button></>}</div>
    </>}
    {mode === 'home' && <form className={styles.inlineForm} onSubmit={e => void createHome(e)}><h2>Un hogar para este aire</h2><fieldset disabled={blocked}><div className={styles.field}><label htmlFor="quick-home-name">Nombre del hogar</label><input id="quick-home-name" required maxLength={80} value={homeName} onChange={e => setHomeName(e.target.value)} /></div><div className={styles.field}><label htmlFor="quick-home-kind">Tipo de lugar</label><select id="quick-home-kind" value={kind} onChange={e => setKind(e.target.value as HomeKind)}>{HOME_KIND_OPTIONS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>{kind === 'apartment' && <div className={styles.field}><label htmlFor="quick-building">Tipo de edificio</label><select id="quick-building" value={building} onChange={e => setBuilding(e.target.value as 'low' | 'high')}><option value="low">Pocos pisos</option><option value="high">Muchos pisos</option></select></div>}<div className={styles.field}><label><input type="checkbox" checked={balcony} onChange={e => setBalcony(e.target.checked)} />Tiene balcón</label><label><input type="checkbox" checked={terrace} onChange={e => setTerrace(e.target.checked)} />Tiene terraza</label><label htmlFor="quick-windows">Ventanas</label><select id="quick-windows" value={windows} onChange={e => setWindows(e.target.value as typeof windows)}><option value="small">Pequeñas</option><option value="large">Grandes</option><option value="mixed">Variadas</option></select></div><div className={styles.field}><label htmlFor="quick-address">Dirección</label><select id="quick-address" value={selectedAddress} onChange={e => setSelectedAddress(e.target.value)}><option value="">Añadir una dirección</option>{data.addresses.filter(a => !a.archivedAt && !data.homes.some(h => [h.addressId, ...(h.addressIds ?? [])].includes(a.id))).map(a => <option key={a.id} value={a.id}>{a.label} · {addressLabel(a)}</option>)}</select></div>{!selectedAddress && <AddressFields value={newAddress} onChange={setNewAddress} onProofChange={setLocationProof} />}<p className={styles.small}>Crearemos una planta vacía. Solo añadiremos el ambiente que necesites.</p></fieldset><InlineActions disabled={blocked} onCancel={close} label="Guardar hogar" /></form>}
    {mode === 'room' && home && <form className={styles.inlineForm} onSubmit={e => void saveRoom(e)}><h2>Añadir el ambiente</h2><fieldset disabled={blocked}><div className={styles.field}><label htmlFor="quick-room-name">Nombre del ambiente</label><input id="quick-room-name" maxLength={80} placeholder={ROOM_CATALOG[roomKind].label} value={roomName} onChange={e => setRoomName(e.target.value)} /></div><div className={styles.field}><label htmlFor="quick-room-kind">Tipo de ambiente</label><select id="quick-room-kind" value={roomKind} onChange={e => { const next = e.target.value as RoomKind; setRoomKind(next); setRoomVariant(ROOM_CATALOG[next].variants[0].value) }}>{roomKindsForHome(home.kind).map(k => <option key={k} value={k}>{ROOM_CATALOG[k].label}</option>)}</select></div><div className={styles.field}><label htmlFor="quick-room-variant">Variante</label><select id="quick-room-variant" value={roomVariant} onChange={e => setRoomVariant(e.target.value)}>{ROOM_CATALOG[roomKind].variants.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}</select></div></fieldset><InlineActions disabled={blocked} onCancel={close} label="Guardar ambiente" /></form>}
    {mode === 'floor' && home && <form className={styles.inlineForm} onSubmit={e => { e.preventDefault(); void run({ kind: 'save-home', input: homeSaveInput({ ...home, floors: [...home.floors, { id: crypto.randomUUID(), name: floorName, order: home.floors.length, rooms: [] }] }) }) }}><h2>Añadir planta</h2><div className={styles.field}><label htmlFor="quick-floor-name">Nombre de la planta</label><input id="quick-floor-name" required disabled={blocked} maxLength={80} value={floorName} onChange={e => setFloorName(e.target.value)} /></div><InlineActions disabled={blocked} onCancel={close} label="Guardar planta" /></form>}
    {mode === 'air' && placementFlow && home && floor && <div className={styles.inlineForm}><h2>{equipment ? 'Confirmar la ubicación' : 'Añadir y ubicar el aire'}</h2>{!listOnly && <div className={styles.scene}><HomeScene home={home} floorId={floor.id} roomId={placementFlow.value.roomId} focused equipment={data.equipment} selectedEquipmentId={equipmentId} placementDraft={placementFlow.value} onPlace={patch => { if (!blocked) setPlacementFlow({ ...placementFlow, value: { ...placementFlow.value, ...patch } }) }} onSelectEquipment={() => {}} onSelectRoom={() => {}} onUnavailable={unavailable} /></div>}<PlacementForm flow={placementFlow} rooms={floor.rooms} busy={busy} locked={!!pending || !!recoveryError} onChange={next => { if (next.type === 'placement') setPlacementFlow(next) }} onCancel={close} onSave={saveAir} /></div>}
    {mode === 'address' && address && <form className={styles.inlineForm} onSubmit={e => { e.preventDefault(); void run({ kind: 'save-address', input: { ...newAddress, ...(locationProof ? { locationProof } : {}), propertyType: address.propertyType, id: address.id, expectedVersion: address.version } }) }}><h2>Dirección de visita</h2><fieldset disabled={blocked}><AddressFields value={newAddress} onChange={setNewAddress} onProofChange={setLocationProof} /><p className={styles.small}>El cambio se guardará en tu dirección de Hogar. Las visitas anteriores conservarán su dirección histórica.</p></fieldset><InlineActions disabled={blocked} onCancel={close} label="Guardar dirección" /></form>}
    {transition && onTransitionDone && !gpuUnavailable && <AirPlacementTransition origin={transition.origin} anchor={anchor} src={transition.src} onDone={onTransitionDone} />}
  </>
}
function InlineActions({ disabled, onCancel, label }: { disabled: boolean; onCancel: () => void; label: string }) { return <div className={styles.footer}><button type="submit" className={styles.primary} disabled={disabled}>{label}</button><button type="button" className={styles.textButton} disabled={disabled} onClick={onCancel}>Cancelar</button></div> }
function AddressFields({ value, onChange, onProofChange }: { value: typeof blankAddress; onChange: (value: typeof blankAddress) => void; onProofChange: (proof: string) => void }) { return <><ArgentineAddressFields value={{ street: value.street, number: value.number, city: value.city, province: value.province }} onChange={location => onChange({ ...value, ...location })} onProofChange={onProofChange} labels={{ street: 'Calle', number: 'Número', city: 'Ciudad', province: 'Provincia' }} idPrefix="request-address" groupClassName={styles.group} fieldClassName={styles.field} after={{ number: <>{([['floor', 'Piso de la dirección'], ['apartment', 'Departamento / unidad']] as const).map(([key, label]) => <div key={key} className={styles.field}><label htmlFor={`request-address-${key}`}>{label}</label><input id={`request-address-${key}`} maxLength={100} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} /></div>)}</> }} /><details className={styles.section}><summary className={styles.textButton}>Condiciones de acceso</summary><div className={styles.field}>{([['hasElevator', 'Hay ascensor'], ['hasParking', 'Hay estacionamiento'], ['stairsRequired', 'Se requieren escaleras'], ['outdoorUnitAtHeight', 'La unidad exterior está en altura'], ['outdoorUnitOnBalcony', 'La unidad exterior está en un balcón'], ['difficultAccess', 'El acceso es complicado']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={!!value.access[key]} onChange={e => onChange({ ...value, access: { ...value.access, [key]: e.target.checked } })} />{label}</label>)}</div></details></> }
