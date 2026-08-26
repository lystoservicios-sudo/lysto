import { notFound } from 'next/navigation'

import { CustomerReviewForm } from '@/components/customer/customer-review-form'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { customerDemoFixtures } from '@/features/customer/fixtures/customer-demo-fixtures'
import { findCustomerRecordById } from '@/features/customer/view-models'

export default async function CustomerReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = findCustomerRecordById(customerDemoFixtures.jobs, id)
  if (!job) notFound()

  return (
    <PageScaffold title="Calificar servicio" eyebrow="Cierre cliente · Demostración" description="Completá tu experiencia sin registrar cambios hasta que el envío esté conectado.">
      <CustomerReviewForm jobId={job.id} professionalName={job.professionalName} eligible={job.status === 'completed' && job.canReview} alreadyReviewed={job.alreadyReviewed} />
    </PageScaffold>
  )
}
