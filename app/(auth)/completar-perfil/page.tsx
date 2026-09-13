import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AuthFrame } from '@/components/auth/auth-frame'
import { CompleteProfileForm } from '@/components/auth/customer-forms'
import { readCustomerSession } from '@/lib/auth/customer-session'
import { missingCustomerFields, safeCustomerNext } from '@/lib/auth/customer-access'
export const metadata = { title: 'Completá tu perfil | Lysto', robots: { index: false, follow: false } }
export default async function CompleteProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: requestedNext } = await searchParams
  const next = safeCustomerNext(requestedNext)
  const session = await readCustomerSession().catch(() => null)
  if (!session) return <AuthFrame title="Un momento, por favor." description="No pudimos cargar tus datos. Intentá nuevamente en unos minutos."><Link className="auth-link" href="/completar-perfil">Volver a intentar</Link></AuthFrame>
  if (session.kind !== 'customer') redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!session.verified) redirect('/login?notice=confirm-email')
  const missing = missingCustomerFields(session.profile, session.address)
  if (!missing.length) redirect(next)
  return <AuthFrame eyebrow="UN ÚLTIMO PASO" title="Contanos un poquito más." description="Solo necesitamos los datos que faltan para ayudarte con tu primer servicio.">
    <div className="auth-progress" aria-hidden="true"><span /></div>
    <div className="auth-saved">Tu cuenta ya está creada. Estos datos quedan guardados para tus próximos servicios.</div>
    <CompleteProfileForm missing={missing} next={next} />
  </AuthFrame>
}
