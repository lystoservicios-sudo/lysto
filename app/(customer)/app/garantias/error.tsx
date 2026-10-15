'use client'

import { MorePage, moreStyles as s } from '@/components/customer/more/more-ui'

export default function CustomerWarrantyError({ reset }: { reset: () => void }) {
  return <MorePage title="No pudimos cargar tus garantías" description="Reintentá para recuperar las coberturas y el seguimiento de tus reclamos."><button type="button" className={s.primary} onClick={reset}>Reintentar</button></MorePage>
}
