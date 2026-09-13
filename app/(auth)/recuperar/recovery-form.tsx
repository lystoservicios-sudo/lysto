'use client'
import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import type { AccountResult } from '@/lib/auth/account-lifecycle'
import { recoverAction } from './actions'
const initial: AccountResult = { status: 'idle', message: '' }
export function RecoveryForm() {
  const [state,action,pending] = useActionState(recoverAction,initial)
  return <form action={action} className="mt-6 space-y-4"><label className="block space-y-2 text-sm font-bold">Email<Input name="email" type="email" autoComplete="email" required maxLength={254} disabled={pending} /></label>{state.message && <p role={state.status === 'error' ? 'alert' : 'status'} className="rounded-xl bg-slate-50 p-4 text-sm leading-6">{state.message}</p>}<button type="submit" disabled={pending} className="h-12 rounded-xl bg-blue-700 px-6 font-bold text-white disabled:opacity-60">{pending ? 'Procesando…' : 'Enviar instrucciones'}</button></form>
}
