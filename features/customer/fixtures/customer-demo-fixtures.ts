import type {
  CustomerAddressViewModel,
  CustomerEquipmentViewModel,
  CustomerJobViewModel,
  CustomerMaintenanceViewModel,
  CustomerPaymentViewModel,
  CustomerProfileViewModel,
  CustomerRequestViewModel,
  CustomerWarrantyViewModel
} from '../view-models'

export type CustomerDemoFixtures = {
  meta: {
    kind: 'demo'
    label: string
  }
  profile: CustomerProfileViewModel
  addresses: CustomerAddressViewModel[]
  requests: CustomerRequestViewModel[]
  jobs: CustomerJobViewModel[]
  equipment: CustomerEquipmentViewModel[]
  maintenance: CustomerMaintenanceViewModel[]
  warranties: CustomerWarrantyViewModel[]
  payments: {
    integrationState: 'deferred'
    movements: CustomerPaymentViewModel[]
  }
}

export const customerDemoFixtures = {
  meta: {
    kind: 'demo',
    label: 'Vista de demostración para desarrollo'
  },
  profile: {
    id: 'customer_demo_marina',
    firstName: 'Marina',
    lastName: 'Costa',
    email: 'marina.demo@example.com',
    phone: '+54 9 11 5555-0107',
    notificationPreference: 'both'
  },
  addresses: [
    {
      id: 'address_demo_home',
      label: 'Casa',
      street: 'Av. Corrientes',
      number: '1240',
      floor: '7',
      apartment: 'B',
      city: 'CABA',
      province: 'Buenos Aires',
      access: {
        hasElevator: true,
        hasParking: false,
        stairsRequired: false,
        outdoorUnitAtHeight: true,
        outdoorUnitOnBalcony: true,
        difficultAccess: false
      }
    }
  ],
  requests: [
    {
      id: 'req_demo_cooling',
      issue: 'no_enfria',
      issueLabel: 'No enfría',
      status: 'pending_payment',
      statusView: { label: 'Integración de pago pendiente', tone: 'warning' },
      urgency: 'priority',
      address: 'Dirección de demostración, CABA',
      preferredWindow: '16:00 – 18:00',
      createdAt: '2026-08-25T12:00:00.000Z',
      preliminaryDiagnosis: 'Revisión preliminar pendiente de confirmación profesional.',
      preliminaryPrice: 43750,
      mediaCount: 0,
      nextStep: 'Revisar el presupuesto preliminar'
    }
  ],
  jobs: [
    {
      id: 'job_demo_visit',
      requestId: 'req_demo_cooling',
      status: 'technician_on_way',
      statusView: { label: 'Profesional en camino', tone: 'brand' },
      issueLabel: 'No enfría',
      address: 'Dirección de demostración, CABA',
      scheduledAt: '2026-08-25T16:00:00.000Z',
      timeWindow: '16:00 – 18:00',
      professionalName: 'Profesional de demostración',
      equipmentName: 'Aire del living',
      amount: null,
      nextStep: 'Esperar la llegada del profesional',
      canReview: false
    }
  ],
  equipment: [
    {
      id: 'eq_demo_living',
      nickname: 'Aire del living',
      kind: 'Split inverter',
      brand: 'Marca de demostración',
      model: 'INV-3200',
      address: 'Dirección de demostración, CABA',
      lastServiceAt: '2026-08-19T12:00:00.000Z',
      nextMaintenanceAt: '2027-02-19T12:00:00.000Z',
      maintenanceOption: 'deep_cleaning_6_months',
      serviceCount: 2
    },
    {
      id: 'eq_demo_bedroom',
      nickname: 'Aire del dormitorio',
      kind: 'Split',
      brand: 'Marca de demostración',
      address: 'Dirección de demostración, CABA',
      maintenanceOption: 'filters_90_days',
      serviceCount: 0
    }
  ],
  maintenance: [
    {
      id: 'maintenance_demo_filters',
      equipmentId: 'eq_demo_bedroom',
      equipmentName: 'Aire del dormitorio',
      recommendation: 'Limpieza preventiva de filtros',
      dueAt: '2026-10-20T12:00:00.000Z',
      urgency: 'planned',
      actionState: 'deferred'
    }
  ],
  warranties: [
    {
      id: 'warranty_demo_active',
      jobId: 'job_demo_visit',
      equipmentName: 'Aire del living',
      status: 'active',
      statusView: { label: 'Cobertura vigente', tone: 'success' },
      coverageEndsAt: '2026-09-19T12:00:00.000Z',
      safeSummary: 'Cobertura de demostración sujeta al cierre técnico.',
      nextStep: 'Conservar el comprobante del servicio'
    }
  ],
  payments: {
    integrationState: 'deferred',
    movements: []
  }
} satisfies CustomerDemoFixtures
