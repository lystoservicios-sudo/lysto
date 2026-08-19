import { PageScaffold } from '@/components/layout/page-scaffold'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FormSection } from '@/components/forms/form-section'

export default function ProfessionalProfilePage() {
  return (
    <PageScaffold title="Perfil profesional" eyebrow="Profesional" description="Datos, documentación, herramientas, zonas, disponibilidad y presentación pública.">
      <FormSection title="Perfil visible"><Field label="Nombre público"><Input defaultValue="Martín Gómez" /></Field><Field label="Especialidad"><Input defaultValue="Aire acondicionado" /></Field><Field label="Bio"><Input defaultValue="Técnico matriculado con experiencia en split e inverter." /></Field><Field label="Foto"><Input placeholder="Upload" /></Field></FormSection>
      <FormSection title="Operación"><Field label="Zona"><Input defaultValue="CABA Norte" /></Field><Field label="Movilidad"><Input defaultValue="Camioneta" /></Field><Field label="Disponibilidad"><Input defaultValue="Lun-Vie 08-18" /></Field><Field label="Herramientas"><Input defaultValue="9/10 verificadas" /></Field></FormSection>
      <Button>Guardar perfil</Button>
    </PageScaffold>
  )
}
