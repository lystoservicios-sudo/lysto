'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

export function Popover({ trigger, label, children, className }: {
  trigger: ReactNode
  label: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    close()
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className={cn('absolute right-0 top-[calc(100%+0.5rem)] z-40 min-w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg', className)}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
