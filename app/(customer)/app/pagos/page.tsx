import { PaymentPanel } from '@/components/payments/payment-panel'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { requirePageSession } from '@/lib/auth/session'
import { listCustomerJobsLive } from '@/lib/customer/live-model'

export default async function CustomerPaymentsPage() {
  const session = await requirePageSession('customer')
  const jobs = await listCustomerJobsLive(session, { pageSize: 100 })

  return (
    <PageScaffold
      title="Pagos y movimientos"
      eyebrow="Protección Lysto"
      description="Consultá tus servicios y pagá con Mercado Pago cuando el profesional haya aceptado el trabajo."
    >
      {jobs.items.length ? (
        <div className="space-y-5">
          {jobs.items.map((job) => (
            <PaymentPanel
              key={job.id}
              role="customer"
              jobId={job.id}
              jobStatus={job.status}
              serviceAmount={job.finalAmount ?? job.amount}
            />
          ))}
        </div>
      ) : (
        <PaymentPanel role="customer" />
      )}
    </PageScaffold>
  )
}
