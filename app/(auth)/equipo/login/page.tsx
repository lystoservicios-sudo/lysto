import { AuthFrame } from '@/components/auth/auth-frame'
import { LoginForm } from '../../login/login-form'
import { requiredRoleForPath, safeLocalRedirectPath } from '@/lib/auth/session-routing'
export const metadata = { title: 'Acceso del equipo | Lysto', robots: { index: false, follow: false } }
export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const requested = (await searchParams).next
  const role = typeof requested === 'string' ? requiredRoleForPath(requested.split(/[?#]/)[0]) : null
  const next = role === 'admin' || role === 'professional' ? safeLocalRedirectPath(requested, role) : undefined
  return <AuthFrame eyebrow="EQUIPO LYSTO" title="Todo listo para empezar." description="Ingresá con tu cuenta habilitada para acceder a tu espacio de trabajo."><LoginForm staff next={next} /></AuthFrame>
}
