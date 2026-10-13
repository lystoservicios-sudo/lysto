'use client'

import { AirVent, Droplet, Flame, Power, Snowflake, Sparkles, Volume2 } from 'lucide-react'
import Link from 'next/link'
import type { KeyboardEvent } from 'react'

import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'
import styles from './customer-home.module.css'

const icons = {
  no_enfria: Snowflake, pierde_agua: Droplet, hace_ruido: Volume2,
  no_enciende: Power, no_funciona_calor: Flame, instalacion: AirVent, mantenimiento: Sparkles
} as const

function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'))
  const current = event.target instanceof Element ? event.target.closest('a') : null
  const index = current ? links.indexOf(current) : -1
  if (index < 0) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
    : Math.max(0, Math.min(links.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))
  links[next]?.focus()
}

export function HomeIssueCarousel() {
  return (
    <div>
      <nav aria-label="Problemas y servicios de aire acondicionado" aria-describedby="home-carousel-hint" className={styles.issueCarousel} onKeyDown={moveFocus}>
        {AIR_CONDITIONING_ISSUES.map(issue => {
          const Icon = icons[issue.slug]
          return (
            <Link key={issue.slug} href={`/app/solicitar/aire-acondicionado?problema=${issue.slug}`} className={styles.issueLink}>
              <span className={styles.issueIcon}><Icon aria-hidden="true" size={24} strokeWidth={1.7} /></span>
              <span className={styles.issueLabel}>{issue.slug === 'no_funciona_calor' ? 'No calienta' : issue.title}</span>
            </Link>
          )
        })}
      </nav>
      <p id="home-carousel-hint" className={styles.carouselHint}>Deslizá para ver más</p>
    </div>
  )
}
