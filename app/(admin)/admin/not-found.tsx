import { ActionLink, Header, Notice } from '@/components/admin/admin-ui'

export default function AdminNotFound() {
  return <><Header title="No encontramos este registro" description="El identificador no existe en los datos disponibles o el registro ya no está accesible." /><Notice>Volvé al listado y seleccioná un registro válido. No se muestra otro cliente o trabajo en su lugar.</Notice><div className="adm-inline"><ActionLink primary href="/admin/dashboard">Ir al dashboard</ActionLink><ActionLink href="/admin/solicitudes">Ver solicitudes</ActionLink></div></>
}
