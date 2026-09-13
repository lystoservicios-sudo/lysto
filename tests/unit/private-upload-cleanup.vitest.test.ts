// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { cleanupExpiredUploads } from '@/lib/uploads/cleanup'
const id='75000000-0000-4000-8000-000000000001'
const owner='75000000-0000-4000-8000-000000000002'
const lease={id,leaseToken:owner,quarantineBucket:'upload-quarantine',quarantinePath:`${owner}/${id}`,outputBucket:'request-media',outputPath:`${owner}/${owner}/photo/${id}.webp`}
describe('leased orphan cleanup',()=>{
  it('acknowledges only after both Storage deletes succeed',async()=>{
    const rpc=vi.fn().mockResolvedValueOnce({data:[lease],error:null}).mockResolvedValueOnce({data:true,error:null})
    const remove=vi.fn().mockResolvedValue({error:null})
    expect(await cleanupExpiredUploads({rpc,storage:{from:()=>({remove})}})).toEqual({claimed:1,cleaned:1,failed:0})
    expect(remove).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[1]).toEqual(['complete_upload_cleanup',{p_intent_id:id,p_lease_token:owner}])
  })
  it('leaves a failed deletion unacknowledged for lease recovery',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[lease],error:null})
    const remove=vi.fn().mockResolvedValue({error:{message:'unavailable'}})
    expect(await cleanupExpiredUploads({rpc,storage:{from:()=>({remove})}})).toEqual({claimed:1,cleaned:0,failed:1})
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects invalid paths before deleting anything',async()=>{
    const rpc=vi.fn().mockResolvedValue({data:[{...lease,outputPath:'../another-object'}],error:null})
    const remove=vi.fn()
    await expect(cleanupExpiredUploads({rpc,storage:{from:()=>({remove})}})).rejects.toThrow()
    expect(remove).not.toHaveBeenCalled()
  })
})
