import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ManagedServiceRequestForm } from '@/components/admin/managed-service-request-form'
import { adminRequestOptions, readAdminRequests, requireAdminRequestManagement } from '@/lib/admin/service-request-service'
import { requirePageSession } from '@/lib/auth/session'
import { ApiError } from '@/lib/http/api-error'

export default async function NewAdminRequestPage({ searchParams }: { searchParams: Promise<{ customerId?: string; draft?: string }> }) {
  const params = z.object({ customerId: z.string().uuid().optional(), draft: z.string().uuid().optional() }).safeParse(await searchParams)
  if (!params.success) notFound()
  const session = await requirePageSession('admin')
  try { await requireAdminRequestManagement(session) }
  catch (error) { if (error instanceof ApiError && error.status === 403) notFound(); throw error }
  let record
  try { record = params.data.draft ? await readAdminRequests(session, params.data.draft) : undefined }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error }
  const customerId = record?.customerId ?? params.data.customerId
  const options = await adminRequestOptions(session, { customerId })
  return <ManagedServiceRequestForm initialOptions={options} initialRecord={record} initialCustomerId={customerId} storageScope={session.profileId} />
}
