'use client'

import { Fragment, useRef, type ReactNode } from 'react'
import { FullAddressCombobox } from './full-address-combobox'
import styles from './location-fields.module.css'

export type AddressFieldValue = { street: string; number: string; city: string; province: string }
export type AddressLabels = { street: string; number: string; city: string; province: string }

export function ArgentineAddressFields({ value, onChange, onProofChange, idPrefix, disabled = false,
  groupClassName = '', fieldClassName = '', inputClassName = '', names,
  order = ['street', 'number', 'city', 'province'], after, revisionKey, ariaInvalid, ariaDescribedBy }:
  { value: AddressFieldValue; onChange: (value: AddressFieldValue) => void; onProofChange?: (proof: string) => void;
    labels: AddressLabels; idPrefix: string; disabled?: boolean; groupClassName?: string; fieldClassName?: string;
    inputClassName?: string; names?: Partial<Record<keyof AddressFieldValue, string>>;
    order?: (keyof AddressFieldValue)[]; placeholders?: Partial<Record<keyof AddressFieldValue, string>>;
    after?: Partial<Record<keyof AddressFieldValue, ReactNode>>; revisionKey?: string | number;
    ariaInvalid?: boolean; ariaDescribedBy?: string }) {
  // Resolution is asynchronous; use the current callbacks to preserve auxiliary edits.
  const callbacks = useRef({ onChange, onProofChange })
  callbacks.current = { onChange, onProofChange }
  const searchContext = useRef({ city: value.city, province: value.province })
  const recordRevision = useRef(revisionKey)
  if (recordRevision.current !== revisionKey) {
    recordRevision.current = revisionKey
    searchContext.current = { city: value.city, province: value.province }
  }
  if (value.number && value.city && value.province) searchContext.current = { city: value.city, province: value.province }
  const query = [[value.street, value.number].filter(Boolean).join(' '), value.city, value.province].filter(Boolean).join(', ')
  const locationRevision = JSON.stringify([revisionKey, value.street, value.number, value.city, value.province])

  return <div className={groupClassName}>
    <div className={styles.fullWidth}>
      <FullAddressCombobox id={`${idPrefix}-address`} label="Dirección" value={query}
        context={searchContext.current}
        disabled={disabled} className={fieldClassName} inputClassName={inputClassName}
        ariaInvalid={ariaInvalid} ariaDescribedBy={ariaDescribedBy} revisionKey={locationRevision}
        onSelectionStart={() => callbacks.current.onProofChange?.('')}
        onChange={text => {
          callbacks.current.onProofChange?.('')
          callbacks.current.onChange({ street: text, number: '', city: '', province: '' })
        }}
        onResolved={({ address, proof }) => {
          callbacks.current.onChange({ street: address.street, number: address.number, city: address.city, province: address.province })
          callbacks.current.onProofChange?.(proof)
        }} />
    </div>
    {names && (Object.keys(names) as (keyof AddressFieldValue)[]).map(key =>
      <input key={key} type="hidden" name={names[key]} value={value[key]} disabled={disabled} />)}
    {order.map(key => <Fragment key={key}>{after?.[key]}</Fragment>)}
  </div>
}
