import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MorePage, moreStyles as s } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
import { supportArticles } from '@/lib/support/customer-content'

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePageSession('customer')
  const { slug } = await params, article = supportArticles.find(a => a.slug === slug)
  if (!article) notFound()
  return <MorePage title={article.title} description={article.category} backHref="/app/ayuda" backLabel="Volver a Ayuda"><article className={s.form}>{article.paragraphs.map(paragraph => <p key={paragraph} className={s.subtitle}>{paragraph}</p>)}</article><div className={s.actions}><Link className={s.primary} href={article.href}>{article.action}</Link><Link className={s.secondary} href="/app/ayuda/nueva">Necesito ayuda</Link></div></MorePage>
}
