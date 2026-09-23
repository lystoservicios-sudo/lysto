'use client'
import { useState } from 'react'
import type { ProfessionalPolicyCatalog } from '@/lib/professional/professional-policies'
import { requiredAirConditioningTools } from '@/lib/professional/tool-checklist'
import { privateRequest, requestError } from '@/lib/http/private-client'
import { Button, Field, Header, Panel } from './admin-ui'

const documents = [
  ['identity', 'DNI (una imagen)'], ['identity_front', 'DNI frente'],
  ['identity_back', 'DNI dorso'], ['license', 'Matrícula'],
  ['insurance', 'Seguro'], ['tax', 'Constancia fiscal']
] as const
const emptyPolicy = { version: '', requiredDocuments: [] as string[], expiryDocuments: [] as string[],
  requiredTools: [] as string[], minExperience: 0, requiresLicense: false }

export function ConnectedProfessionalPolicies({ initial }: { initial: ProfessionalPolicyCatalog }) {
  const [catalog, setCatalog] = useState(initial)
  const [categoryId, setCategoryId] = useState(initial[0]?.categoryId ?? '')
  const [draft, setDraft] = useState(emptyPolicy)
  const [preview, setPreview] = useState<{ categoryId: string; version: string; approvedProfessionalsAffected: number; legacyProfessionalsForManualReview: number } | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const current = catalog.find(item => item.categoryId === categoryId)
  async function reload() {
    setCatalog(await privateRequest<ProfessionalPolicyCatalog>('/api/admin/professionals/policies'))
  }
  function toggle(field: 'requiredDocuments' | 'expiryDocuments' | 'requiredTools', value: string, checked: boolean) {
    setDraft(current => ({ ...current,
      [field]: checked ? [...current[field], value] : current[field].filter(item => item !== value),
      ...(field === 'requiredDocuments' && !checked
        ? { expiryDocuments: current.expiryDocuments.filter(item => item !== value) } : {})
    }))
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage(''); setPreview(null)
    try {
      await privateRequest('/api/admin/professionals/policies', 'POST', { action: 'draft', categoryId, policy: draft })
      await reload()
      setDraft(emptyPolicy)
      setMessage('Borrador guardado. Todavía no modifica los requisitos vigentes.')
    } catch (failure) { setError(requestError(failure)) } finally { setBusy(false) }
  }
  async function inspect(version: string) {
    setBusy(true); setError(''); setPreview(null)
    try {
      const result = await privateRequest<typeof preview>('/api/admin/professionals/policies', 'POST',
        { action: 'preview', categoryId, version })
      setPreview(result)
    } catch (failure) { setError(requestError(failure)) } finally { setBusy(false) }
  }
  async function activate(event: React.FormEvent) {
    event.preventDefault()
    if (!preview) return
    setBusy(true); setError(''); setMessage('')
    try {
      await privateRequest('/api/admin/professionals/policies', 'POST', {
        action: 'activate', categoryId: preview.categoryId, version: preview.version,
        expectedImpact: preview.approvedProfessionalsAffected, reason
      })
      await reload()
      setPreview(null); setReason('')
      setMessage('Política activada. Los expedientes afectados requieren revalidación documental.')
    } catch (failure) { setError(requestError(failure)) } finally { setBusy(false) }
  }
  return <>
    <Header title="Requisitos profesionales" description="Prepará y aprobá los documentos requeridos por especialidad. Ningún borrador afecta postulaciones." back={{ href: '/admin/profesionales', label: 'Profesionales' }} />
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <Panel title="Especialidad">
      <Field label="Seleccionar especialidad"><select value={categoryId} onChange={event => { setCategoryId(event.target.value); setPreview(null); setDraft(emptyPolicy) }}>
        {catalog.map(item => <option key={item.categoryId} value={item.categoryId}>{item.categoryName}</option>)}
      </select></Field>
      <p>Versión vigente: {current?.activeVersion ?? 'Sin política aprobada'}</p>
    </Panel>
    {current && <Panel title="Nuevo borrador">
      <form className="adm-form" onSubmit={event => void save(event)}><fieldset disabled={busy}>
        <Field label="Versión"><input required maxLength={100} value={draft.version} onChange={event => setDraft({ ...draft, version: event.target.value })} placeholder="Identificador aprobado por Operaciones" /></Field>
        <fieldset><legend>Documentos obligatorios</legend>{documents.map(([code, label]) => <label key={code} className="block"><input type="checkbox" checked={draft.requiredDocuments.includes(code)} onChange={event => toggle('requiredDocuments', code, event.target.checked)} /> {label}</label>)}</fieldset>
        <fieldset><legend>Documentos que requieren fecha de vencimiento</legend>{documents.filter(([code]) => draft.requiredDocuments.includes(code)).map(([code, label]) => <label key={code} className="block"><input type="checkbox" checked={draft.expiryDocuments.includes(code)} onChange={event => toggle('expiryDocuments', code, event.target.checked)} /> {label}</label>)}</fieldset>
        <fieldset><legend>Herramientas exigidas</legend>{requiredAirConditioningTools.map(code => <label key={code} className="block"><input type="checkbox" checked={draft.requiredTools.includes(code)} onChange={event => toggle('requiredTools', code, event.target.checked)} /> {code.replaceAll('_', ' ')}</label>)}</fieldset>
        <Field label="Años mínimos de experiencia"><input type="number" min={0} max={80} value={draft.minExperience} onChange={event => setDraft({ ...draft, minExperience: Number(event.target.value) })} /></Field>
        <label className="block"><input type="checkbox" checked={draft.requiresLicense} onChange={event => setDraft({ ...draft, requiresLicense: event.target.checked })} /> Requiere número y entidad de matrícula</label>
        <Button type="submit" variant="primary" disabled={!draft.version || !draft.requiredDocuments.length}>Guardar borrador</Button>
      </fieldset></form>
      <p>Operaciones debe confirmar los requisitos reales de cada especialidad antes de activar una versión. El sistema no presupone exigencias legales.</p>
    </Panel>}
    {current && <Panel title="Borradores pendientes">
      {!current.drafts.length && <p>No hay borradores.</p>}
      {current.drafts.map(item => <div key={item.version} className="border-b py-3"><strong>{item.version}</strong> · Documentos: {item.requiredDocuments.join(', ')} · Experiencia: {item.minExperience} años <Button disabled={busy} onClick={() => void inspect(item.version)}>Ver impacto</Button></div>)}
    </Panel>}
    {preview && <Panel title={`Activar versión ${preview.version}`}>
      <p>Esta actualización afectará la habilitación de {preview.approvedProfessionalsAffected} profesionales aprobados de la especialidad. Sus envíos históricos se conservan; para recibir trabajos nuevos deberán revalidarse con la versión vigente.</p>
      <p>Además, hay {preview.legacyProfessionalsForManualReview} aprobados anteriores al circuito de invitación que requieren revisión manual. Su aprobación documental histórica no se modifica automáticamente.</p>
      <form className="adm-form" onSubmit={event => void activate(event)}><Field label="Motivo de aprobación"><textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></Field><Button disabled={busy || reason.trim().length < 10} type="submit" variant="primary">Confirmar activación</Button></form>
    </Panel>}
  </>
}
