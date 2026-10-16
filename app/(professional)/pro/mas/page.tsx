import Link from 'next/link'
import {
  BookOpen, ChevronRight, ClipboardList, CreditCard,
  FileText, LifeBuoy, ShieldCheck, UserRound
} from 'lucide-react'
import { requirePageSession } from '@/lib/auth/session'
import styles from '@/components/pro/job-workspace.module.css'

const destinations = [
  { href: '/pro/perfil', label: 'Perfil profesional', description: 'Datos personales y de tu actividad.', icon: UserRound },
  { href: '/pro/pagos/mercadopago', label: 'Cuenta de cobro', description: 'Vinculación y estado de Mercado Pago.', icon: CreditCard },
  { href: '/pro/seguridad', label: 'Seguridad', description: 'Protección y acceso a tu cuenta.', icon: ShieldCheck },
  { href: '/pro/soporte', label: 'Ayuda y casos', description: 'Consultas y seguimiento con Lysto.', icon: LifeBuoy },
  { href: '/pro/capacitacion', label: 'Guías de trabajo', description: 'Procedimientos y recomendaciones.', icon: BookOpen },
  { href: '/pro/solicitudes', label: 'Solicitudes anteriores', description: 'Consultá la bandeja de propuestas existente.', icon: ClipboardList },
  { href: '/pro/presupuestos', label: 'Presupuestos', description: 'Accedé a los presupuestos y propuestas.', icon: FileText }
]

export default async function ProfessionalMorePage() {
  await requirePageSession('professional')

  return (
    <section className={styles.root} style={{ minHeight: 0 }} aria-labelledby="professional-more-heading">
      <div className={styles.body}>
        <h1 id="professional-more-heading" className={styles.title}>Más</h1>
        <p className={styles.subtitle}>Tu cuenta y otras herramientas de trabajo.</p>
        <nav aria-label="Opciones del profesional" className={styles.section}>
          {destinations.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className={styles.rowButton}>
              <Icon size={20} aria-hidden="true" />
              <span className={styles.rowCopy}>
                <span className={styles.rowTitle}>{label}</span>
                <span className={styles.rowDescription}>{description}</span>
              </span>
              <ChevronRight className={styles.chevron} size={18} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}
