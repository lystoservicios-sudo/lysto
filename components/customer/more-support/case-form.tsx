'use client'
import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { MediaUploader, type SavedPhoto } from '@/components/customer/media-uploader'
import { moreStyles as s } from '@/components/customer/more/more-ui'
import { supportCategories, type SupportCategory, type SupportJobOption, type WarrantyService } from '@/lib/support/customer-content'
import styles from './support.module.css'

function useSubmission(customerId: string) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<{ id: string; covered?: boolean } | null>(null)
  const lock = useRef(false), command = useRef<{ fingerprint: string; key: string } | null>(null)
  async function send(url: string, payload: Record<string, unknown>, kind: 'case' | 'claim') {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    const fingerprint = JSON.stringify(payload)
    if (command.current?.fingerprint !== fingerprint) command.current = { fingerprint, key: crypto.randomUUID() }
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lysto-Customer-Id': customerId }, body: JSON.stringify({ ...payload, idempotencyKey: command.current.key }), signal: AbortSignal.timeout(60_000) })
      const body = await response.json() as { error?: string; case?: { id: string }; claim?: { caseId: string; coverageEligible: boolean } }
      if (!response.ok) throw new Error(body.error ?? 'No pudimos enviar la consulta. Intentá nuevamente.')
      const id = kind === 'claim' ? body.claim?.caseId : body.case?.id
      if (!id) throw new Error('No pudimos confirmar la consulta. Reintentá para recuperar su estado.')
      setResult({ id, covered: body.claim?.coverageEligible })
    } catch (failure) { setError(failure instanceof Error && failure.message !== 'network' && failure.name !== 'TimeoutError' ? failure.message : 'No pudimos confirmar el envío. Reintentá: no se duplicará tu consulta.') }
    finally { lock.current = false; setBusy(false) }
  }
  return { busy, error, result, send }
}
function SubmissionResult({ result, warranty = false }: { result: { id: string; covered?: boolean }; warranty?: boolean }) {
  return <div className={s.form}><p role="status" className={s.success}>{warranty ? result.covered ? 'Recibimos el reclamo para revisar la cobertura registrada.' : 'Recibimos tu caso para soporte, sin confirmar cobertura.' : 'Recibimos tu consulta. Podés seguir las novedades y aportar información.'}</p><Link className={s.primary} href={`/app/ayuda/consultas/${result.id}`}>{warranty ? 'Seguir mi reclamo' : 'Seguir mi consulta'}</Link></div>
}
function Evidence({ customerId, requestId, files, setFiles, saved, setSaved, setBusy }: { customerId: string; requestId?: string; files: File[]; setFiles: (files: File[]) => void; saved: SavedPhoto[]; setSaved: (saved: SavedPhoto[]) => void; setBusy: (busy: boolean) => void }) {
  return <div className={styles.media}><MediaUploader key={requestId ?? 'general'} files={files} onFilesChange={setFiles} savedPhotos={saved} onSavedPhotosChange={setSaved} onBusyChange={setBusy} customerId={customerId} target={{ kind: 'request-photo', ...(requestId ? { entityId: requestId } : {}) }} /></div>
}
export function SupportCaseForm({ jobs, customerId, initialJobId = '', initialCategory = 'other' }: { jobs: SupportJobOption[]; customerId: string; initialJobId?: string; initialCategory?: SupportCategory }) {
  const [jobId, setJobId] = useState(jobs.some(j => j.id === initialJobId) ? initialJobId : ''), [category, setCategory] = useState<SupportCategory>(initialCategory), [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([]), [saved, setSaved] = useState<SavedPhoto[]>([]), [uploadBusy, setUploadBusy] = useState(false)
  const submission = useSubmission(customerId), job = jobs.find(j => j.id === jobId), unsaved = files.some(f => !saved.some(p => p.file === f))
  async function submit(event: FormEvent) { event.preventDefault(); if (!unsaved && !uploadBusy) await submission.send('/api/support/cases', { ...(jobId ? { jobId } : {}), category, description, evidenceIds: saved.map(p => p.upload.attachmentId) }, 'case') }
  if (submission.result) return <SubmissionResult result={submission.result} />
  return <form className={s.form} onSubmit={submit}>
    <label className={s.field}>Motivo<select value={category} onChange={e => setCategory(e.target.value as SupportCategory)} disabled={submission.busy}>{supportCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
    <label className={s.field}>Servicio relacionado<select value={jobId} disabled={submission.busy || files.length > 0} onChange={e => { setJobId(e.target.value); setFiles([]); setSaved([]) }}><option value="">No corresponde a un servicio</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.label}</option>)}</select><small>{files.length ? 'Para cambiar de servicio, quitá primero las fotos seleccionadas.' : 'Elegí un servicio si la consulta se relaciona con una visita o un pago.'}</small></label>
    {category === 'safety' ? <p className={s.notice}>Ante un peligro inmediato, dejá de usar el equipo y contactá al servicio de emergencias local. Este formulario no es un canal de emergencias.</p> : null}
    <label className={s.field}>Contanos qué pasó<textarea aria-label="Contanos qué pasó" required minLength={10} maxLength={3000} value={description} disabled={submission.busy} onChange={e => setDescription(e.target.value)} /><small>No incluyas contraseñas ni datos completos de tarjetas.</small></label>
    <Evidence customerId={customerId} requestId={job?.requestId} files={files} setFiles={setFiles} saved={saved} setSaved={setSaved} setBusy={setUploadBusy} />
    {unsaved ? <p className={s.muted}>Guardá las fotos antes de enviar la consulta.</p> : null}
    {submission.error ? <p role="alert" className={s.error}>{submission.error}</p> : null}
    <div className={s.actions}><button className={s.primary} disabled={submission.busy || uploadBusy || unsaved} type="submit">{submission.busy ? 'Enviando…' : 'Enviar consulta'}</button><Link className={s.secondary} href="/app/ayuda">Cancelar</Link></div>
  </form>
}
export function WarrantyClaimForm({ job, customerId }: { job: WarrantyService; customerId: string }) {
  const [description, setDescription] = useState(''), [sameProblem, setSameProblem] = useState(true), [files, setFiles] = useState<File[]>([]), [saved, setSaved] = useState<SavedPhoto[]>([]), [uploadBusy, setUploadBusy] = useState(false)
  const submission = useSubmission(customerId), unsaved = files.some(f => !saved.some(p => p.file === f))
  async function submit(event: FormEvent) { event.preventDefault(); if (!unsaved && !uploadBusy) await submission.send('/api/warranty/claim', { jobId: job.id, description, sameProblem, evidenceIds: saved.map(p => p.upload.attachmentId) }, 'claim') }
  if (submission.result) return <SubmissionResult result={submission.result} warranty />
  if (job.claim) return <div className={s.form}><p className={s.notice}>Este servicio ya tiene un reclamo registrado. Consultá su seguimiento para continuar, sin crear otro caso.</p>{job.claim.caseId ? <Link className={s.primary} href={`/app/ayuda/consultas/${job.claim.caseId}`}>Ver reclamo existente</Link> : <Link className={s.primary} href={`/app/ayuda/nueva?jobId=${job.id}&categoria=warranty`}>Consultar sobre este reclamo</Link>}</div>
  return <form className={s.form} onSubmit={submit}>
    <p className={s.notice}>Revisaremos el cierre técnico y la cobertura registrada. Enviar el reclamo no confirma la cobertura ni genera un nuevo cobro.</p>
    <label className={s.field}>¿Qué volvió a ocurrir?<textarea required minLength={10} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} disabled={submission.busy} /></label>
    <label className={s.toggle}><span><strong>Es el mismo problema</strong><small>Indicá si volvió la falla del servicio original.</small></span><input type="checkbox" checked={sameProblem} onChange={e => setSameProblem(e.target.checked)} disabled={submission.busy} /></label>
    <Evidence customerId={customerId} requestId={job.requestId} files={files} setFiles={setFiles} saved={saved} setSaved={setSaved} setBusy={setUploadBusy} />
    {unsaved ? <p className={s.muted}>Guardá las fotos antes de enviar el reclamo.</p> : null}
    {submission.error ? <p role="alert" className={s.error}>{submission.error}</p> : null}
    <div className={s.actions}><button type="submit" className={s.primary} disabled={submission.busy || uploadBusy || unsaved}>{submission.busy ? 'Enviando…' : 'Enviar a revisión'}</button><Link className={s.secondary} href={`/app/garantias/${job.id}`}>Cancelar</Link></div>
  </form>
}
