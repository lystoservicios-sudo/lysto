'use client'

import { useState, type FormEvent } from 'react'
import { Button, ButtonLink } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { FormFeedback } from './states'
import { CustomerEquipmentPhotos } from './customer-equipment-photos'
import { assetRequest, assetError, type AssetPage } from '@/lib/customer-assets/client'
import {
  equipmentInputSchema,
  type CustomerAssetAddress,
  type CustomerAssetEquipment
} from '@/lib/customer-assets/contracts'

const blank = {
  nickname: '',
  addressId: '',
  equipmentType: 'split',
  brand: '',
  model: '',
  serialNumber: '',
  frigorias: ''
}
export function ConnectedCustomerEquipment({
  initialPage,
  initialAddresses
}: {
  initialPage: AssetPage<CustomerAssetEquipment>
  initialAddresses: AssetPage<CustomerAssetAddress>
}) {
  const [page, setPage] = useState(initialPage)
  const [addresses, setAddresses] = useState(initialAddresses)
  const [value, setValue] = useState(blank)
  const [selected, setSelected] = useState<CustomerAssetEquipment | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const parsed = equipmentInputSchema.safeParse({
      ...value,
      addressId: value.addressId || null,
      frigorias: value.frigorias ? Number(value.frigorias) : null
    })
    if (!parsed.success) {
      setFailed(true)
      setMessage('Revisá los datos del equipo.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const { equipment } = await assetRequest<{ equipment: CustomerAssetEquipment }>(
        '/api/equipment/register',
        'POST',
        parsed.data
      )
      setPage((current) => ({
        ...current,
        total: current.total + 1,
        items: [equipment, ...current.items]
      }))
      setSelected(equipment)
      setValue(blank)
      setFailed(false)
      setMessage('Equipo registrado. Ya podés agregar sus fotos.')
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  async function loadMore(kind: 'equipment' | 'addresses', more = true) {
    setBusy(true)
    try {
      if (kind === 'equipment') {
        const result = await assetRequest<AssetPage<CustomerAssetEquipment>>(
          `/api/customer/equipment${more && page.nextCursor ? `?cursor=${encodeURIComponent(page.nextCursor)}` : ''}`
        )
        setPage(
          more
            ? {
                ...result,
                items: [
                  ...page.items,
                  ...result.items.filter((item) => !page.items.some((old) => old.id === item.id))
                ]
              }
            : result
        )
        if (!more) setSelected(null)
      } else {
        const result = await assetRequest<AssetPage<CustomerAssetAddress>>(
          `/api/customer/addresses?cursor=${encodeURIComponent(addresses.nextCursor!)}`
        )
        setAddresses({
          ...result,
          items: [
            ...addresses.items,
            ...result.items.filter((item) => !addresses.items.some((old) => old.id === item.id))
          ]
        })
      }
      setFailed(false)
      setMessage('Información actualizada.')
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  async function archive(equipment: CustomerAssetEquipment) {
    setBusy(true)
    try {
      await assetRequest('/api/customer/equipment', 'DELETE', {
        id: equipment.id,
        expectedVersion: equipment.version
      })
      setPage((current) => ({
        ...current,
        total: current.total - 1,
        items: current.items.filter((item) => item.id !== equipment.id)
      }))
      if (selected?.id === equipment.id) setSelected(null)
      setFailed(false)
      setMessage('Equipo archivado. Su historial se conserva.')
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-5">
      <FormFeedback state={failed ? 'error' : 'success'} message={message} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3" aria-label="Equipos registrados">
          <h2 className="text-xl font-bold">Equipos registrados ({page.total})</h2>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => loadMore('equipment', false)}
          >
            Recargar equipos
          </Button>
          {!page.items.length ? (
            <p>Todavía no registraste equipos.</p>
          ) : (
            page.items.map((equipment) => (
              <article key={equipment.id} className="space-y-2 rounded-2xl border bg-white p-4">
                <h3 className="font-bold">{equipment.nickname}</h3>
                <p>
                  {[equipment.brand, equipment.model].filter(Boolean).join(' · ') ||
                    'Marca y modelo sin informar'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={'/app/equipos/' + equipment.id} size="sm" variant="secondary">
                    Ver historial de {equipment.nickname}
                  </ButtonLink>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setSelected(equipment)}
                  >
                    Fotos de {equipment.nickname}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => archive(equipment)}
                  >
                    Archivar {equipment.nickname}
                  </Button>
                </div>
              </article>
            ))
          )}
          {page.nextCursor ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => loadMore('equipment')}
            >
              Ver más equipos
            </Button>
          ) : null}
        </section>
        <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-bold">Registrar equipo</h2>
          <fieldset disabled={busy} className="space-y-4">
            {(
              [
                ['nickname', 'Nombre del equipo'],
                ['brand', 'Marca (opcional)'],
                ['model', 'Modelo (opcional)'],
                ['serialNumber', 'Número de serie (opcional)'],
                ['frigorias', 'Frigorías (opcional)']
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`equipment-${key}`}>{label}</Label>
                <Input
                  id={`equipment-${key}`}
                  required={key === 'nickname'}
                  maxLength={key === 'nickname' ? 100 : 200}
                  type={key === 'frigorias' ? 'number' : 'text'}
                  min={key === 'frigorias' ? 1000 : undefined}
                  max={key === 'frigorias' ? 30000 : undefined}
                  step={key === 'frigorias' ? 1 : undefined}
                  value={value[key]}
                  onChange={(event) =>
                    setValue((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="equipment-type">Tipo de equipo</Label>
              <select
                id="equipment-type"
                className="h-12 w-full rounded-xl border px-4"
                value={value.equipmentType}
                onChange={(event) =>
                  setValue((current) => ({ ...current, equipmentType: event.target.value }))
                }
              >
                {[
                  ['split', 'Split'],
                  ['inverter', 'Inverter'],
                  ['on_off', 'On/off'],
                  ['window', 'Ventana'],
                  ['floor_ceiling', 'Piso/techo'],
                  ['central', 'Central']
                ].map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment-address">Dirección del equipo</Label>
              <select
                id="equipment-address"
                className="h-12 w-full rounded-xl border px-4"
                value={value.addressId}
                onChange={(event) =>
                  setValue((current) => ({ ...current, addressId: event.target.value }))
                }
              >
                <option value="">Sin dirección asignada</option>
                {addresses.items.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label} · {address.street} {address.number}
                  </option>
                ))}
              </select>
              {addresses.nextCursor ? (
                <Button type="button" variant="ghost" onClick={() => loadMore('addresses')}>
                  Cargar más direcciones
                </Button>
              ) : null}
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando' : 'Registrar equipo'}
            </Button>
          </fieldset>
        </form>
      </div>
      {selected ? (
        <div className="space-y-4 rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-bold">{selected.nickname}</h2>
          <CustomerEquipmentPhotos key={selected.id} equipmentId={selected.id} />
        </div>
      ) : null}
    </div>
  )
}
