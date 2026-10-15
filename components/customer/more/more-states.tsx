'use client'
import { MorePage, moreStyles as styles } from './more-ui'
export function MoreLoading() {
  return <MorePage title="Cargando tus opciones"><div role="status" aria-label="Cargando información de cuenta">{[0, 1, 2].map(key => <div className={styles.skeleton} key={key} style={{ marginBottom: 12 }} />)}</div></MorePage>
}
export function MoreError({ reset }: { reset: () => void }) {
  return <MorePage title="No pudimos cargar esta sección"><p className={styles.muted}>No se confirmó ninguna operación nueva. Volvé a consultar la información antes de repetir una acción.</p><button type="button" className={styles.primary} onClick={reset}>Volver a intentar</button></MorePage>
}
