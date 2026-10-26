'use client'

import { useEffect, useRef, useState } from 'react'
import { resolvedAddressSchema, type LocationSuggestion, type ResolvedAddress } from '@/lib/location/contracts'
import { ARGENTINE_PROVINCES, findArgentineProvince } from '@/lib/location/provinces'
import { LocationCombobox } from './location-combobox'
import styles from './location-fields.module.css'

const provinceFromAddress = (value: string) => value.split(',').reverse().map(part => findArgentineProvince(part.trim())).find(Boolean)

export function FullAddressCombobox({ id, label, name, value, onChange, onResolved, onSelectionStart, onProvinceChange,
  disabled = false, required = true, className = '', inputClassName = '', ariaInvalid, ariaDescribedBy, revisionKey, context }:
  { id: string; label: string; name?: string; value: string; onChange: (value: string) => void;
    onResolved: (value: { value: string; proof: string; address: ResolvedAddress }) => void; disabled?: boolean;
    required?: boolean; className?: string; inputClassName?: string; ariaInvalid?: boolean; ariaDescribedBy?: string;
    revisionKey?: string | number; onSelectionStart?: () => void; onProvinceChange?: (province: string) => void;
    context?: Partial<Pick<LocationSuggestion, 'city' | 'cityId' | 'province' | 'provinceId'>> }) {
  const contextProvince = findArgentineProvince(context?.provinceId) ?? findArgentineProvince(context?.province)
  const [provinceId, setProvinceId] = useState(() => contextProvince?.id ?? provinceFromAddress(value)?.id ?? '')
  const province = findArgentineProvince(provinceId)
  const revision = useRef(0)
  const recordRevision = useRef(revisionKey)
  const [resolutionError, setResolutionError] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => {
    revision.current += 1
    active.current?.abort()
    setResolutionError('')
    if (contextProvince) setProvinceId(contextProvince.id)
    else if (recordRevision.current !== revisionKey) setProvinceId(provinceFromAddress(value)?.id ?? '')
    recordRevision.current = revisionKey
    // value is read only when the parent changes the record revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionKey, contextProvince?.id])
  const change = (next: string) => {
    if (disabled || !province) return
    revision.current += 1
    active.current?.abort()
    setResolutionError('')
    onChange(next)
  }
  const changeProvince = (next: string) => {
    if (disabled) return
    const nextProvince = findArgentineProvince(next)
    revision.current += 1
    active.current?.abort()
    setResolutionError('')
    setProvinceId(nextProvince?.id ?? '')
    onSelectionStart?.()
    if (onProvinceChange) onProvinceChange(nextProvince?.name ?? '')
    else onChange('')
  }
  const resolve = async (item: LocationSuggestion) => {
    const itemProvince = findArgentineProvince(item.provinceId) ?? findArgentineProvince(item.province)
    if (!province || itemProvince?.id !== province.id || !item.street || !item.number || !item.city || !item.province) return
    onSelectionStart?.()
    const ticket = ++revision.current
    setResolutionError('')
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    try {
      const response = await fetch('/api/location/resolve', { method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ street: item.street, number: item.number, city: item.city,
          province: province.name, provinceId: province.id, cityId: item.cityId, streetId: item.streetId }) })
      if (!response.ok) throw new Error('address_resolution_failed')
      const payload = await response.json() as { address: unknown; proof: unknown }
      const address = resolvedAddressSchema.parse(payload.address)
      if (address.provinceId !== province.id || findArgentineProvince(address.province)?.id !== province.id ||
          !Number.isFinite(address.latitude) || !Number.isFinite(address.longitude) || typeof payload.proof !== 'string' || !payload.proof)
        throw new Error('address_resolution_mismatch')
      if (controller.signal.aborted || ticket !== revision.current) return
      onResolved({ value: address.formattedAddress, address, proof: payload.proof })
    } catch {
      if (!controller.signal.aborted && ticket === revision.current)
        setResolutionError('No pudimos confirmar la dirección. Revisá calle, altura y localidad, o elegí otra opción.')
    }
  }
  const searchContext = { ...context, provinceId: province?.id, province: province?.name }
  return <>
    <div className={[styles.field, styles.province, className].filter(Boolean).join(' ')}>
      <label htmlFor={id + '-province'}>Provincia</label>
      <select id={id + '-province'} value={provinceId} required={required} disabled={disabled} className={inputClassName}
        onChange={event => changeProvince(event.target.value)}>
        <option value="">Elegí una provincia</option>
        {ARGENTINE_PROVINCES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
    <LocationCombobox id={id} name={name} label={label} value={value} kind="address" minChars={5}
      disabled={disabled || !province} context={searchContext} required={required} placeholder="Escribí calle y número"
      className={className} inputClassName={inputClassName} ariaInvalid={Boolean(resolutionError) || ariaInvalid}
      ariaDescribedBy={[ariaDescribedBy, id + '-search-hint', resolutionError ? id + '-resolution-error' : undefined].filter(Boolean).join(' ')}
      onChange={change} onSelect={item => void resolve(item)} />
    <p id={id + '-search-hint'} className={styles.status}>{province
      ? 'Escribí calle y altura. Agregá la localidad para distinguir direcciones de la misma provincia.'
      : 'Primero elegí la provincia del domicilio.'}</p>
    {resolutionError && <p id={id + '-resolution-error'} role="alert">{resolutionError}</p>}
  </>
}
