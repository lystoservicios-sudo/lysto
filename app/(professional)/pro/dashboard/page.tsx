import { LiveProfessionalDashboard } from '@/components/pro/live-professional'
import { requireProfessionalWorkspaceSession } from '@/lib/auth/session'
import {
  listProfessionalJobsLive,
  readProfessionalLiveProfile
} from '@/lib/professional/live-model'

export default async function Page() {
  const session = await requireProfessionalWorkspaceSession()
  const pending = session.professionalStatus !== 'approved' || !session.professionalEligible
  const [profile, jobs] = await Promise.all([
    readProfessionalLiveProfile(session),
    pending ? Promise.resolve({ items: [] }) : listProfessionalJobsLive(session, { pageSize: 50 })
  ])
  return (
    <LiveProfessionalDashboard
      name={profile.first_name}
      rating={profile.rating_avg}
      jobs={jobs.items}
      pending={pending}
    />
  )
}
