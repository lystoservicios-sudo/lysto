import Link from 'next/link'
import { ArrowLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './more.module.css'

export function MorePage({ title, description, backHref = '/app/mas', backLabel = 'Volver a Más', children }: {
  title: string; description?: string; backHref?: string | null; backLabel?: string; children: ReactNode
}) {
  return <div className={styles.page}>
    <header>
      {backHref ? <Link className={styles.backLink} href={backHref}><ArrowLeft size={18} aria-hidden="true" />{backLabel}</Link> : null}
      <h1 className={styles.title}>{title}</h1>
      {description ? <p className={styles.subtitle}>{description}</p> : null}
    </header>
    {children}
  </div>
}

export function MoreSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.section} aria-label={title}><h2>{title}</h2><div className={styles.rows}>{children}</div></section>
}

export function MoreLink({ href, title, description, badge, icon: Icon }: {
  href: string; title: string; description?: string; badge?: string | number | null; icon?: LucideIcon
}) {
  return <Link href={href} className={styles.row}>
    {Icon ? <span className={styles.rowIcon}><Icon size={19} aria-hidden="true" /></span> : null}
    <span className={styles.rowCopy}><strong>{title}</strong>{description ? <span>{description}</span> : null}
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </span>
    <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
  </Link>
}

export function MoreEmpty({ title, description }: { title: string; description: string }) {
  return <div className={styles.empty}><h2>{title}</h2><p>{description}</p></div>
}

export { styles as moreStyles }
