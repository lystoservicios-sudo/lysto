import { PublicShell } from '@/components/layout/page-shell'
import { BadgeCheck, BriefcaseBusiness, House, ShieldCheck } from 'lucide-react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <PublicShell>
      <main className="mx-auto grid min-h-[calc(100dvh-65px)] max-w-5xl items-center gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-14">
        <section className="w-full rounded-2xl bg-white p-5 shadow-card sm:p-8">
          <p className="text-sm font-bold text-blue-700">Acceso a tu cuenta</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Entrá a Lysto
          </h1>
          <p className="mt-3 max-w-md text-base leading-7 text-slate-600">
            Usá el mismo acceso si sos cliente, técnico aprobado o parte del equipo Lysto.
          </p>
          <LoginForm />
        </section>

        <aside className="hidden rounded-2xl bg-slate-950 p-8 text-white lg:block">
          <div className="flex items-center gap-3 text-blue-100">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
            <span className="text-sm font-bold">Un acceso, tres experiencias</span>
          </div>
          <h2 className="mt-5 text-3xl font-black tracking-tight">Lysto reconoce tu rol automáticamente.</h2>
          <div className="mt-7 space-y-5 text-sm leading-6 text-slate-200">
            <div className="flex gap-3">
              <House aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
              <p><strong className="text-white">Cliente:</strong> solicita, sigue y administra sus servicios.</p>
            </div>
            <div className="flex gap-3">
              <BriefcaseBusiness aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
              <p><strong className="text-white">Técnico:</strong> recibe trabajos cuando su perfil está aprobado.</p>
            </div>
            <div className="flex gap-3">
              <BadgeCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" />
              <p><strong className="text-white">Administración:</strong> opera la plataforma según sus permisos.</p>
            </div>
          </div>
        </aside>
      </main>
    </PublicShell>
  )
}
