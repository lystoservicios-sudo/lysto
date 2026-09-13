import { AuthFrame } from '@/components/auth/auth-frame'
import { UpdatePasswordForm } from '@/components/auth/customer-forms'
export const metadata = { title: 'Nueva contraseña | Lysto', robots: { index: false, follow: false } }
export default function UpdatePasswordPage() {
  return <AuthFrame title="Una nueva contraseña. Y listo." description="Elegí una contraseña segura para volver a disfrutar de tu cuenta."><UpdatePasswordForm /></AuthFrame>
}
