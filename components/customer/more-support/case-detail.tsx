'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { z } from 'zod'
import { MoreSection, moreStyles as s } from '@/components/customer/more/more-ui'
import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import { canCustomerReply, supportDate, supportStatusLabels, type SupportCaseView } from '@/lib/support/customer-content'
import styles from './support.module.css'

const pendingReplySchema = z.object({ action: z.literal('customer_replied'), expectedVersion: z.number().int().positive(), publicMessage: z.string().min(2).max(3000), evidenceIds: z.array(z.string().uuid()).max(10), idempotencyKey: z.string().uuid() }).strict()
type PendingReply = z.infer<typeof pendingReplySchema>

export function CustomerCaseDetail({ initialCase, customerId, requestId }: { initialCase: SupportCaseView; customerId: string; requestId?: string }) {
  const [item, setItem] = useState(initialCase), [message, setMessage] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [files, setFiles] = useState<File[]>([]), [saved, setSaved] = useState<SavedPhoto[]>([]), [uploadBusy, setUploadBusy] = useState(false)
  const lock = useRef(false), unsaved = files.some(f => !saved.some(p => p.file === f))
  const storageKey = `lysto:support-reply:${customerId}:${initialCase.id}`
  const [pending, setPending] = useState<PendingReply | null>(null), [recovered, setRecovered] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) { const saved = pendingReplySchema.parse(JSON.parse(raw)); setPending(saved); setMessage(saved.publicMessage) }
      setRecovered(true)
    } catch { setError('No pudimos recuperar el envío pendiente de esta consulta. Volvé a abrir la pantalla en este dispositivo antes de responder.') }
  }, [storageKey])
  async function reload() {
    const response = await fetch(`/api/support/cases/${item.id}`, { cache: 'no-store', headers: { 'X-Lysto-Customer-Id': customerId } })
    const body = await response.json() as { case?: SupportCaseView; error?: string }
    if (!response.ok || !body.case) throw new Error(body.error ?? 'No pudimos actualizar el seguimiento.')
    setItem(body.case)
    return body.case
  }
  async function reply(event: FormEvent) {
    event.preventDefault()
    if (lock.current || uploadBusy || (!pending && unsaved) || !recovered) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const command = pending ?? pendingReplySchema.parse({ action: 'customer_replied', expectedVersion: item.version, publicMessage: message, evidenceIds: saved.map(p => p.upload.attachmentId), idempotencyKey: crypto.randomUUID() })
      // Persist before dispatch. An unknown HTTP outcome must replay this exact
      // command, including its original version, even after a page reload.
      sessionStorage.setItem(storageKey, JSON.stringify(command)); setPending(command)
      const response = await fetch(`/api/support/cases/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Lysto-Customer-Id': customerId }, body: JSON.stringify(command), signal: AbortSignal.timeout(60_000) })
      const body = await response.json() as { error?: string; case?: { id: string; version: number } }
      if (!response.ok) {
        // Auth/ownership failures do not disprove an earlier unknown outcome.
        // Validation/conflict responses from this actor can safely unlock edits;
        // transport failures, 5xx and invalid acknowledgements remain pending.
        if ([400,409].includes(response.status)) { sessionStorage.removeItem(storageKey); setPending(null); if (response.status === 409) await reload() }
        throw new Error(body.error ?? 'No pudimos enviar tu respuesta.')
      }
      if (body.case?.id !== item.id || !Number.isInteger(body.case.version) || body.case.version < 1) throw new Error('No pudimos confirmar la respuesta. Reintentá el envío pendiente.')
      sessionStorage.removeItem(storageKey); setPending(null); setMessage(''); setFiles([]); setSaved([]); setNotice('Respuesta recibida.'); await reload()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos confirmar el envío. Actualizá el seguimiento antes de reintentar.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function refresh() { setError(''); setBusy(true); try { await reload(); setNotice('Seguimiento actualizado.') } catch { setError('No pudimos actualizar el seguimiento. Intentá nuevamente.') } finally { setBusy(false) } }
  const events = item.events.filter(e => e.message || e.fromStatus !== e.toStatus || e.evidenceIds.length)
  return <>
    <dl className={s.facts}><div className={s.fact}><dt>Estado</dt><dd>{supportStatusLabels[item.status] ?? 'En seguimiento'}</dd></div><div className={s.fact}><dt>Consulta recibida</dt><dd>{supportDate(item.createdAt)}</dd></div></dl>
    <MoreSection title="Tu consulta"><p className={s.muted} style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p></MoreSection>
    {item.warrantyClaim ? <div className={s.notice}><p>{item.warrantyClaim.status === 'approved' ? 'Cobertura aprobada. Consultá la revisita vinculada.' : item.warrantyClaim.status === 'completed' ? 'Reclamo de garantía finalizado.' : 'El caso tiene una revisión de garantía. La cobertura y su decisión se muestran cuando están confirmadas.'}</p>{item.warrantyClaim.revisitJobId ? <Link className={s.textAction} href={`/app/trabajos/${item.warrantyClaim.revisitJobId}`}>Ver revisita</Link> : null}</div> : null}
    {item.publicResolution ? <MoreSection title="Resolución"><p className={s.muted} style={{ whiteSpace: 'pre-wrap' }}>{item.publicResolution}</p></MoreSection> : null}
    <MoreSection title="Seguimiento"><ol className="m-0 list-none p-0" aria-label="Seguimiento de tu consulta">{events.map(e => <li key={e.id} className={s.row}><div className={s.rowCopy}><strong>{e.type === 'opened' ? 'Consulta recibida' : e.toStatus ? supportStatusLabels[e.toStatus] ?? 'Novedad del caso' : 'Novedad del caso'}</strong><span>{supportDate(e.createdAt)}</span>{e.message ? <p className={s.muted} style={{ whiteSpace: 'pre-wrap' }}>{e.message}</p> : null}<EvidenceLinks ids={e.evidenceIds} /></div></li>)}</ol></MoreSection>
    {notice ? <p className={s.success} role="status">{notice}</p> : null}
    {error ? <p className={s.error} role="alert">{error}</p> : null}
    {canCustomerReply(item.status) || pending ? <MoreSection title="Aportar información"><form className={s.form} onSubmit={reply}>
      {pending ? <p className={s.notice}>Hay un envío por confirmar. Reintentá para recuperar el resultado sin duplicar tu respuesta.</p> : null}
      <label className={s.field}>Tu respuesta<textarea required minLength={2} maxLength={3000} value={message} onChange={e => setMessage(e.target.value)} disabled={busy || !!pending || !recovered} /></label>
      {!pending ? <div className={styles.media}><MediaUploader files={files} onFilesChange={setFiles} savedPhotos={saved} onSavedPhotosChange={setSaved} onBusyChange={setUploadBusy} customerId={customerId} target={{ kind: 'request-photo', ...(requestId ? { entityId: requestId } : {}) }} /></div> : null}
      {unsaved && !pending ? <p className={s.muted}>Guardá las fotos antes de enviar.</p> : null}<button type="submit" className={s.primary} disabled={busy || uploadBusy || (!pending && unsaved) || !recovered}>{busy ? 'Enviando…' : pending ? 'Reintentar envío' : 'Enviar respuesta'}</button>
    </form></MoreSection> : <p className={s.notice}>Esta consulta está cerrada. Si necesitás continuar, abrí una nueva consulta y mencioná este seguimiento.</p>}
    <div className={s.actions}><button type="button" className={s.secondary} onClick={() => void refresh()} disabled={busy}>Actualizar seguimiento</button>{item.jobId ? <Link className={s.secondary} href={`/app/trabajos/${item.jobId}`}>Ver servicio</Link> : null}{!canCustomerReply(item.status) ? <Link className={s.primary} href={`/app/ayuda/nueva${item.jobId ? `?jobId=${item.jobId}` : ''}`}>Nueva consulta</Link> : null}</div>
  </>
}
function EvidenceLinks({ ids }: { ids: string[] }) {
  const [links, setLinks] = useState<Record<string, string>>({}), [error, setError] = useState(''), [busy, setBusy] = useState<string | null>(null)
  async function open(id: string) {
    setBusy(id); setError('')
    try {
      const response = await fetch('/api/uploads/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: id }) })
      const body = await response.json() as { url?: string }
      if (!response.ok || !body.url || new URL(body.url).protocol !== 'https:') throw new Error('unavailable')
      setLinks(current => ({ ...current, [id]: body.url! }))
    } catch { setError('No pudimos abrir la foto. Intentá nuevamente.') }
    finally { setBusy(null) }
  }
  return ids.length ? <div><div className={s.actions}>{ids.map((id, index) => links[id] ? <a key={id} className={s.textAction} href={links[id]} target="_blank" rel="noopener noreferrer" onClick={() => { setTimeout(() => setLinks(current => { const next = { ...current }; delete next[id]; return next }), 0) }}>Abrir foto {index + 1}</a> : <button className={s.textAction} key={id} type="button" disabled={busy !== null} onClick={() => void open(id)}>{busy === id ? 'Preparando…' : `Ver foto ${index + 1}`}</button>)}</div>{error ? <p role="alert" className={s.error}>{error}</p> : null}</div> : null
}
