import type { Metadata } from 'next'
import { AuthFrame } from '@/components/auth/auth-frame'
import { RegistrationForm } from '@/components/auth/customer-forms'
import { safeCustomerNext } from '@/lib/auth/customer-access'
export const metadata: Metadata = { title: 'Crear cuenta | Lysto', robots: { index: false, follow: false } }
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return <AuthFrame eyebrow="EL PRIMER PASO HACIA TU TRANQUILIDAD" title="Tu hogar se merece estar Lysto." description="Creá tu cuenta gratis. Pedí un servicio cuando lo necesites y seguí todo desde acá."><RegistrationForm next={safeCustomerNext(next)} /></AuthFrame>
}
