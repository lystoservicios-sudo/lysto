import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function AdminSettingsPage() {
  return <PageScaffold title="Configuración" eyebrow="Admin" description="Variables operativas: zonas, garantía, textos, horarios y reglas generales."><Card className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Field label="Zona inicial"><Input defaultValue="CABA" /></Field><Field label="Garantía default días"><Input defaultValue="30" /></Field><Field label="SLA prioridad minutos"><Input defaultValue="90" /></Field></div><Button>Guardar configuración</Button></Card></PageScaffold>
}
