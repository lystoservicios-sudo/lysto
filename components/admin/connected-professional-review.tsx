'use client'
import { useEffect, useState } from 'react'
import type { ProfessionalReview } from '@/lib/professional/onboarding-contracts'
import { privateRequest, requestError } from '@/lib/http/private-client'
import {
  professionalStatusLabels,
  documentLabels
} from '@/components/pro/connected-professional-onboarding'
import { Button, Field, Header, Panel } from './admin-ui'

export function ConnectedProfessionalReview({
  initial,
  catalog
}: {
  initial: ProfessionalReview
  catalog: { categories: { id: string; name: string }[]; zones: { id: string; name: string }[] }
}) {
  const [review, setReview] = useState(initial),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  // Do not accept edits before hydration installs the change handlers.
  useEffect(() => {
    setBusy(false)
  }, [])
  const [documentUrl, setDocumentUrl] = useState<{ id: string; url: string } | null>(null)
  const application = review.application
  const reviewing = ['form_submitted', 'under_review'].includes(application.status)
  async function refresh() {
    const next = await privateRequest<ProfessionalReview>(
      '/api/admin/professionals/review?professionalId=' + application.professionalId
    )
    setReview(next)
  }
  async function reload() {
    setBusy(true)
    setError('')
    try {
      await refresh()
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function openDocument(id: string) {
    setBusy(true)
    setError('')
    setDocumentUrl(null)
    try {
      const result = await privateRequest<{ url: string }>('/api/uploads/read', 'POST', {
        intentId: id
      })
      setDocumentUrl({ id, url: result.url })
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function decide(event: React.FormEvent<HTMLFormElement>, documentId?: string) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget,
      values = new FormData(form),
      decision = values.get('decision')
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const input = {
        professionalId: application.professionalId,
        expectedVersion: application.version,
        reason: values.get('reason'),
        decision
      }
      const next = await privateRequest<ProfessionalReview>(
        documentId
          ? '/api/admin/professionals/documents/review'
          : '/api/admin/professionals/review',
        'POST',
        documentId ? { ...input, documentId, expiresAt: values.get('expiresAt') || null } : input
      )
      setReview(next)
      form.reset()
      setMessage('Revisión registrada.')
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  async function suspend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await privateRequest('/api/admin/professionals/suspend', 'POST', {
        professionalId: application.professionalId,
        reason: values.get('reason')
      })
      await refresh()
      setMessage(
        'Profesional suspendido. Los trabajos existentes se conservan para su seguimiento operativo.'
      )
    } catch (failure) {
      setError(requestError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Header
        title={
          `${application.firstName} ${application.lastName}`.trim() || 'Postulación profesional'
        }
        description={application.email}
        back={{ href: '/admin/profesionales', label: 'Profesionales' }}
        action={
          <Button disabled={busy} onClick={() => void reload()}>
            Actualizar expediente
          </Button>
        }
      />
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <Panel title="Estado de la postulación">
        <p>
          {professionalStatusLabels[application.status]} ·{' '}
          {review.eligible ? 'Habilitación vigente' : 'Sin habilitación operativa vigente'}
        </p>
        {review.decisionReason && <p>Última resolución: {review.decisionReason}</p>}
      </Panel>
      <Panel title="Información declarada">
        <dl className="adm-facts">
          {[
            ['Teléfono', application.phone],
            ['DNI', application.dni],
            ['CUIL', application.cuil],
            ['Nacimiento', application.birthdate],
            ['Experiencia', `${application.yearsExperience} años`],
            ['Matrícula', `${application.licenseNumber} ${application.licenseEntity}`],
            ['Movilidad', application.hasMobility ? application.mobilityType || 'Sí' : 'No'],
            ['Presentación', application.bio],
            [
              'Especialidades',
              application.categoryIds
                .map((id) => catalog.categories.find((item) => item.id === id)?.name ?? id)
                .join(', ')
            ],
            [
              'Zonas',
              application.zoneIds
                .map((id) => catalog.zones.find((item) => item.id === id)?.name ?? id)
                .join(', ')
            ],
            ['Herramientas', application.tools.join(', ')],
            [
              'Disponibilidad',
              application.availability
                .map(
                  (slot) =>
                    `${['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][slot.weekday]} ${slot.startTime}–${slot.endTime}`
                )
                .join('; ')
            ]
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || 'Sin informar'}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel title="Requisitos vigentes">
        {review.requirements ? (
          review.requirements.policies.map((policy) => (
            <div className="py-2" key={policy.categoryId}>
              <strong>
                {catalog.categories.find((item) => item.id === policy.categoryId)?.name}
              </strong>
              <p>
                Documentos:{' '}
                {policy.requiredDocuments.map((type) => documentLabels[type] ?? type).join(', ')}.
                Con vencimiento obligatorio:{' '}
                {policy.expiryDocuments.map((type) => documentLabels[type] ?? type).join(', ') ||
                  'Ninguno'}
                .
              </p>
              <p>
                Experiencia mínima: {policy.minExperience} años. Matrícula:{' '}
                {policy.requiresLicense ? 'Obligatoria' : 'No requerida'}. Herramientas:{' '}
                {policy.requiredTools.join(', ') || 'Sin requisito específico'}.
              </p>
            </div>
          ))
        ) : (
          <p>No hay una política documental habilitada para todas las especialidades.</p>
        )}
      </Panel>
      <Panel title="Documentos privados">
        {review.documents.length === 0 && <p>No hay documentos adjuntos.</p>}
        {review.documents.map((document) => (
          <section key={document.id} className="space-y-3 border-b py-5">
            <h3 className="font-semibold">
              {documentLabels[document.documentType] ?? document.documentType}
            </h3>
            <p>
              {
                { pending: 'Pendiente de revisión', approved: 'Aprobado', rejected: 'Observado' }[
                  document.status
                ]
              }{' '}
              · {document.inSubmission ? 'Incluido en el envío actual' : 'Fuera del envío actual'}
              {document.expiresAt && ' · Vence: ' + document.expiresAt}
            </p>
            {document.reason && <p>{document.reason}</p>}
            {document.reviewedAt && (
              <p>
                Revisado: {new Date(document.reviewedAt).toLocaleString('es-AR')} · Responsable:{' '}
                {document.reviewedBy}
              </p>
            )}
            <Button disabled={busy} onClick={() => void openDocument(document.id)}>
              Preparar vista privada
            </Button>
            {documentUrl?.id === document.id && (
              <p>
                <a
                  href={documentUrl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Abrir documento (60 segundos)
                </a>
              </p>
            )}
            {reviewing && document.inSubmission && (
              <form className="adm-form" onSubmit={(event) => void decide(event, document.id)}>
                <fieldset disabled={busy}>
                  <Field label="Resultado de la revisión documental">
                    <select name="decision" required defaultValue="">
                      <option value="" disabled>
                        Seleccionar
                      </option>
                      <option value="approved">Aprobar documento</option>
                      <option value="rejected">Observar documento</option>
                    </select>
                  </Field>
                  <Field label="Fecha de vencimiento">
                    <input type="date" name="expiresAt" defaultValue={document.expiresAt ?? ''} />
                  </Field>
                  <Field label="Motivo y observaciones">
                    <textarea name="reason" minLength={10} maxLength={1000} required />
                  </Field>
                  <Button type="submit">Registrar revisión documental</Button>
                </fieldset>
              </form>
            )}
          </section>
        ))}
      </Panel>
      {reviewing && (
        <Panel title="Resolver postulación">
          <form className="adm-form" onSubmit={(event) => void decide(event)}>
            <fieldset disabled={busy}>
              <Field label="Decisión sobre la postulación">
                <select name="decision" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar
                  </option>
                  <option value="approved">Aprobar y habilitar</option>
                  <option value="rejected">Solicitar correcciones</option>
                </select>
              </Field>
              <Field label="Motivo de la resolución">
                <textarea name="reason" required minLength={10} maxLength={1000} />
              </Field>
              <Button type="submit" variant="primary">
                Registrar resolución
              </Button>
            </fieldset>
          </form>
          <p>
            La aprobación exige documentos revisados y vigentes. La versión del expediente se
            comprueba al guardar.
          </p>
        </Panel>
      )}
      {application.status === 'approved' && (
        <Panel title="Suspender habilitación">
          <p>
            La suspensión retira el acceso operativo y deja los trabajos existentes disponibles para
            seguimiento.
          </p>
          <form className="adm-form" onSubmit={suspend}>
            <Field label="Motivo de suspensión">
              <textarea name="reason" minLength={10} maxLength={1000} required disabled={busy} />
            </Field>
            <Button type="submit" disabled={busy}>
              Suspender profesional
            </Button>
          </form>
        </Panel>
      )}
    </>
  )
}
