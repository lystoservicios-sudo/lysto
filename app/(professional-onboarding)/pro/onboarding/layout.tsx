import type { ReactNode } from 'react'
import styles from '@/components/pro/registration-access.module.css'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Postulación profesional — Lysto',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main className={styles.canvas}>
      <div className={styles.viewport}>
        {children}
      </div>
    </main>
  )
}
