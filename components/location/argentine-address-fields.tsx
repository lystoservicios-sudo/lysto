'use client'

import { Fragment, useRef, type ReactNode } from 'react'
import { FullAddressCombobox } from './full-address-combobox'
import { findArgentineProvince } from '@/lib/location/provinces'
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
  const callbacks = useRef({ onChange, onProofChange })
  callbacks.current = { onChange, onProofChange }
  const province = findArgentineProvince(value.province)
  const query = value.number && value.city
    ? [[value.street, value.number].filter(Boolean).join(' '), value.city, value.province].filter(Boolean).join(', ')
    : value.street
  const locationRevision = JSON.stringify([revisionKey, value.street, value.number, value.city, value.province])
  return <div className={groupClassName}>
    <div className={styles.fullWidth}>
      <FullAddressCombobox id={idPrefix + '-address'} label="Dirección" value={query}
        context={{ province: province?.name, provinceId: province?.id, ...(value.number && value.city ? { city: value.city } : {}) }}
        disabled={disabled} className={fieldClassName} inputClassName={inputClassName}
        ariaInvalid={ariaInvalid} ariaDescribedBy={ariaDescribedBy} revisionKey={locationRevision}
        onSelectionStart={() => callbacks.current.onProofChange?.('')}
        onProvinceChange={next => {
          callbacks.current.onProofChange?.('')
          callbacks.current.onChange({ street: '', number: '', city: '', province: next })
        }}
        onChange={text => {
          callbacks.current.onProofChange?.('')
          callbacks.current.onChange({ street: text, number: '', city: '', province: province?.name ?? '' })
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
