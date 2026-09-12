import { ProFacts, ProPage, ProPanel } from './pro-ui'

type RequestPreview = { id: string; issueLabel: string; address: string; timeWindow: string }
type JobPreview = {
  id: string
  issueLabel: string
  address: string
  timeWindow: string
  status: string
}
type EquipmentPreview = { nickname: string; brand?: string; model?: string; type?: string }

/** Preview-only compatibility components. Production detail routes use authenticated live panels. */
export function ProfessionalRequestDetail({ request }: { request: RequestPreview }) {
  return (
    <ProPage title={request.issueLabel} description={`Solicitud ${request.id}`}>
      <ProPanel title="Visita">
        <ProFacts
          items={[
            { label: 'Zona', value: request.address },
            { label: 'Horario', value: request.timeWindow }
          ]}
        />
      </ProPanel>
    </ProPage>
  )
}
export function ProfessionalJobDetail({ job }: { job: JobPreview }) {
  return (
    <ProPage title={job.issueLabel} description={`Trabajo ${job.id}`}>
      <ProPanel title="Estado confirmado">
        <ProFacts
          items={[
            { label: 'Estado', value: job.status },
            { label: 'Dirección', value: job.address },
            { label: 'Horario', value: job.timeWindow }
          ]}
        />
      </ProPanel>
    </ProPage>
  )
}
export function ProfessionalEquipmentDetail({ item }: { item: EquipmentPreview }) {
  return (
    <ProPage title={item.nickname} description="Ficha técnica">
      <ProPanel title="Equipo">
        <ProFacts
          items={[
            { label: 'Tipo', value: item.type ?? 'No informado' },
            { label: 'Marca', value: item.brand ?? 'No informada' },
            { label: 'Modelo', value: item.model ?? 'No informado' }
          ]}
        />
      </ProPanel>
    </ProPage>
  )
}
