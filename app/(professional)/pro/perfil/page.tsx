import { LiveProfessionalProfile } from '@/components/pro/live-professional'
import { requirePageSession } from '@/lib/auth/session'
import { readProfessionalLiveProfile } from '@/lib/professional/live-model'

export default async function Page() {
  const session = await requirePageSession('professional')
  const canChangePassword = await session.client.rpc('professional_password_change_ready')
  return (
    <LiveProfessionalProfile
      profile={await readProfessionalLiveProfile(session)}
      canChangePassword={!canChangePassword.error && canChangePassword.data === true}
    />
  )
}
