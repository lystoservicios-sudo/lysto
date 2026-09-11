import { getRegistrationPolicy } from '@/lib/auth/account-policy'
import { accountResponse } from '@/lib/auth/account-response'

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params
  const policy = await getRegistrationPolicy()
  if (process.env.APP_ENV !== 'test' || !policy?.testOnly || !['terms','privacy'].includes(kind)) return new Response('No encontrado.',{status:404})
  return accountResponse(new Response(`DOCUMENTO EXCLUSIVO DE ENSAYO: ${kind}. No contiene condiciones legales aprobadas ni habilita servicios reales.`,{headers:{'Content-Type':'text/plain; charset=utf-8'}}))
}
