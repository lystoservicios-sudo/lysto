import type {
  CustomerEquipmentViewModel,
  CustomerJobViewModel,
  CustomerMaintenanceViewModel,
  CustomerUiTone,
  CustomerWarrantyViewModel
} from './view-models'

export type CustomerDashboardMetric = {
  id: 'active-jobs' | 'equipment' | 'maintenance' | 'warranties'
  label: string
  value: number
  description: string
  tone: Exclude<CustomerUiTone, 'danger'>
}

export type CustomerDashboardViewModel = {
  customerName: string
  metrics: CustomerDashboardMetric[]
  activeJob: CustomerJobViewModel | null
  featuredEquipment: CustomerEquipmentViewModel[]
  isNewCustomer: boolean
}

type CustomerDashboardSource = {
  customerName: string
  jobs: readonly CustomerJobViewModel[]
  equipment: readonly CustomerEquipmentViewModel[]
  maintenance: readonly CustomerMaintenanceViewModel[]
  warranties: readonly CustomerWarrantyViewModel[]
}

const inactiveJobStatuses = new Set(['completed', 'cancelled_by_customer', 'cancelled_by_professional', 'cancelled_by_admin'])

export function buildCustomerDashboardViewModel(source: CustomerDashboardSource): CustomerDashboardViewModel {
  const activeJobs = source.jobs.filter((job) => !inactiveJobStatuses.has(job.status))
  const actionableMaintenance = source.maintenance.filter((item) => item.urgency !== 'none')
  const activeWarranties = source.warranties.filter((item) => item.status === 'active' || item.status === 'claim_open')

  return {
    customerName: source.customerName,
    activeJob: activeJobs[0] ?? null,
    featuredEquipment: source.equipment.slice(0, 2),
    isNewCustomer: source.jobs.length === 0 && source.equipment.length === 0,
    metrics: [
      { id: 'active-jobs', label: 'Trabajo activo', value: activeJobs.length, description: activeJobs.length ? 'Requiere seguimiento' : 'Sin visitas en curso', tone: 'brand' },
      { id: 'equipment', label: 'Equipos', value: source.equipment.length, description: 'Con historial en Lysto', tone: 'neutral' },
      { id: 'maintenance', label: 'Mantenimiento', value: actionableMaintenance.length, description: 'Recomendaciones vigentes', tone: actionableMaintenance.length ? 'warning' : 'neutral' },
      { id: 'warranties', label: 'Garantías', value: activeWarranties.length, description: 'Coberturas y casos activos', tone: activeWarranties.length ? 'benefit' : 'neutral' }
    ]
  }
}
