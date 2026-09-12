import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ConnectedProfessionalReview } from '@/components/admin/connected-professional-review'
import { requirePageSession } from '@/lib/auth/session'
import { readProfessionalReview } from '@/lib/professional/onboarding-service'
import { professionalCatalog } from '@/lib/professional/onboarding-context'
import { ApiError } from '@/lib/http/api-error'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requirePageSession('admin')
  if (
    !z.string().uuid().safeParse(id).success ||
    !session.permissions.some((value) => ['owner', 'operations'].includes(value))
  )
    notFound()
  try {
    const [initial, catalog] = await Promise.all([
      readProfessionalReview(session.client, id),
      professionalCatalog(session.client)
    ])
    return <ConnectedProfessionalReview initial={initial} catalog={catalog} />
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }
}
