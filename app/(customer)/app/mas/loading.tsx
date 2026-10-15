import { MorePage, moreStyles as styles } from '@/components/customer/more/more-ui'
export default function Loading() {
  return <MorePage title="Más" backHref={null}><div role="status" aria-label="Cargando opciones de cuenta">{Array.from({ length: 5 }, (_, i) => <div key={i} className={styles.skeleton} style={{ marginBottom: 12 }} />)}</div></MorePage>
}
