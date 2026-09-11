import Link from 'next/link'
import { PublicShell } from '@/components/layout/page-shell'
import { Input } from '@/components/ui/input'
import { validAccountToken } from '@/lib/auth/account-response'
export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token_hash?: string; error?: string }> }) {
  const params = await searchParams
  const token = typeof params.token_hash === 'string' && validAccountToken(params.token_hash) ? params.token_hash : null
  return <PublicShell><main className="mx-auto max-w-xl px-4 py-12"><h1 className="text-3xl font-black">Elegí una contraseña nueva</h1>
    {params.error && <p role="alert" className="mt-4">No pudimos restablecer el acceso. El enlace puede haber vencido o ya haber sido usado. Solicitá uno nuevo.</p>}
    {token ? <form action="/auth/reset-password" method="post" className="mt-6 space-y-4"><input type="hidden" name="token_hash" value={token} /><label className="block space-y-2 text-sm font-bold">Nueva contraseña<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><label className="block space-y-2 text-sm font-bold">Repetir contraseña<Input name="repeatPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><p className="text-sm">Usá entre 12 y 128 caracteres.</p><button type="submit" className="h-12 rounded-xl bg-blue-700 px-6 font-bold text-white">Guardar contraseña</button></form> : <p className="mt-4">Abrí el enlace que recibiste por correo para continuar.</p>}
    <Link href="/recuperar" className="mt-6 inline-block font-bold text-blue-700 underline">Solicitar otro enlace</Link>
  </main></PublicShell>
}
