'use client'

import { useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils/cn'

export type CountTabItem<T extends string> = {
  id: T
  label: string
  count: number
}

export function CountTabs<T extends string>({ items, value, onValueChange, label, panelId, className }: {
  items: readonly CountTabItem<T>[]
  value: T
  onValueChange: (value: T) => void
  label: string
  panelId: string
  className?: string
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % items.length
          : (index - 1 + items.length) % items.length
    const next = items[nextIndex]
    if (!next) return
    onValueChange(next.id)
    tabRefs.current[nextIndex]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={cn('flex max-w-full gap-2 overflow-x-auto pb-1', className)}>
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(node) => { tabRefs.current[index] = node }}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              selected ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            <span>{item.label}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs tabular-nums', selected ? 'bg-white text-blue-800' : 'bg-slate-100 text-slate-600')}>{item.count}</span>
          </button>
        )
      })}
    </div>
  )
}
