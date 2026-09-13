'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check } from 'lucide-react'
import './home-scene.css'

const description = 'Habitación luminosa con sillón verde, mesa de madera, plantas y aire acondicionado'
const layers = ['architecture', 'sofa', 'plant', 'table'] as const

/** Photographic planes preserve the materials and light of the approved room. */
export function HomeScene() {
  const container = useRef<HTMLDivElement>(null)
  const composition = useRef<HTMLDivElement>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const element = container.current
    const room = composition.current
    if (fallback || !element || !room || typeof window.matchMedia !== 'function'
      || typeof IntersectionObserver !== 'function') return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (typeof motion.addEventListener !== 'function') return
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const pieces = layers.map(name => room.querySelector<HTMLElement>(`[data-room-layer="${name}"]`))
    let visible = false
    let disposed = false
    let frame = 0
    let previous = 0
    let targetX = 0
    let targetY = 0
    let x = 0
    let y = 0
    let progress = 0
    let heroHeight = element.closest('section')?.offsetHeight || window.innerHeight

    const reset = () => {
      room.style.removeProperty('transform')
      pieces.forEach(piece => piece?.style.removeProperty('transform'))
      x = y = progress = targetX = targetY = previous = 0
    }
    const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0 }
    const schedule = () => {
      if (!frame && !disposed && visible && !document.hidden && !motion.matches) {
        frame = requestAnimationFrame(draw)
      }
    }
    const draw = (time: number) => {
      frame = 0
      if (disposed || !visible || document.hidden || motion.matches) return
      const delta = previous ? Math.min((time - previous) / 16.67, 3) : 1
      previous = time
      const ease = 1 - Math.pow(.85, delta)
      const targetProgress = Math.max(0, Math.min(1, window.scrollY / Math.max(heroHeight, 1)))
      x += (targetX - x) * ease
      y += (targetY - y) * ease
      progress += (targetProgress - progress) * ease
      room.style.transform = `perspective(1600px) rotateX(${(-y * 1.4 + progress * .8).toFixed(3)}deg) rotateY(${(x * 2.1 - progress * 1.6).toFixed(3)}deg) translateY(${(-progress * .4).toFixed(3)}%)`
      const offsets = [0, 1.1, 2.4, 3.2]
      pieces.forEach((piece, index) => {
        if (!piece || index === 0) return
        const depth = offsets[index]
        piece.style.transform = `translate3d(${(x * depth * .3).toFixed(3)}%, ${(-progress * depth + y * depth * .22).toFixed(3)}%, 0)`
      })
      if (Math.abs(targetX - x) + Math.abs(targetY - y) + Math.abs(targetProgress - progress) > .003) schedule()
      else previous = 0
    }
    const onPointer = (event: PointerEvent) => {
      if (!pointer.matches || event.pointerType === 'touch') return
      const rect = element.getBoundingClientRect()
      targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1))
      targetY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1) * 2 - 1))
      schedule()
    }
    const onLeave = () => { targetX = targetY = 0; schedule() }
    const onResize = () => { heroHeight = element.closest('section')?.offsetHeight || window.innerHeight; schedule() }
    const onMotion = () => { stop(); reset(); schedule() }
    const onVisibility = () => { if (document.hidden) stop(); else schedule() }
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting)
      if (visible) schedule(); else stop()
    })
    observer.observe(element)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    element.addEventListener('pointermove', onPointer, { passive: true })
    element.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    motion.addEventListener('change', onMotion)
    return () => {
      disposed = true
      stop()
      reset()
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', onResize)
      element.removeEventListener('pointermove', onPointer)
      element.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      motion.removeEventListener('change', onMotion)
    }
  }, [fallback])

  return <div ref={container} className="m-scene m-photo-room">
    {fallback ? <Image className="m-photo-fallback" src="/images/lysto-home.webp" alt={description} width={1000} height={1000} sizes="(max-width:760px) 100vw, 52vw" priority /> :
      <div ref={composition} className="m-room-composition" role="img" aria-label={description}>
        {layers.map(name => <div className={`m-room-plane m-room-${name}`} data-room-layer={name} key={name}>
          <Image src={`/images/room-${name}.webp`} alt="" aria-hidden="true" width={1000} height={1000} sizes="(max-width:760px) 100vw, 52vw" priority onError={() => setFallback(true)} />
        </div>)}
      </div>}
    <div className="m-scene-badge"><span><Check size={15} aria-hidden="true"/></span>Todo, bajo control.</div>
    <div className="m-scene-caption">Un hogar para disfrutar.</div>
  </div>
}
