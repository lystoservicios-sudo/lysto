'use client'

import { LoaderCircle } from 'lucide-react'

import { Button, ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export type ActionGroupAction = {
  id: string
  label: string
  pendingLabel?: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function ActionGroup({ actions, pendingActionId, className }: {
  actions: readonly ActionGroupAction[]
  pendingActionId?: string | null
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap', className)}>
      {actions.map((action) => {
        const isPending = pendingActionId === action.id
        const isDisabled = Boolean(action.disabled || pendingActionId || (!action.href && !action.onClick))
        const label = isPending ? action.pendingLabel ?? `${action.label}…` : action.label

        if (action.href && !isDisabled) {
          return <ButtonLink key={action.id} href={action.href} variant={action.variant}>{label}</ButtonLink>
        }

        return (
          <Button
            key={action.id}
            type="button"
            variant={action.variant}
            disabled={isDisabled}
            aria-busy={isPending || undefined}
            onClick={action.onClick}
          >
            {isPending ? <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
            {label}
          </Button>
        )
      })}
    </div>
  )
}
