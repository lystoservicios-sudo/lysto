import Link from 'next/link'
import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { RegistrationForm } from './registration-form'

export const dynamic = 'force-dynamic'
export default async function RegisterPage() {
  const policy = await getRegistrationPolicy()
  return (
    <PublicShell>
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Card className="p-6 sm:p-8">
          <p className="text-sm font-black uppercase tracking-wide text-blue-700">
            Registro cliente
          </p>
          <h1 className="mt-3 text-3xl font-black">Creá tu cuenta en Lysto</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Confirmá tu correo y aceptá la versión vigente de términos y privacidad para solicitar
            servicios. Los profesionales ingresan por invitación del equipo.
          </p>
          {policy ? (
            <RegistrationForm policy={policy} />
          ) : (
            <p role="status" className="my-6 rounded-xl bg-slate-50 p-4">
              El registro todavía no está habilitado. Intentá más tarde.
            </p>
          )}
          <p className="mt-6 text-sm">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="font-bold text-blue-700 underline">
              Ingresar
            </Link>
          </p>
        </Card>
      </main>
    </PublicShell>
  )
}
