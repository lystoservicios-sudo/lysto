'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  DoorOpen,
  Home,
  Layers3,
  List,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Snowflake,
  Trash2
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { useClientFocusedFlow } from '@/components/app-shell/client-flow-context'
import { assetError, assetRequest } from '@/lib/customer-assets/client'
import { PrivateRequestError } from '@/lib/http/private-client'
import type { CustomerAssetAddress, CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import {
  HOME_KIND_OPTIONS,
  ROOM_CATALOG,
  addHomeEquipmentSchema,
  createHomeSchema,
  saveHomeSchema,
  type CreateHomeInput,
  type AddHomeEquipmentInput,
  type CustomerHome,
  type CustomerHomesSnapshot
} from '@/lib/customer-homes/contracts'
import {
  addHomeRoom,
  createHomeFloor,
  equipmentForHome,
  removeHomeFloor,
  removeHomeRoom,
  roomKindsForHome
} from '@/lib/customer-homes/model'
import { createHomePreset } from '@/lib/customer-homes/presets'
import {
  HomeForm,
  RoomForm,
  FloorForm,
  PlacementForm,
  airTypes,
  configuration,
  type HomeConfig,
  type HomeFlow,
  addressLabel
} from './hogar-forms'
import styles from './customer-hogar.module.css'

const HomeScene = dynamic(() => import('./home-scene'), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading} role="status">
      Preparando tu hogar en 3D…
    </div>
  )
})
type Confirmation = {
  title: string
  description: string
  action: () => Promise<void>
}
const uuid = () => crypto.randomUUID()
function homePayload(home: CustomerHome) {
  return {
    id: home.id,
    expectedVersion: home.version,
    name: home.name,
    addressId: home.addressId,
    kind: home.kind,
    building: home.building,
    features: home.features,
    floors: home.floors,
    placements: home.placements
  }
}

