import { MorePage, moreStyles as s } from '@/components/customer/more/more-ui'

export default function CustomerWarrantyLoading() {
  return <MorePage title="Garantías y reclamos"><div role="status" aria-label="Cargando garantías" className={s.form}><div className={s.skeleton} /><div className={s.skeleton} /><div className={s.skeleton} /></div></MorePage>
}
