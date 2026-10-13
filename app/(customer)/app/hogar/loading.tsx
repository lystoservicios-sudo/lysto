import styles from '@/components/customer/hogar/customer-hogar.module.css'

export default function CustomerHogarLoading() {
  return <div className={styles.hogar} role="status" aria-label="Cargando Hogar"><header className={styles.header}><h1>Mi hogar</h1></header><div className={styles.homeSelector}>Cargando tus espacios…</div><div className={styles.sceneLoading}>Preparando Hogar…</div></div>
}
