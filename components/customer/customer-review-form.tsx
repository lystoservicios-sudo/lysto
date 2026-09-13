'use client'

import { Star } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { FormFeedback } from './states'
import { EmptyState } from './states'
import { InfoNotice } from './info-notice'
import { acknowledgeCommand, recoverCommand } from '@/lib/jobs/recoverable-command'

export type CustomerReviewDraft = {
  jobId: string
  serviceRating: number
  professionalRating: number
  problemResolved: boolean
  wouldHireAgain: boolean
  comment?: string
}

type SubmissionResult = { ok: boolean; message: string }
type SubmissionState = 'idle' | 'pending' | 'success' | 'error'

export function CustomerReviewForm({
  jobId,
  professionalName,
  eligible = true,
  alreadyReviewed = false,
  onSubmit
}: {
  jobId: string
  professionalName?: string
  eligible?: boolean
  alreadyReviewed?: boolean
  onSubmit?: (draft: CustomerReviewDraft) => Promise<SubmissionResult>
}) {
  const [serviceRating, setServiceRating] = useState(0)
  const [professionalRating, setProfessionalRating] = useState(0)
  const [problemResolved, setProblemResolved] = useState<boolean | null>(null)
  const [wouldHireAgain, setWouldHireAgain] = useState<boolean | null>(null)
  const [comment, setComment] = useState('')
  const [submission, setSubmission] = useState<{ state: SubmissionState; message?: string }>({
    state: 'idle'
  })
  const pendingRef = useRef(false)
  const canPersist = Boolean(onSubmit || /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(jobId))

  if (alreadyReviewed)
    return (
      <EmptyState
        title="Ya calificaste este servicio"
        description="Cada trabajo admite una sola calificación para proteger la integridad del historial."
      />
    )
  if (!eligible)
    return (
      <InfoNotice
        tone="warning"
        title="La calificación todavía no está disponible"
        description="Podrás completar esta pantalla cuando el trabajo figure como finalizado."
      />
    )

  const isComplete =
    serviceRating > 0 &&
    professionalRating > 0 &&
    problemResolved !== null &&
    wouldHireAgain !== null
  const canSubmit = Boolean(
    canPersist && isComplete && submission.state !== 'pending' && submission.state !== 'success'
  )

  async function persist(draft: CustomerReviewDraft): Promise<SubmissionResult> {
    const fingerprint = JSON.stringify(draft),
      pending = recoverCommand(sessionStorage, `${jobId}:review`, fingerprint)
    const response = await fetch('/api/reviews/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draft, idempotencyKey: pending.key })
    })
    const body = await response.json()
    if (!response.ok) return { ok: false, message: body.error }
    acknowledgeCommand(sessionStorage, `${jobId}:review`, pending.key)
    return { ok: true, message: 'Calificación guardada.' }
  }

  async function handleSubmit() {
    if (!canSubmit || problemResolved === null || wouldHireAgain === null || pendingRef.current)
      return
    pendingRef.current = true
    setSubmission({ state: 'pending', message: 'Enviando calificación' })
    try {
      const draft = {
        jobId,
        serviceRating,
        professionalRating,
        problemResolved,
        wouldHireAgain,
        comment: comment.trim() || undefined
      }
      const result = await (onSubmit ?? persist)(draft)
      setSubmission({ state: result.ok ? 'success' : 'error', message: result.message })
    } catch {
      setSubmission({ state: 'error', message: 'No pudimos enviar la calificación. Reintentá.' })
    } finally {
      pendingRef.current = false
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <div className="min-w-0 space-y-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
            Trabajo {jobId}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Contanos cómo fue el servicio
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tus respuestas ayudan a mejorar la atención y detectar casos que necesitan seguimiento.
          </p>
        </div>

        <RatingGroup
          label="Calificación del servicio"
          subject="el servicio"
          value={serviceRating}
          onChange={setServiceRating}
        />
        <RatingGroup
          label={`Calificación de ${professionalName ?? 'la atención profesional'}`}
          subject="el profesional"
          value={professionalRating}
          onChange={setProfessionalRating}
        />
        <BinaryQuestion
          label="¿El problema quedó resuelto?"
          yesLabel="Sí, quedó resuelto"
          noLabel="No, sigue sin resolverse"
          value={problemResolved}
          onChange={setProblemResolved}
        />
        <BinaryQuestion
          label="¿Volverías a elegir Lysto?"
          yesLabel="Sí, volvería a elegir Lysto"
          noLabel="No volvería a elegir Lysto"
          value={wouldHireAgain}
          onChange={setWouldHireAgain}
        />

        <label className="block text-sm font-bold text-slate-900">
          Comentario opcional
          <Textarea
            aria-label="Comentario opcional"
            className="mt-2"
            value={comment}
            maxLength={800}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Podés contarnos qué funcionó bien o qué deberíamos revisar."
          />
          <span className="mt-1 block text-right text-xs font-medium text-slate-500">
            {comment.length}/800
          </span>
        </label>

        <FormFeedback state={submission.state} message={submission.message} />
        <Button
          type="button"
          className="w-full"
          disabled={!canSubmit}
          aria-busy={submission.state === 'pending' || undefined}
          onClick={() => void handleSubmit()}
        >
          {submission.state === 'pending' ? 'Enviando calificación' : 'Enviar calificación'}
        </Button>
        {!canPersist ? (
          <p className="text-center text-xs font-semibold leading-5 text-slate-500">
            La calificación estará disponible sobre el trabajo real confirmado.
          </p>
        ) : null}
      </div>

      <InfoNotice
        tone="security"
        title="Qué pasa después"
        description="La reseña es opcional y no cambia el cierre ni el pago. Una calificación baja o un problema no resuelto abre seguimiento de calidad una sola vez."
      />
    </div>
  )
}

function RatingGroup({
  label,
  subject,
  value,
  onChange
}: {
  label: string
  subject: string
  value: number
  onChange: (value: number) => void
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
      return
    const current =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>('[role="radio"]')
        : null
    const index = current ? refs.current.indexOf(current) : -1
    if (index < 0) return
    event.preventDefault()
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 4
          : ['ArrowRight', 'ArrowDown'].includes(event.key)
            ? (index + 1) % 5
            : (index - 1 + 5) % 5
    onChange(nextIndex + 1)
    refs.current[nextIndex]?.focus()
  }

  return (
    <fieldset>
      <legend className="text-sm font-black text-slate-950">{label}</legend>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="mt-3 grid grid-cols-5 gap-2 sm:flex"
      >
        {[1, 2, 3, 4, 5].map((rating, index) => (
          <button
            key={rating}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} ${rating === 1 ? 'estrella' : 'estrellas'} para ${subject}`}
            tabIndex={value === rating || (value === 0 && rating === 1) ? 0 : -1}
            onClick={() => onChange(rating)}
            className={cn(
              'grid aspect-square min-w-0 w-full place-items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:h-11 sm:w-11',
              value >= rating
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
            )}
          >
            <Star aria-hidden="true" className={cn('h-5 w-5', value >= rating && 'fill-current')} />
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function BinaryQuestion({
  label,
  yesLabel,
  noLabel,
  value,
  onChange
}: {
  label: string
  yesLabel: string
  noLabel: string
  value: boolean | null
  onChange: (value: boolean) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-slate-950">{label}</legend>
      <div role="radiogroup" aria-label={label} className="mt-3 grid gap-2 sm:grid-cols-2">
        {(
          [
            { label: yesLabel, value: true },
            { label: noLabel, value: false }
          ] as const
        ).map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              value === option.value
                ? 'border-blue-300 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
