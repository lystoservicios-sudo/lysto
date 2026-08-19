import { PageScaffold } from '@/components/layout/page-scaffold'
import { ProfessionalCard } from '@/components/business/professional-card'
import { professionals } from '@/lib/mock/lysto-data'

export default function AdminMatchingPage() {
  return <PageScaffold title="Matching" eyebrow="Asignación inteligente" description="Ranking operativo por zona, disponibilidad, matrícula, herramientas, distancia, score y aceptación."><div className="grid gap-4 lg:grid-cols-2">{professionals.map((professional) => <ProfessionalCard key={professional.id} professional={professional} />)}</div></PageScaffold>
}
