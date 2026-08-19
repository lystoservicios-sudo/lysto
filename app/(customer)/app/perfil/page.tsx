import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'

export default function CustomerProfilePage() {
  return <PageScaffold title="Perfil" eyebrow="Cliente" description="Datos del cliente, contacto y preferencias de notificación."><Card className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nombre"><Input defaultValue="Marina" /></Field><Field label="Apellido"><Input defaultValue="Costa" /></Field><Field label="Email"><Input defaultValue="marina@email.com" /></Field><Field label="Teléfono"><Input defaultValue="+54 9 11 5555-0107" /></Field></div><Button>Guardar cambios</Button></Card></PageScaffold>
}
