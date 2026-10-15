import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { MoreEmpty, MoreLink, MorePage, MoreSection, moreStyles as s } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
import { loadWarrantyServices } from '@/lib/support/customer-center'
import { supportDate } from '@/lib/support/customer-content'

export default async function CustomerWarrantyPage({ searchParams }: { searchParams: Promise<{ cursor?: string }> }) {
  const session = await requirePageSession('customer'), input = await searchParams, page = await loadWarrantyServices(session, input)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  return <MorePage title="Garantías y reclamos" description="El respaldo de tus servicios, con su cobertura y seguimiento reales.">
    <p className={s.notice}>Si volvió un problema, elegí el servicio e informanos qué ocurrió. Revisaremos el cierre y la cobertura antes de confirmar una garantía.</p>
    {page.items.length ? <MoreSection title="Servicios finalizados">{page.items.map(job => <MoreLink key={job.id} href={`/app/garantias/${job.id}`} title={job.equipment} description={`${job.label} · ${supportDate(job.completedAt)}`} badge={job.claim ? 'Reclamo registrado' : job.warrantyUntil ? job.warrantyUntil >= today ? `Cobertura hasta ${supportDate(job.warrantyUntil)}` : 'Cobertura finalizada' : 'Sin cobertura registrada'} icon={ShieldCheck} />)}</MoreSection> : <MoreEmpty title="Tu respaldo empieza con un servicio finalizado" description="Acá aparecerán sus condiciones de garantía. Si necesitás ayuda antes del cierre, podés consultar desde el servicio o abrir una consulta." />}
    {page.nextCursor ? <Link className={s.secondary} href={`/app/garantias?cursor=${encodeURIComponent(page.nextCursor)}`}>Ver servicios anteriores</Link> : null}<div className={s.actions}><Link className={s.secondary} href="/app/ayuda/consultas">Mis reclamos y consultas</Link><Link className={s.secondary} href="/app/trabajos">Ver mis servicios</Link></div>
  </MorePage>
}
