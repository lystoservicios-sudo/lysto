'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { FormFeedback } from './states'
import { assetRequest, assetError } from '@/lib/customer-assets/client'

export function CustomerEmailChange() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await assetRequest<{ message: string }>(
        '/api/customer/profile/email',
        'POST',
        { email }
      )
      setFailed(false)
      setMessage(result.message)
      setEmail('')
    } catch (error) {
      setFailed(true)
      setMessage(assetError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-bold">Cambiar correo</h2>
      <p className="text-sm text-slate-600">
        Necesitás acceso al correo actual y al nuevo. El cambio se completa cuando confirmás ambos
        enlaces.
      </p>
      <div className="space-y-2">
        <Label htmlFor="new-email">Nuevo correo</Label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={busy}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <FormFeedback state={failed ? 'error' : 'success'} message={message} />
      <Button type="submit" disabled={busy || !email}>
        {busy ? 'Solicitando cambio' : 'Solicitar cambio de correo'}
      </Button>
    </form>
  )
}
