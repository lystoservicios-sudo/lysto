import {
  AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ChevronRight,
  Clock3, FileClock, LifeBuoy, ShieldCheck, UserRound, Wrench
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import type { CustomerHomeViewModel, HomeActivityItem } from '@/features/customer/home-view-model'
import { HomeSetupInvite } from './home-setup-invite'
import { HomeIssueCarousel } from './home-issue-carousel'
import styles from './customer-home.module.css'

const activityIcons = {
  decision: AlertCircle, visit: CalendarDays, progress: Clock3,
  draft: FileClock, maintenance: Wrench, support: ShieldCheck
} as const

function visitSchedule(item: HomeActivityItem) {
  if (!item.startsAt || !item.endsAt || !item.timezone) return null
  const date = new Date(item.startsAt)
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('es-AR', { timeZone: item.timezone, ...options }).format(date)
  const time = (value: string) => new Intl.DateTimeFormat('es-AR', {
    timeZone: item.timezone, hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(value)).replace(',', '')
  return {
    day: format({ day: 'numeric' }),
    month: format({ month: 'short' }).replace('.', ''),
    date: format({ weekday: 'long', day: 'numeric', month: 'long' }),
    time: `${time(item.startsAt)}–${time(item.endsAt)}`
  }
}

function ActivityItem({ item, primary = false }: { item: HomeActivityItem; primary?: boolean }) {
  const Icon = activityIcons[item.kind]
  const visit = item.kind === 'visit' ? visitSchedule(item) : null
  const dueDate = item.dueAt ? new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(item.dueAt)) : null

  const quoteDecision = item.kind === 'decision' && item.id.startsWith('quote:') && !item.additionalActions?.length
  const title = quoteDecision ? 'Presupuesto listo' : item.title
  return (
      <article className={primary ? `${styles.activity} ${styles.primaryActivity}` : styles.activity} data-kind={item.kind}>
        <div className={styles.status}>
          {!primary ? <Icon aria-hidden="true" size={16} strokeWidth={1.8} /> : null}
          <span>{primary && item.kind === 'decision' ? 'Requiere tu atención' : item.eyebrow}</span>
        </div>
        <h3 className={styles.activityTitle}>{title}</h3>
        {item.subject && item.subject !== item.title ? <p className={styles.subject}>{item.subject}</p> : null}
        {!visit && !quoteDecision ? <p className={styles.description}>{item.description}</p> : null}
        {visit ? (
          <div className={styles.visit}>
            <div className={styles.calendar} aria-hidden="true">
              <span>{visit.month}</span><strong>{visit.day}</strong>
            </div>
            <div className={styles.visitDetails}>
              <time dateTime={item.startsAt} className={styles.visitDate}>{visit.date}</time>
              <p className={styles.visitTime}>{visit.time}</p>
              {item.professionalName ? (
                <p className={styles.professional}><UserRound aria-hidden="true" size={14} />{item.professionalName}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        {dueDate ? <p className={styles.dueDate}><CalendarDays aria-hidden="true" size={15} />{dueDate}</p> : null}
        {item.disabledReason ? <p className={styles.disabledReason}>{item.disabledReason}</p> : null}
        {item.action ? (
          <div className={styles.activityActions}>
            <Link href={item.action.href} className={styles.activityAction}>
              {item.action.label}<ArrowRight aria-hidden="true" size={17} />
            </Link>
            {item.additionalActions?.map((action) => (
              <Link key={`${action.href}:${action.label}`} href={action.href} className={styles.secondaryAction}>
                {action.label}<ChevronRight aria-hidden="true" size={16} />
              </Link>
            ))}
          </div>
        ) : null}
      </article>
  )
}

export function CustomerHome({ model }: { model: CustomerHomeViewModel }) {
  const activity = model.activity.filter(item => item.id !== `maintenance:${model.household?.maintenanceId}`)
  const [primary, ...remaining] = activity
  const serviceDate = model.lastService?.completedAt ? new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short'
  }).format(new Date(model.lastService.completedAt)).replace('.', '') : null
  return (
    <div className={styles.home}>
      <h1 className={styles.pageTitle}>Inicio</h1>
      {model.unavailableSections.length ? (
        <div role="status" className={styles.notice}>
          <AlertCircle aria-hidden="true" size={18} />
          <p>No pudimos cargar parte de tu información. Podés seguir usando los accesos de Inicio.</p>
          <Link href="/app" className={styles.secondaryAction}>Reintentar</Link>
        </div>
      ) : null}
      {primary ? (
        <section aria-label="Lo importante ahora">
          <ActivityItem item={primary} primary />
          {remaining.length ? (
            <ol className={styles.activityList} aria-label="Otras novedades y acciones pendientes">
              {remaining.map(item => <li key={item.id}><ActivityItem item={item} /></li>)}
            </ol>
          ) : null}
          {model.hiddenActivityCount > 0 ? <Link href="/app/trabajos" className={styles.moreLink}>Ver más actividad<ChevronRight aria-hidden="true" size={16} /></Link> : null}
        </section>
      ) : null}
      <section aria-labelledby="home-services-title">
        <h2 id="home-services-title" className={styles.sectionTitle}>¿Qué necesitás?</h2>
        <p className={styles.sectionDescription}>Elegí el problema de tu aire</p>
        <HomeIssueCarousel />
        <Link href={model.service.href} className={styles.orientationLink}>No sé qué le pasa<ChevronRight aria-hidden="true" size={20} /></Link>
      </section>
      <div className={styles.supportSections}>
        {model.household ? (
          <section aria-labelledby="home-household-title">
            <div className={styles.sectionHeader}>
              <h2 id="home-household-title" className={styles.sectionTitle}>Tu hogar</h2>
              <Link href="/app/hogar" className={styles.sectionLink}>Ver hogar<ChevronRight aria-hidden="true" size={17} /></Link>
            </div>
            <Link href={model.household.action.href} className={styles.equipment}>
              <Image src="/images/customer-home-air.png" alt="" width={224} height={128} sizes="(max-width: 719px) 104px, 120px" className={styles.equipmentImage} />
              <span className={styles.equipmentCopy}>
                <span className={styles.equipmentTitle}>{model.household.title}</span>
                <span className={styles.description}>{model.household.description}</span>
                <span className={styles.equipmentAction}>{model.household.action.label}<ChevronRight aria-hidden="true" size={17} /></span>
              </span>
            </Link>
          </section>
        ) : null}
        {model.setupInvite ? <HomeSetupInvite invite={model.setupInvite} preferenceScope={model.preferenceScope} /> : null}
        <section aria-labelledby="home-last-service-title">
          <div className={styles.sectionHeader}>
            <h2 id="home-last-service-title" className={styles.sectionTitle}>{model.lastService ? 'Último servicio' : 'Tus servicios'}</h2>
            <Link href="/app/trabajos" className={styles.sectionLink}>{model.lastService ? 'Ver todos' : 'Ver servicios'}<ChevronRight aria-hidden="true" size={17} /></Link>
          </div>
          {model.lastService ? (
            <Link href={model.lastService.action.href} className={styles.completedService}>
              <CheckCircle2 aria-hidden="true" size={28} strokeWidth={1.7} className={styles.completedIcon} />
              <span className={styles.completedCopy}>
                <span className={styles.rowTitle}>{model.lastService.title}</span>
                <span className={styles.rowDescription}>{serviceDate ? `${serviceDate} · ` : ''}{model.lastService.action.label}</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} className={styles.chevron} />
            </Link>
          ) : <p className={styles.emptyDescription}>Tus solicitudes y el seguimiento de cada servicio, en un solo lugar.</p>}
        </section>
      </div>
      <Link href="/app/mas" className={styles.helpLink}>
        <LifeBuoy aria-hidden="true" size={27} strokeWidth={1.65} className={styles.helpIcon} />
        <span className={styles.completedCopy}>
          <span className={styles.rowTitle}>¿Necesitás ayuda?</span>
          <span className={styles.rowDescription}>Ayuda, pagos y garantías</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className={styles.chevron} />
      </Link>
    </div>
  )
}
