import { ArrowRight, CalendarClock, Camera, MapPin } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import type { CustomerRequestViewModel, CustomerUiTone } from '@/features/customer/view-models'
import { moreStyles } from './more/more-ui'
import styles from './customer-secondary.module.css'

const badgeTones: Record<CustomerUiTone, 'blue' | 'green' | 'amber' | 'red' | 'slate'> = {
  brand: 'blue',
  success: 'green',
  warning: 'amber',
  danger: 'red',
  benefit: 'green',
  neutral: 'slate'
}

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
})
const unsubmittedStatuses = new Set(['draft', 'diagnosis_completed', 'address_completed', 'schedule_completed', 'price_selected'])

export function CustomerRequestSummaryCard({ request }: { request: CustomerRequestViewModel }) {
  const unsubmitted = unsubmittedStatuses.has(request.status)
  return <li className={styles.requestRow}>
    <article>
      <div className={styles.requestTop}>
        <h2>{request.issueLabel}</h2>
        <Badge tone={unsubmitted ? 'slate' : badgeTones[request.statusView.tone]}>{unsubmitted ? 'Solicitud sin enviar' : request.statusView.label}</Badge>
      </div>
      {unsubmitted ? <p className={styles.requestNext}>Este registro no llegó a enviarse. Si todavía necesitás ayuda, podés iniciar una nueva solicitud en Pedir.</p> : <>
        <div className={styles.requestMeta}>
          <p><MapPin size={18} aria-hidden="true" /><span>{request.address}</span></p>
          <p><CalendarClock size={18} aria-hidden="true" /><span>{request.preferredWindow}</span></p>
          {request.mediaCount > 0 ? <p><Camera size={18} aria-hidden="true" /><span>{request.mediaCount} {request.mediaCount === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}</span></p> : null}
        </div>
        <p className={styles.requestNext}>{request.nextStep}</p>
      </>}
      <div className={styles.requestFooter}>
        <Link href={unsubmitted ? '/app/solicitar/aire-acondicionado' : '/app/trabajos'} className={moreStyles.textAction}>
          {unsubmitted ? 'Pedir un nuevo servicio' : 'Ver en Servicios'}<ArrowRight size={18} aria-hidden="true" />
        </Link>
        {!unsubmitted && request.preliminaryPrice !== null ? <strong>{moneyFormatter.format(request.preliminaryPrice)}</strong> : null}
      </div>
    </article>
  </li>
}
