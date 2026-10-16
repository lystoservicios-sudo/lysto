'use client'

import { useEffect, useRef } from 'react'
import type { LocationSuggestion, ResolvedAddress } from '@/lib/location/contracts'
import { LocationCombobox } from './location-combobox'

export function FullAddressCombobox({ id, label, name, value, onChange, onResolved, disabled = false, required = true, className = '', inputClassName = '', ariaInvalid, ariaDescribedBy, revisionKey }:
  { id: string; label: string; name?: string; value: string; onChange: (value: string) => void;
    onResolved: (value: { value: string; proof: string; address: ResolvedAddress }) => void; disabled?: boolean;
    required?: boolean; className?: string; inputClassName?: string; ariaInvalid?: boolean; ariaDescribedBy?: string; revisionKey?: string | number }) {
  const revision = useRef(0)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => { revision.current += 1; active.current?.abort() }, [revisionKey])
  const change = (next: string) => {
    revision.current += 1
    active.current?.abort()
    onChange(next)
  }
  const resolve = async (item: LocationSuggestion) => {
    if (!item.street || !item.number || !item.city || !item.province) return
    const ticket = ++revision.current
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    try {
      const response = await fetch('/api/location/resolve', { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street: item.street, number: item.number, city: item.city, province: item.province, provinceId: item.provinceId, cityId: item.cityId, streetId: item.streetId }) })
      if (!response.ok) return
      const payload = await response.json() as { address: ResolvedAddress; proof: string }
      if (controller.signal.aborted || ticket !== revision.current) return
      onResolved({ value: payload.address.formattedAddress, address: payload.address, proof: payload.proof })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) return
    }
  }
  return <LocationCombobox id={id} name={name} label={label} value={value} kind="address" minChars={5} disabled={disabled} required={required}
    className={className} inputClassName={inputClassName} ariaInvalid={ariaInvalid} ariaDescribedBy={ariaDescribedBy}
    onChange={change} onSelect={(item) => void resolve(item)} />
}

