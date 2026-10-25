'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, MapPin, Snowflake } from 'lucide-react'
import { addressInputSchema, type CustomerAssetAddress } from '@/lib/customer-assets/contracts'
import {
  HOME_KIND_OPTIONS,
  ROOM_CATALOG,
  WALL_OPTIONS,
  type CustomerHome,
  type EquipmentPlacement,
  type HomeFeatures,
  type HomeFloor,
  type HomeKind,
  type HomeRoom,
  type RoomKind
} from '@/lib/customer-homes/contracts'
import { roomKindsForHome } from '@/lib/customer-homes/model'
import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'
import styles from './customer-hogar.module.css'

export const airTypes = [
  ['split', 'Split'],
  ['inverter', 'Inverter'],
  ['on_off', 'On/off'],
  ['window', 'De ventana'],
  ['floor_ceiling', 'Piso / techo'],
  ['central', 'Central']
] as const
export type HomeConfig = {
  name: string
  addressId: string
  kind: HomeKind
  building: 'low' | 'high' | null
  features: HomeFeatures
  suggested: boolean
}
export type HomeFlow =
  | { type: 'home'; value: HomeConfig; key: string; existing: boolean }
  | { type: 'floor'; value: HomeFloor; existing: boolean }
  | { type: 'room'; value: HomeRoom; existing: boolean }
  | {
      type: 'placement'
      value: EquipmentPlacement
      key: string
      register: boolean
      equipment: {
        nickname: string
        equipmentType: (typeof airTypes)[number][0]
        brand: string
        model: string
        serialNumber: string
        frigorias: string
      }
    }
