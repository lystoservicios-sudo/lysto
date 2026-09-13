import { AuthFrame } from '@/components/auth/auth-frame'
import { LoginForm } from '../../login/login-form'
export const metadata = { title: 'Acceso del equipo | Lysto', robots: { index: false, follow: false } }
export default function StaffLoginPage() {
  return <AuthFrame eyebrow="EQUIPO LYSTO" title="Todo listo para empezar." description="Ingresá con tu cuenta habilitada para acceder a tu espacio de trabajo."><LoginForm staff /></AuthFrame>
}
