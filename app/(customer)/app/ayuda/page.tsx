import { CircleHelp, MessageCircle, Plus } from 'lucide-react'
import { MorePage, MoreSection, MoreLink } from '@/components/customer/more/more-ui'
import { requirePageSession } from '@/lib/auth/session'
import { supportArticles } from '@/lib/support/customer-content'

export default async function CustomerHelpPage() {
  await requirePageSession('customer')
  const categories = [...new Set(supportArticles.map(article => article.category))]
  return <MorePage title="Ayuda y consultas" description="Encontrá una respuesta o contanos qué necesitás resolver.">
    <MoreSection title="Hablemos de tu caso"><MoreLink href="/app/ayuda/nueva" title="Nueva consulta" description="Sobre un servicio, un pago o tu cuenta" icon={Plus} /><MoreLink href="/app/ayuda/consultas" title="Mis consultas" description="Respuestas y seguimiento de tus casos" icon={MessageCircle} /></MoreSection>
    {categories.map(category => <MoreSection key={category} title={category}>{supportArticles.filter(a => a.category === category).map(article => <MoreLink key={article.slug} href={`/app/ayuda/articulos/${article.slug}`} title={article.title} icon={CircleHelp} />)}</MoreSection>)}
  </MorePage>
}
