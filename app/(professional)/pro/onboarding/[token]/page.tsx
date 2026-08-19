import { PageScaffold } from '@/components/layout/page-scaffold'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/forms/form-section'
import { Card } from '@/components/ui/card'

const tools = ['Bomba de vacío', 'Manifold R410A/R32', 'Balanza digital', 'Detector de fugas', 'Pinza amperométrica', 'Multímetro', 'Termómetro', 'Escalera', 'Taladro', 'Elementos de seguridad']

export default function ProfessionalOnboardingPage() {
  return (
    <PageScaffold title="Registro profesional por invitación" eyebrow="Profesional" description="Completá tus datos para que Lysto pueda validar documentación, herramientas, zonas y disponibilidad.">
      <FormSection title="Datos personales" description="La cuenta queda en revisión hasta aprobación manual.">
        <Field label="Nombre"><Input placeholder="Martín" /></Field>
        <Field label="Apellido"><Input placeholder="Gómez" /></Field>
        <Field label="Email"><Input placeholder="tecnico@example.com" /></Field>
        <Field label="Teléfono"><Input placeholder="+54 9 11 ..." /></Field>
        <Field label="DNI"><Input placeholder="00.000.000" /></Field>
        <Field label="CUIL"><Input placeholder="20-00000000-0" /></Field>
      </FormSection>
      <FormSection title="Datos técnicos" description="Especialidad inicial: aire acondicionado.">
        <Field label="Años de experiencia"><Input placeholder="5" /></Field>
        <Field label="Número de matrícula"><Input placeholder="ABC-123" /></Field>
        <Field label="Entidad emisora"><Input placeholder="Entidad / registro" /></Field>
        <Field label="Movilidad"><Input placeholder="Auto / moto / camioneta" /></Field>
        <Field label="Zona de trabajo"><Input placeholder="CABA Norte" /></Field>
        <Field label="Disponibilidad"><Input placeholder="Lunes a viernes 8 a 18" /></Field>
      </FormSection>
      <Card className="p-5"><h2 className="text-xl font-black">Herramientas disponibles</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool) => <label key={tool} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" />{tool}</label>)}</div></Card>
      <FormSection title="Documentación y pagos" description="Archivos privados en Supabase Storage y cuenta Mercado Pago para split.">
        <Field label="DNI frente/dorso"><Input placeholder="Upload pendiente" /></Field>
        <Field label="Comprobante matrícula"><Input placeholder="Upload pendiente" /></Field>
        <Field label="Cuenta Mercado Pago"><Input placeholder="Conectar luego por OAuth" /></Field>
        <Field label="Bio pública"><Input placeholder="Técnico especializado en split inverter..." /></Field>
      </FormSection>
      <Button>Enviar perfil a revisión</Button>
    </PageScaffold>
  )
}
