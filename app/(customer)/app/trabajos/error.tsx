'use client'

import Link from 'next/link'
import styles from '@/components/customer/customer-services.module.css'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className={styles.page}><h1 className={styles.title}>No pudimos cargar Servicios</h1><p className={styles.subtitle}>Volvé a consultar para recuperar el seguimiento de tus pedidos.</p><button className={styles.textAction} onClick={() => reset()}>Volver a consultar</button><Link className={styles.textAction} href="/app">Volver a Inicio</Link></div>
}
