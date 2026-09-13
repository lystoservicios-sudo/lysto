// Explicit legacy demonstration scope. T28 replaces the old demo screens.
// Never import this module from session repositories or production view models.
import { equipment, jobs, payments, professionals, serviceRequests } from './lysto-data'
export const demoProfessional = professionals[0]
export const professionalJobs = jobs.filter((job) => job.professional === demoProfessional.name)
export const professionalPayments = payments.filter(
  (payment) => payment.professional === demoProfessional.name
)
export const professionalEquipment = equipment.filter((item) =>
  professionalJobs.some((job) => job.customer === item.customer)
)
export const visibleRequests = serviceRequests.filter(
  (request) =>
    request.assignedProfessional === demoProfessional.name ||
    (!request.assignedProfessional && request.status === 'payment_approved')
)
export const availableRequests = visibleRequests.filter(
  (request) => !professionalJobs.some((job) => job.requestId === request.id)
)
