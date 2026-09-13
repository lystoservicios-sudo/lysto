import { notFound } from 'next/navigation'
import { requirePageSession } from '@/lib/auth/session'
import { readAssignedEquipment } from '@/lib/professional/live-model'
import { ProFacts, ProPage, ProPanel } from '@/components/pro/pro-ui'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await readAssignedEquipment(await requirePageSession('professional'), id)
  if (!item) notFound()
  return (
    <ProPage
      title={item.equipment.nickname}
      description="Ficha e historial visibles por tu asignación vigente."
    >
      <div className="pro-two-col">
        <ProPanel title="Equipo">
          <ProFacts
            items={[
              { label: 'Tipo', value: item.equipment.equipment_type ?? 'No informado' },
              { label: 'Marca', value: item.equipment.brand ?? 'No informada' },
              { label: 'Modelo', value: item.equipment.model ?? 'No informado' },
              {
                label: 'Capacidad',
                value: item.equipment.frigorias
                  ? `${item.equipment.frigorias} frigorías`
                  : 'No informada'
              }
            ]}
          />
        </ProPanel>
        <ProPanel title="Historial técnico">
          {item.history.map((record) => (
            <article key={record.id} className="border-b border-slate-100 py-3">
              <strong>{new Date(record.created_at).toLocaleDateString('es-AR')}</strong>
              <p className="pro-muted">
                {record.real_diagnosis ?? record.reported_problem ?? 'Sin diagnóstico publicado'}
              </p>
              <p className="pro-muted">{record.work_done ?? 'Sin trabajo registrado'}</p>
            </article>
          ))}
          {!item.history.length ? (
            <p className="pro-muted">No hay antecedentes técnicos publicados para este equipo.</p>
          ) : null}
        </ProPanel>
      </div>
    </ProPage>
  )
}
