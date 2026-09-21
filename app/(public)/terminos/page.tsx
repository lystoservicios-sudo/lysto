import type { Metadata } from 'next'
import { PolicyPage } from '@/components/public/policy-page'
import { customerTermsPolicy } from '@/lib/legal/customer-account-policies'

export const metadata: Metadata = { title: 'Términos | Lysto', robots: { index: false } }

export default function Page() {
  return (
    <PolicyPage title={customerTermsPolicy.title} version={customerTermsPolicy.version} effectiveDate={customerTermsPolicy.effectiveDate}>
      {customerTermsPolicy.sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-black">{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
    </PolicyPage>
  )
}
