import { Fingerprint, Laptop, LockKeyhole } from 'lucide-react'
import { MoreLink, MorePage, MoreSection } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
export default async function Page() {
  await requirePageSession('customer')
  return <MorePage title="Seguridad y cuenta" description="Controlá el acceso a tu cuenta y tus datos."><MoreSection title="Tu acceso"><MoreLink href="/app/seguridad/contrasena" title="Contraseña" description="Cambiar tu contraseña o recuperar el acceso" icon={LockKeyhole} /><MoreLink href="/app/seguridad/sesiones" title="Sesiones y dispositivos" description="Revisar y cerrar otros accesos" icon={Laptop} /></MoreSection><MoreSection title="Tus datos"><MoreLink href="/app/seguridad/privacidad" title="Privacidad y gestión de cuenta" description="Descargar tus datos o solicitar la eliminación" icon={Fingerprint} /></MoreSection></MorePage>
}
