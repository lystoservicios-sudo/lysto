import type { Metadata } from 'next'
import Link from 'next/link'
import { PolicyPage } from '@/components/public/policy-page'
import { customerPrivacyPolicy } from '@/lib/legal/customer-account-policies'

export const metadata: Metadata = { title: 'Privacidad | Lysto', robots: { index: false } }

export default function Page() {
  return (
    <PolicyPage title={customerPrivacyPolicy.title} version={customerPrivacyPolicy.version} effectiveDate={customerPrivacyPolicy.effectiveDate}>
      {customerPrivacyPolicy.sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-black">{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.title === 'Tus derechos' && (
            <p>
              <Link className="font-bold text-blue-700 underline" href="/contacto">Contactar a Lysto</Link>
              {' '}para ejercer tus derechos o hacer una consulta de privacidad.
            </p>
          )}
        </section>
      ))}
    </PolicyPage>
  )
}
