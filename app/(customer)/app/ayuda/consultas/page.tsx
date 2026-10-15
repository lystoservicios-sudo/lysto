import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { MoreEmpty, MoreLink, MorePage, MoreSection, moreStyles as s } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
import { loadCustomerCases } from '@/lib/support/customer-center'
import { supportCategories, supportDate, supportStatusLabels } from '@/lib/support/customer-content'

export default async function CustomerCasesPage({ searchParams }: { searchParams: Promise<{ estado?: string; cursor?: string }> }) {
  const session = await requirePageSession('customer'), input = await searchParams, state = input.estado === 'resueltas' ? 'closed' : 'open'
  const page = await loadCustomerCases(session, { state, ...(input.cursor ? { cursor: input.cursor } : {}) })
  return <MorePage title="Mis consultas" description="Seguí las novedades y aportá información al equipo." backHref="/app/ayuda" backLabel="Volver a Ayuda">
    <nav className={s.filters} aria-label="Estado de las consultas"><Link href="/app/ayuda/consultas" aria-current={state === 'open' ? 'page' : undefined}>Abiertas</Link><Link href="/app/ayuda/consultas?estado=resueltas" aria-current={state === 'closed' ? 'page' : undefined}>Resueltas</Link></nav>
    {page.items.length ? <MoreSection title={state === 'open' ? 'En seguimiento' : 'Consultas cerradas'}>{page.items.map(item => <MoreLink key={item.id} href={`/app/ayuda/consultas/${item.id}`} title={supportCategories.find(c => c.value === item.category)?.label ?? 'Consulta'} description={`${supportDate(item.createdAt)} · ${item.description.slice(0, 100)}${item.description.length > 100 ? '…' : ''}`} badge={supportStatusLabels[item.status] ?? 'En seguimiento'} icon={MessageCircle} />)}</MoreSection> : <MoreEmpty title={state === 'open' ? 'No tenés consultas abiertas' : 'Todavía no hay consultas resueltas'} description={state === 'open' ? 'Si necesitás ayuda con un servicio, un pago o tu cuenta, podés abrir una consulta y seguirla acá.' : 'Cuando finalice la revisión de una consulta, vas a poder volver a leer su seguimiento en este espacio.'} />}
    {page.nextCursor ? <Link className={s.secondary} href={`/app/ayuda/consultas?estado=${state === 'closed' ? 'resueltas' : 'abiertas'}&cursor=${encodeURIComponent(page.nextCursor)}`}>Ver consultas anteriores</Link> : null}<Link className={s.primary} href="/app/ayuda/nueva">Nueva consulta</Link>
  </MorePage>
}
