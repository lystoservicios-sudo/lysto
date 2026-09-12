import { LiveProfessionalProfile } from '@/components/pro/live-professional'
import { requirePageSession } from '@/lib/auth/session'
import { readProfessionalLiveProfile } from '@/lib/professional/live-model'

export default async function Page() {
  return (
    <LiveProfessionalProfile
      profile={await readProfessionalLiveProfile(await requirePageSession('professional'))}
    />
  )
}
