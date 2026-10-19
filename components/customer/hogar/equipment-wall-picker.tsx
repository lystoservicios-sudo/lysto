'use client'

import { useId } from 'react'
import { Snowflake } from 'lucide-react'
import { WALL_OPTIONS, type EquipmentPlacement } from '@/lib/customer-homes/contracts'
import styles from './customer-hogar.module.css'

type Position = Pick<EquipmentPlacement, 'wall' | 'offset' | 'height'>
const clamp = (value: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, value)) * 100) / 100

export function EquipmentWallPicker({ value, disabled, onChange }: {
  value: Position
  disabled: boolean
  onChange: (value: Position) => void
}) {
  const helpId = useId()
  return <div role="group" aria-label="Paredes del ambiente" className={styles.wallPicker}>
    <p id={helpId} className={styles.srOnly}>Elegí una pared con Enter. Usá las flechas para mover el aire sobre esa pared.</p>
    {WALL_OPTIONS.map(wall => <button type="button" key={wall.value} className={styles.wallSurface}
      aria-label={wall.label} aria-pressed={value.wall === wall.value} aria-describedby={helpId}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown" disabled={disabled}
      onClick={event => {
        if (disabled) return
        const bounds = event.currentTarget.getBoundingClientRect()
        const pointer = event.detail > 0 && bounds.width > 32 && bounds.height > 48
        onChange({ wall: wall.value,
          offset: pointer ? clamp((event.clientX - bounds.left - 16) / (bounds.width - 32), 0, 1) : value.offset,
          height: pointer ? clamp(.35 + (1 - (event.clientY - bounds.top - 32) / (bounds.height - 48)) * 2.15, .35, 2.5) : value.height })
      }}
      onKeyDown={event => {
        if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        onChange({ wall: wall.value,
          offset: clamp(value.offset + (event.key === 'ArrowLeft' ? -.05 : event.key === 'ArrowRight' ? .05 : 0), 0, 1),
          height: clamp(value.height + (event.key === 'ArrowDown' ? -.1 : event.key === 'ArrowUp' ? .1 : 0), .35, 2.5) })
      }}>
      <span className={styles.wallName}>{wall.label}</span>
      <span className={styles.wallInterior} aria-hidden>
        {value.wall === wall.value && <span className={styles.wallAir} style={{ left: `${value.offset * 100}%`, top: `${(1 - (value.height - .35) / 2.15) * 100}%` }}><Snowflake size={17} /></span>}
      </span>
    </button>)}
  </div>
}
