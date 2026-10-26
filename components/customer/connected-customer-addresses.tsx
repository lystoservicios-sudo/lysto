'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { FormFeedback } from './states'
import { assetError, assetRequest, type AssetPage } from '@/lib/customer-assets/client'
import { addressInputSchema, type CustomerAssetAddress } from '@/lib/customer-assets/contracts'
import { moreStyles } from './more/more-ui'
import { ArgentineAddressFields } from '@/components/location/argentine-address-fields'
import styles from './customer-secondary.module.css'

const blankAddress: CustomerAssetAddress = {
  id: '',
  version: 0,
  createdAt: '',
  archivedAt: null,
  label: '',
  street: '',
  number: '',
  city: '',
  province: '',
  propertyType: 'apartment',
  isDefault: false,
  access: {}
}
const fields = [
  ['label', 'Nombre de la dirección', 80, true],
  ['floor', 'Piso', 100, false],
  ['apartment', 'Departamento', 100, false],
  ['postalCode', 'Código postal', 30, false],
  ['reference', 'Referencia', 500, false]
] as const
const accessFields = [
  ['hasElevator', 'Tiene ascensor'],
  ['hasParking', 'Tiene estacionamiento'],
  ['stairsRequired', 'Requiere escaleras'],
  ['outdoorUnitAtHeight', 'Unidad exterior en altura'],
  ['outdoorUnitOnBalcony', 'Unidad exterior en balcón'],
  ['difficultAccess', 'Acceso difícil']
] as const

