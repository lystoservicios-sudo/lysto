'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LocationSuggestion, ResolvedAddress } from '@/lib/location/contracts'
import { LocationCombobox } from './location-combobox'

export type AddressFieldValue = { street: string; number: string; city: string; province: string }
export type AddressLabels = { street: string; number: string; city: string; province: string }

export function ArgentineAddressFields({ value, onChange, onProofChange, labels, idPrefix, disabled = false,
  groupClassName = '', fieldClassName = '', inputClassName = '', names,
  order = ['street', 'number', 'city', 'province'], placeholders, after, revisionKey }:
  { value: AddressFieldValue; onChange: (value: AddressFieldValue) => void; onProofChange?: (proof: string) => void;
    labels: AddressLabels; idPrefix: string; disabled?: boolean; groupClassName?: string; fieldClassName?: string;
    inputClassName?: string; names?: Partial<Record<keyof AddressFieldValue, string>>;
    order?: (keyof AddressFieldValue)[]; placeholders?: Partial<Record<keyof AddressFieldValue, string>>;
    after?: Partial<Record<keyof AddressFieldValue, ReactNode>>; revisionKey?: string | number }) {
  const [ids, setIds] = useState<{ provinceId?: string; cityId?: string; streetId?: string }>({})
  const revision = useRef(0)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => { revision.current += 1; active.current?.abort() }, [revisionKey])
  const invalidate = () => {
    revision.current += 1
    active.current?.abort()
    onProofChange?.('')
  }
  const patch = (next: Partial<AddressFieldValue>) => onChange({ ...value, ...next })
  const selectProvince = (item: LocationSuggestion) => {
    setIds({ provinceId: item.provinceId }); patch({ province: item.province ?? item.label, city: '', street: '', number: '' }); invalidate()
  }
  const selectCity = (item: LocationSuggestion) => {
    setIds({ provinceId: item.provinceId, cityId: item.cityId }); patch({ province: item.province ?? value.province, city: item.city ?? item.label, street: '', number: '' }); invalidate()
  }
  const selectStreet = (item: LocationSuggestion) => {
    setIds({ provinceId: item.provinceId, cityId: item.cityId, streetId: item.streetId }); patch({ province: item.province ?? value.province, city: item.city ?? value.city, street: item.street ?? item.label, number: '' }); invalidate()
  }
  const resolve = async (item: LocationSuggestion) => {
    if (!item.street || !item.number || !item.city || !item.province) return
    invalidate()
    const ticket = revision.current
    const controller = new AbortController()
    active.current = controller
    try {
      const response = await fetch('/api/location/resolve', { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street: item.street, number: item.number, city: item.city, province: item.province, provinceId: item.provinceId, cityId: item.cityId, streetId: item.streetId }) })
      if (!response.ok) return
      const payload = await response.json() as { address: ResolvedAddress; proof: string }
      if (controller.signal.aborted || ticket !== revision.current) return
      setIds({ provinceId: payload.address.provinceId, cityId: payload.address.cityId, streetId: payload.address.streetId })
      onChange({ street: payload.address.street, number: payload.address.number, city: payload.address.city, province: payload.address.province })
      onProofChange?.(payload.proof)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) return
    }
  }
  const edit = (key: keyof AddressFieldValue, next: string) => {
    invalidate()
    if (key === 'province') { setIds({}); patch({ province: next }) }
    else if (key === 'city') { setIds((current) => ({ provinceId: current.provinceId })); patch({ city: next }) }
    else if (key === 'street') { setIds((current) => ({ provinceId: current.provinceId, cityId: current.cityId })); patch({ street: next }) }
    else patch({ number: next })
  }
  const field = (key: keyof AddressFieldValue) => {
    const common = { id: `${idPrefix}-${key}`, name: names?.[key], label: labels[key], value: value[key], required: true,
      disabled, className: fieldClassName, inputClassName, placeholder: placeholders?.[key] }
    if (key === 'province') return <LocationCombobox {...common} kind="province" onChange={(next) => edit('province', next)} onSelect={selectProvince} />
    if (key === 'city') return <LocationCombobox {...common} kind="city" context={{ provinceId: ids.provinceId, province: value.province }} onChange={(next) => edit('city', next)} onSelect={selectCity} />
    if (key === 'street') return <LocationCombobox {...common} kind="street" context={{ provinceId: ids.provinceId, province: value.province, cityId: ids.cityId, city: value.city }} onChange={(next) => edit('street', next)} onSelect={selectStreet} />
    return <LocationCombobox {...common} kind="address" context={{ provinceId: ids.provinceId, province: value.province, cityId: ids.cityId, city: value.city, streetId: ids.streetId, street: value.street }} onChange={(next) => edit('number', next)} onSelect={(item) => void resolve(item)} />
  }
  return <div className={groupClassName}>{order.map(key => <Fragment key={key}>{field(key)}{after?.[key]}</Fragment>)}</div>
}

