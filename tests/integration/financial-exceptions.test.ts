import { randomUUID } from 'node:crypto'
import { afterAll,beforeAll,describe,expect,it } from 'vitest'
import { Client } from 'pg'
import { createFixtureAccounts } from './fixtures'

describe('financial exceptions',()=>{
  const pending=createFixtureAccounts();let fixture:Awaited<typeof pending>
  const db=new Client({connectionString:process.env.LYSTO_TEST_DATABASE_URL})
  const requests:string[]=[],jobs:string[]=[],payments:string[]=[],checkouts:string[]=[]
  let category:string,issue:string
  async function job(withProfessional=true){
    const request=randomUUID(),id=randomUUID();requests.push(request);jobs.push(id)
    await db.query(`insert into public.service_requests(id,customer_id,category_id,issue_type_id,status) values($1,$2,$3,$4,'assigned')`,[request,fixture.accounts.customerA.entityId,category,issue])
    await db.query(`insert into public.jobs(id,request_id,customer_id,professional_id,status) values($1,$2,$3,$4,$5)`,[id,request,fixture.accounts.customerA.entityId,withProfessional?fixture.accounts.professionalApproved.entityId:null,withProfessional?'confirmed':'pending_assignment'])
    return {request,id}
  }
  beforeAll(async()=>{fixture=await pending;await db.connect();const row=await db.query(`select c.id category,i.id issue from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.active and i.active limit 1`);category=row.rows[0].category;issue=row.rows[0].issue})
  afterAll(async()=>{try{await db.query('delete from private.financial_exception_cases where job_id=any($1::uuid[])',[jobs]);await db.query('delete from private.payment_refund_requests where payment_id=any($1::uuid[])',[payments]);await db.query('delete from public.marketplace_payment_observations where checkout_id=any($1::uuid[])',[checkouts]);await db.query('delete from public.marketplace_checkouts where id=any($1::uuid[])',[checkouts]);await db.query('delete from public.payments where id=any($1::uuid[])',[payments]);await db.query('delete from public.jobs where id=any($1::uuid[])',[jobs]);await db.query('delete from public.service_requests where id=any($1::uuid[])',[requests])}finally{await db.end();await pending.cleanup()}})

  it('serializes concurrent refund reservations and denies operations-only users',async()=>{
    const created=await job();const payment=randomUUID();payments.push(payment)
    await db.query(`insert into public.payments(id,job_id,request_id,customer_id,professional_id,provider,provider_payment_id,amount,marketplace_fee,professional_amount,status) values($1,$2,$3,$4,$5,'mercadopago',$6,100,18,82,'approved')`,[payment,created.id,created.request,fixture.accounts.customerA.entityId,fixture.accounts.professionalApproved.entityId,`provider-${payment}`])
    const request=(amount:number,key:string)=>fixture.accounts.finance.client.rpc('request_payment_refund',{p_payment_id:payment,p_amount:amount,p_reason:'Reintegro autorizado para prueba concurrente.',p_idempotency_key:key})
    const results=await Promise.all([request(60,randomUUID()),request(60,randomUUID())])
    expect(results.filter(value=>value.error===null)).toHaveLength(1)
    expect(results.filter(value=>value.error!==null)).toHaveLength(1)
    const denied=await fixture.accounts.operations.client.rpc('request_payment_refund',{p_payment_id:payment,p_amount:1,p_reason:'Operaciones no puede devolver dinero.',p_idempotency_key:randomUUID()})
    expect(denied.error?.code).toBe('42501')
  })

  it('cancels immediately without a checkout and opens review when a link existed',async()=>{
    const direct=await job();const cancelled=await fixture.accounts.operations.client.rpc('request_job_cancellation',{p_job_id:direct.id,p_reason:'Cliente solicitó cancelar antes de emitir el enlace.',p_expected_version:0})
    expect(cancelled.data.requiresFinancialReview).toBe(false)
    const guarded=await job();const checkout=randomUUID();checkouts.push(checkout)
    await db.query(`insert into public.marketplace_checkouts(id,job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status,preference_id) values($1,$2,$3,$4,'seller',100,18,false,'ready','pref-1')`,[checkout,guarded.id,fixture.accounts.customerA.entityId,fixture.accounts.professionalApproved.entityId])
    const review=await fixture.accounts.operations.client.rpc('request_job_cancellation',{p_job_id:guarded.id,p_reason:'Cliente pagó tarde y requiere conciliación.',p_expected_version:0})
    expect(review.data.requiresFinancialReview).toBe(true)
    expect((await db.query('select status from public.jobs where id=$1',[guarded.id])).rows[0].status).toBe('confirmed')
    expect((await db.query('select status from public.marketplace_checkouts where id=$1',[checkout])).rows[0].status).toBe('review')
  })

  it('creates a linked replacement only after finance closes every checkout',async()=>{
    const original=await job();const checkout=randomUUID();checkouts.push(checkout)
    await db.query(`insert into public.marketplace_checkouts(id,job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status,preference_id) values($1,$2,$3,$4,'seller',100,18,false,'ready','pref-replacement')`,[checkout,original.id,fixture.accounts.customerA.entityId,fixture.accounts.professionalApproved.entityId])
    const opened=await fixture.accounts.operations.client.rpc('request_professional_replacement',{p_job_id:original.id,p_reason:'El profesional no puede asistir y se requiere sustitución.',p_expected_version:0})
    expect(opened.error).toBeNull()
    const closed=await fixture.accounts.finance.client.rpc('mark_marketplace_checkout_closed',{p_checkout_id:checkout,p_evidence:{providerPreferenceStatus:'expired',summary:'El proveedor confirmó que la preferencia venció sin pagos.'}})
    expect(closed.error).toBeNull()
    const cleared=await fixture.accounts.finance.client.rpc('clear_financial_exception',{p_case_id:opened.data.caseId,p_expected_version:opened.data.version,p_evidence:{summary:'Preferencia vencida sin pagos encontrados al conciliar.'}})
    expect(cleared.error).toBeNull()
    expect(cleared.data.status).toBe('ready')
    const resolved=await fixture.accounts.operations.client.rpc('resolve_financial_exception',{p_case_id:opened.data.caseId,p_expected_version:cleared.data.version,p_reason:'Crear servicio sustituto conservando el historial original.'})
    expect(resolved.data.replacementJobId).toMatch(/[0-9a-f-]{36}/)
    jobs.push(resolved.data.replacementJobId)
    const replacement=await db.query(`select j.status,r.replacement_of_request_id from public.jobs j join public.service_requests r on r.id=j.request_id where j.id=$1`,[resolved.data.replacementJobId])
    requests.push((await db.query('select request_id from public.jobs where id=$1',[resolved.data.replacementJobId])).rows[0].request_id)
    expect(replacement.rows[0]).toMatchObject({status:'pending_assignment',replacement_of_request_id:original.request})
  })
})
