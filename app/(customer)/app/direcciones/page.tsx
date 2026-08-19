import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'

export default function CustomerAddressesPage() {
  return <PageScaffold title="Direcciones" eyebrow="Cliente" description="Direcciones guardadas para reutilizar en nuevas solicitudes."><Card className="space-y-4"><h2 className="text-xl font-black">Agregar dirección</h2><div className="grid gap-4 md:grid-cols-2"><Field label="Calle"><Input placeholder="Av. Corrientes" /></Field><Field label="Número"><Input placeholder="1240" /></Field><Field label="Piso/depto"><Input placeholder="7 B" /></Field><Field label="Barrio"><Input placeholder="San Nicolás" /></Field></div><div className="grid gap-3 sm:grid-cols-3"><label className="rounded-2xl border p-3 text-sm font-semibold"><input className="mr-2" type="checkbox" />Ascensor</label><label className="rounded-2xl border p-3 text-sm font-semibold"><input className="mr-2" type="checkbox" />Estacionamiento</label><label className="rounded-2xl border p-3 text-sm font-semibold"><input className="mr-2" type="checkbox" />Acceso complejo</label></div><Button>Guardar dirección</Button></Card></PageScaffold>
}
