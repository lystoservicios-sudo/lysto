import { getMaintenanceTask } from '@/lib/customer/maintenance-plan'
import type { JobStatus, MaintenanceOption, RequestStatus } from '@/lib/domain/types'

export type HomeDataset<T> =
  | { state: 'ready'; items: T[] }
  | { state: 'error'; label: string }

export type HomeRequestSource = {
  id: string
  status: RequestStatus
  issueLabel: string
  nextStep: string
  createdAt: string
}

export type HomeVisitSource = {
  startsAt: string
  endsAt: string
  timezone: 'America/Argentina/Buenos_Aires'
  professionalName: string
}

export type HomeJobSource = {
  id: string
  requestId: string
  status: JobStatus
  issueLabel: string
  equipmentId?: string
  equipmentName?: string
  nextStep: string
  createdAt: string
  completedAt?: string
  visit: HomeVisitSource | null
  visitState: 'ready' | 'error'
}

export type HomeQuoteSource = {
  id: string
  requestId: string | null
  status: string
  scope: string
  total: number | null
  expiresAt: string
  createdAt: string
}

export type HomeCheckoutSource = {
  jobId: string
  extraId: string | null
  status: string
}

export type HomeMaintenanceSource = {
  id: string
  equipmentId?: string
  equipmentName: string
  recommendation: string
  dueAt: string | null
  status: string
  sourceJobId: string | null
}

export type HomeEquipmentSource = { id: string; name: string }

export type HomeSupportCaseSource = {
  id: string
  jobId: string | null
  status: string
  category: string
  summary: string
  updatedAt: string
}

export type CustomerHomeSource = {
  preferenceScope: string
  now: string
  quotes: HomeDataset<HomeQuoteSource>
  requests: HomeDataset<HomeRequestSource>
  jobs: HomeDataset<HomeJobSource>
  checkouts: HomeDataset<HomeCheckoutSource>
  addresses: HomeDataset<number>
  equipment: HomeDataset<number>
  equipmentDetails?: HomeDataset<HomeEquipmentSource>
  completedJobs?: HomeDataset<HomeJobSource>
  maintenance: HomeDataset<HomeMaintenanceSource>
  supportCases: HomeDataset<HomeSupportCaseSource>
}

export type HomeAction = { label: string; href: string }
export type HomeActivityKind = 'decision' | 'visit' | 'progress' | 'draft' | 'maintenance' | 'support'

export type HomeActivityItem = {
  id: string
  contractKey: string
  kind: HomeActivityKind
  priority: number
  eyebrow: string
  title: string
  description: string
  subject?: string
  action: HomeAction | null
  additionalActions?: HomeAction[]
  disabledReason?: string
  startsAt?: string
  endsAt?: string
  timezone?: HomeVisitSource['timezone']
  professionalName?: string
  dueAt?: string | null
  sortAt: string
}

export type CustomerHomeViewModel = {
  preferenceScope: string
  activity: HomeActivityItem[]
  hiddenActivityCount: number
  unavailableSections: string[]
  service: { title: string; description: string; href: string }
  orderHistory: HomeAction[]
  household: null | {
    id: string
    title: string
    description: string
    action: HomeAction
    maintenanceId?: string
  }
  lastService: null | {
    id: string
    title: string
    equipmentName?: string
    completedAt?: string
    action: HomeAction
  }
  setupInvite: null | {
    kind: 'address' | 'equipment'
    title: string
    description: string
    action: HomeAction
    deferDays: number
  }
}

const completedJobs = new Set<JobStatus>([
  'completed',
  'cancelled_by_customer',
  'cancelled_by_professional',
  'cancelled_by_admin'
])
const incompleteRequests = new Set<RequestStatus>([
  'draft',
  'diagnosis_completed',
  'address_completed',
  'schedule_completed',
  'price_selected'
])
const closedRequests = new Set<RequestStatus>(['cancelled', 'expired'])
const paidCheckoutStatuses = new Set(['approved', 'captured'])
const activeSupportStatuses = new Set([
  'open',
  'in_review',
  'waiting_customer',
  'waiting_professional'
])

function items<T>(dataset: HomeDataset<T>) {
  return dataset.state === 'ready' ? dataset.items : []
}

function count(dataset: HomeDataset<number>) {
  return dataset.state === 'ready' ? dataset.items[0] ?? 0 : null
}

function jobContract(job: Pick<HomeJobSource, 'requestId'>) {
  return `request:${job.requestId}`
}

