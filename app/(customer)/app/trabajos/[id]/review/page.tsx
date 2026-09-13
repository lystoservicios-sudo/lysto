import { notFound } from 'next/navigation'

import { CustomerReviewForm } from '@/components/customer/customer-review-form'
import { PageScaffold } from '@/components/layout/page-scaffold'
import { requirePageSession } from '@/lib/auth/session'
import { customerReviewEligibility } from '@/lib/customer/live-model'

export default async function CustomerReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const eligibility = await customerReviewEligibility(await requirePageSession('customer'), id)
  if (!eligibility) notFound()

  return (
    <PageScaffold
      title="Calificar servicio"
      eyebrow="Cierre cliente"
      description="Tu opinión queda asociada al trabajo confirmado y ayuda a mejorar la calidad."
    >
      <CustomerReviewForm
        jobId={id}
        eligible={eligibility.eligible}
        alreadyReviewed={eligibility.alreadyReviewed}
      />
    </PageScaffold>
  )
}
