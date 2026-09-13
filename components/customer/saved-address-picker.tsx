'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { FormFeedback } from './states'
import { assetError, assetRequest, type AssetPage } from '@/lib/customer-assets/client'
import type { CustomerAssetAddress } from '@/lib/customer-assets/contracts'

export function SavedAddressPicker({
  initialPage,
  onSelect
}: {
  initialPage: AssetPage<CustomerAssetAddress>
  onSelect: (address: CustomerAssetAddress) => void
}) {
  const [page, setPage] = useState(initialPage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function more() {
    setBusy(true)
    setError('')
    try {
      const next = await assetRequest<AssetPage<CustomerAssetAddress>>(
        `/api/customer/addresses?cursor=${encodeURIComponent(page.nextCursor!)}`
      )
      setPage({
        ...next,
        items: [
          ...page.items,
          ...next.items.filter((item) => !page.items.some((old) => old.id === item.id))
        ]
      })
    } catch (failure) {
      setError(assetError(failure))
    } finally {
      setBusy(false)
    }
  }
  if (!page.total) return null
  return (
    <div className="space-y-2">
      <Label htmlFor="saved-address">Usar una dirección guardada</Label>
      <select
        id="saved-address"
        value=""
        disabled={busy}
        className="h-12 w-full rounded-xl border px-4"
        onChange={(event) => {
          const address = page.items.find((item) => item.id === event.target.value)
          if (address) onSelect(address)
        }}
      >
        <option value="">Elegí una dirección para completar los campos</option>
        {page.items.map((address) => (
          <option key={address.id} value={address.id}>
            {address.label} · {address.street} {address.number}
            {address.isDefault ? ' (Principal)' : ''}
          </option>
        ))}
      </select>
      {page.nextCursor ? (
        <Button type="button" variant="secondary" disabled={busy} onClick={more}>
          Cargar más direcciones
        </Button>
      ) : null}
      <FormFeedback state="error" message={error} />
    </div>
  )
}
