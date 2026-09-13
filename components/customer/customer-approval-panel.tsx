'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'

type ApprovalResult = { ok: boolean; message: string }

export function CustomerApprovalPanel({
  jobId,
  context = 'quote',
  onApprove,
  onReject
}: {
  jobId?: string
  context?: 'quote' | 'closeout'
  onApprove?: () => Promise<ApprovalResult>
  onReject?: () => Promise<ApprovalResult>
}) {
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason] = useState(''),
    [message, setMessage] = useState('')
  const pendingRef = useRef(false)
  const hasConnectedAction = Boolean(
    (onApprove && onReject) ||
      (context === 'closeout' && jobId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(jobId))
  )

  async function persistedDecision(action: 'approve' | 'reject'): Promise<ApprovalResult> {
    const decision = action === 'approve' ? 'confirmed' : 'disputed',
      payload = { jobId, decision, ...(decision === 'disputed' ? { reason: reason.trim() } : {}) },
      fingerprint = JSON.stringify(payload),
      command = recoverCommand(sessionStorage, `${jobId}:customer-decision`, fingerprint)
    const response = await fetch('/api/jobs/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, idempotencyKey: command.key })
      }),
      body = await response.json()
    if (!response.ok) return { ok: false, message: body.error }
    acknowledgeCommand(sessionStorage, `${jobId}:customer-decision`, command.key)
    return {
      ok: true,
      message:
        decision === 'confirmed'
          ? 'Servicio confirmado. La reseña queda disponible y es opcional.'
          : 'Desacuerdo registrado. Operaciones revisará el caso.'
    }
  }

  async function run(action: 'approve' | 'reject') {
    if (!hasConnectedAction || pendingRef.current) return
    pendingRef.current = true
    setPending(action)
    try {
      const result =
        (await (action === 'approve' ? onApprove?.() : onReject?.())) ??
        (await persistedDecision(action))
      setMessage(result.message)
    } catch {
      setMessage(
        'No pudimos confirmar la decisión. Conservamos el intento para reintentar sin duplicar.'
      )
    } finally {
      pendingRef.current = false
      setPending(null)
    }
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
        {context === 'closeout' ? 'Informe recibido' : 'Decisión pendiente'}
      </p>
      <h2 className="mt-2 text-xl font-black text-amber-950">
        {context === 'closeout'
          ? 'Confirmá el resultado o informá un desacuerdo'
          : 'Confirmá antes de continuar'}
      </h2>
      <p className="mt-2 text-sm leading-6 text-amber-900/80">
        {context === 'closeout'
          ? 'Confirmar completa el servicio. La reseña se ofrece después y sigue siendo opcional. No aplicamos conformidad por silencio.'
          : 'Revisá el diagnóstico, el importe y el motivo del cambio. Nada se aprueba automáticamente.'}
      </p>
      {context === 'closeout' ? (
        <label className="mt-4 block text-sm font-bold text-amber-950">
          Motivo si no estás de acuerdo
          <Textarea
            className="mt-2"
            value={reason}
            maxLength={3000}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          disabled={!hasConnectedAction || pending !== null}
          aria-busy={pending === 'approve' || undefined}
          onClick={() => void run('approve')}
        >
          {pending === 'approve'
            ? 'Confirmando…'
            : context === 'closeout'
              ? 'Confirmar servicio'
              : 'Aprobar presupuesto'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={
            !hasConnectedAction ||
            pending !== null ||
            (context === 'closeout' && reason.trim().length < 10)
          }
          aria-busy={pending === 'reject' || undefined}
          onClick={() => void run('reject')}
        >
          {pending === 'reject'
            ? 'Informando…'
            : context === 'closeout'
              ? 'Informar desacuerdo'
              : 'No continuar'}
        </Button>
      </div>
      {!hasConnectedAction ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-amber-900">
          La aprobación se habilitará cuando exista una acción segura conectada.
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 text-sm font-semibold text-amber-950">
          {message}
        </p>
      ) : null}
    </div>
  )
}
