import { InvitationEntry } from '@/components/pro/invitation-entry'
import { ConnectedProfessionalOnboarding } from '@/components/pro/connected-professional-onboarding'
import { ownOnboardingContext } from '@/lib/professional/onboarding-context'
import { ApiError } from '@/lib/http/api-error'
export default async function Page() {
  try {
    return <ConnectedProfessionalOnboarding initial={await ownOnboardingContext()} />
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status))
      return <InvitationEntry />
    return (
      <section role="alert">
        <h1>No pudimos cargar tu postulación</h1>
        <p>Intentá recargar la página en unos minutos.</p>
      </section>
    )
  }
}
