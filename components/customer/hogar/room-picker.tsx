'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { ROOM_CATALOG, type CustomerHome, type HomeRoom, type RoomKind } from '@/lib/customer-homes/contracts'
import { roomKindsForHome } from '@/lib/customer-homes/model'
import styles from './customer-hogar.module.css'

const HomeScene = dynamic(() => import('./home-scene'), { ssr: false, loading: () => <div className={styles.sceneLoading}>Preparando el ambiente…</div> })
const noSelection = () => {}
const noEquipment: [] = []

export function RoomPicker({ home, value, busy, error, onChange, onCancel, onSave, onReload }: {
  home: CustomerHome
  value: HomeRoom
  busy: boolean
  error: string
  onChange: (value: HomeRoom) => void
  onCancel: () => void
  onSave: () => void
  onReload: () => void
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const variants = ROOM_CATALOG[value.kind].variants
  const index = Math.max(0, variants.findIndex(variant => variant.value === value.variant))
  const preview = useMemo(() => ({ ...home, placements: [], floors: [{ id: 'preview', name: 'Vista previa', order: 0, rooms: [{ ...value, x: 0, z: 0 }] }] }), [home, value])
  function chooseKind(kind: RoomKind) {
    if (busy || kind === value.kind) return
    onChange({ ...value, kind, name: ROOM_CATALOG[kind].label, variant: ROOM_CATALOG[kind].variants[0].value })
  }
  function move(step: number) {
    if (!busy) onChange({ ...value, variant: variants[(index + step + variants.length) % variants.length].value })
  }
  return <Dialog open title="Nuevo ambiente" description="Elegí el tipo y deslizá el ambiente para ver sus variantes."
    className={`${styles.hogar} ${styles.roomPicker}`} onOpenChange={open => { if (!open && !busy) onCancel() }}>
    <label className={styles.roomTypeField}>
      <span>Tipo de ambiente</span>
      <select value={value.kind} disabled={busy} onChange={event => chooseKind(event.target.value as RoomKind)}>
        {roomKindsForHome(home.kind).map(kind => <option key={kind} value={kind}>{ROOM_CATALOG[kind].label}</option>)}
      </select>
    </label>
    <section className={styles.variantPreview} aria-label="Variantes del ambiente" aria-roledescription="carrusel" tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1) }
      }}>
      <div className={styles.variantSwipe}
        onPointerDown={event => {
          if (busy || !event.isPrimary || event.button !== 0) return
          start.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerCancel={() => { start.current = null }}
        onPointerUp={event => {
          const from = start.current; start.current = null
          if (!from || from.id !== event.pointerId) return
          const dx = event.clientX - from.x, dy = event.clientY - from.y
          if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx < 0 ? 1 : -1)
        }}>
        <HomeScene home={preview} floorId="preview" roomId={value.id} focused equipment={noEquipment} previewOnly onSelectRoom={noSelection} onSelectEquipment={noSelection} />
      </div>
      <button className={`${styles.variantArrow} ${styles.variantPrevious}`} type="button" disabled={busy} aria-label="Variante anterior" onClick={() => move(-1)}><ChevronLeft size={22} aria-hidden /></button>
      <button className={`${styles.variantArrow} ${styles.variantNext}`} type="button" disabled={busy} aria-label="Variante siguiente" onClick={() => move(1)}><ChevronRight size={22} aria-hidden /></button>
      <div className={styles.variantCaption} aria-live="polite" aria-atomic="true"><strong>{variants[index].label}</strong><span>{index + 1} de {variants.length}</span></div>
      <div className={styles.variantDots} aria-hidden>{variants.map((variant, i) => <span key={variant.value} data-active={i === index} />)}</div>
    </section>
    {error && <div role="alert" className={styles.error}><p>{error}</p>{error.includes('Los datos cambiaron') && <button className={styles.secondary} type="button" disabled={busy} onClick={onReload}>Recargar Hogar</button>}</div>}
    <div className={styles.actions}>
      <button className={styles.secondary} type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
      <button className={styles.primary} type="button" disabled={busy} onClick={onSave}>{busy ? 'Guardando…' : 'Añadir ambiente'}</button>
    </div>
  </Dialog>
}
