export type UploadCleanupClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: unknown }> } }
}
const leaseSchema = z.object({
  id: z.string().uuid(), leaseToken: z.string().uuid(), quarantineBucket: z.literal('upload-quarantine'),
  quarantinePath: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
  outputBucket: z.enum(['request-media','professional-documents','job-evidence']),
  outputPath: z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/(?:photo\/|before\/|during\/|after\/|document\/)?[a-f0-9-]{36}\.(?:jpg|webp)$/)
}).refine(lease => lease.quarantinePath.endsWith('/' + lease.id) && [lease.id + '.jpg',lease.id + '.webp'].some(name=>lease.outputPath.endsWith('/'+name)))

/** The database leases only expired, unlinked, unverified objects after grace. */
export async function cleanupExpiredUploads(client: UploadCleanupClient): Promise<{ claimed: number; cleaned: number; failed: number }> {
  const batch = await client.rpc('claim_expired_upload_intents',{p_limit:50})
  if (batch.error) throw new Error('Could not lease expired uploads')
  const leases = z.array(leaseSchema).max(50).parse(batch.data)
  const summary={claimed:leases.length,cleaned:0,failed:0}
  for (const lease of leases) {
    try {
      for (const object of [{bucket:lease.quarantineBucket,path:lease.quarantinePath},{bucket:lease.outputBucket,path:lease.outputPath}]) {
        const deleted=await client.storage.from(object.bucket).remove([object.path])
        if(deleted.error) throw new Error('Storage deletion failed')
      }
      const completed=await client.rpc('complete_upload_cleanup',{p_intent_id:lease.id,p_lease_token:lease.leaseToken})
      if(completed.error || completed.data!==true) throw new Error('Cleanup acknowledgement failed')
      summary.cleaned++
    } catch { summary.failed++ }
  }
  return summary
}
import { z } from 'zod'
