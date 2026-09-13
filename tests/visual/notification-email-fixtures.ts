export const notificationEmailFixtures = [
  {
    slug: 'visit-confirmed',
    context: {
      eventType: 'visit.confirmed',
      aggregateId: '75500000-0000-4000-8000-000000000001',
      audience: 'customer',
      scheduleVersion: 2,
      startsAt: '2030-09-18T13:00:00+00:00',
      endsAt: '2030-09-18T15:00:00+00:00',
      timezone: 'America/Argentina/Buenos_Aires',
      serviceName: 'Reparación de aire acondicionado',
      professionalName: 'Martín T.',
      addressLabel: 'Av. Siempre Viva 742, Piso 3 Depto. B, Buenos Aires'
    },
    requiredText: [
      'Ver servicio',
      'Cómo llegar',
      'Solicitar reprogramación',
      'Contactar desde Lysto'
    ]
  },
  {
    slug: 'review-requested',
    context: {
      eventType: 'review.requested',
      aggregateId: '75500000-0000-4000-8000-000000000001',
      audience: 'customer'
    },
    requiredText: ['Calificar servicio']
  }
] as const
