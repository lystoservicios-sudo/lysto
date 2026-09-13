import type { Metadata } from 'next'
import { AuthFrame } from '@/components/auth/auth-frame'
import { authNotice, safeCustomerNext } from '@/lib/auth/customer-access'
import { LoginForm } from './login-form'
import { EmailHelpForm } from '@/components/auth/customer-forms'
export const metadata: Metadata = { title: 'Ingresar | Lysto', robots: { index: false, follow: false } }
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string; reset?: string }> }) {
  const params = await searchParams
  const next = safeCustomerNext(params.next)
  const notice = authNotice(params.reset === 'success' ? 'password-updated' : params.notice)
  return <AuthFrame title="Qué bueno verte de nuevo." description="Ingresá a tu cuenta y dejá que nos ocupemos de tu hogar.">
    {notice && <div role="status" className="auth-notice">{notice}</div>}
    <LoginForm next={next} />
    <details className="auth-resend"><summary>¿No recibiste el email de confirmación?</summary><EmailHelpForm mode="confirmation" next={next} /></details>
  </AuthFrame>
}
