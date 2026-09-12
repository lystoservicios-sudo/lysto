import { notFound, redirect } from 'next/navigation'
import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { requireSecuritySession } from '@/lib/auth/session'
import { safeLocalRedirectPath } from '@/lib/auth/session-routing'
import { ApiError } from '@/lib/http/api-error'
import { SecurityForm } from './security-form'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Verificación de seguridad | Lysto',
  robots: { index: false, follow: false }
}

export default async function SecurityPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await requireSecuritySession().catch((error) => {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
    if (error instanceof ApiError && error.status === 403) notFound()
    throw error
  })
  const { data, error } = await session.client.auth.mfa.listFactors()
  const destination = safeLocalRedirectPath((await searchParams).next, session.role)
  return (
    <PublicShell>
      <main className="mx-auto max-w-xl px-4 py-12">
        <Card className="p-6 sm:p-8">
          <h1 className="text-3xl font-black">Verificación de seguridad</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Usá un autenticador para proteger el acceso administrativo y las operaciones de tu
            cuenta de cobros.
          </p>
          {error || !data ? (
            <p role="alert" className="mt-6">
              No pudimos consultar tus autenticadores. Recargá la página para volver a intentar.
            </p>
          ) : (
            <SecurityForm
              factors={data.totp
                .filter((factor) => factor.status === 'verified')
                .map((factor) => ({ id: factor.id, name: factor.friendly_name || 'Autenticador' }))}
              assuranceLevel={session.assuranceLevel}
              destination={destination}
            />
          )}
        </Card>
      </main>
    </PublicShell>
  )
}
