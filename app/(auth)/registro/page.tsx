import { PublicShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'

export default function RegisterPage() {
  return (
    <PublicShell>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="p-6 sm:p-8"><p className="text-sm font-black uppercase tracking-wide text-blue-700">Registro cliente</p><h1 className="mt-3 text-3xl font-black text-slate-950">Creá tu cuenta y pedí un técnico</h1><p className="mt-2 text-sm leading-6 text-slate-600">El registro profesional no es público: los técnicos entran por invitación validada por admin.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Nombre"><Input placeholder="Lucía" /></Field><Field label="Apellido"><Input placeholder="Fernández" /></Field><Field label="Email"><Input placeholder="tu@email.com" /></Field><Field label="Teléfono"><Input placeholder="+54 9 11 ..." /></Field><Field label="Contraseña"><Input type="password" placeholder="••••••••" /></Field><Field label="Repetir contraseña"><Input type="password" placeholder="••••••••" /></Field></div><div className="mt-6 flex flex-col gap-2 sm:flex-row"><Button>Crear cuenta</Button><ButtonLink href="/login" variant="secondary">Ya tengo cuenta</ButtonLink></div></Card>
        <Card className="p-6 sm:p-8"><h2 className="text-2xl font-black">Después del registro</h2><ol className="mt-5 space-y-3 text-sm leading-6 text-slate-600"><li><strong>1.</strong> Elegís el problema del aire.</li><li><strong>2.</strong> Cargás fotos/video si querés.</li><li><strong>3.</strong> Recibís diagnóstico preliminar.</li><li><strong>4.</strong> Elegís horario y presupuesto.</li><li><strong>5.</strong> Pagás y Lysto asigna profesional verificado.</li></ol><div className="mt-6 rounded-3xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">Tu dirección y equipos quedan guardados para próximos servicios y mantenimientos.</div></Card>
      </main>
    </PublicShell>
  )
}
