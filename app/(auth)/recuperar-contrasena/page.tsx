import { AuthFrame } from '@/components/auth/auth-frame'
import { EmailHelpForm } from '@/components/auth/customer-forms'
export const metadata = { title: 'Recuperar contraseña | Lysto', robots: { index: false, follow: false } }
export default function RecoveryPage() {
  return <AuthFrame title="Volvamos a conectarte." description="Dejanos tu email y te enviamos un enlace para crear una nueva contraseña."><EmailHelpForm mode="recovery" /></AuthFrame>
}
