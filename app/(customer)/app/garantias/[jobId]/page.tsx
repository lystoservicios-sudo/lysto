import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MorePage, MoreSection, moreStyles as s } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
import { loadWarrantyServices } from '@/lib/support/customer-center'
import { supportDate } from '@/lib/support/customer-content'

export default async function WarrantyDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await requirePageSession('customer'), { jobId } = await params, job = (await loadWarrantyServices(session, { id: jobId })).items[0]
  if (!job) notFound()
  return <MorePage title={job.equipment} description={job.label} backHref="/app/garantias" backLabel="Volver a Garantías">
    <dl className={s.facts}><div className={s.fact}><dt>Servicio finalizado</dt><dd>{supportDate(job.completedAt)}</dd></div><div className={s.fact}><dt>Fin de cobertura registrada</dt><dd>{job.warrantyUntil ? supportDate(job.warrantyUntil) : 'Sin cobertura registrada'}</dd></div></dl>
    <MoreSection title="Qué vamos a revisar"><p className={s.muted}>El informe del servicio, la falla atendida y la vigencia registrada. La cobertura no incluye automáticamente fallas distintas ni trabajos o repuestos no contemplados en el servicio original.</p><p className={s.subtitle}>Si la cobertura finalizó o no figura una fecha, igualmente podés informar el problema para recibir orientación.</p></MoreSection>
    {job.claim ? <MoreSection title="Reclamo registrado"><p className={s.muted} style={{ whiteSpace: 'pre-wrap' }}>{job.claim.description}</p>{job.claim.resolution ? <p className={s.notice}>{job.claim.resolution}</p> : null}{job.claim.caseId ? <Link className={s.primary} href={`/app/ayuda/consultas/${job.claim.caseId}`}>Seguir mi reclamo</Link> : <Link className={s.primary} href={`/app/ayuda/nueva?jobId=${job.id}&categoria=warranty`}>Consultar sobre mi reclamo</Link>}</MoreSection> : <Link className={s.primary} href={`/app/garantias/${job.id}/reclamar`}>Informar un problema</Link>}
    <Link className={s.secondary} href={`/app/trabajos/${job.id}`}>Ver servicio e informe</Link>
  </MorePage>
}
