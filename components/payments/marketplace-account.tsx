'use client'
import { useEffect, useState } from 'react'
import { paymentResponse } from './payment-response'
import { Card } from '@/components/ui/card'
import { Button, ButtonLink } from '@/components/ui/button'

export function MarketplaceAccount({ onboarding = false }: { onboarding?: boolean }) {
  const [account,setAccount]=useState<{configured:boolean;linked:boolean|null;mode?:string;accountId?:string}|null>(null)
  const [message,setMessage]=useState('Cargando conexión…'),[busy,setBusy]=useState(false)
  useEffect(()=>{let active=true;fetch('/api/mercadopago/account').then(async r=>{const b=await paymentResponse(r);if(active){setAccount(b);setMessage('')}}).catch(e=>{if(active)setMessage(e.message)});return()=>{active=false}},[])
  async function connect(){setBusy(true);try{const r=await fetch('/api/mercadopago/oauth/authorize',{method:'POST'});const b=await paymentResponse(r);window.location.assign(b.url)}catch(e){setMessage(e instanceof Error?e.message:'No se pudo conectar.');setBusy(false)}}
  async function disconnect(){setBusy(true);try{const r=await fetch('/api/mercadopago/account',{method:'DELETE'});await paymentResponse(r);setAccount(a=>a?{...a,linked:false}:a);setMessage('Conexión desactivada en Lysto. Podés revisar los permisos otorgados desde tu cuenta de Mercado Pago.')}catch(e){setMessage(e instanceof Error?e.message:'No se pudo desconectar.')}finally{setBusy(false)}}
  if (onboarding) return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Último paso · cobros</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Vinculá tu cuenta de Mercado Pago</h2>
        <p className="mt-3 leading-7 text-slate-600">La cuenta debe ser tuya para recibir el pago de tus trabajos. Lysto no te pide ni almacena tu contraseña de Mercado Pago.</p>
      </div>
      <ol aria-label="Cómo vincular tu cuenta" className="grid gap-3 sm:grid-cols-3">
        {['Iniciá sesión en Mercado Pago', 'Revisá y autorizá la conexión', 'Volvés a Lysto con tu cuenta vinculada'].map((label, index) => <li key={label} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">{index + 1}</span>
          <span className="pt-1 text-sm font-medium leading-5 text-slate-700">{label}</span>
        </li>)}
      </ol>
      {account?.linked
        ? <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p role="status" className="font-semibold text-emerald-950">Cuenta vinculada correctamente</p>
          <p className="text-sm leading-6 text-emerald-900">Ya terminaste la configuración inicial. Tu postulación queda sujeta a la revisión de Operaciones.</p>
          <ButtonLink href="/pro/dashboard">Ir al panel profesional</ButtonLink>
        </div>
        : <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
          <p className="text-sm leading-6 text-slate-700">Mercado Pago te va a mostrar los permisos antes de confirmar. Al volver, Lysto verificará automáticamente la vinculación.</p>
          <Button disabled={busy || !account?.configured} onClick={() => void connect()}>
            {busy ? 'Abriendo Mercado Pago…' : 'Vincular cuenta con Mercado Pago'}
          </Button>
        </div>}
      {account?.configured === false && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">La vinculación todavía no está disponible. Lysto debe terminar la configuración de Mercado Pago.</p>}
      {message && <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{message}</p>}
    </div>
  )
  return <div className="mx-auto max-w-3xl space-y-5"><div><p className="text-sm font-semibold text-blue-700">Cobros del profesional</p>{onboarding?<h2 className="mt-2 text-2xl font-black">Tu cuenta de Mercado Pago</h2>:<h1 className="mt-2 text-3xl font-black">Tu cuenta de Mercado Pago</h1>}<p className="mt-3 text-slate-600">Vinculá la cuenta donde vas a recibir los pagos de tus trabajos.</p></div>
    <Card className="space-y-4 p-6"><h2 className="text-xl font-bold">{account?.linked?'Cuenta vinculada':'Conectar cuenta'}</h2>{account?.configured===false?<p>Los pagos están pendientes de configuración por parte de Lysto.</p>:null}{account?.configured?<><p>{account.mode==='test'?'Ambiente de pruebas: no usar cuentas ni dinero reales.':'Ambiente de producción.'}</p>{account.linked?<p>Cuenta de Mercado Pago: <strong>{account.accountId}</strong></p>:null}<Button disabled={busy} onClick={()=>void connect()}>{busy?'Procesando…':account.linked?'Renovar autorización de esta cuenta':'Conectar con Mercado Pago'}</Button>{account.linked?<Button variant="ghost" disabled={busy} onClick={()=>void disconnect()}>Desconectar de Lysto</Button>:null}</>:null}<p className="text-sm text-slate-600">La autorización se realiza en Mercado Pago. Lysto no te pide la contraseña. Si ya hay pagos asociados, la cuenta queda ligada a ese historial; podés renovar su autorización, pero no reemplazar al destinatario.</p>{message?<p role="status" className="text-sm text-blue-900">{message}</p>:null}</Card>
    <Card className="space-y-3 p-6"><h2 className="text-xl font-bold">Cómo se reparte cada pago</h2><p className="text-sm text-slate-600">Antes de aceptar un trabajo vas a ver el precio y la comisión Lysto. Mercado Pago descuenta sus propios cargos de tu parte. En las fallas adicionales aceptadas por el cliente, la comisión Lysto es $0.</p>{!onboarding?<ButtonLink href="/pro/pagos/mercadopago" variant="secondary">Ver cobros y estados</ButtonLink>:null}</Card></div>
}
