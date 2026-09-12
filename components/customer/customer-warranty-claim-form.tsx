'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CustomerWarrantyClaimForm() {
  const [jobId, setJobId] = useState(''),
    [description, setDescription] = useState(''),
    [sameProblem, setSameProblem] = useState(true),
    [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('Enviando…')
    const response = await fetch('/api/warranty/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-correlation-id': crypto.randomUUID() },
      body: JSON.stringify({
        jobId,
        description,
        sameProblem,
        evidenceIds: [],
        idempotencyKey: crypto.randomUUID()
      })
    })
    const body = (await response.json()) as {
      claim?: { coverageEligible: boolean; supportContinues?: boolean }
      error?: string
    }
    setMessage(
      response.ok
        ? body.claim?.coverageEligible
          ? 'Garantía recibida para revisión.'
          : 'Recibimos el caso para soporte, sin prometer cobertura.'
        : (body.error ?? 'No pudimos registrar el caso.')
    )
    if (response.ok) setDescription('')
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="text-xl font-black">Informar una reincidencia</h2>
      <p className="mt-2 text-sm text-slate-600">
        La cobertura se calcula con el cierre guardado. Si está vencida, el equipo de soporte
        igualmente recibe el caso.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <label className="block text-sm font-bold">
          ID del trabajo
          <input
            required
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-bold">
          ¿Qué volvió a ocurrir?
          <textarea
            required
            minLength={10}
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-28 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={sameProblem}
            onChange={(e) => setSameProblem(e.target.checked)}
          />
          Es el mismo problema del servicio original
        </label>
        <Button type="submit">Enviar a revisión</Button>
        {message ? (
          <p role="status" className="text-sm text-slate-700">
            {message}
          </p>
        ) : null}
      </form>
    </section>
  )
}
