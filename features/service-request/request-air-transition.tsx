'use client'
import Image from 'next/image'
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { EquipmentScreenAnchor } from '@/components/customer/hogar/equipment-anchor'
import styles from './request-screens.module.css'
import { isCustomerMotionReduced, subscribeCustomerMotionPreference } from '@/lib/customer/motion-preference'
export type AirTransitionOrigin = { x: number; y: number; width: number; height: number }
export function AirPlacementTransition({ origin, anchor, src, onDone }: { origin: AirTransitionOrigin; anchor: EquipmentScreenAnchor | null; src: string; onDone: () => void }) {
  const [reduced, setReduced] = useState(isCustomerMotionReduced)
  useEffect(() => {
    return subscribeCustomerMotionPreference(() => setReduced(isCustomerMotionReduced()))
  }, [])
  useEffect(() => {
    if (reduced) { onDone(); return }
    if (!anchor) return
    const timer = window.setTimeout(onDone, 800)
    return () => window.clearTimeout(timer)
  }, [anchor, reduced, onDone])
  if (!anchor || reduced || origin.width <= 0) return null
  const width = anchor.width, height = width * 2 / 3
  const left = anchor.x - width / 2, top = anchor.y - height / 2
  const style = { left, top, width, height, '--air-from-x': `${origin.x - left}px`, '--air-from-y': `${origin.y - top}px`, '--air-from-scale': origin.width / width } as CSSProperties
  return createPortal(<Image src={src} width={1536} height={1024} alt="Transición del aire a su ubicación guardada" aria-hidden className={styles.airTransition} style={style} onAnimationEnd={onDone} data-request-air-transition />, document.body)
}
