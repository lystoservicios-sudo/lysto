import { PageScaffold } from '@/components/layout/page-scaffold'
import { ProfessionalOnboardingFormMock } from '@/components/business/forms'

export default function AdminProfessionalInvitationsPage() {
  return <PageScaffold title="Invitaciones profesionales" eyebrow="Admin" description="Crear link de onboarding para técnicos. El registro no es público."><ProfessionalOnboardingFormMock /></PageScaffold>
}
