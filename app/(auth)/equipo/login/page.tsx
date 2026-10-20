import { AuthFrame } from '@/components/auth/auth-frame'
import { redirect } from 'next/navigation'
import { existingLoginDestination } from '@/lib/auth/login-destination'
import { LoginForm } from '../../login/login-form'
import { requiredRoleForPath, safeLocalRedirectPath } from '@/lib/auth/session-routing'
import { InvitationEntry } from '@/components/pro/invitation-entry'
import styles from '@/components/pro/registration-access.module.css'
export const metadata = { title: 'Acceso del equipo | Lysto', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const requested = (await searchParams).next
  const role = typeof requested === 'string' ? requiredRoleForPath(requested.split(/[?#]/)[0]) : null
  const next = role === 'admin' || role === 'professional' ? safeLocalRedirectPath(requested, role) : undefined
  if (next && /^\/pro\/onboarding(?:\/[A-Za-z0-9_-]{43})?$/.test(next))
    return <main className={styles.canvas}><InvitationEntry token={next === '/pro/onboarding' ? undefined : next.split('/')[3]} /></main>
  const destination = await existingLoginDestination(requested)
  if (destination) redirect(destination)
  return <AuthFrame variant="staff" eyebrow="EQUIPO LYSTO" title="Todo listo para empezar." description="Ingresá con tu cuenta habilitada para acceder a tu espacio de trabajo."><LoginForm staff next={next} /></AuthFrame>
}
