import type { CustomerPolicy } from '@/lib/legal/customer-account-policies'
import { MorePage, moreStyles as styles } from './more-ui'
export function CustomerPolicyArticle({ policy }: { policy: CustomerPolicy }) {
  return <MorePage title={policy.title} description={`Versión ${policy.version} · Vigente desde ${policy.effectiveDate}`}>
    {policy.sections.map(section => <section key={section.title} className={styles.section}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p className={styles.subtitle} key={paragraph}>{paragraph}</p>)}</section>)}
  </MorePage>
}
