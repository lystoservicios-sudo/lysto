import { AlertTriangle, CircleCheck, Inbox, LoaderCircle, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className
}: {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-3xl border border-dashed border-slate-200 bg-white text-center', compact ? 'p-5' : 'px-5 py-10', className)}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
        {icon ?? <Inbox aria-hidden="true" className="h-5 w-5" />}
      </div>
      <h2 className="mt-4 text-lg font-black text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function LoadingSkeleton({ label = 'Cargando contenido', rows = 3, className }: {
  label?: string
  rows?: number
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" className={cn('space-y-3 rounded-3xl border border-slate-200 bg-white p-5', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: Math.max(1, rows) }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={cn('h-4 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none', index === 0 ? 'w-2/5' : index === rows - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function ErrorState({ title, description, code, onRetry, retryLabel = 'Reintentar', className }: {
  title: string
  description: string
  code?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div role="alert" className={cn('rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950', className)}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-red-700">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-black">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-900/80">{description}</p>
          {code ? <p className="mt-2 font-mono text-xs text-red-800">Código: {code}</p> : null}
          {onRetry ? (
            <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
              <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function FormFeedback({ state, message, className }: {
  state: 'idle' | 'pending' | 'success' | 'error'
  message?: string
  className?: string
}) {
  if (state === 'idle' || !message) return null

  const isError = state === 'error'
  const isPending = state === 'pending'
  const Icon = isPending ? LoaderCircle : isError ? AlertTriangle : CircleCheck

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={cn(
        'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold',
        isError
          ? 'border-red-200 bg-red-50 text-red-900'
          : state === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-blue-200 bg-blue-50 text-blue-900',
        className
      )}
    >
      <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0', isPending && 'animate-spin motion-reduce:animate-none')} />
      <span>{message}</span>
    </div>
  )
}
