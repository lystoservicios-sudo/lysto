import Link from 'next/link'
import { AuthFrame } from '@/components/auth/auth-frame'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { safeCustomerNext } from '@/lib/auth/customer-access'
import { RegistrationForm } from './registration-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Crear cuenta | Lysto', robots: { index: false, follow: false } }
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeCustomerNext((await searchParams).next)
  const policy = await getRegistrationPolicy()
  return <AuthFrame title="Tu hogar, en buenas manos." description="Creá tu cuenta para pedir servicios y acompañar cada paso desde un mismo lugar.">
    {policy ? <RegistrationForm policy={policy} next={next} /> : <p role="status" className="auth-notice">Estamos preparando la apertura de nuevas cuentas. Podés <Link className="auth-link" href="/contacto">contactarnos</Link> para consultar por un servicio.</p>}
    <p className="auth-form-bottom">¿Ya tenés cuenta? <Link href={`/login?next=${encodeURIComponent(next)}`} className="auth-link">Iniciar sesión</Link></p>
  </AuthFrame>
}
