import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ConnectedProfessionalReview } from '@/components/admin/connected-professional-review'
import { ConnectedProfessionalInvitationDetail } from '@/components/admin/connected-professional-invitation-detail'
import { requirePageSession } from '@/lib/auth/session'
import { readProfessionalReview, readProfessionalInvitationAdmin } from '@/lib/professional/onboarding-service'
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
    const [initial, catalog, jobs] = await Promise.all([
      readProfessionalReview(session.client, id),
      professionalCatalog(session.client),
      session.client.from('jobs').select('id,status,created_at').eq('professional_id', id)
        .order('created_at', { ascending: false }).limit(50)
    ])
    if (jobs.error) throw new ApiError('service_unavailable')
    return <ConnectedProfessionalReview initial={initial} catalog={catalog} jobs={jobs.data ?? []} />
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      try {
        return <ConnectedProfessionalInvitationDetail invitation={await readProfessionalInvitationAdmin(session, id)} />
      } catch (invitationError) {
        if (invitationError instanceof ApiError && invitationError.status === 404) notFound()
        throw invitationError
      }
    }
    throw error
  }
}
