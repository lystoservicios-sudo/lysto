'use client'

import { ActionLink, Button, Header, Notice } from '@/components/admin/admin-ui'

export default function AdminError({ reset }: { reset: () => void }) {
  return <><Header title="No pudimos cargar la pantalla" description="Intentá nuevamente. Los datos existentes no se modificaron." /><Notice>Si el problema continúa, volvé al dashboard para acceder a otra herramienta.</Notice><div className="adm-inline"><Button variant="primary" onClick={reset}>Reintentar</Button><ActionLink href="/admin/dashboard">Volver al dashboard</ActionLink></div></>
}
