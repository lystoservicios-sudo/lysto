'use client'

import { useCombobox } from 'downshift'
import { useEffect, useMemo, useState } from 'react'

import { locationSuggestionSchema, type LocationKind, type LocationSuggestion } from '@/lib/location/contracts'
import { findArgentineProvince } from '@/lib/location/provinces'
import styles from './location-fields.module.css'

type Context = Partial<Pick<LocationSuggestion, 'provinceId' | 'province' | 'cityId' | 'city' | 'streetId' | 'street'>>

export function LocationCombobox({ id, label, name, value, kind, context, onChange, onSelect, disabled = false,
  required = false, className = '', inputClassName = '', minChars = kind === 'address' ? 1 : 2, placeholder,
  ariaInvalid, ariaDescribedBy, searchEnabled = true }:
  { id: string; label: string; name?: string; value: string; kind: LocationKind; context?: Context;
    onChange: (value: string) => void; onSelect: (item: LocationSuggestion) => void; disabled?: boolean;
    required?: boolean; className?: string; inputClassName?: string; minChars?: number; placeholder?: string;
    ariaInvalid?: boolean; ariaDescribedBy?: string; searchEnabled?: boolean }) {
  const [items, setItems] = useState<LocationSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [failed, setFailed] = useState(false)
  const query = value.trim()
  const contextKey = JSON.stringify(context ?? {})
  useEffect(() => {
    if (disabled || !searchEnabled || query.length < minChars) { setItems([]); setBusy(false); setAttempted(false); setFailed(false); return }
    const controller = new AbortController()
    setItems([]); setBusy(false); setAttempted(false); setFailed(false)
    const timer = window.setTimeout(async () => {
      setBusy(true)
      try {
        const params = new URLSearchParams({ kind, query })
        Object.entries(context ?? {}).forEach(([key, entry]) => { if (entry) params.set(key, String(entry)) })
        const response = await fetch(`/api/location/suggestions?${params}`, { credentials: 'same-origin', signal: controller.signal })
        if (!response.ok) throw new Error('suggestions_unavailable')
        const payload = await response.json() as { suggestions?: unknown }
        if (controller.signal.aborted) return
        const selectedProvince = findArgentineProvince(context?.provinceId) ?? findArgentineProvince(context?.province)
        const suggestions = locationSuggestionSchema.array().parse(payload.suggestions).filter(item => kind !== 'address' || !selectedProvince ||
          (findArgentineProvince(item.provinceId) ?? findArgentineProvince(item.province))?.id === selectedProvince.id)
        setItems(suggestions); setAttempted(true); setFailed(false)
      } catch (error) {
        if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) { setItems([]); setAttempted(true); setFailed(true) }
      } finally { if (!controller.signal.aborted) setBusy(false) }
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
    // contextKey is the stable dependency; using the object would restart on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, searchEnabled, query, kind, minChars, contextKey])
  const stableItems = useMemo(() => items, [items])
  const combo = useCombobox({
    id, items: stableItems, inputValue: value, itemToString: (item) => item?.label ?? '',
    onInputValueChange: ({ inputValue, type }) => {
      if (type === useCombobox.stateChangeTypes.InputChange && inputValue !== undefined && inputValue !== value) onChange(inputValue)
    },
    onSelectedItemChange: ({ selectedItem }) => { if (selectedItem) onSelect(selectedItem) }
  })
  const open = combo.isOpen && stableItems.length > 0
  const menuProps = { ...combo.getMenuProps({ 'aria-label': `${label} opciones` }), 'aria-labelledby': undefined }
  return <div className={`${styles.field} ${className}`.trim()}>
    <label {...combo.getLabelProps()} htmlFor={id}>{label}</label>
    <input {...combo.getInputProps({ id, name, required, disabled, className: inputClassName, autoComplete: 'off', placeholder,
      'aria-busy': busy || undefined, 'aria-invalid': ariaInvalid || undefined, 'aria-describedby': ariaDescribedBy })} />
    {busy && <span className={styles.busy} aria-hidden="true" />}
    <ul {...menuProps} className={styles.menu} hidden={!open}>
      {open && stableItems.map((item, index) => <li key={item.id} {...combo.getItemProps({ item, index })} className={styles.option} data-highlighted={combo.highlightedIndex === index}>
        <strong>{item.label}</strong>{item.secondary && <span>{item.secondary}</span>}
      </li>)}
    </ul>
    {!busy && query.length >= minChars && failed && <p className={styles.status} role="status">No pudimos cargar opciones. Intentá nuevamente.</p>}
    {!busy && query.length >= minChars && attempted && !failed && stableItems.length === 0 && <p className={styles.status} role="status">No encontramos coincidencias.</p>}
  </div>
}

