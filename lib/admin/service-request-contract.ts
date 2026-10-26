import { z } from 'zod'
import { cents, decimal } from '../payments/checkout-contract'

const money = z.number().finite().min(0).max(100_000_000)
  .refine(value => Number.isInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Usá hasta dos decimales.')

export const adminCommissionSchema = z.object({
  mode: z.enum(['percentage', 'amount']), value: money
}).strict()
export type AdminCommission = z.infer<typeof adminCommissionSchema>

export function calculateAdminRequestAmounts(total: number, commission: AdminCommission, paymentCostRate = 0.06) {
  money.refine(value => value > 0).parse(total)
  adminCommissionSchema.parse(commission)
  if (!Number.isFinite(paymentCostRate) || paymentCostRate < 0 || paymentCostRate > 0.5) throw new Error('invalid_payment_cost_rate')
  const amount = cents(total)
  const fee = commission.mode === 'percentage'
    ? (amount * cents(commission.value) + 5000n) / 10000n
    : cents(commission.value)
  if ((commission.mode === 'percentage' && commission.value >= 100) || fee >= amount) throw new Error('invalid_payment_split')
  const cost = (amount * BigInt(Math.round(paymentCostRate * 10000)) + 5000n) / 10000n
  return {
    total, platformFee: Number(decimal(fee)), professionalAmount: Number(decimal(amount - fee)),
    paymentCostBudget: Number(decimal(cost)), professionalNetEstimate: Number(amount - fee - cost) / 100
  }
}

export const adminRequestSchema = z.object({
  id: z.string().uuid(), expectedVersion: z.number().int().nonnegative(),
  action: z.enum(['draft', 'send']), customerId: z.string().uuid(), addressId: z.string().uuid(),
  equipmentId: z.string().uuid().nullable().optional(), categoryId: z.string().uuid(), issueTypeId: z.string().uuid(),
  serviceTitle: z.string().trim().min(3).max(120), description: z.string().trim().min(15).max(2000),
  professionalId: z.string().uuid(), startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(30).max(480), travelBufferMinutes: z.number().int().min(0).max(180),
  total: money.refine(value => value > 0), commission: adminCommissionSchema
}).strict().superRefine((input, context) => {
  if (input.action === 'send' && !input.equipmentId)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['equipmentId'], message: 'Seleccioná el equipo del cliente antes de enviar la solicitud.' })
  try { calculateAdminRequestAmounts(input.total, input.commission) }
  catch { context.addIssue({ code: z.ZodIssueCode.custom, path: ['commission'], message: 'La comisión debe dejar un importe positivo para el técnico.' }) }
})

export type AdminRequestCommand = z.infer<typeof adminRequestSchema>
export type AdminRequestRecord = {
  id: string; version: number; state: 'draft' | 'sent'; customerId: string; customerName?: string
  jobId: string | null; requestId: string | null; acceptedAt: string | null
  input: Omit<AdminRequestCommand, 'action' | 'expectedVersion' | 'id'>
  createdAt: string; updatedAt: string
}
export type ManagedRequestSummary = {
  id: string; version: number; title: string; description: string; total: number
  startsAt: string; durationMinutes: number; acceptedAt: string | null; canAccept: boolean
  assignmentVersion: number; scheduleVersion: number
}
export type AdminRequestOptions = {
  customers: Array<{ id: string; name: string; email: string }>
  addresses: Array<{ id: string; label: string }>
  equipment: Array<{ id: string; addressId: string | null; categoryId: string | null; name: string }>
  categories: Array<{ id: string; name: string }>
  issues: Array<{ id: string; categoryId: string; name: string }>
  professionals: Array<{ id: string; name: string; paymentAccountConnected: boolean }>
  quotes: Array<{ id: string; title: string; total: number; commissionRate: number }>
  paymentCostRate: number
}
