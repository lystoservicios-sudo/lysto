import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'

export default function LoginPage() {
  return (
    <PublicShell>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6 sm:p-8"><p className="text-sm font-black uppercase tracking-wide text-blue-700">Ingresar</p><h1 className="mt-3 text-3xl font-black text-slate-950">Entrá a Lysto</h1><p className="mt-2 text-sm leading-6 text-slate-600">El mismo login identifica si sos cliente, profesional aprobado o admin.</p><div className="mt-6 grid gap-4"><Field label="Email"><Input placeholder="tu@email.com" /></Field><Field label="Contraseña"><Input type="password" placeholder="••••••••" /></Field><Button>Ingresar</Button><ButtonLink href="/registro" variant="secondary">Crear cuenta cliente</ButtonLink></div></Card>
        <Card className="bg-slate-950 p-6 text-white sm:p-8"><h2 className="text-2xl font-black">Accesos por rol</h2><div className="mt-5 grid gap-3"><div className="rounded-2xl bg-white/10 p-4"><strong>Cliente:</strong> solicita servicio, paga, sigue el trabajo y ve historial.</div><div className="rounded-2xl bg-white/10 p-4"><strong>Profesional:</strong> entra solo si fue invitado y aprobado por Lysto.</div><div className="rounded-2xl bg-white/10 p-4"><strong>Admin:</strong> opera solicitudes, matching, pagos, calidad y configuración.</div></div></Card>
      </main>
    </PublicShell>
  )
}
