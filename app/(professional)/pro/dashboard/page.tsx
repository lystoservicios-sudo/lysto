'use client'

import { useState } from 'react'
import { ShieldCheck, CheckCircle2, Clock, Calendar } from 'lucide-react'
import { JobCard } from '@/components/pro/ui/job-card'
import { InfoBanner } from '@/components/pro/ui/info-banner'
import { SectionHeader } from '@/components/pro/ui/section-header'
import { jobs } from '@/lib/mock/lysto-data'

type TabType = 'activos' | 'por_cerrar' | 'finalizados'

export default function ProfessionalDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('activos')

  const activeJobs = jobs.filter(
    (j) =>
      !['completed', 'completed_pending_customer_confirmation', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'].includes(j.status)
  )
  const pendingCloseJobs = jobs.filter((j) => j.status === 'completed_pending_customer_confirmation')
  const completedJobs = jobs.filter((j) => j.status === 'completed')

  const filteredJobs =
    activeTab === 'activos'
      ? activeJobs
      : activeTab === 'por_cerrar'
      ? pendingCloseJobs
      : completedJobs

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Técnico Profesional"
        title="Mis trabajos"
        subtitle="Gestioná tus servicios activos, realizá diagnósticos y avanzá cada trabajo."
      />

      {/* Interactive Tabs Row */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80 w-fit">
        {[
          { key: 'activos' as TabType, label: 'Activos', count: activeJobs.length, icon: Clock },
          { key: 'por_cerrar' as TabType, label: 'Por cerrar', count: pendingCloseJobs.length, icon: Calendar },
          { key: 'finalizados' as TabType, label: 'Finalizados', count: completedJobs.length, icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Info banner */}
      <InfoBanner
        title="Lysto te acompaña en cada servicio"
        description="Respaldo al profesional, cobro protegido y garantía de 6 meses al cliente."
      />

      {/* Filtered Jobs List */}
      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => <JobCard key={job.id} job={job} />)
        ) : (
          <div className="rounded-3xl bg-white border border-slate-200 p-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto text-xl">
              📂
            </div>
            <p className="text-base font-black text-slate-900">No tenés trabajos en esta pestaña</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cuando tengas servicios en este estado, aparecerán automáticamente en esta lista.
            </p>
          </div>
        )}
      </div>

      {/* Footer Support */}
      <div className="pt-4 border-t border-slate-200/80 text-center">
        <p className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          Si tenés un inconveniente operativo o con el cliente, nuestro equipo te respalda.{' '}
          <a href="/pro/soporte" className="text-blue-600 font-bold hover:underline">
            Contactar soporte
          </a>
        </p>
      </div>
    </div>
  )
}