export function ConnectedCustomerAddresses({
  initialPage
}: {
  initialPage: AssetPage<CustomerAssetAddress>
}) {
  const [page, setPage] = useState(initialPage)
  const [value, setValue] = useState<CustomerAssetAddress>(blankAddress)
  const [locationProof, setLocationProof] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  async function reload(more = false) {
    setBusy(true)
    try {
      const next = await assetRequest<AssetPage<CustomerAssetAddress>>(
        `/api/customer/addresses${more && page.nextCursor ? `?cursor=${encodeURIComponent(page.nextCursor)}` : ''}`
      )
      setPage(
        more
          ? {
              ...next,
              items: [
                ...page.items,
                ...next.items.filter((item) => !page.items.some((old) => old.id === item.id))
              ]
            }
          : next
      )
      if (!more) {
        setValue(blankAddress)
        setLocationProof('')
        setMessage('Direcciones actualizadas.')
        setFailed(false)
      }
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const savedAddress = page.items.find((address) => address.id === value.id)
    const unchangedLocation = savedAddress && (['street', 'number', 'city', 'province'] as const)
      .every((field) => savedAddress[field] === value[field])
    if (!locationProof && !unchangedLocation) {
      setFailed(true)
      setMessage('Elegí la provincia y seleccioná una dirección de la lista para continuar.')
      return
    }
    const parsed = addressInputSchema.safeParse(
      Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => !['id', 'version', 'createdAt', 'archivedAt'].includes(key)
        )
      )
    )
    if (!parsed.success) {
      setFailed(true)
      setMessage('Completá los datos obligatorios de la dirección.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await assetRequest<{ address: CustomerAssetAddress }>(
        '/api/customer/addresses',
        value.id ? 'PUT' : 'POST',
        { ...parsed.data, locationProof, ...(value.id ? { id: value.id, expectedVersion: value.version } : {}) }
      )
      setValue(result.address)
      setLocationProof('')
      setFailed(false)
      setMessage('La dirección quedó guardada.')
      // A new default also changes the previous default's version.
      try {
        setPage(await assetRequest<AssetPage<CustomerAssetAddress>>('/api/customer/addresses'))
      } catch {
        setMessage('La dirección quedó guardada. Recargá para actualizar el listado.')
      }
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  async function archive(address: CustomerAssetAddress) {
    setBusy(true)
    setMessage('')
    try {
      await assetRequest('/api/customer/addresses', 'DELETE', {
        id: address.id,
        expectedVersion: address.version
      })
      setPage((current) => ({
        ...current,
        total: current.total - 1,
        items: current.items.filter((item) => item.id !== address.id)
      }))
      if (value.id === address.id) { setValue(blankAddress); setLocationProof('') }
      setFailed(false)
      setMessage('Dirección archivada. Los servicios anteriores conservan sus datos.')
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.stack}>
      <FormFeedback state={failed ? 'error' : 'success'} message={message} />
      <div className={moreStyles.actions}>
        <Button
          className={moreStyles.primary}
          type="button"
          disabled={busy}
          onClick={() => {
            setValue(blankAddress)
            setLocationProof('')
            setMessage('')
          }}
        >
          Nueva dirección
        </Button>
        <Button className={moreStyles.secondary} type="button" variant="secondary" disabled={busy} onClick={() => reload()}>
          Recargar direcciones
        </Button>
      </div>
      <p className={moreStyles.muted}>
        Recargar o elegir otra dirección reemplaza los cambios que todavía no guardaste.
      </p>
      <div className={styles.assetLayout}>
        <section aria-label="Direcciones registradas" className={styles.assetSection}>
          <h2 className={styles.heading}>Direcciones registradas ({page.total})</h2>
          {page.items.length === 0 ? (
            <p className={moreStyles.muted}>Todavía no registraste direcciones.</p>
          ) : (
            page.items.map((address) => (
              <article key={address.id} className={styles.assetRow}>
                <h3>
                  {address.label}
                  {address.isDefault ? ' · Principal' : ''}
                </h3>
                <p>
                  {address.street} {address.number}, {address.city}
                </p>
                <div className={moreStyles.actions}>
                  <Button
                    className={moreStyles.secondary}
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setValue(address)
                      setLocationProof('')
                      setMessage('')
                    }}
                  >
                    Editar {address.label}
                  </Button>
                  <Button
                    className={moreStyles.textAction}
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => archive(address)}
                  >
                    Archivar {address.label}
                  </Button>
                </div>
              </article>
            ))
          )}
          {page.nextCursor ? (
            <Button className={moreStyles.textAction} type="button" variant="secondary" disabled={busy} onClick={() => reload(true)}>
              Ver más direcciones
            </Button>
          ) : null}
        </section>
        <form onSubmit={save} className={styles.assetForm}>
          <h2 className={styles.heading}>
            {value.id ? 'Editar dirección' : 'Agregar dirección'}
          </h2>
          <fieldset disabled={busy} className={moreStyles.form}>
            <div className={styles.fields}>
              <div className={moreStyles.field}>
                <Label htmlFor="address-label">Nombre de la dirección *</Label>
                <Input id="address-label" required maxLength={80} value={value.label}
                  onChange={(event) => setValue((current) => ({ ...current, label: event.target.value }))} />
              </div>
            </div>
            <ArgentineAddressFields
                value={{ street: value.street, number: value.number, city: value.city, province: value.province }}
                onChange={(location) => setValue((current) => ({ ...current, ...location }))}
                onProofChange={setLocationProof}
                labels={{ street: 'Calle *', number: 'Número *', city: 'Ciudad *', province: 'Provincia *' }}
                idPrefix="address-location"
                revisionKey={value.id || 'new'}
                groupClassName={styles.fields}
                fieldClassName={moreStyles.field}
                disabled={busy}
                after={{
                  number: <>{fields.filter(([name]) => name === 'floor' || name === 'apartment').map(([name, label, max]) => <div key={name} className={moreStyles.field}><Label htmlFor={`address-${name}`}>{label}</Label><Input id={`address-${name}`} maxLength={max} value={value[name] ?? ''} onChange={(event) => setValue((current) => ({ ...current, [name]: event.target.value }))} /></div>)}</>,
                  province: <>{fields.filter(([name]) => name === 'postalCode' || name === 'reference').map(([name, label, max]) => <div key={name} className={moreStyles.field}><Label htmlFor={`address-${name}`}>{label}</Label><Input id={`address-${name}`} maxLength={max} value={value[name] ?? ''} onChange={(event) => setValue((current) => ({ ...current, [name]: event.target.value }))} /></div>)}</>
                }}
            />
            <div className={moreStyles.field}>
              <Label htmlFor="address-property">Tipo de propiedad</Label>
              <select
                id="address-property"
                value={value.propertyType}
                onChange={(event) =>
                  setValue((current) => ({
                    ...current,
                    propertyType: event.target.value as CustomerAssetAddress['propertyType']
                  }))
                }
              >
                <option value="apartment">Departamento</option>
                <option value="house">Casa</option>
                <option value="commercial">Local comercial</option>
                <option value="office">Oficina</option>
              </select>
            </div>
            <fieldset className={styles.fields}>
              <legend className="mb-3 font-semibold">Condiciones de acceso</legend>
              {accessFields.map(([key, label]) => (
                <label key={key} className={styles.choice}>
                  <input
                    type="checkbox"
                    checked={value.access[key] ?? false}
                    onChange={(event) =>
                      setValue((current) => ({
                        ...current,
                        access: { ...current.access, [key]: event.target.checked }
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className={styles.choice}>
              <input
                type="checkbox"
                checked={value.isDefault}
                onChange={(event) =>
                  setValue((current) => ({ ...current, isDefault: event.target.checked }))
                }
              />
              Usar como dirección principal
            </label>
            <Button className={moreStyles.primary} type="submit" disabled={busy}>
              {busy ? 'Guardando' : 'Guardar dirección'}
            </Button>
          </fieldset>
        </form>
      </div>
    </div>
  )
}
