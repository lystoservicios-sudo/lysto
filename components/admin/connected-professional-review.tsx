'use client'
import Image from 'next/image'
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
  catalog,
  jobs = []
}: {
  initial: ProfessionalReview
  catalog: { categories: { id: string; name: string }[]; zones: { id: string; name: string }[] }
  jobs?: { id: string; status: string; created_at: string }[]
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
  const [documentFeedback, setDocumentFeedback] = useState<
    Record<string, { error?: string; message?: string }>
  >({})
  const application = review.application
  const reviewing = ['form_submitted', 'under_review'].includes(application.status)
  const requiredDocuments = [...new Set([
    'identity_front', 'identity_back', 'license',
    ...(review.requirements?.policies.flatMap((policy) => policy.requiredDocuments) ?? [])
  ])]
  const missingRegistration = [
    ...(!application.firstName || !application.lastName ? ['Nombre y apellido'] : []),
    ...(!application.phone ? ['Teléfono'] : []),
    ...(!application.dni || !application.cuil || !application.birthdate ? ['Identidad y datos personales'] : []),
    ...(!application.address ? ['Domicilio'] : []),
    ...(!application.licenseNumber || !application.licenseEntity ? ['Datos de matrícula'] : []),
    ...(!application.categoryIds.length || !application.zoneIds.length ? ['Especialidad y zonas'] : []),
    ...(!application.availability.length ? ['Días y horarios de trabajo'] : []),
    ...(!review.avatarUrl ? ['Foto de perfil'] : []),
    ...requiredDocuments.filter((type) => !review.documents.some((document) =>
      document.documentType === type && document.status !== 'rejected'))
      .map((type) => documentLabels[type] ?? type)
  ]
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
      values = new FormData(form, (event.nativeEvent as SubmitEvent).submitter),
      decision = values.get('decision')
    let reason = String(values.get('reason') ?? '').trim()
    const expiresAt = String(values.get('expiresAt') ?? '').trim() || null
    if (documentId) {
      const showDocumentError = (detail: string) =>
        setDocumentFeedback((previous) => ({ ...previous, [documentId]: { error: detail } }))
      setDocumentFeedback((previous) => ({ ...previous, [documentId]: {} }))
      if (decision !== 'approved' && decision !== 'rejected') {
        showDocumentError('Elegí Aprobar documento o Solicitar corrección.')
        return
      }
      if (reason.length > 1000) {
        showDocumentError('Las observaciones admiten hasta 1000 caracteres.')
        return
      }
      if (decision === 'rejected' && [...reason].length < 10) {
        showDocumentError('Para solicitar una corrección, escribí un motivo de al menos 10 caracteres.')
        return
      }
      const dateField = form.elements.namedItem('expiresAt') as HTMLInputElement
      if (dateField.validity.badInput || (expiresAt && (
        !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ||
        !Number.isFinite(Date.parse(expiresAt)) ||
        new Date(expiresAt).toISOString().slice(0, 10) !== expiresAt ||
        expiresAt <= new Date().toISOString().slice(0, 10)
      ))) {
        const minimumDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10).split('-').reverse().join('/')
        showDocumentError(`La fecha de vencimiento debe ser el ${minimumDate} o una fecha posterior. Si el documento no vence, dejala vacía.`)
        return
      }
      const document = review.documents.find((item) => item.id === documentId)
      if (decision === 'approved' && !expiresAt && review.requirements?.policies.some((policy) =>
        policy.expiryDocuments.includes(document?.documentType ?? '')
      )) {
        showDocumentError('La fecha de vencimiento es obligatoria para aprobar este documento.')
        return
      }
      // Keep the persisted audit reason while allowing an ordinary approval without extra prose.
      if (decision === 'approved' && [...reason].length < 10)
        reason = `Documento aprobado.${reason ? ` ${reason}` : ''}`
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const input = {
        professionalId: application.professionalId,
        expectedVersion: application.version,
        reason,
        decision
      }
      const next = await privateRequest<ProfessionalReview>(
        documentId
          ? '/api/admin/professionals/documents/review'
          : '/api/admin/professionals/review',
        'POST',
        documentId ? { ...input, documentId, expiresAt } : input
      )
      setReview(next)
      form.reset()
      if (documentId)
        setDocumentFeedback((previous) => ({ ...previous, [documentId]: {
          message: decision === 'approved' ? 'Documento aprobado.' : 'Corrección solicitada.'
        } }))
      else setMessage('Revisión registrada.')
    } catch (failure) {
      if (documentId)
        setDocumentFeedback((previous) => ({ ...previous, [documentId]: {
          error: `No se guardó la revisión. ${requestError(failure)}`
        } }))
      else setError(requestError(failure))
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
  async function requestRevalidation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const reason = new FormData(form).get('reason')
    setBusy(true); setError(''); setMessage('')
    try {
      const next = await privateRequest<ProfessionalReview>('/api/admin/professionals/revalidation', 'POST', {
        professionalId: application.professionalId, expectedVersion: application.version, reason
      })
      setReview(next)
      form.reset()
      setMessage('Se solicitó la actualización documental. El expediente anterior se conserva.')
    } catch (failure) { setError(requestError(failure)) } finally { setBusy(false) }
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
          {review.eligible ? 'Documentación vigente' : 'Sin habilitación documental vigente'} ·{' '}
          {(review.readyForNewWork ?? review.eligible) ? 'Listo para recibir trabajos' : 'No recibe trabajos nuevos'}
        </p>
        {review.readinessReasons && review.readinessReasons.length > 0 && <p>Falta: {review.readinessReasons.join(', ')}.</p>}
        {review.decisionReason && <p>Última resolución: {review.decisionReason}</p>}
      </Panel>
      {['form_started', 'rejected'].includes(application.status) &&
        <Panel title="Qué falta para completar el registro">
          {missingRegistration.length
            ? <ul>{missingRegistration.map((item) => <li key={item}>• {item}</li>)}</ul>
            : <p>Los datos están cargados. Falta enviar la postulación a revisión y vincular Mercado Pago.</p>}
        </Panel>}
      {application.status === 'approved' && !review.eligible && <Panel title="Solicitar revalidación documental">
        <p>La política vigente o un documento vencido impide la habilitación. Esta acción reabre el expediente para que el profesional corrija y vuelva a enviarlo; los trabajos existentes requieren seguimiento operativo.</p>
        <form className="adm-form" onSubmit={event => void requestRevalidation(event)}>
          <Field label="Motivo para el profesional"><textarea name="reason" required minLength={10} maxLength={1000} disabled={busy} /></Field>
          <Button type="submit" disabled={busy}>Solicitar actualización</Button>
        </form>
      </Panel>}
      <Panel title="Información declarada">
        {review.avatarUrl && <Image unoptimized src={review.avatarUrl} alt="Foto de perfil" width={96} height={96} className="mb-4 h-24 w-24 rounded-full object-cover" />}
        <dl className="adm-facts">
          {[
            ['Teléfono', application.phone],
            ['Dirección', application.address ?? ''],
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
      <Panel title="Trabajos vinculados">
        {jobs.length ? <ul>{jobs.map((job) => <li key={job.id} className="border-b py-2">
          <a className="underline" href={`/admin/calculadora/trabajos/${job.id}`}>{job.id}</a>
          {' · '}{job.status}{' · '}{new Date(job.created_at).toLocaleDateString('es-AR')}
        </li>)}</ul> : <p>Todavía no tiene trabajos vinculados.</p>}
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
              <form className="adm-form" noValidate onSubmit={(event) => void decide(event, document.id)}>
                <fieldset disabled={busy}>
                  <Field label="Fecha de vencimiento (si corresponde)"
                    hint="Es el vencimiento del documento, no la fecha de revisión. Dejala vacía si no vence.">
                    <input type="date" name="expiresAt" defaultValue={document.expiresAt ?? ''}
                      min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} />
                  </Field>
                  <Field label="Observaciones"
                    hint="Opcionales para aprobar. Para solicitar una corrección, explicá el motivo con al menos 10 caracteres.">
                    <textarea name="reason" maxLength={1000} />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" name="decision" value="approved" variant="primary">Aprobar documento</Button>
                    <Button type="submit" name="decision" value="rejected">Solicitar corrección</Button>
                  </div>
                </fieldset>
              </form>
            )}
            {documentFeedback[document.id]?.error &&
              <p role="alert" className="adm-notice">{documentFeedback[document.id].error}</p>}
            {documentFeedback[document.id]?.message &&
              <p role="status" className="adm-notice success">{documentFeedback[document.id].message}</p>}
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
