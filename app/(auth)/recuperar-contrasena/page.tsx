import { AuthFrame } from '@/components/auth/auth-frame'
import { EmailHelpForm } from '@/components/auth/customer-forms'
export const metadata = { title: 'Recuperar contraseña | Lysto', robots: { index: false, follow: false } }
export default function RecoveryPage() {
  return <AuthFrame title="Recuperá tu acceso" description="Ingresá tu email para solicitar un enlace y crear una nueva contraseña."><EmailHelpForm mode="recovery" /></AuthFrame>
}
