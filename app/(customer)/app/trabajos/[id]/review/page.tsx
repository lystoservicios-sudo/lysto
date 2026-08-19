import { PageScaffold } from '@/components/layout/page-scaffold'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const questions = ['¿El problema quedó resuelto?', 'Calificación del servicio Lysto', 'Calificación del profesional', '¿Volverías a contratar Lysto?', 'Comentario opcional']

export default function CustomerReviewPage() {
  return (
    <PageScaffold title="Calificar servicio" eyebrow="Cierre cliente" description="Pantalla final para medir satisfacción, alimentar ranking profesional y abrir casos de calidad si algo salió mal.">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card className="space-y-4">
          {questions.map((question) => <div key={question} className="rounded-2xl bg-slate-50 p-4"><p className="font-bold text-slate-950">{question}</p><p className="mt-1 text-sm text-slate-600">Controlado por reglas: solo trabajos completados, una sola review por job.</p></div>)}
          <Button className="w-full">Enviar calificación</Button>
        </Card>
        <Card className="bg-blue-50"><h2 className="font-black text-blue-950">Qué pasa después</h2><p className="mt-2 text-sm leading-6 text-blue-900">Si la calificación es baja o el problema no quedó resuelto, Lysto abre automáticamente un caso de calidad para revisión admin.</p></Card>
      </div>
    </PageScaffold>
  )
}
