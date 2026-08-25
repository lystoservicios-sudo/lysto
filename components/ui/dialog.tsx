'use client'

import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ open, onOpenChange, title, description, children, footer, className }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const [mounted, setMounted] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const previousOverflowRef = useRef('')
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflowRef.current
      returnFocusRef.current?.focus()
    }
  }, [open])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }

    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Cerrar diálogo al tocar fuera"
        className="absolute inset-0 h-full w-full bg-slate-950/45"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={handleKeyDown}
        className={cn('relative z-10 max-h-[min(90dvh,48rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6', className)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-black text-slate-950">{title}</h2>
            {description ? <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar diálogo"
            onClick={() => onOpenChange(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
        {footer ? <div className="mt-6 border-t border-slate-100 pt-4">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