export function CustomerHogar({ initialData }: { initialData: CustomerHomesSnapshot }) {
  const [data, setData] = useState(initialData)
  const [homeId, setHomeId] = useState(initialData.homes[0]?.id ?? '')
  const [floorId, setFloorId] = useState(initialData.homes[0]?.floors[0]?.id ?? '')
  const [roomId, setRoomId] = useState<string | null>(null)
  const [flow, setFlow] = useState<HomeFlow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [listOnly, setListOnly] = useState(false)
  const [gpuUnavailable, setGpuUnavailable] = useState(false)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const creationAttempt = useRef<{
    key: string
    input: CreateHomeInput
  } | null>(null)
  const [creationPending, setCreationPending] = useState(false)
  const equipmentAttempt = useRef<{ key: string; input: AddHomeEquipmentInput } | null>(null)
  const [equipmentPending, setEquipmentPending] = useState(false)
  const home = data.homes.find((h) => h.id === homeId) ?? data.homes[0]
  const floor = home?.floors.find((f) => f.id === floorId) ?? home?.floors[0]
  const room = floor?.rooms.find((r) => r.id === roomId)
  const address = data.addresses.find((a) => a.id === home?.addressId)
  useClientFocusedFlow(Boolean(flow || confirm))
  useEffect(() => {
    headingRef.current?.focus()
  }, [flow?.type])
  useEffect(() => {
    if (!flow) return
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [flow])
  const unavailable = useCallback(() => {
    setGpuUnavailable(true)
    setListOnly(true)
  }, [])
  const clearFeedback = () => {
    setError('')
    setNotice('')
  }
  const closeFlow = () => {
    if (!busy) {
      setFlow(null)
      clearFeedback()
    }
  }
  function acceptHome(next: CustomerHome) {
    setData((current) => ({
      ...current,
      homes: current.homes.some((h) => h.id === next.id)
        ? current.homes.map((h) => (h.id === next.id ? next : h))
        : [...current.homes, next]
    }))
    setHomeId(next.id)
    setFloorId((current) =>
      next.floors.some((f) => f.id === current) ? current : (next.floors[0]?.id ?? '')
    )
    setRoomId((current) =>
      next.floors.some((f) => f.rooms.some((r) => r.id === current)) ? current : null
    )
  }
  async function mutation(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    clearFeedback()
    try {
      await action()
    } catch (err) {
      if (
        err instanceof PrivateRequestError &&
        err.status < 500 &&
        ![401, 408, 409, 429].includes(err.status)
      ) {
        creationAttempt.current = null
        equipmentAttempt.current = null
        setCreationPending(false)
        setEquipmentPending(false)
      }
      setError(assetError(err))
    } finally {
      setBusy(false)
    }
  }
  async function persist(next: CustomerHome, success: string) {
    const parsed = saveHomeSchema.safeParse(homePayload(next))
    if (!parsed.success)
      throw new Error(parsed.error.issues[0]?.message || 'Revisá la distribución del hogar.')
    const result = await assetRequest<{ home: CustomerHome }>(
      '/api/customer/homes',
      'PUT',
      parsed.data
    )
    acceptHome(result.home)
    setFlow(null)
    setConfirm(null)
    setNotice(success)
  }
  async function reload() {
    await mutation(async () => {
      const next = await assetRequest<CustomerHomesSnapshot>('/api/customer/homes')
      setData(next)
      setFlow(null)
      setConfirm(null)
      const selected = next.homes.find((h) => h.id === home?.id) ?? next.homes[0]
      setHomeId(selected?.id ?? '')
      setFloorId(
        selected?.floors.find((f) => f.id === floor?.id)?.id ?? selected?.floors[0]?.id ?? ''
      )
      setRoomId(null)
      setNotice('Hogar actualizado.')
    })
  }
  function newHome() {
    clearFeedback()
    creationAttempt.current = null
    setCreationPending(false)
    setFlow({
      type: 'home',
      value: configuration(),
      key: uuid(),
      existing: false
    })
  }
  function newRoom() {
    if (!home || !floor) return
    clearFeedback()
    try {
      const next = addHomeRoom(floor, roomKindsForHome(home.kind)[0])
      setFlow({ type: 'room', value: next.rooms.at(-1)!, existing: false })
    } catch (err) {
      setError(assetError(err))
    }
  }
  function placeEquipment(item?: CustomerAssetEquipment) {
    if (!home || !floor) return
    if (item && !airTypes.some(([value]) => value === item.equipmentType)) return
    equipmentAttempt.current = null
    setEquipmentPending(false)
    const target = room ?? floor.rooms[0]
    if (!target) {
      setError('Añadí un ambiente en esta planta antes de ubicar un aire.')
      return
    }
    const existing = item ? home.placements.find((p) => p.equipmentId === item.id) : undefined
    const targetId =
      existing && floor.rooms.some((r) => r.id === existing.roomId) ? existing.roomId : target.id
    clearFeedback()
    setFlow({
      type: 'placement',
      value: existing
        ? { ...existing, roomId: targetId }
        : {
            equipmentId: item?.id ?? uuid(),
            roomId: targetId,
            wall: 'north',
            offset: 0.5,
            height: 2
          },
      key: uuid(),
      register: !item,
      equipment: {
        nickname: item?.nickname ?? '',
        equipmentType: airTypes.find(([value]) => value === item?.equipmentType)?.[0] ?? 'split',
        brand: item?.brand ?? '',
        model: item?.model ?? '',
        serialNumber: item?.serialNumber ?? '',
        frigorias: item?.frigorias ?? ''
      }
    })
  }
  const visibleEquipment = useMemo(
    () =>
      home
        ? equipmentForHome(home, data.equipment).filter(
            (e) =>
              !data.homes.some(
                (h) => h.id !== home.id && h.placements.some((p) => p.equipmentId === e.id)
              )
          )
        : [],
    [home, data.equipment, data.homes]
  )
  const shownEquipment = room
    ? visibleEquipment.filter((e) =>
        home!.placements.some((p) => p.equipmentId === e.id && p.roomId === room.id)
      )
    : visibleEquipment
  const allRooms = home?.floors.flatMap((f) => f.rooms) ?? []
  const placementRoom =
    flow?.type === 'placement' ? floor?.rooms.find((r) => r.id === flow.value.roomId) : undefined
  const sceneHome =
    home && flow?.type === 'room' && floor
      ? {
          ...home,
          floors: home.floors.map((f) =>
            f.id === floor.id
              ? {
                  ...f,
                  rooms: flow.existing
                    ? f.rooms.map((r) => (r.id === flow.value.id ? flow.value : r))
                    : [...f.rooms, flow.value]
                }
              : f
          )
        }
      : home
  const previewEquipment = useMemo(
    () =>
      flow?.type === 'placement' && flow.register
        ? [
            ...visibleEquipment,
            {
              id: flow.value.equipmentId,
              nickname: flow.equipment.nickname || 'Nuevo aire',
              addressId: home!.addressId,
              equipmentType: flow.equipment.equipmentType,
              brand: flow.equipment.brand,
              model: flow.equipment.model,
              serialNumber: null,
              frigorias: null,
              version: 1,
              createdAt: '',
              archivedAt: null
            }
          ]
        : visibleEquipment,
    [flow, home, visibleEquipment]
  )
  const sceneEquipment = useMemo(
    () =>
      previewEquipment.filter((item) => airTypes.some(([value]) => value === item.equipmentType)),
    [previewEquipment]
  )
  const title =
    flow?.type === 'home'
      ? flow.existing
        ? 'Configurar hogar'
        : 'Nuevo hogar'
      : flow?.type === 'floor'
        ? flow.existing
          ? 'Editar planta'
          : 'Nueva planta'
        : flow?.type === 'room'
          ? flow.existing
            ? 'Editar ambiente'
            : 'Nuevo ambiente'
          : flow?.type === 'placement'
            ? flow.register
              ? 'Añadir aire acondicionado'
              : 'Ubicar aire acondicionado'
            : (room?.name ?? 'Mi hogar')

  async function saveConfiguration(value: HomeConfig, newAddress?: Record<string, unknown>) {
    await mutation(async () => {
      if (flow?.type !== 'home') return
      const addressId = value.addressId
      if (flow.existing && home)
        await persist(
          {
            ...home,
            ...value,
            addressId,
            building: value.kind === 'apartment' ? value.building : null
          },
          'Configuración guardada.'
        )
      else {
        if (creationAttempt.current?.key !== flow.key) {
          const floors = value.suggested
            ? createHomePreset(value.kind, value.features)
            : [{ id: uuid(), name: 'Planta baja', order: 0, rooms: [] }]
          const parsed = createHomeSchema.safeParse({
            name: value.name,
            addressId: newAddress ? null : addressId,
            ...(newAddress ? { newAddress } : {}),
            kind: value.kind,
            building: value.kind === 'apartment' ? value.building : null,
            features: value.features,
            floors,
            placements: [],
            idempotencyKey: flow.key
          })
          if (!parsed.success)
            throw new Error(parsed.error.issues[0]?.message || 'Revisá los datos de tu hogar.')
          creationAttempt.current = { key: flow.key, input: parsed.data }
        }
        setCreationPending(true)
        const result = await assetRequest<{
          home: CustomerHome
          address?: CustomerAssetAddress
        }>('/api/customer/homes', 'POST', creationAttempt.current.input)
        creationAttempt.current = null
        setCreationPending(false)
        if (result.address)
          setData((current) => ({
            ...current,
            addresses: [
              ...current.addresses.filter((a) => a.id !== result.address!.id),
              result.address!
            ]
          }))
        acceptHome(result.home)
        setFlow(null)
        setNotice('Tu hogar quedó creado. Podés adaptar cada ambiente.')
        setRoomId(null)
      }
    })
  }
  return (
    <div className={styles.hogar} aria-busy={busy}>
      <header className={styles.header}>
        <div>
          {flow ? (
            <button type="button" className={styles.back} disabled={busy} onClick={closeFlow}>
              <ArrowLeft size={18} aria-hidden />
              Volver a Hogar
            </button>
          ) : (
            <p className={styles.kicker}>Tus espacios, conectados</p>
          )}
          <h1 ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          {!flow && <p className={styles.muted}>Un lugar para tus ambientes y tus equipos.</p>}
        </div>
        {!flow && home && (
          <button
            type="button"
            aria-label="Añadir otro hogar"
            className={styles.iconButton}
            disabled={busy}
            onClick={newHome}
          >
            <Plus size={20} aria-hidden />
          </button>
        )}
      </header>
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          {(error.includes('Los datos cambiaron') || creationPending || equipmentPending) && (
            <button type="button" className={styles.secondary} disabled={busy} onClick={reload}>
              Recargar Hogar
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className={styles.success}>
          {notice}
        </p>
      )}
      {flow?.type === 'home' && (
        <HomeForm
          flow={flow}
          addresses={data.addresses}
          homes={data.homes}
          busy={busy}
          locked={creationPending}
          onChange={(value) => setFlow({ ...flow, value })}
          onCancel={closeFlow}
          onSave={saveConfiguration}
        />
      )}
      {!flow && !home && (
        <section className={styles.empty}>
          <div className={styles.emptySymbol}>
            <Home size={36} aria-hidden />
          </div>
          <h2>Tu hogar, a tu manera</h2>
          <p>
            Organizá tu casa, departamento u oficina. Creá sus ambientes y ubicá tus aires para
            tener todo a mano.
          </p>
          <button type="button" className={styles.primary} disabled={busy} onClick={newHome}>
            <Plus size={18} aria-hidden />
            Crear mi primer hogar
          </button>
          <p className={styles.small}>
            La vista 3D es orientativa. No necesitás conocer las medidas reales.
          </p>
          {data.equipment.length > 0 && (
            <Link className={styles.textLink} href="/app/equipos">
              Ver mis equipos registrados
              <ChevronRight size={16} aria-hidden />
            </Link>
          )}
        </section>
      )}
      {home && !flow && (
        <>
          <section className={styles.homeSelector} aria-label="Hogar seleccionado">
            <div className={styles.homeMark}>
              {home.kind === 'house' || home.kind === 'ph' ? (
                <Home size={24} aria-hidden />
              ) : (
                <Building2 size={24} aria-hidden />
              )}
            </div>
            <div className={styles.selectorContent}>
              <label className={styles.srOnly} htmlFor="hogar-select">
                Hogar actual
              </label>
              <select
                id="hogar-select"
                value={home.id}
                disabled={busy}
                onChange={(e) => {
                  const next = data.homes.find((h) => h.id === e.target.value)!
                  setHomeId(next.id)
                  setFloorId(next.floors[0]?.id ?? '')
                  setRoomId(null)
                  clearFeedback()
                }}
              >
                {data.homes.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
              <p>
                <MapPin size={13} aria-hidden />
                {addressLabel(address)}
              </p>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Configurar hogar"
              disabled={busy}
              onClick={() => {
                clearFeedback()
                setFlow({
                  type: 'home',
                  value: configuration(home),
                  key: uuid(),
                  existing: true
                })
              }}
            >
              <Pencil size={18} aria-hidden />
            </button>
          </section>
          <div className={styles.features}>
            <span>
              {HOME_KIND_OPTIONS.find((k) => k.value === home.kind)?.label}
              {home.kind === 'apartment' && home.building
                ? ` · Edificio ${home.building === 'low' ? 'bajo' : 'alto'}`
                : ''}
            </span>
            {home.features.balcony && <span>Balcón</span>}
            {home.features.terrace && <span>Terraza</span>}
            <span>
              Ventanas{' '}
              {home.features.windows === 'small'
                ? 'pequeñas'
                : home.features.windows === 'large'
                  ? 'grandes'
                  : 'mixtas'}
            </span>
          </div>
          <div className={styles.toolbar}>
            <div className={styles.floorPicker}>
              <Layers3 size={18} aria-hidden />
              <label className={styles.srOnly} htmlFor="floor-select">
                Planta actual
              </label>
              <select
                id="floor-select"
                value={floor?.id ?? ''}
                disabled={busy}
                onChange={(e) => {
                  setFloorId(e.target.value)
                  setRoomId(null)
                  clearFeedback()
                }}
              >
                {[...home.floors]
                  .sort((a, b) => a.order - b.order)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="button"
              className={styles.textButton}
              disabled={busy || home.floors.length >= 12}
              onClick={() => {
                clearFeedback()
                setFlow({
                  type: 'floor',
                  value: {
                    id: uuid(),
                    name: `Planta ${home.floors.length + 1}`,
                    order: home.floors.length,
                    rooms: []
                  },
                  existing: false
                })
              }}
            >
              <Plus size={16} aria-hidden />
              Planta
            </button>
            {floor && (
              <button
                type="button"
                className={styles.iconButton}
                disabled={busy}
                aria-label="Editar planta actual"
                onClick={() => {
                  clearFeedback()
                  setFlow({
                    type: 'floor',
                    value: structuredClone(floor),
                    existing: true
                  })
                }}
              >
                <Pencil size={16} aria-hidden />
              </button>
            )}
          </div>
        </>
      )}
      {sceneHome && floor && flow?.type !== 'home' && flow?.type !== 'floor' && (
        <>
          {room && !flow && (
            <button className={styles.back} type="button" onClick={() => setRoomId(null)}>
              <ArrowLeft size={18} aria-hidden />
              Volver a la planta
            </button>
          )}
          <div className={styles.sceneWrap}>
            {listOnly ? (
              <div className={styles.listPreview}>
                <DoorOpen size={30} aria-hidden />
                <h2>
                  {flow?.type === 'room'
                    ? flow.value.name
                    : (placementRoom?.name ?? room?.name ?? floor.name)}
                </h2>
                <p>
                  {gpuUnavailable
                    ? 'La vista 3D no está disponible en este dispositivo. Todos los cambios se pueden hacer desde los controles.'
                    : 'Vista de lista. Tus ambientes y equipos están abajo.'}
                </p>
                {!gpuUnavailable && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setListOnly(false)}
                  >
                    Volver a 3D
                  </button>
                )}
              </div>
            ) : (
              <HomeScene
                home={sceneHome}
                floorId={floor.id}
                roomId={flow?.type === 'room' ? flow.value.id : (placementRoom?.id ?? roomId)}
                focused={Boolean(room || flow?.type === 'placement' || flow?.type === 'room')}
                equipment={sceneEquipment}
                selectedEquipmentId={flow?.type === 'placement' ? flow.value.equipmentId : null}
                placementDraft={flow?.type === 'placement' ? flow.value : null}
                onSelectRoom={(id) => {
                  if (!flow) setRoomId(id)
                }}
                onSelectEquipment={(id) => {
                  if (!flow) {
                    const item = data.equipment.find((e) => e.id === id)
                    if (item) placeEquipment(item)
                  }
                }}
                onPlace={(patch) =>
                  setFlow((current) =>
                    current?.type === 'placement' && !equipmentPending
                      ? { ...current, value: { ...current.value, ...patch } }
                      : current
                  )
                }
                onUnavailable={unavailable}
              />
            )}
            {!flow && !listOnly && (
              <button type="button" className={styles.viewToggle} onClick={() => setListOnly(true)}>
                <List size={16} aria-hidden />
                Lista
              </button>
            )}
          </div>
          {!flow && (
            <p className={styles.sceneHint}>
              {room
                ? 'Explorá el ambiente o añadí un aire en sus paredes.'
                : 'Tocá un ambiente para entrar. Arrastrá para girar.'}
              <span>Vista orientativa · No es un plano técnico</span>
            </p>
          )}
        </>
      )}
      {home && floor && flow?.type === 'room' && (
        <RoomForm
          value={flow.value}
          home={home}
          busy={busy}
          existing={flow.existing}
          onChange={(value) => setFlow({ ...flow, value })}
          onCancel={closeFlow}
          onSave={(value) =>
            mutation(async () => {
              const features = {
                ...home.features,
                ...(value.kind === 'balcony' ? { balcony: true } : {}),
                ...(value.kind === 'terrace' ? { terrace: true } : {})
              }
              await persist(
                {
                  ...home,
                  features,
                  floors: home.floors.map((f) =>
                    f.id === floor.id
                      ? {
                          ...f,
                          rooms: flow.existing
                            ? f.rooms.map((r) => (r.id === value.id ? value : r))
                            : [...f.rooms, value]
                        }
                      : f
                  )
                },
                'Ambiente guardado.'
              )
            })
          }
        />
      )}
      {home && floor && flow?.type === 'floor' && (
        <FloorForm
          value={flow.value}
          floors={home.floors}
          busy={busy}
          existing={flow.existing}
          onCancel={closeFlow}
          onSave={(value, suggested) =>
            mutation(async () => {
              const nextFloors = home.floors
                .filter((f) => f.id !== value.id)
                .sort((a, b) => a.order - b.order)
              nextFloors.splice(value.order, 0, {
                ...value,
                rooms: flow.existing
                  ? value.rooms
                  : suggested
                    ? createHomeFloor(home.kind).rooms
                    : []
              })
              await persist(
                {
                  ...home,
                  floors: nextFloors.map((f, order) => ({ ...f, order }))
                },
                'Planta guardada.'
              )
              setFloorId(value.id)
              setRoomId(null)
            })
          }
          onRemove={
            flow.existing && home.floors.length > 1
              ? () =>
                  setConfirm({
                    title: '¿Quitar esta planta?',
                    description:
                      'Se quitarán sus ambientes y las ubicaciones. Los equipos y su historial se conservarán sin ubicar.',
                    action: () =>
                      persist(
                        removeHomeFloor(home, flow.value.id),
                        'Planta quitada. Los equipos se conservaron.'
                      )
                  })
              : undefined
          }
        />
      )}
      {home && floor && flow?.type === 'placement' && (
        <PlacementForm
          flow={flow}
          rooms={floor.rooms}
          busy={busy}
          locked={equipmentPending}
          onChange={setFlow}
          onCancel={closeFlow}
          onSave={() =>
            mutation(async () => {
              if (flow.register) {
                if (equipmentAttempt.current?.key !== flow.key) {
                  const parsed = addHomeEquipmentSchema.safeParse({
                    homeId: home.id,
                    expectedVersion: home.version,
                    idempotencyKey: flow.key,
                    equipment: {
                      ...flow.equipment,
                      frigorias: flow.equipment.frigorias ? Number(flow.equipment.frigorias) : null
                    },
                    placement: {
                      roomId: flow.value.roomId,
                      wall: flow.value.wall,
                      offset: flow.value.offset,
                      height: flow.value.height
                    }
                  })
                  if (!parsed.success)
                    throw new Error(parsed.error.issues[0]?.message || 'Revisá los datos del aire.')
                  equipmentAttempt.current = { key: flow.key, input: parsed.data }
                }
                setEquipmentPending(true)
                const result = await assetRequest<{
                  home: CustomerHome
                  equipment: CustomerAssetEquipment
                }>('/api/customer/homes/equipment', 'POST', equipmentAttempt.current.input)
                equipmentAttempt.current = null
                setEquipmentPending(false)
                acceptHome(result.home)
                setData((current) => ({
                  ...current,
                  equipment: [
                    ...current.equipment.filter((e) => e.id !== result.equipment.id),
                    result.equipment
                  ]
                }))
                setFlow(null)
                setNotice('Aire registrado y ubicado.')
                setRoomId(flow.value.roomId)
              } else {
                await persist(
                  {
                    ...home,
                    placements: [
                      ...home.placements.filter((p) => p.equipmentId !== flow.value.equipmentId),
                      flow.value
                    ]
                  },
                  'Ubicación guardada.'
                )
                setRoomId(flow.value.roomId)
              }
            })
          }
        />
      )}
      {home && floor && !flow && (
        <div className={styles.content}>
          <section aria-label="Ambientes de la planta" className={styles.rooms}>
            <div className={styles.sectionHeading}>
              <h2>
                {room ? 'Este ambiente' : 'Ambientes'}
                <span>{room ? '' : floor.rooms.length}</span>
              </h2>
              <button
                type="button"
                className={styles.textButton}
                disabled={busy || floor.rooms.length >= 60}
                onClick={newRoom}
              >
                <Plus size={16} aria-hidden />
                Añadir
              </button>
            </div>
            {!floor.rooms.length && (
              <p className={styles.emptyRow}>Esta planta todavía no tiene ambientes.</p>
            )}
            {(room ? [room] : floor.rooms).map((r) => (
              <article className={styles.roomRow} key={r.id}>
                <button
                  type="button"
                  aria-label={`Abrir ${r.name}`}
                  onClick={() => setRoomId(r.id)}
                  className={styles.roomButton}
                >
                  <span className={styles.roomIcon}>
                    <DoorOpen size={20} aria-hidden />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <small>
                      {ROOM_CATALOG[r.kind].variants.find((v) => v.value === r.variant)?.label} ·{' '}
                      {home.placements.filter((p) => p.roomId === r.id).length} aires
                    </small>
                  </span>
                  <ChevronRight size={17} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Editar ${r.name}`}
                  className={styles.iconButton}
                  disabled={busy}
                  onClick={() => {
                    clearFeedback()
                    setFlow({ type: 'room', value: { ...r }, existing: true })
                  }}
                >
                  <Pencil size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Quitar ${r.name}`}
                  className={styles.iconButton}
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      title: `¿Quitar ${r.name}?`,
                      description:
                        'Sus equipos quedarán sin ubicar. No se borrarán ni perderán su historial.',
                      action: () =>
                        persist(
                          removeHomeRoom(home, r.id),
                          'Ambiente quitado. Sus equipos se conservaron.'
                        )
                    })
                  }
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </article>
            ))}
          </section>
          <section aria-label="Aires del hogar" className={styles.equipment}>
            <div className={styles.sectionHeading}>
              <h2>
                {room ? 'Aires en este ambiente' : 'Tus aires'}
                <span>{shownEquipment.length}</span>
              </h2>
              <button
                type="button"
                className={styles.textButton}
                disabled={busy || !floor.rooms.length || home.placements.length >= 500}
                onClick={() => placeEquipment()}
              >
                <Plus size={16} aria-hidden />
                Añadir aire
              </button>
            </div>
            {home.placements.length >= 500 && (
              <p className={styles.small}>
                Llegaste al límite de 500 aires ubicados en este hogar. Podés reubicar o quitar una
                ubicación antes de añadir otro.
              </p>
            )}
            {!shownEquipment.length && (
              <div className={styles.emptyRow}>
                <Snowflake size={24} aria-hidden />
                <p>
                  {room
                    ? 'Este ambiente todavía no tiene aires ubicados.'
                    : 'Registrá un aire o ubicá uno que ya tengas.'}
                </p>
                {room &&
                  visibleEquipment.some(
                    (e) => !home.placements.some((p) => p.equipmentId === e.id)
                  ) && (
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setRoomId(null)}
                    >
                      Ver aires sin ubicar
                    </button>
                  )}
              </div>
            )}
            {shownEquipment.map((item) => {
              const placement = home.placements.find((p) => p.equipmentId === item.id)
              const location = allRooms.find((r) => r.id === placement?.roomId)
              const level = home.floors.find((f) => f.rooms.some((r) => r.id === location?.id))
              return (
                <article key={item.id} className={styles.equipmentRow}>
                  <div className={styles.airIcon}>
                    <Snowflake size={22} aria-hidden />
                  </div>
                  <div className={styles.equipmentInfo}>
                    <h3>{item.nickname}</h3>
                    <p>
                      {[
                        airTypes.find(([value]) => value === item.equipmentType)?.[1] ??
                          'Aire acondicionado',
                        item.brand,
                        item.model
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <span className={placement ? styles.located : styles.unplaced}>
                      {location
                        ? `${location.name}${level && home.floors.length > 1 ? ` · ${level.name}` : ''}`
                        : 'Sin ubicar'}
                    </span>
                    {!airTypes.some(([value]) => value === item.equipmentType) && (
                      <p className={styles.small}>
                        Este aire no tiene un tipo compatible para la vista 3D. Podés consultar su
                        ficha e historial.
                      </p>
                    )}
                    <div className={styles.equipmentActions}>
                      <button
                        type="button"
                        className={styles.textButton}
                        aria-label={`${placement ? 'Reubicar' : 'Ubicar'} ${item.nickname}`}
                        disabled={
                          busy ||
                          !floor.rooms.length ||
                          (!placement && home.placements.length >= 500) ||
                          !airTypes.some(([value]) => value === item.equipmentType)
                        }
                        onClick={() => placeEquipment(item)}
                      >
                        {placement ? 'Reubicar' : 'Ubicar'}
                        <ChevronRight size={14} aria-hidden />
                      </button>
                      <Link
                        aria-label={`Historial de ${item.nickname}`}
                        href={`/app/equipos/${item.id}`}
                        className={styles.textLink}
                      >
                        Historial
                      </Link>
                      {placement && (
                        <button
                          type="button"
                          className={styles.textButton}
                          aria-label={`Quitar ubicación de ${item.nickname}`}
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              title: '¿Quitar la ubicación?',
                              description:
                                'El aire quedará sin ubicar. Su ficha y su historial se conservarán.',
                              action: () =>
                                persist(
                                  {
                                    ...home,
                                    placements: home.placements.filter(
                                      (p) => p.equipmentId !== item.id
                                    )
                                  },
                                  'Ubicación quitada.'
                                )
                            })
                          }
                        >
                          Sin ubicar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        </div>
      )}
      {home && !flow && (
        <footer className={styles.footer}>
          <Link href="/app/direcciones">Gestionar direcciones</Link>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              setConfirm({
                title: '¿Archivar este hogar?',
                description:
                  'Se ocultará este hogar, pero sus equipos, direcciones y servicios anteriores se conservarán.',
                action: async () => {
                  await assetRequest('/api/customer/homes', 'DELETE', {
                    id: home.id,
                    expectedVersion: home.version
                  })
                  setData((current) => ({
                    ...current,
                    homes: current.homes.filter((h) => h.id !== home.id)
                  }))
                  setHomeId('')
                  setFloorId('')
                  setRoomId(null)
                  setConfirm(null)
                  setNotice('Hogar archivado. El historial y los equipos se conservaron.')
                }
              })
            }
          >
            Archivar hogar
          </button>
          <button type="button" disabled={busy} onClick={reload}>
            <RotateCcw size={14} aria-hidden />
            Actualizar
          </button>
        </footer>
      )}
      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null)
        }}
        title={confirm?.title ?? ''}
        description={confirm?.description}
        className={styles.confirmDialog}
      >
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={styles.danger}
            disabled={busy}
            onClick={() => {
              if (confirm) void mutation(confirm.action)
            }}
          >
            {busy ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </Dialog>
    </div>
  )
}
