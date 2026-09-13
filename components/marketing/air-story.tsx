'use client'

import Image from 'next/image'
import { ArrowDown, Check, MoveDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { RequestLink } from './shared'
import './air-story.css'

const steps = [
  {
    control: 'Confort',
    eyebrow: '01 / Tu día a día',
    title: 'Estar bien empieza por el ambiente.',
    body: 'Dormir a gusto. Concentrarte en lo tuyo. Compartir una comida sin pensar en el calor. Un aire que funciona bien acompaña esos pequeños momentos.',
    detail: 'La temperatura es parte de sentirte en casa.',
  },
  {
    control: 'Flujo',
    eyebrow: '02 / Filtros + turbina',
    title: 'Un buen flujo hace la diferencia.',
    body: 'Los filtros retienen polvo y la turbina hace circular el aire. Si se acumula suciedad, ese recorrido puede perder fuerza. Revisar y mantener el equipo ayuda a que cada parte haga su trabajo.',
    detail: 'Menos aire no siempre significa falta de refrigerante.',
  },
  {
    control: 'Equipo',
    eyebrow: '03 / Serpentín + drenaje',
    title: 'Cada parte tiene una función.',
    body: 'El serpentín intercambia calor y el drenaje retira el agua que se forma al enfriar. Un equipo que no enfría, gotea o hace ruido puede tener distintas causas. Por eso, el síntoma es apenas el comienzo.',
    detail: 'Entender qué pasa permite elegir qué hace falta.',
  },
  {
    control: 'Solución',
    eyebrow: '04 / Ahí entra Lysto',
    title: 'Primero entender. Después resolver.',
    body: 'Nos contás qué notás. Un especialista de nuestro equipo, aprobado por Lysto, revisa el aire e identifica el problema. Buscamos la solución adecuada y te presentamos un presupuesto detallado antes de avanzar.',
    detail: 'Vos decidís cómo seguir. Lysto acompaña el trabajo.',
  },
] as const

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function readingLine(visual: HTMLDivElement | null) {
  // Short landscape screens use normal document flow instead of a pinned visual.
  if (window.innerWidth > 760 || window.innerHeight <= 600) return window.innerHeight * .45
  const visualHeight = visual?.getBoundingClientRect().height ?? 0
  const styledTop = visual ? Number.parseFloat(window.getComputedStyle(visual).top) : NaN
  const pinnedTop = Number.isFinite(styledTop) ? styledTop : 75
  // Use the destination's pinned position even when a button is clicked before pinning.
  return Math.min(window.innerHeight - 100, pinnedTop + visualHeight + 75)
}

export function AirStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const articleRefs = useRef<Array<HTMLElement | null>>([])
  const manualUntil = useRef(0)
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef<() => void>(() => {})
  const [active, setActive] = useState(0)
  const [motion, setMotion] = useState<'static' | 'reduced' | 'scroll'>('static')
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const preference = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    let frame = 0
    let visible = true

    const update = () => {
      frame = 0
      if (!visible || document.hidden || Date.now() < manualUntil.current) return
      const articles = articleRefs.current.filter((article): article is HTMLElement => Boolean(article))
      if (articles.length !== steps.length) return
      const line = readingLine(visualRef.current)
      const firstTop = articles[0].getBoundingClientRect().top
      const lastTop = articles[articles.length - 1].getBoundingClientRect().top
      if (lastTop <= firstTop) return
      const progress = clamp((line - firstTop) / (lastTop - firstTop))
      section.style.setProperty('--air-open', progress.toFixed(4))
      let current = 0
      articles.forEach((article, index) => {
        if (article.getBoundingClientRect().top <= line + 1) current = index
      })
      setActive(current)
    }

    const schedule = () => {
      if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(update)
    }
    refreshRef.current = schedule
    const syncPreference = () => {
      setMotion(preference?.matches === false ? 'scroll' : 'reduced')
      schedule()
    }
    syncPreference()

    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting
        if (visible) schedule()
      }, { rootMargin: '120px' })
      : null
    observer?.observe(section)
    const visibilityChanged = () => {
      if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0 }
      else schedule()
    }
    preference?.addEventListener?.('change', syncPreference)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('visibilitychange', visibilityChanged)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (unlockTimer.current) clearTimeout(unlockTimer.current)
      observer?.disconnect()
      preference?.removeEventListener?.('change', syncPreference)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('visibilitychange', visibilityChanged)
      refreshRef.current = () => {}
    }
  }, [])

  const selectStage = (index: number) => {
    setActive(index)
    setAnnouncement(`${steps[index].eyebrow}. ${steps[index].title}`)
    sectionRef.current?.style.setProperty('--air-open', String(index / (steps.length - 1)))
    manualUntil.current = Date.now() + 750
    const article = articleRefs.current[index]
    if (article) window.scrollTo({ top: window.scrollY + article.getBoundingClientRect().top - readingLine(visualRef.current), behavior: motion === 'scroll' ? 'smooth' : 'auto' })
    if (unlockTimer.current) clearTimeout(unlockTimer.current)
    unlockTimer.current = setTimeout(() => { manualUntil.current = 0; refreshRef.current() }, 800)
  }

  return (
    <section ref={sectionRef} className="m-air-story" id="el-aire-importa" aria-labelledby="air-story-title" data-motion={motion} data-stage={active}>
      <div className="m-container">
        <header className="m-air-heading">
          <div><span className="m-small-label">Detrás del confort, hay mucho pasando.</span><h2 id="air-story-title">Un buen aire<br/><span>cambia tu día.</span></h2></div>
          <p>Cuando todo funciona, casi no lo notás.<br className="m-air-desktop-break"/> Cuando algo falla, estamos para ayudarte a entenderlo y resolverlo.</p>
        </header>
        <div className="m-air-layout">
          <div className="m-air-visual" ref={visualRef}>
            <div className="m-air-product" role="img" aria-label="Vista ilustrativa de un aire acondicionado dividido en tapa, filtros, serpentín y conjunto de turbina y drenaje.">
              {['cover', 'filters', 'coil', 'base'].map(part => (
                <div className={`m-air-layer m-air-layer-${part}`} key={part}>
                  <Image src="/images/air-exploded.webp" alt="" width={1200} height={1200} sizes="(max-width: 760px) 90vw, 48vw" draggable={false}/>
                </div>
              ))}
              <span className="m-air-product-note" aria-hidden="true"><span/> Cada parte cuenta.</span>
            </div>
            <div className="m-air-controls" role="group" aria-label="Explorar el aire acondicionado">
              {steps.map((step, index) => <button type="button" key={step.control} aria-pressed={active === index} aria-controls={`air-step-${index}`} onClick={() => selectStage(index)}><span>0{index + 1}</span>{step.control}</button>)}
            </div>
            <p className="m-air-motion-hint"><MoveDown size={14} aria-hidden="true"/> Deslizá para descubrir. O elegí una etapa.</p>
          </div>
          <div className="m-air-chapters">
            {steps.map((step, index) => <article id={`air-step-${index}`} ref={element => { articleRefs.current[index] = element }} key={step.control} className="m-air-chapter" data-active={active === index} aria-labelledby={`air-step-title-${index}`}>
              <span className="m-air-eyebrow">{step.eyebrow}</span>
              <h3 id={`air-step-title-${index}`}>{step.title}</h3>
              <p>{step.body}</p>
              <div className="m-air-insight"><Check size={17} aria-hidden="true"/><span>{step.detail}</span></div>
              {index === steps.length - 1 ? <RequestLink>Encontrar mi solución</RequestLink> : <ArrowDown className="m-air-next" size={20} aria-hidden="true"/>}
            </article>)}
          </div>
        </div>
        <p className="m-air-footnote">Vista ilustrativa de una unidad interior. Cada equipo y cada diagnóstico pueden ser diferentes.</p>
        <p className="m-air-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      </div>
    </section>
  )
}
