'use client'
import Link from 'next/link'
import { MorePage, moreStyles as styles } from '@/components/customer/more/more-ui'
export default function CustomerPaymentsError({ reset }: { error: Error; reset: () => void }) {
  return <MorePage title="No pudimos cargar tus pagos" description="No se modificó ningún pago. Intentá nuevamente para consultar el estado confirmado.">
    <div className={styles.actions}><button type="button" className={styles.primary} onClick={reset}>Reintentar</button>
      <Link className={styles.secondary} href="/app/ayuda/nueva?category=payment">Pedir ayuda</Link></div>
  </MorePage>
}
