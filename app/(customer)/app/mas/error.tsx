'use client'
import { MorePage, moreStyles as styles } from '@/components/customer/more/more-ui'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <MorePage title="No pudimos cargar tus opciones" backHref={null}><p className={styles.muted}>No se modificó tu cuenta. Intentá cargar esta sección otra vez.</p><button type="button" className={styles.primary} onClick={reset}>Volver a intentar</button></MorePage>
}
