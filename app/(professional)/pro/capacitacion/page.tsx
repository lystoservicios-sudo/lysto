import { ModuleCard } from '@/components/pro/ui/module-card'
import { SectionHeader } from '@/components/pro/ui/section-header'
import { Star, BarChart3, DollarSign } from 'lucide-react'

const modules = [
  { title: 'Protocolo de ingreso al domicilio', description: 'Cómo presentarte, evaluar el entorno y generar confianza desde el inicio.', status: 'completed' as const, progress: 100 },
  { title: 'Checklist aire acondicionado split', description: 'Revisión paso a paso para un diagnóstico preciso y profesional.', status: 'completed' as const, progress: 100 },
  { title: 'Uso de fotos antes/después', description: 'Documentación correcta para respaldar tu trabajo.', status: 'in_progress' as const, progress: 70 },
  { title: 'Política de garantía Lysto', description: 'Conocé la cobertura, tiempos y cómo funciona la garantía.', status: 'pending' as const, progress: 0 },
  { title: 'Cierre técnico y mantenimiento', description: 'Cómo cerrar un servicio y dejar al cliente satisfecho.', status: 'pending' as const, progress: 0 },
  { title: 'Atención al cliente', description: 'Buenas prácticas para comunicarte, resolver y fidelizar clientes.', status: 'pending' as const, progress: 0 },
]

const completedCount = modules.filter(m => m.status === 'completed').length
const totalCount = modules.length
const overallProgress = Math.round((completedCount / totalCount) * 100)

export default function ProfessionalTrainingPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Desarrollá tu talento"
        title="Capacitación que impulsa tu crecimiento"
        subtitle="Módulos diseñados para que mejores tus habilidades, brinden un mejor servicio y sigas creciendo con Lysto."
      />

      {/* Progress overview */}
      <div className="rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.08)] p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-lysto-ink">Tu progreso</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-lysto-muted">{completedCount} de {totalCount} módulos completados</span>
            <span className="text-2xl font-black text-lysto-blue">{overallProgress}%</span>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-lysto-blue lysto-progress-fill"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="text-xl">🏅</span>
          <div>
            <p className="font-bold text-lysto-ink">Siguiente nivel: <span className="text-lysto-blue">Especialista</span></p>
            <p className="text-lysto-muted">Completá {totalCount - completedCount} módulos más para alcanzarlo.</p>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((mod, index) => (
          <ModuleCard
            key={mod.title}
            index={index}
            title={mod.title}
            description={mod.description}
            status={mod.status}
            progress={mod.progress}
          />
        ))}
      </div>

      {/* Footer banner */}
      <div className="rounded-2xl bg-white border border-lysto-border p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-lysto-blueSoft flex items-center justify-center text-2xl">🏆</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-lysto-ink">Capacitarte te hace crecer</p>
          <p className="text-xs text-lysto-muted">Más conocimientos, mejores servicios, más oportunidades y mejores ingresos.</p>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-center">
          {[
            { icon: <Star className="h-4 w-4 text-lysto-warning" />, label: 'Mejor reputación' },
            { icon: <BarChart3 className="h-4 w-4 text-lysto-blue" />, label: 'Más oportunidades' },
            { icon: <DollarSign className="h-4 w-4 text-lysto-green" />, label: 'Más ingresos' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs font-semibold text-lysto-muted">
              {item.icon}
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
