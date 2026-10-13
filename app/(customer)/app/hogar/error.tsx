'use client'

import styles from '@/components/customer/hogar/customer-hogar.module.css'

export default function CustomerHogarError({ reset }: { error: Error; reset: () => void }) {
  return <div className={styles.hogar}><section role="alert" className={styles.error}><h1>No pudimos cargar Hogar</h1><p>Tus datos se conservan. Intentá de nuevo en unos momentos.</p><button type="button" className={styles.secondary} onClick={() => reset()}>Reintentar</button></section></div>
}
