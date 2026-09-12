'use client'

import { useState } from 'react'
import { CustomerProfileForm } from './customer-profile-form'
import { FormFeedback } from './states'
import { Button } from '@/components/ui/button'
import { assetRequest, assetError } from '@/lib/customer-assets/client'
import type { CustomerAssetProfile } from '@/lib/customer-assets/contracts'

export function ConnectedCustomerProfile({ initialValue }: { initialValue: CustomerAssetProfile }) {
  const [profile, setProfile] = useState(initialValue)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  async function reload() {
    setBusy(true)
    try {
      const result = await assetRequest<{ profile: CustomerAssetProfile }>('/api/customer/profile')
      setProfile(result.profile)
      setFailed(false)
      setMessage('Información actualizada.')
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <CustomerProfileForm
        key={profile.version}
        initialValue={profile}
        emailReadOnly
        onSubmit={async (value) => {
          setBusy(true)
          setMessage('')
          try {
            const result = await assetRequest<{ profile: CustomerAssetProfile }>(
              '/api/customer/profile',
              'PUT',
              {
                firstName: value.firstName,
                lastName: value.lastName,
                phone: value.phone,
                notificationPreference: value.notificationPreference,
                expectedVersion: profile.version
              }
            )
            setProfile(result.profile)
            setFailed(false)
            setMessage('Tus cambios quedaron guardados.')
            return { ok: true, message: 'Tus cambios quedaron guardados.' }
          } catch (error) {
            return { ok: false, message: assetError(error) }
          } finally {
            setBusy(false)
          }
        }}
      />
      <FormFeedback state={failed ? 'error' : 'success'} message={message} />
      <Button type="button" variant="secondary" disabled={busy} onClick={reload}>
        Recargar datos guardados
      </Button>
      <p className="text-sm text-slate-600">
        Recargar reemplaza los cambios que todavía no guardaste.
      </p>
    </div>
  )
}
