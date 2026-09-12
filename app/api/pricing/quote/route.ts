import { privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { z } from 'zod'
import type { Json } from '@/lib/supabase/database.types'
import { TIME_WINDOWS } from '@/lib/domain/constants'
import { calculateServiceQuote, quoteInputSchema, routeSchema } from '@/lib/pricing/service-quote'
import { estimateTravel } from '@/lib/pricing/google-routes'
import {
  getPricingSession,
  getQuotePolicyRecord,
  pricingError,
  quoteWriter,
  requirePricingPermission,
  throwPricingDatabaseError
} from '@/lib/pricing/server'

const schema = quoteInputSchema
  .omit({ route: true })
  .extend({
    address: z
      .object({
        street: z.string().trim().min(2).max(150),
        number: z
          .string()
          .trim()
          .regex(/^\d{1,6}$/),
        city: z.string().trim().min(2).max(100),
        province: z.string().trim().min(2).max(100),
        floor: z.string().max(20).optional(),
        apartment: z.string().max(20).optional(),
        reference: z.string().max(500).optional(),
        postalCode: z.string().max(20).optional()
      })
      .strict(),
    preferredDate: z.string().date(),
    timeWindow: z.string().refine((v) => (TIME_WINDOWS as readonly string[]).includes(v)),
    manualRoute: routeSchema
      .extend({ source: z.literal('manual') })
      .strict()
      .optional(),
    manualRouteReason: z.string().trim().min(15).max(2000).optional(),
    previousQuoteId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional(),
    revisionReason: z.string().trim().min(15).max(2000).optional(),
    uploadIntentIds: z
      .array(z.string().uuid())
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length)
      .default([]),
    save: z.boolean().default(false),
    customerId: z.string().uuid().optional()
  })
  .strict()
  .superRefine((body, context) => {
    if (Boolean(body.manualRoute) !== Boolean(body.manualRouteReason))
      context.addIssue({ code: 'custom', message: 'Manual route reason required' })
    if (
      body.previousQuoteId
        ? !body.expectedVersion || !body.revisionReason || !body.save
        : body.expectedVersion !== undefined || body.revisionReason !== undefined
    )
      context.addIssue({ code: 'custom', message: 'Complete revision context required' })
  })

export async function POST(request: Request) {
  try {
    const session = await getPricingSession()
    if (!['customer', 'admin'].includes(session.role)) throw new Error('forbidden')
    if (session.role === 'admin') await requirePricingPermission(session, 'operations')
    const body = schema.parse(await readPrivateJsonBody(request, 32768))
    if (
      session.role !== 'admin' &&
      (body.manualRoute ||
        body.customerId ||
        body.scenario ||
        body.materials.length ||
        body.materialsConfirmed ||
        body.previousQuoteId)
    )
      throw new Error('forbidden')
    const now = new Date()
    const hour = body.timeWindow.match(/\d{2}/)?.[0] ?? '09'
    const departureTime = `${body.preferredDate}T${hour}:00:00-03:00`
    if (Date.parse(departureTime) < now.getTime()) throw new Error('invalid_departure_time')
    const policyRecord = await getQuotePolicyRecord(session.client)
    const policy = policyRecord.policy
    let route: z.infer<typeof routeSchema> | undefined = body.manualRoute
    let routingNotice: string | null = null
    if (!route) {
      try {
        route = await estimateTravel({
          address: `${body.address.street} ${body.address.number}, ${body.address.city}, ${body.address.province}, Argentina`,
          origin:
            process.env.LYSTO_ROUTING_ORIGIN ??
            'Obelisco, Ciudad Autónoma de Buenos Aires, Argentina',
          apiKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '',
          departureTime,
          now
        })
      } catch (error) {
        const code = error instanceof Error ? error.message : ''
        if (
          [
            'outside_coverage',
            'address_ambiguous',
            'invalid_departure_time',
            'origin_must_be_caba'
          ].includes(code)
        )
          throw error
        routingNotice =
          'Traslado pendiente de verificación. El importe mostrado todavía no lo incluye.'
      }
    }
    const input = quoteInputSchema.parse({ ...body, route })
    const quote = calculateServiceQuote(input, policy, now)
    let quoteId: string | null = null
    if (body.save) {
      const customerId = session.role === 'customer' ? session.customerId : body.customerId
      if (!customerId) throw new Error('customer_required')
      if (session.role === 'admin') {
        const { data } = await session.client
          .from('customer_profiles')
          .select('id')
          .eq('id', customerId)
          .single()
        if (!data) throw new Error('forbidden')
      }
      const { data, error } = await quoteWriter().rpc('persist_calculated_quote', {
        p_actor_user_id: session.userId,
        p_actor_session_id: session.sessionId,
        p_customer_id: customerId,
        p_payload: {
          address: body.address,
          input,
          quote,
          preferredDate: body.preferredDate,
          timeWindow: body.timeWindow,
          expiresAt: quote.expiresAt,
          policyId: policyRecord.id,
          policySnapshot: policy,
          manualRouteReason: body.manualRouteReason ?? null,
          previousQuoteId: body.previousQuoteId ?? null,
          expectedVersion: body.expectedVersion ?? null,
          revisionReason: body.revisionReason ?? null,
          uploadIntentIds: body.uploadIntentIds
        } as unknown as Json
      })
      if (error) throwPricingDatabaseError(error)
      quoteId = z.object({ id: z.string().uuid() }).parse(data).id
    }
    return privateJson({ quote, quoteId, routingNotice })
  } catch (error) {
    return pricingError(error)
  }
}
