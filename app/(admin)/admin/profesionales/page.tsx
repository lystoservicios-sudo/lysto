import { PageScaffold } from '@/components/layout/page-scaffold'
import { ProfessionalCard } from '@/components/business/professional-card'
import { professionals } from '@/lib/mock/lysto-data'

export default function AdminProfessionalsPage() {
  return <PageScaffold title="Profesionales" eyebrow="Admin" description="Onboarding, aprobación, suspensión, documentación, herramientas, zonas, score y pagos."><div className="grid gap-4 lg:grid-cols-2">{professionals.map((professional) => <ProfessionalCard key={professional.id} professional={professional} />)}</div></PageScaffold>
}
