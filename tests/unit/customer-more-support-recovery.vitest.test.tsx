import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CustomerCaseDetail } from '@/components/customer/more-support/case-detail'
import type { Session } from '@/lib/auth/session'
import * as service from '@/lib/support/service'
const id='c1727548-fc12-4ca1-a11f-f295a40a7d6a', other='a1727548-fc12-4ca1-a11f-f295a40a7d6a'
const item={id,jobId:null,category:'other',status:'open',description:'Consulta original',publicResolution:null,version:1,createdAt:'2026-10-14T00:00:00Z',warrantyClaim:null,events:[]}
afterEach(()=>{cleanup();sessionStorage.clear();vi.restoreAllMocks()})
describe('Support reply durable recovery',()=>{
  it('keeps the exact key and version across lost responses and a page reload',async()=>{
    const fetcher=vi.spyOn(globalThis,'fetch').mockRejectedValueOnce(new Error('lost response'))
    const view=render(<CustomerCaseDetail initialCase={item} customerId={id}/> )
    fireEvent.change(screen.getByLabelText('Tu respuesta'),{target:{value:'Información adicional importante'}})
    fireEvent.click(screen.getByRole('button',{name:'Enviar respuesta'}))
    await screen.findByRole('alert')
    const first=JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(first.idempotencyKey).toBeTruthy()
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('X-Lysto-Customer-Id')).toBe(id)
    view.unmount()
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({case:{id,status:'open',version:2}}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({case:{...item,version:2}}),{status:200}))
    render(<CustomerCaseDetail initialCase={{...item,version:2}} customerId={id}/> )
    await waitFor(()=>expect((screen.getByLabelText('Tu respuesta') as HTMLTextAreaElement).value).toBe(first.publicMessage))
    expect((screen.getByLabelText('Tu respuesta') as HTMLTextAreaElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button',{name:'Reintentar envío'}))
    await screen.findByText('Respuesta recibida.')
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual(first)
    expect(sessionStorage.length).toBe(0)
  })
  it('requires a command key for customer replies before invoking any RPC',async()=>{
    const fn=(service as Record<string,unknown>).replyCustomerSupportCase
    expect(fn).toBeTypeOf('function')
    if(typeof fn!=='function')return
    const rpc=vi.fn(),session={role:'customer',customerId:id,client:{rpc}} as unknown as Session
    await expect(fn(session,id,{action:'customer_replied',expectedVersion:1,publicMessage:'Respuesta válida'})).rejects.toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('rejects stale actor headers and preserves legacy staff without a header',async()=>{
    const path='../../lib/support/request-actor'
    const actorGuard=await import(path).catch(()=>null)
    expect(actorGuard?.assertSupportRequestActor).toBeTypeOf('function')
    if(!actorGuard)return
    expect(()=>actorGuard.assertSupportRequestActor(new Request('https://lystohogar.com',{headers:{'X-Lysto-Customer-Id':other}}),{role:'customer',customerId:id})).toThrow()
    expect(()=>actorGuard.assertSupportRequestActor(new Request('https://lystohogar.com'),{role:'professional'})).not.toThrow()
    expect(()=>actorGuard.assertSupportRequestActor(new Request('https://lystohogar.com'),{role:'customer',customerId:id})).toThrow()
  })
})
