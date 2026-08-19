import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { AIR_CONDITIONING_ISSUES, MAINTENANCE_OPTIONS, TIME_WINDOWS } from '@/lib/domain/constants'

export function LoginFormMock({ mode }: { mode: 'login' | 'registro' }) {
  return (
    <Card className="mx-auto max-w-md space-y-4">
      <div><h1 className="text-2xl font-black">{mode === 'login' ? 'Ingresar a Lysto' : 'Crear cuenta cliente'}</h1><p className="mt-1 text-sm leading-6 text-slate-600">Formulario listo para conectar con Supabase Auth.</p></div>
      {mode === 'registro' ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Nombre"><Input placeholder="Walter" /></Field><Field label="Apellido"><Input placeholder="Galtieri" /></Field></div> : null}
      <Field label="Email"><Input placeholder="cliente@email.com" type="email" /></Field>
      {mode === 'registro' ? <Field label="Teléfono"><Input placeholder="+54 9 11..." /></Field> : null}
      <Field label="Contraseña"><Input placeholder="••••••••" type="password" /></Field>
      <Button className="w-full">{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</Button>
    </Card>
  )
}

export function ProfessionalOnboardingFormMock() {
  return (
    <Card className="space-y-6">
      <div><h2 className="text-2xl font-black">Onboarding profesional</h2><p className="mt-1 text-sm leading-6 text-slate-600">Formulario por invitación: datos, documentación, herramientas, zonas, disponibilidad y Mercado Pago.</p></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Nombre"><Input placeholder="Martín" /></Field><Field label="Apellido"><Input placeholder="Gómez" /></Field><Field label="DNI"><Input placeholder="30111222" /></Field><Field label="CUIL"><Input placeholder="20-30111222-9" /></Field><Field label="Matrícula"><Input placeholder="MAT-AC-123" /></Field><Field label="Años de experiencia"><Input placeholder="8" /></Field></div>
      <div><p className="mb-3 text-sm font-black text-slate-950">Herramientas declaradas</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{['Bomba de vacío','Manifold R410A/R32','Balanza digital','Detector de fugas','Pinza amperométrica','Multímetro','Hidrolavadora','Escalera','Rotomartillo'].map((tool) => <label key={tool} className="rounded-2xl border border-slate-200 p-3 text-sm font-semibold"><input className="mr-2" type="checkbox" />{tool}</label>)}</div></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Zona principal"><Input placeholder="CABA norte" /></Field><Field label="Disponibilidad"><select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-lysto-blue focus:ring-4 focus:ring-blue-100">{TIME_WINDOWS.map((tw) => <option key={tw}>{tw}</option>)}</select></Field></div>
      <Button>Enviar para revisión</Button>
    </Card>
  )
}

export function JobClosureFormMock() {
  return (
    <Card className="space-y-5">
      <div><h2 className="text-2xl font-black">Cierre técnico del servicio</h2><p className="mt-1 text-sm leading-6 text-slate-600">Todo campo crítico queda estructurado para historial, garantía, QR y calidad.</p></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Equipo"><Input placeholder="Aire living · Surrey inverter" /></Field><Field label="Estado final"><select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"><option>Resuelto</option><option>Resuelto parcialmente</option><option>Pendiente de repuesto</option><option>Requiere segunda visita</option><option>No se pudo resolver</option></select></Field></div>
      <Field label="Diagnóstico real"><textarea className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-lysto-blue focus:ring-4 focus:ring-blue-100" placeholder="Se detectó baja carga de refrigerante y filtro obstruido..." /></Field>
      <Field label="Trabajo realizado"><textarea className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-lysto-blue focus:ring-4 focus:ring-blue-100" placeholder="Limpieza, revisión de presión, prueba de funcionamiento..." /></Field>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Repuestos usados"><Input placeholder="Opcional" /></Field><Field label="Mantenimiento recomendado"><select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm">{Object.values(MAINTENANCE_OPTIONS).map((option) => <option key={option}>{option}</option>)}</select></Field></div>
      <div className="grid gap-3 sm:grid-cols-2"><Card className="border-dashed text-center shadow-none"><p className="text-3xl">📷</p><p className="font-bold">Fotos después</p></Card><Card className="border-dashed text-center shadow-none"><p className="text-3xl">▣</p><p className="font-bold">Generar QR/comprobante</p></Card></div>
      <Button>Cerrar trabajo</Button>
    </Card>
  )
}

export function PricingConfigFormMock() {
  return (
    <Card className="space-y-5">
      <div><h2 className="text-2xl font-black">Configuración de precios</h2><p className="mt-1 text-sm leading-6 text-slate-600">Matriz editable desde admin. Las solicitudes ya creadas no cambian.</p></div>
      <div className="grid gap-4 md:grid-cols-4"><Field label="Base"><Input defaultValue="35000" /></Field><Field label="Prioridad x"><Input defaultValue="1.25" /></Field><Field label="Comisión"><Input defaultValue="0.18" /></Field><Field label="Zona"><Input defaultValue="caba" /></Field></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{AIR_CONDITIONING_ISSUES.map((issue) => <Field key={issue.slug} label={issue.title}><Input defaultValue={issue.slug === 'instalacion' ? '20000' : issue.slug === 'no_enciende' ? '5000' : '0'} /></Field>)}</div>
      <Button>Guardar matriz</Button>
    </Card>
  )
}


export function ReviewFormMock() {
  return (
    <Card className="space-y-5">
      <div><h2 className="text-2xl font-black">Calificar servicio</h2><p className="mt-1 text-sm leading-6 text-slate-600">Review separada para servicio Lysto y profesional, con campos estructurados para calidad.</p></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Servicio Lysto"><select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"><option>5 estrellas</option><option>4 estrellas</option><option>3 estrellas</option><option>2 estrellas</option><option>1 estrella</option></select></Field><Field label="Profesional"><select className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"><option>5 estrellas</option><option>4 estrellas</option><option>3 estrellas</option><option>2 estrellas</option><option>1 estrella</option></select></Field></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="rounded-2xl border border-slate-200 p-3 text-sm font-semibold"><input className="mr-2" type="checkbox" />El problema quedó resuelto</label><label className="rounded-2xl border border-slate-200 p-3 text-sm font-semibold"><input className="mr-2" type="checkbox" />Volvería a contratar Lysto</label></div>
      <Field label="Comentario"><textarea className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-lysto-blue focus:ring-4 focus:ring-blue-100" placeholder="Contanos cómo fue la experiencia..." /></Field>
      <Button>Enviar calificación</Button>
    </Card>
  )
}
