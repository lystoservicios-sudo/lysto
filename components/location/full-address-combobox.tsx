'use client'

import { useEffect, useRef, useState } from 'react'
import type { LocationSuggestion, ResolvedAddress } from '@/lib/location/contracts'
import { LocationCombobox } from './location-combobox'
import { ManualAddressEntry } from './manual-address-entry'
import styles from './location-fields.module.css'

const sameDisplayedAddress = (a: string, b: string) => {
  const normalized = (text: string) => text.trim().replace(/,\s*Argentina\s*$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')
  return normalized(a) === normalized(b)
}

export function FullAddressCombobox({ id, label, name, value, onChange, onResolved, onSelectionStart, disabled = false, required = true, className = '', inputClassName = '', ariaInvalid, ariaDescribedBy, revisionKey, context }:
  { id: string; label: string; name?: string; value: string; onChange: (value: string) => void;
    onResolved: (value: { value: string; proof: string; address: ResolvedAddress }) => void; disabled?: boolean;
    required?: boolean; className?: string; inputClassName?: string; ariaInvalid?: boolean; ariaDescribedBy?: string; revisionKey?: string | number; onSelectionStart?: () => void;
    context?: Partial<Pick<LocationSuggestion, 'city' | 'cityId' | 'province' | 'provinceId'>> }) {
  const revision = useRef(0)
  const [resolutionError, setResolutionError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualConfirmed, setManualConfirmed] = useState(false)
  const manualValue = useRef('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  useEffect(() => { revision.current += 1; active.current?.abort(); setResolutionError('') }, [revisionKey])
  useEffect(() => { if (manualValue.current && !sameDisplayedAddress(value, manualValue.current)) setManualConfirmed(false) }, [value])
  const change = (next: string) => {
    revision.current += 1
    active.current?.abort()
    setResolutionError('')
    setManualConfirmed(false)
    onChange(next)
  }
  const resolve = async (item: LocationSuggestion) => {
    if (!item.street || !item.number || !item.city || !item.province) return
    onSelectionStart?.()
    const ticket = ++revision.current
    setResolutionError('')
    active.current?.abort()
    if (item.provinceId && !['02', '06'].includes(item.provinceId)) {
      setResolutionError('Por ahora el servicio está disponible en CABA y la provincia de Buenos Aires.')
      return
    }
    const controller = new AbortController()
    active.current = controller
    try {
      const response = await fetch('/api/location/resolve', { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street: item.street, number: item.number, city: item.city, province: item.province, provinceId: item.provinceId, cityId: item.cityId, streetId: item.streetId }) })
      if (!response.ok) throw new Error('address_resolution_failed')
      const payload = await response.json() as { address: ResolvedAddress; proof: string }
      if (controller.signal.aborted || ticket !== revision.current) return
      onResolved({ value: payload.address.formattedAddress, address: payload.address, proof: payload.proof })
    } catch {
      if (!controller.signal.aborted && ticket === revision.current)
        setResolutionError('No pudimos confirmar la dirección. Podés elegir otra opción o ingresarla manualmente.')
    }
  }
  return <><LocationCombobox id={id} name={name} label={label} value={value} kind="address" minChars={5} disabled={disabled || manualOpen} context={context} searchEnabled={!manualConfirmed} required={required} placeholder="Escribí calle y número"
    className={className} inputClassName={inputClassName} ariaInvalid={Boolean(resolutionError) || ariaInvalid} ariaDescribedBy={[ariaDescribedBy, !manualOpen && !manualConfirmed ? `${id}-search-hint` : undefined, resolutionError ? `${id}-resolution-error` : undefined].filter(Boolean).join(' ') || undefined}
    onChange={change} onSelect={(item) => void resolve(item)} />
    {!manualOpen && !manualConfirmed && <p id={`${id}-search-hint`} className={styles.status}>Agregá la localidad para distinguir calles con el mismo nombre.</p>}
    {!manualOpen && <button type="button" disabled={disabled} className={styles.manualToggle} onClick={() => { change(value); onSelectionStart?.(); setManualOpen(true) }}>Mi dirección no aparece</button>}
    {manualOpen && <ManualAddressEntry key={revisionKey} id={id} value={value} context={context} disabled={disabled} onStart={() => onSelectionStart?.()}
      onCancel={() => { revision.current += 1; active.current?.abort(); setManualOpen(false); setResolutionError('') }}
      onResolved={result => { manualValue.current = result.value; setManualOpen(false); setManualConfirmed(true); onResolved(result) }} />}
    {resolutionError && <p id={`${id}-resolution-error`} role="alert">{resolutionError}</p>}
    {manualConfirmed && <p role="status" className={styles.status}>Dirección ingresada manualmente. Verificaremos la ubicación antes de calcular el traslado.</p>}
  </>
}

