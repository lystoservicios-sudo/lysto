'use client'

import { useEffect, useRef, useState } from 'react'
import type { ResolvedAddress } from '@/lib/location/contracts'
import styles from './location-fields.module.css'

type Address = { street: string; number: string; city: string; province: string }
type Context = { city?: string; province?: string; provinceId?: string }
export function ManualAddressEntry({ id, value, context, disabled, onStart, onResolved, onCancel }:
  { id: string; value: string; context?: Context; disabled: boolean; onStart: () => void;
    onResolved: (result: { value: string; proof: string; address: ResolvedAddress }) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Address>(() => {
    const parts = value.split(',').map(p => p.trim()).filter(Boolean)
    const numbered = parts[0]?.match(/^(.*?)\s+(\d{1,6}|S\/N)$/i)
    const isCaba = parts.some(p => /^(caba|capital federal|ciudad (?:aut[oó]noma )?de buenos aires)$/i.test(p))
    const explicitProvince = isCaba ? 'CABA' : parts.some(p => /^(?:provincia de )?buenos aires$/i.test(p)) ? 'Buenos Aires' : null
    const province = explicitProvince ?? (context?.provinceId === '02' || context?.province === 'CABA' ? 'CABA'
      : context?.province === 'Buenos Aires' || context?.provinceId === '06' ? 'Buenos Aires' : '')
    const city = parts.slice(1).find(p => !/^(argentina|caba|capital federal|ciudad (?:aut[oó]noma )?de buenos aires|(?:provincia de )?buenos aires)$/i.test(p))
    return { street: numbered?.[1] ?? parts[0] ?? '', number: numbered?.[2] ?? '', city: city ?? (explicitProvince ? explicitProvince === 'CABA' ? 'CABA' : '' : context?.city ?? ''), province }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const callbacks = useRef({ onStart, onResolved })
  callbacks.current = { onStart, onResolved }
  useEffect(() => () => active.current?.abort(), [])
  const submit = async () => {
    if (busy || disabled) return
    const address = Object.fromEntries(Object.entries(draft).map(([key, text]) => [key, text.trim()])) as Address
    if (!address.street || address.street.length > 150 || !address.number || address.number.length > 30 || !address.city || address.city.length > 100 || !['CABA', 'Buenos Aires'].includes(address.province)) {
      setError('Completá calle, altura, localidad y provincia. Si no tiene altura, escribí S/N.')
      return
    }
    if (`${address.street} ${address.number}, ${address.city}, ${address.province}, Argentina`.length > 200) {
      setError('La dirección es demasiado larga. Dejá los detalles de acceso en los campos separados.')
      return
    }
    callbacks.current.onStart()
    const controller = new AbortController()
    active.current?.abort(); active.current = controller
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/location/resolve', { method: 'POST', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'manual', ...address }) })
      if (!response.ok) throw new Error('manual_address_unavailable')
      const result = await response.json() as { address: ResolvedAddress; proof: string }
      if (controller.signal.aborted) return
      callbacks.current.onResolved({ value: result.address.formattedAddress, address: result.address, proof: result.proof })
    } catch {
      if (!controller.signal.aborted) setError('No pudimos registrar la dirección. Tus datos se mantienen; volvé a intentarlo.')
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <div className={styles.manual}>
    <fieldset disabled={disabled || busy} onKeyDown={event => { if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') { event.preventDefault(); void submit() } }}>
      <legend>Ingresá tu dirección</legend>
      <p>Podés guardarla aunque no figure entre las opciones.</p>
      <div className={styles.manualGrid}>
        <label htmlFor={`${id}-manual-street`}>Calle<input id={`${id}-manual-street`} value={draft.street} maxLength={150} autoComplete="address-line1" onChange={e => setDraft(current => ({ ...current, street: e.target.value }))} /></label>
        <label htmlFor={`${id}-manual-number`}>Altura<input id={`${id}-manual-number`} value={draft.number} maxLength={30} placeholder="1234 o S/N" onChange={e => setDraft(current => ({ ...current, number: e.target.value }))} /></label>
        <label htmlFor={`${id}-manual-city`}>Localidad<input id={`${id}-manual-city`} value={draft.city} maxLength={100} autoComplete="address-level2" onChange={e => setDraft(current => ({ ...current, city: e.target.value }))} /></label>
        <label htmlFor={`${id}-manual-province`}>Provincia<select id={`${id}-manual-province`} value={draft.province} autoComplete="address-level1" onChange={e => setDraft(current => ({ ...current, province: e.target.value }))}><option value="">Elegí la provincia</option><option value="CABA">CABA</option><option value="Buenos Aires">Buenos Aires</option></select></label>
      </div>
    </fieldset>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.manualActions}>
      <button type="button" disabled={disabled || busy} aria-busy={busy || undefined} onClick={() => void submit()}>{busy ? 'Confirmando dirección…' : 'Usar esta dirección'}</button>
      <button type="button" disabled={disabled} onClick={onCancel}>Volver al buscador</button>
    </div>
  </div>
}
