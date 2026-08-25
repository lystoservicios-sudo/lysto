import { Headphones, MessagesSquare } from 'lucide-react'

import { InfoNotice } from './info-notice'
import { ButtonLink } from '@/components/ui/button'

export function SupportBanner() {
  return (
    <InfoNotice
      tone="security"
      title="Lysto te acompaña antes, durante y después de la visita"
      description="Encontrá respuestas sobre trabajos, garantías y seguridad sin salir del circuito de soporte."
      icon={<Headphones aria-hidden="true" className="h-5 w-5" />}
      action={<ButtonLink href="/ayuda" variant="secondary">Ir al centro de ayuda</ButtonLink>}
    />
  )
}

export function ChatSupportBanner() {
  return (
    <InfoNotice
      title="Mensajería todavía no disponible"
      description="El chat con el profesional se habilitará cuando exista una conexión real. Mientras tanto, usá el centro de ayuda."
      icon={<MessagesSquare aria-hidden="true" className="h-5 w-5" />}
    />
  )
}
