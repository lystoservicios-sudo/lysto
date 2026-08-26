'use client'

import { useState } from 'react'

import type { CustomerDataState, CustomerProfessionalRecognitionViewModel, CustomerQualityFollowupViewModel, CustomerWarrantyViewModel } from '@/features/customer/view-models'
import { CountTabs } from './count-tabs'
import { InfoNotice } from './info-notice'
import { ProfessionalRecognitionCard } from './professional-recognition-card'
import { QualityFollowupCard } from './quality-followup-card'
import { EmptyState, ErrorState, LoadingSkeleton } from './states'
import { WarrantyAssurancePanel } from './warranty-assurance-panel'
import { WarrantyCaseCard } from './warranty-case-card'

type WarrantyTab = 'coverage' | 'claims' | 'quality'

export function CustomerWarrantyCenter({ warranties, qualityFollowups, recognition, state = warranties.length || qualityFollowups.length || recognition ? 'ready' : 'empty', onRetry, onContactQuality }: {
  warranties: readonly CustomerWarrantyViewModel[]
  qualityFollowups: readonly CustomerQualityFollowupViewModel[]
  recognition?: CustomerProfessionalRecognitionViewModel
  state?: CustomerDataState
  onRetry?: () => void
  onContactQuality?: (followupId: string) => void
}) {
  const [tab, setTab] = useState<WarrantyTab>('coverage')
  if (state === 'loading') return <LoadingSkeleton label="Cargando garantías" rows={8} />
  if (state === 'error') return <ErrorState title="No pudimos cargar tus garantías" description="Reintentá para recuperar coberturas y seguimientos." onRetry={onRetry} />

  const coverage = warranties.filter((item) => item.status === 'active' || item.status === 'expired')
  const claims = warranties.filter((item) => item.status === 'claim_open' || item.status === 'resolved' || item.status === 'rejected')
  const tabs = [
    { id: 'coverage' as const, label: 'Coberturas', count: coverage.length },
    { id: 'claims' as const, label: 'Reclamos', count: claims.length },
    { id: 'quality' as const, label: 'Calidad', count: qualityFollowups.length + (recognition ? 1 : 0) }
  ]

  return (
    <div className="space-y-6">
      <WarrantyAssurancePanel />
      {state === 'empty' ? <EmptyState title="Todavía no hay coberturas ni casos" description="Cuando un servicio cerrado genere una garantía o un seguimiento confirmado, aparecerá en este espacio." /> : (
        <section aria-labelledby="warranty-records-title" className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Expedientes del hogar</p><h2 id="warranty-records-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Coberturas, reclamos y calidad</h2></div>
          <CountTabs items={tabs} value={tab} onValueChange={setTab} label="Secciones de garantías" panelId="warranty-tab-panel" />
          <div id="warranty-tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-4">
            {tab === 'coverage' ? (
              coverage.length ? <div className="grid gap-4 lg:grid-cols-2">{coverage.map((item) => <WarrantyCaseCard key={item.id} warranty={item} />)}</div> : <EmptyState compact title="No hay coberturas disponibles" description="Las garantías aparecerán después de un cierre técnico confirmado." />
            ) : tab === 'claims' ? (
              claims.length ? <div className="grid gap-4 xl:grid-cols-2">{claims.map((item) => <WarrantyCaseCard key={item.id} warranty={item} />)}</div> : <EmptyState compact title="No hay reclamos registrados" description="No abrimos casos sin una operación confirmada." />
            ) : (
              qualityFollowups.length || recognition ? <div className="grid gap-4 xl:grid-cols-2"><div className="space-y-4">{qualityFollowups.map((item) => <QualityFollowupCard key={item.id} followup={item} onContact={onContactQuality} />)}</div>{recognition ? <ProfessionalRecognitionCard recognition={recognition} /> : null}</div> : <EmptyState compact title="No hay seguimientos de calidad" description="Los seguimientos aparecerán únicamente cuando exista un evento confirmado." />
            )}
          </div>
        </section>
      )}
      <InfoNotice tone="security" title="Información segura para el cliente" description="Esta vista muestra estados, próximos pasos y resúmenes confirmados. Las notas administrativas privadas no se exponen." />
    </div>
  )
}
