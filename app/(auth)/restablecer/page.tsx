import Link from 'next/link'
import { AuthFrame } from '@/components/auth/auth-frame'
import { AuthInput } from '@/components/auth/auth-fields'
import { validAccountToken } from '@/lib/auth/account-response'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Nueva contraseña | Lysto', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; error?: string }> }) {
  const params = await searchParams
  const token = typeof params.token_hash === 'string' && validAccountToken(params.token_hash) ? params.token_hash : null
  return <AuthFrame title="Una nueva contraseña. Y listo." description="Elegí una contraseña segura para volver a disfrutar de tu cuenta.">
    {params.error && <p role="alert" className="auth-notice">No pudimos restablecer el acceso. El enlace puede haber vencido o ya haber sido usado. Solicitá uno nuevo.</p>}
    {token ? <form action="/auth/reset-password" method="post" className="auth-form"><input type="hidden" name="token_hash" value={token} /><AuthInput label="Nueva contraseña" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} /><AuthInput label="Repetir contraseña" name="repeatPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} /><p className="auth-help">Usá entre 12 y 128 caracteres.</p><button type="submit" className="auth-button">Guardar contraseña</button></form> : <p className="auth-notice">Abrí el enlace que recibiste por correo para continuar.</p>}
    <p className="auth-form-bottom"><Link href="/recuperar" className="auth-link">Solicitar otro enlace</Link></p>
  </AuthFrame>
}