export function configuration(home?: CustomerHome): HomeConfig {
  return home
    ? {
        name: home.name,
        addressId: home.addressId,
        kind: home.kind,
        building: home.building,
        features: { ...home.features },
        suggested: true
      }
    : {
        name: '',
        addressId: '',
        kind: 'apartment',
        building: 'low',
        features: { balcony: false, terrace: false, windows: 'large' },
        suggested: true
      }
}
export function addressLabel(address?: CustomerAssetAddress) {
  return address
    ? `${address.street} ${address.number}${address.floor ? ` · Piso ${address.floor}` : ''}${address.apartment ? ` · ${address.apartment}` : ''}, ${address.city}`
    : 'Dirección no disponible'
}
const blankAddress = {
  label: '',
  street: '',
  number: '',
  floor: '',
  apartment: '',
  city: '',
  province: '',
  postalCode: '',
  reference: '',
  access: {},
  propertyType: 'apartment' as CustomerAssetAddress['propertyType'],
  isDefault: false
}
export function HomeForm({
  flow,
  addresses,
  homes,
  busy,
  locked,
  onChange,
  onSave,
  onCancel
}: {
  flow: Extract<HomeFlow, { type: 'home' }>
  addresses: CustomerAssetAddress[]
  homes: CustomerHome[]
  busy: boolean
  locked: boolean
  onChange: (value: HomeConfig) => void
  onSave: (value: HomeConfig, newAddress?: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const value = flow.value
  const configuredHome = flow.existing
    ? homes.find((home) => home.addressId === value.addressId)
    : undefined
  const configuredRooms = configuredHome?.floors.flatMap((floor) => floor.rooms) ?? []
  const hasBalconyRoom = configuredRooms.some((room) => room.kind === 'balcony')
  const hasTerraceRoom = configuredRooms.some((room) => room.kind === 'terrace')
  const [newAddress, setNewAddress] = useState(blankAddress)
  const [locationProof, setLocationProof] = useState('')
  const [addressMode, setAddressMode] = useState<'existing' | 'new'>(
    addresses.some((a) => !homes.some((h) => h.addressId === a.id)) ? 'existing' : 'new'
  )
  const [formError, setFormError] = useState('')
  const savedAddress = useRef(value.addressId)
  useEffect(() => {
    if (value.addressId && value.addressId !== savedAddress.current) {
      savedAddress.current = value.addressId
      setAddressMode('existing')
    }
  }, [value.addressId])
  async function submit(event: FormEvent) {
    event.preventDefault()
    setFormError('')
    if (!flow.existing && addressMode === 'new' && !locationProof) {
      setFormError('Elegí una dirección de las opciones para confirmar la ubicación.')
      return
    }
    const candidate = {
      ...newAddress,
      label: newAddress.label || value.name,
      propertyType: value.kind === 'ph' ? ('house' as const) : value.kind
    }
    if (
      addressMode === 'new' &&
      !flow.existing &&
      !addressInputSchema.safeParse(candidate).success
    ) {
      setFormError('Completá calle, número, ciudad y provincia de la dirección.')
      return
    }
    if ((!value.addressId && addressMode !== 'new') || !value.name.trim()) {
      setFormError('Elegí una dirección y un nombre para tu hogar.')
      return
    }
    await onSave(value, !flow.existing && addressMode === 'new' ? { ...candidate, ...(locationProof ? { locationProof } : {}) } : undefined)
  }
  const patch = (part: Partial<HomeConfig>) => onChange({ ...value, ...part })
  return (
    <form onSubmit={submit} className={styles.form}>
      {formError && (
        <p role="alert" className={styles.error}>
          {formError}
        </p>
      )}
      {locked && (
        <p className={styles.small}>
          El guardado está pendiente de confirmar. Reintentar enviará exactamente los mismos datos y
          no creará un hogar duplicado.
        </p>
      )}
      <fieldset disabled={busy || locked}>
        <Field label="Nombre del hogar" id="home-name">
          <input
            id="home-name"
            required
            maxLength={80}
            value={value.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Por ejemplo, mi casa o la oficina"
          />
        </Field>
        <div className={styles.formGrid}>
          <Field label="Tipo de lugar" id="home-kind">
            <select
              id="home-kind"
              value={value.kind}
              onChange={(e) =>
                patch({
                  kind: e.target.value as HomeKind,
                  building: e.target.value === 'apartment' ? 'low' : null
                })
              }
              disabled={flow.existing}
            >
              {HOME_KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          {value.kind === 'apartment' && (
            <Field label="Tipo de edificio" id="home-building">
              <select
                id="home-building"
                value={value.building ?? 'low'}
                onChange={(e) => patch({ building: e.target.value as 'low' | 'high' })}
              >
                <option value="low">Edificio de pocos pisos</option>
                <option value="high">Edificio de muchos pisos</option>
              </select>
            </Field>
          )}
        </div>
        {flow.existing && (
          <p className={styles.small}>
            El tipo identifica este lugar. Para otro lugar, creá un hogar nuevo.
          </p>
        )}
        <fieldset className={styles.featureFields}>
          <legend>Características del lugar</legend>
          <label>
            <input
              type="checkbox"
              checked={value.features.balcony}
              disabled={hasBalconyRoom}
              aria-describedby={hasBalconyRoom ? 'home-balcony-explanation' : undefined}
              onChange={(e) =>
                patch({
                  features: { ...value.features, balcony: e.target.checked }
                })
              }
            />
            Tiene balcón
          </label>
          {hasBalconyRoom && (
            <p id="home-balcony-explanation" className={styles.small}>
              Para quitar esta característica, primero quitá o convertí el ambiente Balcón.
            </p>
          )}
          <label>
            <input
              type="checkbox"
              checked={value.features.terrace}
              disabled={hasTerraceRoom}
              aria-describedby={hasTerraceRoom ? 'home-terrace-explanation' : undefined}
              onChange={(e) =>
                patch({
                  features: { ...value.features, terrace: e.target.checked }
                })
              }
            />
            Tiene terraza
          </label>
          {hasTerraceRoom && (
            <p id="home-terrace-explanation" className={styles.small}>
              Para quitar esta característica, primero quitá o convertí el ambiente Terraza.
            </p>
          )}
          <Field label="Ventanas del hogar" id="home-windows">
            <select
              id="home-windows"
              value={value.features.windows}
              onChange={(e) =>
                patch({
                  features: {
                    ...value.features,
                    windows: e.target.value as HomeFeatures['windows']
                  }
                })
              }
            >
              <option value="small">Pequeñas</option>
              <option value="large">Grandes</option>
              <option value="mixed">Pequeñas y grandes</option>
            </select>
          </Field>
          <p className={styles.small}>
            Estas características son visuales. No cambian las condiciones de acceso ni el precio de
            los servicios.
          </p>
        </fieldset>
        {flow.existing ? (
          <div className={styles.addressSummary}>
            <MapPin size={18} aria-hidden />
            <div>
              <p>{addressLabel(addresses.find((a) => a.id === value.addressId))}</p>
              <Link href="/app/direcciones" className={styles.textLink}>
                Corregir datos de la dirección
              </Link>
            </div>
          </div>
        ) : (
          <>
            <fieldset className={styles.segment}>
              <legend>Dirección del hogar</legend>
              <label>
                <input
                  type="radio"
                  name="address-mode"
                  checked={addressMode === 'existing'}
                  onChange={() => setAddressMode('existing')}
                />
                Usar una dirección guardada
              </label>
              <label>
                <input
                  type="radio"
                  name="address-mode"
                  checked={addressMode === 'new'}
                  onChange={() => {
                    setAddressMode('new')
                    patch({ addressId: '' })
                  }}
                />
                Crear una dirección
              </label>
            </fieldset>
            {addressMode === 'existing' ? (
              <Field label="Dirección" id="home-address">
                <select
                  id="home-address"
                  required
                  value={value.addressId}
                  onChange={(e) => patch({ addressId: e.target.value })}
                >
                  <option value="">Elegí una dirección</option>
                  {addresses
                    .filter((a) => !a.archivedAt && !homes.some((h) => h.addressId === a.id))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} · {addressLabel(a)}
                      </option>
                    ))}
                </select>
              </Field>
            ) : (
              <>
                <ArgentineAddressFields
                  value={{ street: newAddress.street, number: newAddress.number, city: newAddress.city, province: newAddress.province }}
                  onChange={(location) => setNewAddress((current) => ({ ...current, ...location }))}
                  onProofChange={setLocationProof}
                  labels={{ street: 'Calle', number: 'Número', city: 'Ciudad', province: 'Provincia' }}
                  idPrefix="new-address"
                  groupClassName={styles.formGrid}
                  fieldClassName={styles.field}
                  disabled={busy || locked}
                  after={{
                    number: <>{([['floor', 'Piso de la dirección', 100], ['apartment', 'Departamento / unidad', 100]] as const).map(([key, label, max]) => <Field key={key} label={label} id={`new-address-${key}`}><input id={`new-address-${key}`} maxLength={max} value={newAddress[key]} onChange={(e) => setNewAddress({ ...newAddress, [key]: e.target.value })} /></Field>)}</>,
                    province: <>{([['postalCode', 'Código postal', 30], ['reference', 'Referencia', 500]] as const).map(([key, label, max]) => <Field key={key} label={label} id={`new-address-${key}`}><input id={`new-address-${key}`} maxLength={max} value={newAddress[key]} onChange={(e) => setNewAddress({ ...newAddress, [key]: e.target.value })} /></Field>)}</>
                  }}
                />
              </>
            )}
            <p className={styles.small}>
              El piso de la dirección no define las plantas internas del hogar.
            </p>
            <Field label="Distribución inicial" id="home-preset">
              <select
                id="home-preset"
                value={value.suggested ? 'suggested' : 'empty'}
                onChange={(e) => patch({ suggested: e.target.value === 'suggested' })}
              >
                <option value="suggested">Empezar con ambientes sugeridos</option>
                <option value="empty">Empezar con una planta vacía</option>
              </select>
            </Field>
            <p className={styles.small}>
              La propuesta se adapta al tipo de lugar. Podés cambiar cada ambiente después.
            </p>
          </>
        )}
      </fieldset>
      <FormActions
        busy={busy}
        cancelDisabled={locked}
        label={
          flow.existing ? 'Guardar configuración' : locked ? 'Reintentar creación' : 'Crear hogar'
        }
        onCancel={onCancel}
      />
    </form>
  )
}

export function RoomForm({
  value,
  home,
  busy,
  existing,
  onChange,
  onSave,
  onCancel
}: {
  value: HomeRoom
  home: CustomerHome
  busy: boolean
  existing: boolean
  onChange: (value: HomeRoom) => void
  onSave: (value: HomeRoom) => Promise<void>
  onCancel: () => void
}) {
  const patch = (part: Partial<HomeRoom>) => onChange({ ...value, ...part })
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void onSave(value)
      }}
    >
      <fieldset disabled={busy}>
        <Field label="Nombre del ambiente" id="room-name">
          <input
            id="room-name"
            required
            maxLength={80}
            value={value.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <div className={styles.formGrid}>
          <Field label="Tipo de ambiente" id="room-kind">
            <select
              id="room-kind"
              value={value.kind}
              onChange={(e) => {
                const kind = e.target.value as RoomKind
                patch({
                  kind,
                  variant: ROOM_CATALOG[kind].variants[0].value,
                  name: !existing ? ROOM_CATALOG[kind].label : value.name
                })
              }}
            >
              {roomKindsForHome(home.kind).map((kind) => (
                <option key={kind} value={kind}>
                  {ROOM_CATALOG[kind].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Variante" id="room-variant">
            <select
              id="room-variant"
              value={value.variant}
              onChange={(e) => patch({ variant: e.target.value })}
            >
              {ROOM_CATALOG[value.kind].variants.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Ventanas del ambiente" id="room-windows">
          <select
            id="room-windows"
            value={value.windows}
            onChange={(e) => patch({ windows: e.target.value as HomeRoom['windows'] })}
          >
            <option value="none">Sin ventanas</option>
            <option value="small">Pequeñas</option>
            <option value="large">Grandes</option>
          </select>
        </Field>
        <h2 className={styles.formSection}>Distribución orientativa</h2>
        <p className={styles.small}>
          Ajustá el tamaño y la ubicación dentro de la planta. Son proporciones de la maqueta, no
          medidas reales.
        </p>
        <div className={styles.formGrid}>
          {(
            [
              ['width', 'Ancho', 2, 12],
              ['depth', 'Profundidad', 2, 12],
              ['x', 'Posición horizontal', -80, 80],
              ['z', 'Posición vertical', -80, 80]
            ] as const
          ).map(([key, label, min, max]) => (
            <Field key={key} label={label} id={`room-${key}`}>
              <input
                id={`room-${key}`}
                type="number"
                step="0.01"
                min={min}
                max={max}
                required
                value={value[key]}
                onChange={(e) => patch({ [key]: Number(e.target.value) })}
              />
            </Field>
          ))}
          <Field label="Orientación" id="room-rotation">
            <select
              id="room-rotation"
              value={value.rotation}
              onChange={(e) =>
                patch({
                  rotation: Number(e.target.value) as HomeRoom['rotation']
                })
              }
            >
              {[0, 90, 180, 270].map((v) => (
                <option key={v} value={v}>
                  {v}°
                </option>
              ))}
            </select>
          </Field>
        </div>
        <FormActions busy={busy} label="Guardar ambiente" onCancel={onCancel} />
      </fieldset>
    </form>
  )
}
export function FloorForm({
  value,
  floors,
  busy,
  existing,
  onCancel,
  onSave,
  onRemove
}: {
  value: HomeFloor
  floors: HomeFloor[]
  busy: boolean
  existing: boolean
  onCancel: () => void
  onSave: (value: HomeFloor, suggested: boolean) => Promise<void>
  onRemove?: () => void
}) {
  const [draft, setDraft] = useState(value)
  const [suggested, setSuggested] = useState(false)
  const count = floors.length + (existing ? 0 : 1)
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void onSave(draft, suggested)
      }}
    >
      <fieldset disabled={busy}>
        <Field label="Nombre de la planta" id="floor-name">
          <input
            id="floor-name"
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Orden de la planta" id="floor-order">
          <select
            id="floor-order"
            value={draft.order}
            onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
          >
            {Array.from({ length: count }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? 'Primera planta' : `Planta ${i + 1}`}
              </option>
            ))}
          </select>
        </Field>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={draft.order === 0}
            onClick={() => setDraft({ ...draft, order: draft.order - 1 })}
          >
            <ArrowUp size={16} aria-hidden />
            Subir
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={draft.order === count - 1}
            onClick={() => setDraft({ ...draft, order: draft.order + 1 })}
          >
            <ArrowDown size={16} aria-hidden />
            Bajar
          </button>
        </div>
        {!existing && (
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={suggested}
              onChange={(e) => setSuggested(e.target.checked)}
            />
            Empezar con ambientes sugeridos
          </label>
        )}
        <p className={styles.small}>
          Cada planta se muestra por separado. Cambiar el orden no cambia la dirección postal.
        </p>
        <FormActions busy={busy} label="Guardar planta" onCancel={onCancel} />
        {onRemove && (
          <button type="button" className={styles.textDanger} onClick={onRemove}>
            Quitar planta
          </button>
        )}
      </fieldset>
    </form>
  )
}
export function PlacementForm({
  flow,
  rooms,
  busy,
  locked,
  onChange,
  onCancel,
  onSave
}: {
  flow: Extract<HomeFlow, { type: 'placement' }>
  /** Optional location controls for embedded flows that still use the form. */
  rooms?: HomeRoom[]
  busy: boolean
  locked: boolean
  onChange: (flow: HomeFlow) => void
  onCancel: () => void
  onSave: () => Promise<void>
}) {
  const patch = (part: Partial<EquipmentPlacement>) =>
    onChange({ ...flow, value: { ...flow.value, ...part } })
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        void onSave()
      }}
    >
      {locked && (
        <p className={styles.small}>
          El registro está pendiente de confirmar. Reintentar enviará los mismos datos y no
          duplicará el aire.
        </p>
      )}
      <fieldset disabled={busy || locked}>
        {flow.register ? (
          <>
            <h2 className={styles.formSection}>Datos del aire</h2>
            <div className={styles.formGrid}>
              <Field label="Nombre del aire" id="air-name">
                <input
                  id="air-name"
                  required
                  maxLength={100}
                  value={flow.equipment.nickname}
                  onChange={(e) =>
                    onChange({
                      ...flow,
                      equipment: {
                        ...flow.equipment,
                        nickname: e.target.value
                      }
                    })
                  }
                  placeholder="Por ejemplo, aire del living"
                />
              </Field>
              <Field label="Tipo de aire" id="air-type">
                <select
                  id="air-type"
                  value={flow.equipment.equipmentType}
                  onChange={(e) =>
                    onChange({
                      ...flow,
                      equipment: {
                        ...flow.equipment,
                        equipmentType: e.target.value as typeof flow.equipment.equipmentType
                      }
                    })
                  }
                >
                  {airTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {(
                [
                  ['brand', 'Marca'],
                  ['model', 'Modelo'],
                  ['serialNumber', 'Número de serie']
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={`${label} (opcional)`} id={`air-${key}`}>
                  <input
                    id={`air-${key}`}
                    maxLength={200}
                    value={flow.equipment[key]}
                    onChange={(e) =>
                      onChange({
                        ...flow,
                        equipment: { ...flow.equipment, [key]: e.target.value }
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Frigorías (opcional)" id="air-frigorias">
                <input
                  id="air-frigorias"
                  type="number"
                  min={1000}
                  max={30000}
                  value={flow.equipment.frigorias}
                  onChange={(e) =>
                    onChange({
                      ...flow,
                      equipment: {
                        ...flow.equipment,
                        frigorias: e.target.value
                      }
                    })
                  }
                />
              </Field>
            </div>
          </>
        ) : (
          <p className={styles.selectedAir}>
            <Snowflake size={20} aria-hidden />
            {flow.equipment.nickname}
          </p>
        )}
        {rooms && <>
        <h2 className={styles.formSection}>Ubicación en el ambiente</h2>
        <p className={styles.small}>
          Tocá una pared o usá estos controles. Solo se guardará cuando confirmes.
        </p>
        <div className={styles.formGrid}>
          <Field label="Ambiente" id="placement-room">
            <select
              id="placement-room"
              value={flow.value.roomId}
              onChange={(e) => patch({ roomId: e.target.value })}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pared" id="placement-wall">
            <select
              id="placement-wall"
              value={flow.value.wall}
              onChange={(e) => patch({ wall: e.target.value as EquipmentPlacement['wall'] })}
            >
              {WALL_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Posición sobre la pared" id="placement-offset">
          <input
            id="placement-offset"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={flow.value.offset}
            onChange={(e) => patch({ offset: Number(e.target.value) })}
          />
          <div className={styles.rangeLabels}>
            <span>Izquierda</span>
            <output htmlFor="placement-offset">{Math.round(flow.value.offset * 100)}%</output>
            <span>Derecha</span>
          </div>
        </Field>
        <Field label="Altura orientativa" id="placement-height">
          <input
            id="placement-height"
            type="range"
            min={0.35}
            max={2.5}
            step={0.05}
            value={flow.value.height}
            onChange={(e) => patch({ height: Number(e.target.value) })}
          />
          <div className={styles.rangeLabels}>
            <span>Baja</span>
            <span>Alta</span>
          </div>
        </Field>
        {flow.equipment.equipmentType === 'central' && (
          <p className={styles.small}>El sistema central se representa en el techo del ambiente.</p>
        )}
        {flow.equipment.equipmentType === 'floor_ceiling' && (
          <p className={styles.small}>
            La altura baja representa montaje de piso; la alta, montaje de techo.
          </p>
        )}
        <p className={styles.small}>
          La ubicación es una referencia visual, no certifica la instalación ni las condiciones de
          acceso.
        </p>
        </>}
      </fieldset>
      <FormActions
        busy={busy}
        label={flow.register ? 'Registrar y ubicar aire' : 'Guardar ubicación'}
        cancelDisabled={locked}
        onCancel={onCancel}
      />
    </form>
  )
}
function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  )
}
function FormActions({
  busy,
  cancelDisabled = false,
  label,
  onCancel
}: {
  busy: boolean
  cancelDisabled?: boolean
  label: string
  onCancel: () => void
}) {
  return (
    <div className={styles.formActions}>
      <button
        type="button"
        className={styles.secondary}
        disabled={busy || cancelDisabled}
        onClick={onCancel}
      >
        Cancelar
      </button>
      <button type="submit" className={styles.primary} disabled={busy}>
        {busy ? 'Guardando…' : label}
      </button>
    </div>
  )
}
