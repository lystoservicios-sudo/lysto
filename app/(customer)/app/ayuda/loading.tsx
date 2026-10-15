import { MorePage, moreStyles as s } from '@/components/customer/more/more-ui'
export default function CustomerHelpLoading() {
  return <MorePage title="Ayuda y consultas"><div role="status" aria-label="Cargando ayuda" className={s.form}><div className={s.skeleton} /><div className={s.skeleton} /><div className={s.skeleton} /></div></MorePage>
}
