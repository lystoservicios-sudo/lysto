import { PageScaffold } from '@/components/layout/page-scaffold'
import { RecordList, RecordRow } from '@/components/business/record-list'
import { AIR_CONDITIONING_ISSUES } from '@/lib/domain/constants'

export default function AdminServicesPage() {
  return <PageScaffold title="Servicios" eyebrow="Admin" description="Configuración multi-rubro preparada. MVP activo: aire acondicionado."><RecordList title="Problemas de aire acondicionado">{AIR_CONDITIONING_ISSUES.map((issue) => <RecordRow key={issue.slug} title={`${issue.emoji} ${issue.title}`} subtitle={issue.description} meta={issue.slug} />)}</RecordList></PageScaffold>
}
