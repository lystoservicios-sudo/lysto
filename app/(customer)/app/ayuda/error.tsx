'use client'
import Link from 'next/link'
import { MorePage, moreStyles as s } from '@/components/customer/more/more-ui'
export default function CustomerHelpError({ reset }: { reset: () => void }) {
  return <MorePage title="No pudimos cargar la ayuda" description="Tu consulta no se pierde por un error de carga. Reintentá para recuperar el seguimiento."><div className={s.actions}><button type="button" className={s.primary} onClick={reset}>Reintentar</button><Link className={s.secondary} href="/app/ayuda">Volver a Ayuda</Link></div></MorePage>
}
