import { LiveProfessionalDashboard } from '@/components/pro/live-professional'
import { requirePageSession } from '@/lib/auth/session'
import {
  listProfessionalJobsLive,
  readProfessionalLiveProfile
} from '@/lib/professional/live-model'

export default async function Page() {
  const session = await requirePageSession('professional')
  const [profile, jobs] = await Promise.all([
    readProfessionalLiveProfile(session),
    listProfessionalJobsLive(session, { pageSize: 50 })
  ])
  return (
    <LiveProfessionalDashboard
      name={profile.first_name}
      rating={profile.rating_avg}
      jobs={jobs.items}
    />
  )
}
