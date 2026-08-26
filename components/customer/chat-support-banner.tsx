import { MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function ChatSupportBanner({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700"><MessageCircle aria-hidden="true" className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-black text-slate-950">Contacto del servicio</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Usá este espacio para contactar al profesional cuando exista un canal conectado.</p>
        </div>
      </div>
      <Button type="button" variant="secondary" className="mt-4 w-full" disabled={!onOpen} onClick={onOpen}>Abrir chat</Button>
      {!onOpen ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">El chat se habilitará cuando el servicio esté conectado.</p> : null}
    </div>
  )
}
