import styles from '@/components/customer/customer-home.module.css'

export default function CustomerHomeLoading() {
  return (
    <div role="status" aria-label="Cargando Inicio" className={`${styles.home} ${styles.loading}`}>
      <div aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeleton} ${styles.skeletonActivity}`} />
      </div>
      <div aria-hidden="true" className={styles.stableSections}>
        <div>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonService}`} />
        </div>
        <div>
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonOrders}`} />
        </div>
      </div>
      <span className="sr-only">Cargando Inicio</span>
    </div>
  )
}
