import { LiveProfessionalJobs } from '@/components/pro/live-professional'
import { ButtonLink } from '@/components/ui/button'
import { requirePageSession } from '@/lib/auth/session'
import { listProfessionalJobsLive } from '@/lib/professional/live-model'

export default async function Page({
  searchParams = Promise.resolve({})
}: {
  searchParams?: Promise<{ cursor?: string }>
}) {
  const { cursor } = await searchParams
  const page = await listProfessionalJobsLive(await requirePageSession('professional'), {
    pageSize: 25,
    ...(cursor ? { cursor } : {})
  })
  return (
    <div className="space-y-5">
      <LiveProfessionalJobs jobs={page.items} />
      {page.nextCursor ? (
        <ButtonLink
          variant="secondary"
          href={`/pro/trabajos?cursor=${encodeURIComponent(page.nextCursor)}`}
        >
          Ver trabajos anteriores
        </ButtonLink>
      ) : null}
    </div>
  )
}
