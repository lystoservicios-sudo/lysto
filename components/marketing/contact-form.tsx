'use client'
import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { contactSchema, type ContactResult } from '@/lib/marketing/contact'

export function ContactForm() {
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({})
  const sending = useRef(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const input = Object.fromEntries(data)
    const parsed = contactSchema.safeParse({ ...input, consent: data.get('consent') === 'on' })
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      setErrors(fieldErrors)
      setMessage('Revisá los campos marcados para enviar tu consulta.')
      const first = Object.keys(fieldErrors)[0]
      ;(form.elements.namedItem(first) as HTMLElement | null)?.focus()
      return
    }
    sending.current = true
    setPending(true); setErrors({}); setMessage('')
    try {
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) })
      const result = await response.json() as ContactResult
      if (response.ok && result.ok) setSuccess(true)
      else if (!result.ok) { setMessage(result.message); setErrors(result.errors ?? {}) }
      else setMessage('No pudimos enviar tu consulta. Intentá nuevamente.')
    } catch { setMessage('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente; el mensaje sigue acá.') }
    finally { setPending(false); sending.current = false }
  }
  const error = (name: string) => errors[name]?.[0] ? <p id={`contact-${name}-error`} className="m-field-error">{errors[name]?.[0]}</p> : null
  const accessibility = (name: string) => ({ 'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? `contact-${name}-error` : undefined })

  if (success) return <div className="m-form-success" role="status"><CheckCircle2 aria-hidden="true"/><h2>Tu mensaje ya está en buenas manos.</h2><p>Recibimos tu consulta. El equipo de Lysto va a responderte al email que nos dejaste.</p><Link href="/" className="m-text-link">Volver al inicio <ArrowRight size={18} aria-hidden="true"/></Link></div>
  return <form className="m-form" onSubmit={submit} noValidate>
    <div className="m-form-grid"><div className="m-field"><label htmlFor="contact-name">Tu nombre</label><input id="contact-name" name="name" autoComplete="name" placeholder="¿Cómo te llamás?" maxLength={100} required {...accessibility('name')}/>{error('name')}</div><div className="m-field"><label htmlFor="contact-email">Email</label><input id="contact-email" name="email" type="email" autoComplete="email" placeholder="vos@ejemplo.com" maxLength={254} required {...accessibility('email')}/>{error('email')}</div></div>
    <div className="m-form-grid"><div className="m-field"><label htmlFor="contact-phone">Teléfono <span>(opcional)</span></label><input id="contact-phone" name="phone" type="tel" autoComplete="tel" placeholder="Tu número de contacto" maxLength={40} {...accessibility('phone')}/>{error('phone')}</div><div className="m-field"><label htmlFor="contact-subject">¿En qué te ayudamos?</label><select id="contact-subject" name="subject" defaultValue="consulta"><option value="consulta">Tengo una consulta</option><option value="servicio">Quiero consultar por un servicio</option><option value="cuenta">Necesito ayuda con mi cuenta</option><option value="otro">Otro motivo</option></select></div></div>
    <div className="m-field"><label htmlFor="contact-message">Contanos un poco más</label><textarea id="contact-message" name="message" placeholder="Te leemos. ¿Qué necesitás resolver?" rows={5} minLength={20} maxLength={2000} required {...accessibility('message')}/>{error('message')}</div>
    <div className="m-honeypot" aria-hidden="true"><label htmlFor="contact-website">Sitio web</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off"/></div>
    <div><label className="m-form-consent"><input type="checkbox" name="consent" required {...accessibility('consent')}/><span>Acepto que Lysto use estos datos para responder mi consulta. <Link href="/privacidad">Ver privacidad.</Link></span></label>{error('consent')}</div>
    {message && <p className="m-form-alert" role="alert">{message}</p>}
    <div className="m-form-footer"><button type="submit" className="m-button m-button-blue" disabled={pending} aria-busy={pending}>{pending ? 'Enviando…' : 'Enviar mensaje'}{pending ? <LoaderCircle size={19} aria-hidden="true"/> : <ArrowRight size={19} aria-hidden="true"/>}</button><span>Tu consulta llega directamente al equipo de Lysto.</span></div>
  </form>
}
