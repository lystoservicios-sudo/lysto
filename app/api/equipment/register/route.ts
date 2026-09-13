import { readPrivateJsonBody } from '@/lib/http/private-json-body'
import { privateRoute } from '@/lib/http/route-handler'
import { privateJson } from '@/lib/http/api-error'
import { equipmentInputSchema } from '@/lib/customer-assets/contracts'
import { writeCustomerAsset } from '@/lib/customer-assets/service'

export const POST = privateRoute({ roles: ['customer'] }, async (request, session) =>
  privateJson(
    await writeCustomerAsset(
      session,
      'equipment',
      equipmentInputSchema.parse(await readPrivateJsonBody(request)),
      null,
      null
    ),
    { status: 201 }
  )
)
