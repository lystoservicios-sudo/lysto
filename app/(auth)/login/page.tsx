import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { existingLoginDestination } from '@/lib/auth/login-destination'
import { AuthFrame } from '@/components/auth/auth-frame'
import { authNotice, safeCustomerNext } from '@/lib/auth/customer-access'
import { LoginForm } from './login-form'
import { EmailHelpForm } from '@/components/auth/customer-forms'
export const metadata: Metadata = { title: 'Ingresar | Lysto', robots: { index: false, follow: false } }
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string; reset?: string; confirmation?: string }> }) {
  const params = await searchParams
  const destination = await existingLoginDestination(params.next)
  if (destination) redirect(destination)
  const next = safeCustomerNext(params.next)
  const notice = authNotice(params.reset === 'success' ? 'password-updated' : params.notice)
  return <AuthFrame title="Ingresá a tu cuenta" description="Seguí tus servicios desde acá.">
    {notice && <div role="status" className="auth-notice">{notice}</div>}
    <LoginForm next={next} />
    <details id="reenviar-confirmacion" className="auth-resend" open={params.confirmation === 'resend'}><summary>¿No recibiste el email de confirmación?</summary><EmailHelpForm mode="confirmation" next={next} /></details>
  </AuthFrame>
}
