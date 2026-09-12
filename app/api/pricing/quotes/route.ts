import { ApiError, privateJson } from '@/lib/http/api-error'
import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { z } from 'zod'
import {
  getPricingSession,
  pricingError,
  requirePricingPermission,
  throwPricingDatabaseError
} from '@/lib/pricing/server'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'
export async function GET(request: Request) {
  try {
    const s = await getPricingSession()
    const parameters = z
      .object({
        quoteId: z.string().uuid().optional(),
        cursor: z.string().optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional()
      })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams))
    if (parameters.quoteId && (parameters.cursor || parameters.pageSize))
      throw new ApiError('invalid_input')
    const scope = `service-quotes:${s.profileId}`
    let page: ReturnType<typeof parsePageInput>
    try {
      page = parsePageInput({ pageSize: parameters.pageSize, cursor: parameters.cursor }, scope)
    } catch {
      throw new ApiError('invalid_input')
    }
    let query = s.client
      .from('service_quotes')
      .select(
        'id,customer_id,address,input,quote,status,request_id,expires_at,created_at,version,revision,root_quote_id,previous_quote_id,revision_reason,review_reason,preferred_date,time_window'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (parameters.quoteId) query = query.eq('id', parameters.quoteId)
    if (page.cursor)
      query = query.or(
        `created_at.lt.${page.cursor.createdAt},and(created_at.eq.${page.cursor.createdAt},id.lt.${page.cursor.id})`
      )
    const { data, error } = await query.limit(parameters.quoteId ? 1 : page.pageSize + 1)
    if (error) throw new Error('pricing_database_not_ready')
    const quotes = (data ?? []).slice(0, page.pageSize),
      last = quotes.at(-1)
    const count = parameters.quoteId
      ? { count: quotes.length, error: null }
      : await s.client.from('service_quotes').select('id', { count: 'exact', head: true })
    if (count.error) throw new Error('pricing_database_not_ready')
    return privateJson({
      quotes,
      total: count.count ?? 0,
      nextCursor:
        data.length > page.pageSize && last
          ? encodeCursor({ id: last.id, createdAt: last.created_at }, scope)
          : null
    })
  } catch (error) {
    return pricingError(error)
  }
}
export async function PATCH(request: Request) {
  try {
    const s = await getPricingSession()
    await requirePricingPermission(s, 'operations')
    const body = z
      .object({
        quoteId: z.string().uuid(),
        expectedVersion: z.number().int().positive(),
        reason: z.string().trim().min(15).max(2000)
      })
      .strict()
      .parse(await readPrivateJsonBody(request))
    const { data, error } = await s.client.rpc('review_service_quote_v2', {
      p_quote_id: body.quoteId,
      p_expected_version: body.expectedVersion,
      p_reason: body.reason
    })
    if (error) throwPricingDatabaseError(error)
    return privateJson({ result: data })
  } catch (error) {
    return pricingError(error)
  }
}
