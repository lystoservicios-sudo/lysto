import { z } from 'zod'
import { customerHomeSchema } from '@/lib/customer-homes/contracts'
import type { CustomerAssetEquipment } from '@/lib/customer-assets/contracts'
import type { CustomerHome } from '@/lib/customer-homes/contracts'

const equipmentSchema = z.object({
  id: z.string().uuid(), nickname: z.string(), addressId: z.string().uuid().nullable(),
  equipmentType: z.string().nullable(), brand: z.string().nullable(), model: z.string().nullable(),
  serialNumber: z.string().nullable(), frigorias: z.string().nullable(), version: z.number().int().positive(),
  createdAt: z.string(), archivedAt: z.string().nullable()
}).strict()
const paymentStatusSchema = z.enum(['creating', 'ready', 'pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded', 'partially_refunded', 'charged_back', 'review', 'expired'])
export const professionalJobContextSchema = z.object({
  jobId: z.string().uuid(), issueLabel: z.string(), reportedProblem: z.string().nullable(),
  accessInstructions: z.string().nullable(), equipment: equipmentSchema.nullable(),
  history: z.array(z.object({
    id: z.string().uuid(), createdAt: z.string(), diagnosis: z.string().nullable(),
    work: z.string().nullable(), nextMaintenanceDate: z.string().nullable()
  }).strict()).max(50),
  home: customerHomeSchema.nullable(), initialPaymentStatus: paymentStatusSchema.nullable(),
  extraPayments: z.array(z.object({ extraId: z.string().uuid(), status: paymentStatusSchema }).strict()),
  requestPhotoIds: z.array(z.string().uuid()).max(10).default([])
}).strict()
export type ProfessionalJobContext = Omit<z.infer<typeof professionalJobContextSchema>, 'equipment' | 'home' | 'requestPhotoIds'> & {
  equipment: CustomerAssetEquipment | null
  home: CustomerHome | null
  requestPhotoIds?: string[]
}
