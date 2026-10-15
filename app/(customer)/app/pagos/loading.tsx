import { MorePage, moreStyles as styles } from '@/components/customer/more/more-ui'
export default function LoadingCustomerPayments() {
  return <MorePage title="Pagos y comprobantes"><div role="status" aria-label="Cargando pagos" className={styles.form}>
    {[1, 2, 3].map((row) => <div key={row} className={styles.skeleton} aria-hidden="true" />)}
  </div></MorePage>
}
