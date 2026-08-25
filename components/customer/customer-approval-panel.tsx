'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

type ApprovalResult = { ok: boolean; message: string }

export function CustomerApprovalPanel({ onApprove, onReject }: {
  onApprove?: () => Promise<ApprovalResult>
  onReject?: () => Promise<ApprovalResult>
}) {
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const pendingRef = useRef(false)
  const hasConnectedAction = Boolean(onApprove && onReject)

  async function run(action: 'approve' | 'reject') {
    if (!hasConnectedAction || pendingRef.current) return
    pendingRef.current = true
    setPending(action)
    try {
      await (action === 'approve' ? onApprove?.() : onReject?.())
    } finally {
      pendingRef.current = false
      setPending(null)
    }
  }

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">Decisión pendiente</p>
      <h2 className="mt-2 text-xl font-black text-amber-950">Confirmá antes de continuar</h2>
      <p className="mt-2 text-sm leading-6 text-amber-900/80">Revisá el diagnóstico, el importe y el motivo del cambio. Nada se aprueba automáticamente.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" disabled={!hasConnectedAction || pending !== null} aria-busy={pending === 'approve' || undefined} onClick={() => void run('approve')}>{pending === 'approve' ? 'Aprobando…' : 'Aprobar presupuesto'}</Button>
        <Button type="button" variant="secondary" disabled={!hasConnectedAction || pending !== null} aria-busy={pending === 'reject' || undefined} onClick={() => void run('reject')}>{pending === 'reject' ? 'Informando…' : 'No continuar'}</Button>
      </div>
      {!hasConnectedAction ? <p className="mt-3 text-xs font-semibold leading-5 text-amber-900">La aprobación se habilitará cuando exista una acción segura conectada.</p> : null}
    </div>
  )
}
