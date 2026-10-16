import { InvitationEntry } from '@/components/pro/invitation-entry'
import { ConnectedProfessionalOnboarding } from '@/components/pro/connected-professional-onboarding'
import { ownOnboardingContext } from '@/lib/professional/onboarding-context'
import { ApiError } from '@/lib/http/api-error'
import { readTrustedRole } from '@/lib/auth/session-routing'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { RegistrationRestrictedState, RegistrationRetry } from '@/components/pro/registration-access'
import styles from '@/components/pro/registration-access.module.css'

const restrictedSession = z.object({
  role: z.literal('professional'),
  profile_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  session_id: z.string().uuid(),
  session_active: z.literal(true),
  professional_status: z.enum(['suspended', 'inactive'])
})

/** Restricted accounts may see their status, never the protected application. */
async function ownRestrictedStatus(): Promise<'suspended' | 'inactive' | null> {
  try {
    const client = await createServerSupabaseClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data.user?.id || !data.user.email_confirmed_at ||
      readTrustedRole(data.user.app_metadata) !== 'professional') return null
    const context = await client.rpc('get_session_context')
    const parsed = restrictedSession.safeParse(context.data)
    return !context.error && parsed.success ? parsed.data.professional_status : null
  } catch {
    return null
  }
}

export default async function Page() {
  try {
    return <ConnectedProfessionalOnboarding initial={await ownOnboardingContext()} />
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) {
      const restricted = await ownRestrictedStatus()
      if (restricted) return <RegistrationRestrictedState status={restricted} />
    }
    if (error instanceof ApiError && [401, 403, 404].includes(error.status))
      return <InvitationEntry />
    return (
      <section role="alert" className={styles.failure}>
        <h1>No pudimos cargar tu postulación</h1>
        <p>El registro no está disponible en este momento. Podés volver a intentar sin perder los pasos que ya guardaste.</p>
        <RegistrationRetry />
      </section>
    )
  }
}
