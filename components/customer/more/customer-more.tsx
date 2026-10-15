import Link from 'next/link'
import { Bell, CircleHelp, LogOut, ShieldCheck, SlidersHorizontal, UserRound, Wallet } from 'lucide-react'
import { MoreLink, MorePage, MoreSection } from './more-ui'
import styles from './more.module.css'

export function CustomerMore({ profile, pendingPayments, awaitingReplies }: {
  profile: { firstName: string; lastName: string; email: string }
  pendingPayments: number | null; awaitingReplies: number | null
}) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ')
  return <MorePage title="Más" description="Tu cuenta y el respaldo de tus servicios, en un solo lugar." backHref={null}>
    <MoreLink href="/app/perfil" title={name || 'Datos personales'} description={profile.email} icon={UserRound} />
    {pendingPayments === null || awaitingReplies === null ? <p role="status" className={styles.notice}>No pudimos actualizar todos los avisos. Podés entrar a cada sección y consultar su estado.</p> : null}
    <MoreSection title="Pagos y respaldo">
      <MoreLink href="/app/pagos" title="Pagos y comprobantes" description="Importes, movimientos y reintegros" icon={Wallet}
        badge={pendingPayments ? `${pendingPayments} ${pendingPayments === 1 ? 'pago para completar' : 'pagos para completar'}` : null} />
      <MoreLink href="/app/garantias" title="Garantías y reclamos" description="Coberturas y seguimiento después de una visita" icon={ShieldCheck} />
      <MoreLink href="/app/ayuda" title="Ayuda y mis consultas" description="Encontrá respuestas o consultá con Lysto" icon={CircleHelp}
        badge={awaitingReplies ? `${awaitingReplies} ${awaitingReplies === 1 ? 'consulta espera tu respuesta' : 'consultas esperan tu respuesta'}` : null} />
    </MoreSection>
    <MoreSection title="Configuración">
      <MoreLink href="/app/preferencias" title="Notificaciones y preferencias" description="Avisos por email y movimiento de la app" icon={Bell} />
      <MoreLink href="/app/seguridad" title="Seguridad y cuenta" description="Contraseña, sesiones y privacidad" icon={SlidersHorizontal} />
    </MoreSection>
    <footer className={styles.footer}>
      <Link href="/app/mas/terminos">Términos del servicio</Link>
      <Link href="/app/mas/privacidad">Privacidad</Link>
      <form action="/auth/logout" method="post"><button className={styles.textAction} type="submit"><LogOut size={16} aria-hidden="true" />Cerrar sesión</button></form>
    </footer>
  </MorePage>
}
