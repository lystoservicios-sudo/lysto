'use client'

import { RotateCcw } from 'lucide-react'
import styles from '@/components/customer/customer-home.module.css'

export default function CustomerHomeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={styles.home}>
      <section role="alert" className={styles.error}>
        <h1 className={styles.sectionTitle}>No pudimos cargar Inicio</h1>
        <p className={styles.description}>Volvé a intentar en unos momentos.</p>
        <button type="button" className={styles.activityAction} onClick={() => reset()}>
          <RotateCcw aria-hidden="true" size={16} />Reintentar
        </button>
      </section>
    </div>
  )
}
