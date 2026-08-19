import { PageScaffold } from '@/components/layout/page-scaffold'
import { DataList, DataRow } from '@/components/dashboard/data-list'
import { payments, money } from '@/lib/mock/lysto-data'

export default function ProfessionalPaymentsPage() {
  return (
    <PageScaffold title="Pagos profesional" eyebrow="Profesional" description="Liquidaciones, comisiones, trabajos pagados y estado de Mercado Pago.">
      <DataList title="Mis liquidaciones">
        {payments.map((payment) => <DataRow key={payment.id} title={money(payment.professionalAmount)} subtitle={`Trabajo ${payment.jobId} · ${payment.customer}`} meta={`Total cliente ${money(payment.amount)} · comisión Lysto ${money(payment.platformFee)}`} status={payment.status} />)}
      </DataList>
    </PageScaffold>
  )
}
