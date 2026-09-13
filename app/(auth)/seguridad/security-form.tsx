'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

type Factor = { id: string; name: string }
type Enrollment = { id: string; secret: string; qr: string }

export function SecurityForm({
  factors,
  assuranceLevel,
  destination
}: {
  factors: Factor[]
  assuranceLevel: 'aal1' | 'aal2'
  destination: string
}) {
  const client = useMemo(() => createClient(), [])
  const router = useRouter()
  const [factorId, setFactorId] = useState(factors[0]?.id ?? '')
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const {
      data: { subscription }
    } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setEnrollment(null)
        setCode('')
        router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [client, router])

  async function enroll() {
    setBusy(true)
    setError('')
    try {
      const { data, error: enrollmentError } = await client.auth.mfa.enroll({ factorType: 'totp' })
      if (enrollmentError || !data || data.type !== 'totp') throw new Error('enrollment')
      // The installed Auth SDK prefixes the raw SVG with this data URI header.
      // Encode the SVG once so characters such as # survive the image URL.
      const prefix = 'data:image/svg+xml;utf-8,'
      const qr = data.totp.qr_code.startsWith(prefix)
        ? data.totp.qr_code.slice(prefix.length)
        : data.totp.qr_code
      setEnrollment({ id: data.id, secret: data.totp.secret, qr })
      setFactorId(data.id)
      setCode('')
    } catch {
      setError('No pudimos configurar el autenticador. Intentá nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('Ingresá los seis dígitos que muestra tu autenticador.')
      return
    }
    setBusy(true)
    try {
      const { data, error: verificationError } = await client.auth.mfa.challengeAndVerify({
        factorId,
        code
      })
      if (verificationError || !data) throw new Error('verification')
      setEnrollment(null)
      setCode('')
      router.replace(destination)
      router.refresh()
    } catch {
      setCode('')
      setError('No pudimos verificar el código. Revisá tu autenticador e intentá nuevamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-5">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {assuranceLevel === 'aal2' && !enrollment && (
        <p role="status">Tu sesión ya tiene la verificación adicional.</p>
      )}
      {enrollment && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Escaneá el QR con tu aplicación de autenticación o ingresá la clave manualmente. Guardá
            esta clave en un lugar privado.
          </p>
          <Image
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`}
            alt="QR para configurar tu autenticador"
            width={220}
            height={220}
            unoptimized
          />
          <Label htmlFor="setup-key">Clave de configuración</Label>
          <Input
            id="setup-key"
            value={enrollment.secret}
            readOnly
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
      {factorId && (
        <form onSubmit={verify} className="space-y-4">
          {!enrollment && factors.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="factor">Autenticador</Label>
              <select
                id="factor"
                value={factorId}
                disabled={busy}
                onChange={(event) => {
                  setFactorId(event.target.value)
                  setCode('')
                }}
                className="h-12 w-full rounded-xl border border-slate-300 px-4"
              >
                {factors.map((factor) => (
                  <option key={factor.id} value={factor.id}>
                    {factor.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="totp-code">Código del autenticador</Label>
            <Input
              id="totp-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={busy}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Verificar y continuar
          </Button>
        </form>
      )}
      {!enrollment && (factors.length === 0 || assuranceLevel === 'aal2') && (
        <Button type="button" variant="secondary" disabled={busy} onClick={enroll}>
          {factors.length ? 'Agregar otro autenticador' : 'Configurar autenticador'}
        </Button>
      )}
      {assuranceLevel === 'aal2' && !enrollment && (
        <Button
          type="button"
          onClick={() => {
            router.replace(destination)
            router.refresh()
          }}
        >
          Continuar
        </Button>
      )}
      <p className="text-sm text-slate-600">
        Si perdiste acceso a tu autenticador, contactá al equipo de soporte para recuperar la
        cuenta.
      </p>
    </div>
  )
}
