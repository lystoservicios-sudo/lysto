import Link from 'next/link'
import { AuthFrame } from '@/components/auth/auth-frame'
import { PasswordResetForm } from '@/components/auth/password-reset-form'
import { validAccountToken } from '@/lib/auth/account-response'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nueva contraseña | Lysto', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; error?: string }> }) {
  const params = await searchParams
  const token = typeof params.token_hash === 'string' && validAccountToken(params.token_hash) ? params.token_hash : null
  return <AuthFrame title="Creá una nueva contraseña" description="Elegí tu nueva contraseña para volver a ingresar.">
    {params.error && <p role="alert" className="auth-notice auth-notice-error">No pudimos restablecer el acceso. El enlace puede haber vencido o ya haber sido usado. Solicitá uno nuevo.</p>}
    {token ? <PasswordResetForm token={token} /> : <p role="status" className="auth-notice">Abrí el enlace que recibiste por correo para continuar.</p>}
    <p className="auth-form-bottom"><Link href="/recuperar" className="auth-link">Solicitar otro enlace</Link></p>
  </AuthFrame>
}