function addActivity(target: Map<string, HomeActivityItem>, next: HomeActivityItem) {
  const current = target.get(next.contractKey)
  if (!current || next.priority < current.priority) {
    target.set(next.contractKey, next)
    return
  }
  if (current.kind === 'decision' && next.kind === 'decision') {
    const actions = [current.action, ...(current.additionalActions ?? []), next.action]
      .filter((action): action is HomeAction => Boolean(action))
      .filter((action, index, all) => all.findIndex((candidate) => candidate.href === action.href) === index)
    target.set(next.contractKey, {
      ...current,
      title: actions.length > 1 ? 'Tenés más de una decisión pendiente' : current.title,
      description:
        actions.length > 1
          ? `Revisá las decisiones pendientes de ${current.subject ?? 'este servicio'}.`
          : current.description,
      action: actions[0] ?? null,
      additionalActions: actions.slice(1)
    })
  }
}

function supportHref() {
  return '/app/garantias'
}

export function buildCustomerHomeViewModel(source: CustomerHomeSource): CustomerHomeViewModel {
  const activity = new Map<string, HomeActivityItem>()
  const jobById = new Map(items(source.jobs).map((job) => [job.id, job]))
  const checkoutByJob = new Map<string, HomeCheckoutSource[]>()
  for (const checkout of items(source.checkouts)) {
    const current = checkoutByJob.get(checkout.jobId) ?? []
    current.push(checkout)
    checkoutByJob.set(checkout.jobId, current)
  }

  for (const quote of items(source.quotes)) {
    if (Date.parse(quote.expiresAt) <= Date.parse(source.now)) continue
    const contractKey = quote.requestId ? `request:${quote.requestId}` : `quote:${quote.id}`
    if (quote.status === 'ready') {
      addActivity(activity, {
        id: `quote:${quote.id}`,
        contractKey,
        kind: 'decision',
        priority: 1,
        eyebrow: 'Decisión pendiente',
        title: 'Tu presupuesto está listo',
        description: 'Revisá el alcance y el importe antes de decidir.',
        subject: quote.scope,
        action: {
          label: 'Revisar presupuesto',
          href: `/app/presupuestos#presupuesto-${quote.id}`
        },
        sortAt: quote.createdAt
      })
    } else if (quote.status === 'needs_review') {
      addActivity(activity, {
        id: `quote:${quote.id}`,
        contractKey,
        kind: 'progress',
        priority: 3,
        eyebrow: 'Pedido en revisión',
        title: 'Estamos revisando tu presupuesto',
        description: 'Por ahora no necesitás hacer nada.',
        subject: quote.scope,
        action: {
          label: 'Ver presupuesto',
          href: `/app/presupuestos#presupuesto-${quote.id}`
        },
        sortAt: quote.createdAt
      })
    }
  }

  for (const job of items(source.jobs)) {
    if (completedJobs.has(job.status)) continue
    const contractKey = jobContract(job)
    const common = {
      id: `job:${job.id}`,
      contractKey,
      subject: job.equipmentName ?? job.issueLabel,
      sortAt: job.createdAt
    }
    if (job.status === 'waiting_customer_approval') {
      addActivity(activity, {
        ...common,
        kind: 'decision',
        priority: 1,
        eyebrow: 'Decisión pendiente',
        title: 'Revisá el diagnóstico y los cambios',
        description: 'El profesional registró información que requiere tu aprobación.',
        action: { label: 'Revisar diagnóstico', href: `/app/trabajos/${job.id}` }
      })
      continue
    }
    if (job.status === 'completed_pending_customer_confirmation') {
      addActivity(activity, {
        ...common,
        kind: 'decision',
        priority: 1,
        eyebrow: 'Decisión pendiente',
        title: 'Confirmá el resultado del servicio',
        description: 'Revisá el informe técnico antes de confirmar o informar un problema.',
        action: { label: 'Revisar servicio', href: `/app/trabajos/${job.id}` }
      })
      continue
    }
    if (job.status === 'confirmed' && source.checkouts.state === 'ready') {
      const initialCheckouts = (checkoutByJob.get(job.id) ?? []).filter(
        (checkout) => checkout.extraId === null
      )
      const paid = initialCheckouts.some((checkout) => paidCheckoutStatuses.has(checkout.status))
      if (!paid) {
        addActivity(activity, {
          ...common,
          kind: 'decision',
          priority: 1,
          eyebrow: 'Pago habilitado',
          title: 'El profesional confirmó el servicio',
          description: 'Revisá el detalle y el estado del pago antes de continuar.',
          action: { label: 'Ver pago', href: `/app/trabajos/${job.id}` }
        })
        continue
      }
    }
    if (job.status === 'confirmed' && job.visitState === 'ready' && job.visit) {
      addActivity(activity, {
        ...common,
        kind: 'visit',
        priority: 2,
        eyebrow: 'Próxima visita',
        title: job.issueLabel,
        description: 'La visita está confirmada.',
        action: { label: 'Ver seguimiento', href: `/app/trabajos/${job.id}` },
        startsAt: job.visit.startsAt,
        endsAt: job.visit.endsAt,
        timezone: job.visit.timezone,
        professionalName: job.visit.professionalName
      })
      continue
    }
    addActivity(activity, {
      ...common,
      kind: 'progress',
      priority: 2,
      eyebrow: 'Servicio en curso',
      title: job.issueLabel,
      description: job.nextStep,
      action: { label: 'Ver seguimiento', href: `/app/trabajos/${job.id}` }
    })
  }

  for (const request of items(source.requests)) {
    const contractKey = `request:${request.id}`
    if (closedRequests.has(request.status)) continue
    if (incompleteRequests.has(request.status)) {
      addActivity(activity, {
        id: `request:${request.id}`,
        contractKey,
        kind: 'draft',
        priority: 4,
        eyebrow: 'Solicitud sin terminar',
        title: request.issueLabel,
        description: 'Este borrador quedó guardado, pero todavía no se puede recuperar desde Inicio.',
        action: null,
        disabledReason: 'La recuperación de borradores todavía no está disponible.',
        sortAt: request.createdAt
      })
      continue
    }
    addActivity(activity, {
      id: `request:${request.id}`,
      contractKey,
      kind: 'progress',
      priority: 3,
      eyebrow: 'Pedido en seguimiento',
      title: request.issueLabel,
      description:
        request.status === 'pending_payment'
          ? 'El pedido sigue en revisión. El pago se habilita cuando un profesional acepta el trabajo.'
          : request.nextStep,
      action: { label: 'Ver pedido', href: '/app/solicitudes' },
      sortAt: request.createdAt
    })
  }

  const support = items(source.supportCases)
  for (const reminder of items(source.maintenance)) {
    if (['cancelled', 'completed', 'requested'].includes(reminder.status)) continue
    const relatedCase = reminder.sourceJobId
      ? support.find(
          (item) => item.jobId === reminder.sourceJobId && activeSupportStatuses.has(item.status)
        )
      : undefined
    const blocked = reminder.status === 'suppressed_by_case' || Boolean(relatedCase)
    const relatedJob = reminder.sourceJobId ? jobById.get(reminder.sourceJobId) : undefined
    addActivity(activity, {
      id: `maintenance:${reminder.id}`,
      contractKey: relatedJob ? jobContract(relatedJob) : `maintenance:${reminder.id}`,
      kind: 'maintenance',
      priority: 5,
      eyebrow: blocked ? 'Mantenimiento en pausa' : 'Mantenimiento recomendado',
      title: reminder.equipmentName,
      description: blocked
        ? 'Hay un caso abierto que debe resolverse antes de coordinar otro servicio.'
        : reminder.recommendation.replaceAll('_', ' '),
      subject: reminder.equipmentName,
      action: blocked
        ? { label: 'Ver caso', href: supportHref() }
        : { label: 'Ver mantenimiento', href: '/app/mantenimientos' },
      dueAt: reminder.dueAt,
      sortAt: reminder.dueAt ?? source.now
    })
  }

  for (const supportCase of support) {
    if (!activeSupportStatuses.has(supportCase.status)) continue
    const relatedJob = supportCase.jobId ? jobById.get(supportCase.jobId) : undefined
    const contractKey = relatedJob ? jobContract(relatedJob) : `case:${supportCase.id}`
    const needsCustomer = supportCase.status === 'waiting_customer'
    addActivity(activity, {
      id: `case:${supportCase.id}`,
      contractKey,
      kind: needsCustomer ? 'decision' : 'support',
      priority: needsCustomer ? 1 : 5,
      eyebrow: needsCustomer ? 'Respuesta pendiente' : 'Caso en seguimiento',
      title: needsCustomer ? 'Soporte necesita tu respuesta' : 'Hay una novedad en tu caso',
      description: supportCase.summary,
      action: { label: 'Ver caso', href: supportHref() },
      sortAt: supportCase.updatedAt
    })
  }

  const allActivity = [...activity.values()].sort(
    (left, right) => left.priority - right.priority || right.sortAt.localeCompare(left.sortAt)
  )
  const decisions = allActivity.filter((item) => item.kind === 'decision')
  const remaining = allActivity.filter((item) => item.kind !== 'decision')
  const visible = [...decisions, ...remaining.slice(0, Math.max(0, 6 - decisions.length))]
  const unavailableSections = Object.values(source)
    .filter((value): value is Extract<HomeDataset<unknown>, { state: 'error' }> =>
      Boolean(value && typeof value === 'object' && 'state' in value && value.state === 'error')
    )
    .map((dataset) => dataset.label)
  if (items(source.jobs).some((job) => job.visitState === 'error')) {
    unavailableSections.push('visitas')
  }

  const addressCount = count(source.addresses)
  const equipmentCount = count(source.equipment)
  const equipmentDetails = source.equipmentDetails ? items(source.equipmentDetails) : []
  const equipmentNames = new Map(equipmentDetails.map((equipment) => [equipment.id, equipment.name]))
  const nextCare = items(source.maintenance)
    .filter((reminder) =>
      reminder.equipmentId &&
      ['planned', 'deferred'].includes(reminder.status) &&
      reminder.recommendation !== 'none' &&
      !support.some((supportCase) =>
        reminder.sourceJobId &&
        supportCase.jobId === reminder.sourceJobId &&
        activeSupportStatuses.has(supportCase.status)
      )
    )
    .sort((left, right) => (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999'))[0]
  const equipment = equipmentDetails[0]
  let household: CustomerHomeViewModel['household'] = equipment
    ? {
        id: equipment.id,
        title: equipment.name,
        description: 'Datos e historial del equipo',
        action: { label: 'Ver equipo', href: `/app/equipos/${equipment.id}` }
      }
    : null
  if (nextCare?.equipmentId) {
    const continuity = ['pending_part_replacement', 'second_visit_recommended'].includes(
      nextCare.recommendation
    )
    household = {
      id: nextCare.equipmentId,
      title: equipmentNames.get(nextCare.equipmentId) ?? nextCare.equipmentName,
      description:
        getMaintenanceTask(nextCare.recommendation as MaintenanceOption)?.label ??
        nextCare.recommendation.replaceAll('_', ' '),
      maintenanceId: nextCare.id,
      action: continuity && nextCare.sourceJobId
        ? { label: 'Ver seguimiento', href: `/app/trabajos/${nextCare.sourceJobId}` }
        : { label: 'Ver mantenimiento', href: '/app/mantenimientos' }
    }
  }
  const lastCompleted = (source.completedJobs ? items(source.completedJobs) : [])
    .filter((job) => job.status === 'completed')
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0]
  const lastService: CustomerHomeViewModel['lastService'] = lastCompleted
    ? {
        id: lastCompleted.id,
        title: lastCompleted.issueLabel,
        equipmentName: lastCompleted.equipmentName ??
          (lastCompleted.equipmentId ? equipmentNames.get(lastCompleted.equipmentId) : undefined),
        completedAt: lastCompleted.completedAt,
        action: { label: 'Ver servicio', href: `/app/trabajos/${lastCompleted.id}` }
      }
    : null
  const suppressInvite = visible.some(
    (item) => item.kind === 'decision' || item.kind === 'draft'
  )
  let setupInvite: CustomerHomeViewModel['setupInvite'] = null
  if (!suppressInvite && addressCount === 0) {
    setupInvite = {
      kind: 'address',
      title: 'Agregá tu hogar',
      description: 'Guardá tu dirección para usarla en tus próximos pedidos.',
      action: { label: 'Agregar hogar', href: '/app/direcciones' },
      deferDays: 7
    }
  } else if (!suppressInvite && addressCount !== null && addressCount > 0 && equipmentCount === 0) {
    setupInvite = {
      kind: 'equipment',
      title: 'Agregá tu primer equipo',
      description: 'Guardá sus datos para no volver a cargarlos al pedir un servicio.',
      action: { label: 'Agregar equipo', href: '/app/equipos' },
      deferDays: 7
    }
  }

  return {
    preferenceScope: source.preferenceScope,
    activity: visible,
    hiddenActivityCount: allActivity.length - visible.length,
    unavailableSections: [...new Set(unavailableSections)],
    service: {
      title: 'Aire acondicionado',
      description: 'Reparación, mantenimiento e instalación',
      href: '/app/solicitar/aire-acondicionado'
    },
    orderHistory: [
      { label: 'Presupuestos', href: '/app/presupuestos' },
      { label: 'Solicitudes', href: '/app/solicitudes' },
      { label: 'Trabajos', href: '/app/trabajos' }
    ],
    household,
    lastService,
    setupInvite
  }
}
