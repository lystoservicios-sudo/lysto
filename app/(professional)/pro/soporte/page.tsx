import { Briefcase, Wrench, DollarSign, MessageCircle, Users, GraduationCap, BarChart3, Award, HelpCircle, ChevronRight } from 'lucide-react'
import { SupportItem } from '@/components/pro/ui/support-item'
import { SectionHeader } from '@/components/pro/ui/section-header'

export default function ProfessionalSupportPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Red de apoyo"
        title="Estamos con vos"
        subtitle="No trabajás solo. Nuestro equipo te acompaña para que puedas brindar el mejor servicio."
      />

      {/* Categories */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-black text-lysto-ink mb-1">¿En qué podemos ayudarte?</h2>
          <p className="text-xs text-lysto-muted mb-3">Elegí el tema y te guiamos con el equipo indicado.</p>
        </div>
        <SupportItem
          icon={<Briefcase className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          title="Necesito ayuda en un trabajo"
          description="Problemas durante el servicio, cambios, repuestos, cliente, garantías y más."
        />
        <SupportItem
          icon={<Wrench className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
          title="Tengo una duda técnica"
          description="Consultas sobre diagnóstico, instalación, configuración y mejores prácticas."
        />
        <SupportItem
          icon={<DollarSign className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-50"
          title="Pagos y administración"
          description="Consultas sobre pagos, liquidaciones, facturación y documentación."
        />
        <SupportItem
          icon={<MessageCircle className="h-5 w-5 text-amber-600" />}
          iconBg="bg-amber-50"
          title="Otro tema"
          description="Cualquier otro tema no relacionado a los anteriores."
        />
      </div>

      {/* Respaldo banner */}
      <div className="rounded-2xl bg-lysto-blueSoft border border-blue-100 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center">
            <Users className="h-5 w-5 text-lysto-blue" />
          </div>
          <div>
            <p className="text-sm font-bold text-lysto-ink">Contás con nuestro respaldo</p>
            <p className="text-xs text-lysto-muted">Respuesta rápida, soluciones claras y un equipo que te entiende.</p>
          </div>
        </div>
        <Users className="h-10 w-10 text-blue-200 shrink-0" />
      </div>

      {/* Grow section */}
      <div>
        <h2 className="text-base font-black text-lysto-ink mb-0.5">Crecer con LYSTO</h2>
        <p className="text-xs text-lysto-muted mb-3">Recursos para que sigas desarrollándote y accedas a más oportunidades.</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { icon: <GraduationCap className="h-5 w-5" />, label: 'Capacitación', desc: 'Cursos y guías para mejorar cada día.', bg: 'bg-blue-50 text-blue-600' },
            { icon: <Wrench className="h-5 w-5" />, label: 'Herramientas', desc: 'Recursos y checklists para tu día a día.', bg: 'bg-green-50 text-green-600' },
            { icon: <BarChart3 className="h-5 w-5" />, label: 'Desarrollo', desc: 'Niveles, certificaciones y más beneficios.', bg: 'bg-amber-50 text-amber-600' },
            { icon: <Award className="h-5 w-5" />, label: 'Beneficios', desc: 'Promociones, seguros y ventajas exclusivas.', bg: 'bg-purple-50 text-purple-600' },
          ].map(item => (
            <button key={item.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-lysto-border p-3 hover:bg-slate-50 transition-colors">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${item.bg}`}>
                {item.icon}
              </div>
              <p className="text-[10px] font-bold text-lysto-ink">{item.label}</p>
              <p className="text-[10px] text-lysto-muted leading-tight hidden sm:block">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Help center */}
      <button className="w-full flex items-center gap-3 rounded-2xl bg-white border border-lysto-border p-4 hover:bg-slate-50 transition-colors">
        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <HelpCircle className="h-5 w-5 text-lysto-blue" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-lysto-ink">Centro de ayuda</p>
          <p className="text-xs text-lysto-muted">Explorá preguntas frecuentes y guías rápidas.</p>
        </div>
        <ChevronRight className="h-5 w-5 text-lysto-muted" />
      </button>
    </div>
  )
}
