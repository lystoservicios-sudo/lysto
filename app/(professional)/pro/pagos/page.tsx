import { Trophy, ShieldCheck, GraduationCap, Wrench, BarChart3, HelpCircle, ChevronRight } from 'lucide-react'
import { LiquidationRow } from '@/components/pro/ui/liquidation-row'
import { SectionHeader } from '@/components/pro/ui/section-header'
import { payments } from '@/lib/mock/lysto-data'

function money(value: number) {
  return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

const totalGenerated = payments.reduce((sum, p) => sum + p.professionalAmount, 0)
const totalCliente = payments.reduce((sum, p) => sum + p.amount, 0)
const totalComision = payments.reduce((sum, p) => sum + p.platformFee, 0)

export default function ProfessionalPaymentsPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Pagos profesional"
        title="Tu trabajo, tu recompensa"
        subtitle="Vos te ocupás del servicio, nosotros del resto."
      />

      {/* Hero financiero */}
      <div className="rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.08)] p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-lysto-muted font-semibold">Total generado</p>
            <p className="text-3xl font-black text-lysto-ink mt-1">{money(totalGenerated)}</p>
            <p className="text-xs text-lysto-green font-semibold mt-1">Disponible para transferencia</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-lysto-ink">Así se compone</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-lysto-blue" />
                <span className="text-xs text-lysto-muted">Total cliente</span>
              </div>
              <span className="text-xs font-bold text-lysto-ink">{money(totalCliente)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-lysto-green" />
                <span className="text-xs text-lysto-muted">Comisión Lysto</span>
              </div>
              <span className="text-xs font-bold text-lysto-ink">{money(totalComision)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-lysto-border grid grid-cols-2 gap-3">
          <button className="flex items-center gap-2.5 rounded-xl border border-lysto-border p-3 text-left hover:bg-slate-50 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-lysto-blueSoft flex items-center justify-center">
              <svg className="h-4 w-4 text-lysto-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-lysto-ink">Ver detalle de</p>
              <p className="text-xs font-bold text-lysto-ink">liquidaciones</p>
            </div>
            <ChevronRight className="h-4 w-4 text-lysto-muted ml-auto" />
          </button>
          <div className="rounded-xl bg-green-50 border border-green-100 p-3 flex items-center gap-2">
            <span className="text-xl">🌱</span>
            <p className="text-[11px] text-lysto-muted leading-relaxed">Con tu comisión mantenemos la plataforma y soporte que usás todos los días.</p>
          </div>
        </div>
      </div>

      {/* Liquidaciones */}
      <div className="rounded-2xl bg-white border border-lysto-border shadow-[0_1px_3px_rgba(7,19,47,0.08)] p-5">
        <h2 className="text-base font-black text-lysto-ink flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-lysto-warning" />
          Últimas liquidaciones
        </h2>
        <div className="divide-y divide-lysto-border">
          {payments.map(payment => (
            <LiquidationRow key={payment.id} payment={payment} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="rounded-2xl bg-white border border-lysto-border p-4">
        <p className="text-sm font-bold text-lysto-ink mb-3">Te respaldamos para que sigas creciendo</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { icon: <GraduationCap className="h-5 w-5" />, label: 'Capacitación', desc: 'Cursos y certificaciones para vos.' },
            { icon: <Wrench className="h-5 w-5" />, label: 'Herramientas', desc: 'Todo lo que necesitás para trabajar mejor.' },
            { icon: <ShieldCheck className="h-5 w-5" />, label: 'Soporte', desc: 'Asistencia rápida cuando la necesitás.' },
            { icon: <BarChart3 className="h-5 w-5" />, label: 'Más trabajos', desc: 'Más oportunidades para vos.' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center gap-1.5">
              <div className="h-10 w-10 rounded-2xl bg-lysto-blueSoft flex items-center justify-center text-lysto-blue">
                {item.icon}
              </div>
              <p className="text-[10px] font-bold text-lysto-ink">{item.label}</p>
              <p className="text-[10px] text-lysto-muted leading-tight hidden sm:block">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Help link */}
      <div className="flex items-center justify-between rounded-2xl bg-white border border-lysto-border p-4">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-5 w-5 text-lysto-warning" />
          <div>
            <p className="text-sm font-bold text-lysto-ink">¿Tenés dudas sobre tus pagos?</p>
            <p className="text-xs text-lysto-muted">Encontrá respuestas rápidas en el Centro de ayuda.</p>
          </div>
        </div>
        <button className="text-lysto-blue text-sm font-bold shrink-0">Ir al Centro de ayuda →</button>
      </div>
    </div>
  )
}
