import { redirect } from 'next/navigation'
import { ProPage } from '@/components/pro/pro-ui'
import { ProfessionalPasswordForm } from '@/components/pro/professional-password-form'
import { requireProfessionalWorkspaceSession } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

export const metadata = { title: 'Seguridad de la cuenta | Lysto', robots: { index: false, follow: false } }
export default async function ProfessionalSecurityPage() {
  const session = await requireProfessionalWorkspaceSession()
  const ready = await session.client.rpc('professional_password_change_ready')
  if (ready.error) throw new ApiError('service_unavailable')
  if (!ready.data) redirect('/pro/onboarding')
  return <ProPage title="Seguridad de la cuenta" description="Actualizá tu contraseña usando la clave provisoria actual o tu contraseña vigente." back={{ href: '/pro/perfil', label: 'Mi perfil' }}>
    <ProfessionalPasswordForm />
  </ProPage>
}
