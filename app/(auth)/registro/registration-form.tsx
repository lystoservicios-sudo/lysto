'use client'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, MailCheck } from 'lucide-react'
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AuthInput, AuthNotice } from '@/components/auth/auth-fields'
import type { AccountResult, RegistrationPolicy } from '@/lib/auth/account-lifecycle'
import { registerAction } from './actions'
import { completeAccountAction } from '../completar-cuenta/actions'

const initial: AccountResult = { status: 'idle', message: '' }

function personalInformationError(form: HTMLFormElement) {
  const fields = ['firstName', 'lastName', 'phone'].map(name => form.elements.namedItem(name) as HTMLInputElement)
  for (const input of fields) {
    input.setCustomValidity(input.name === 'phone'
      ? input.value.replace(/\D/g, '').length < 8 ? 'Ingresá un teléfono con al menos 8 dígitos.' : ''
      : !input.value.trim() ? 'Completá este dato para continuar.' : '')
  }
  return fields.find(input => !input.checkValidity())
}

function accessInformationError(form: HTMLFormElement, completing: boolean) {
  const names = completing ? ['accepted'] : ['email', 'password', 'repeatPassword', 'accepted']
  const fields = names.map(name => form.elements.namedItem(name) as HTMLInputElement)
  if (!completing) {
    const password = form.elements.namedItem('password') as HTMLInputElement
    const repeat = form.elements.namedItem('repeatPassword') as HTMLInputElement
    password.setCustomValidity(password.value.length < 6 || password.value.length > 12 ? 'Usá entre 6 y 12 caracteres.' : '')
    repeat.setCustomValidity(repeat.value !== password.value ? 'Las contraseñas deben coincidir.' : '')
  }
  return fields.find(input => !input.checkValidity())
}

export function RegistrationForm({ policy, completing = false, next = '/app', initialValues = {} }: { policy: RegistrationPolicy; completing?: boolean; next?: string; initialValues?: { firstName?: string; lastName?: string; phone?: string } }) {
  const [state, action, pending] = useActionState(completing ? completeAccountAction : registerAction, initial)
  const [step, setStep] = useState<1 | 2>(1)
  const headingId = useId()
  const personalHeading = useRef<HTMLHeadingElement>(null)
  const accessHeading = useRef<HTMLHeadingElement>(null)
  const successHeading = useRef<HTMLHeadingElement>(null)
  const navigated = useRef(false)
  const invalidPersonalField = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!navigated.current) return
    if (invalidPersonalField.current) {
      invalidPersonalField.current.reportValidity()
      invalidPersonalField.current = null
    } else {
      (step === 1 ? personalHeading : accessHeading).current?.focus()
    }
  }, [step])

  useEffect(() => {
    if (state.status === 'success' && !completing) successHeading.current?.focus()
  }, [state.status, completing])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const invalidPersonal = personalInformationError(form)
    if (invalidPersonal) {
      if (!completing && step === 2) {
        invalidPersonalField.current = invalidPersonal
        navigated.current = true
        setStep(1)
      } else invalidPersonal.reportValidity()
      return
    }
    if (!completing && step === 1) {
      navigated.current = true
      setStep(2)
      return
    }
    const invalidAccess = accessInformationError(form, completing)
    if (invalidAccess) {
      invalidAccess.reportValidity()
      return
    }
    // Dispatch the real action without resetting these uncontrolled fields on a recoverable error.
    const payload = new FormData(form)
    startTransition(() => action(payload))
  }

  if (state.status === 'success' && !completing) return <div className="auth-form auth-confirmation">
    <span className="auth-confirmation-icon"><MailCheck aria-hidden="true" /></span>
    <h2 className="auth-step-heading" tabIndex={-1} ref={successHeading}>Revisá tu correo</h2>
    <AuthNotice state={state} />
    <Link className="auth-button" href={`/login?next=${encodeURIComponent(next)}`}>Ir a iniciar sesión<ArrowRight size={16} aria-hidden="true" /></Link>
  </div>

  return <form action={action} onSubmit={submit} noValidate aria-busy={pending} className="auth-form" onInput={event => {
    if (event.target instanceof HTMLInputElement) event.target.setCustomValidity('')
  }}>
    {policy.testOnly && <p className="auth-notice">Entorno de ensayo: estos documentos no habilitan operaciones reales.</p>}
    <input type="hidden" name="next" value={next} />
    {!completing && <ol className="auth-stepper" aria-label="Pasos para crear tu cuenta">
      <li aria-current={step === 1 ? 'step' : undefined} data-complete={step === 2} aria-label={step === 2 ? 'Tus datos, completado' : undefined}><span>{step === 2 ? <Check size={16} aria-hidden="true" /> : '1'}</span><span>Tus datos</span></li>
      <li aria-current={step === 2 ? 'step' : undefined}><span>2</span><span>Tu acceso</span></li>
    </ol>}
    <section className="auth-step" hidden={!completing && step !== 1} aria-labelledby={completing ? undefined : `${headingId}-personal`}>
      {!completing && <h2 id={`${headingId}-personal`} className="auth-step-heading" ref={personalHeading} tabIndex={-1}>Tus datos</h2>}
      <div className="auth-two-fields"><AuthInput label="Nombre" name="firstName" autoComplete="given-name" maxLength={100} defaultValue={initialValues.firstName} /><AuthInput label="Apellido" name="lastName" autoComplete="family-name" maxLength={100} defaultValue={initialValues.lastName} /></div>
      <AuthInput label="Teléfono" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={initialValues.phone} />
    </section>
    <section className="auth-step" hidden={!completing && step !== 2} aria-labelledby={completing ? undefined : `${headingId}-access`}>
      {!completing && <>
        <h2 id={`${headingId}-access`} className="auth-step-heading" ref={accessHeading} tabIndex={-1}>Tu acceso</h2>
        <AuthInput label="Email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="tu@email.com" />
        <AuthInput label="Contraseña" name="password" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable />
        <p className="auth-help">Usá entre 6 y 12 caracteres.</p>
        <AuthInput label="Repetir contraseña" name="repeatPassword" type="password" autoComplete="new-password" minLength={6} maxLength={12} revealable />
      </>}
      <label className="auth-consent"><input name="accepted" type="checkbox" required className="mt-1 h-5 w-5 shrink-0" /><span>Leí y acepto los <a className="auth-link" href={policy.termsUrl} target="_blank" rel="noopener noreferrer">términos ({policy.termsVersion})</a> y la <a className="auth-link" href={policy.privacyUrl} target="_blank" rel="noopener noreferrer">política de privacidad ({policy.privacyVersion})</a>.</span></label>
    </section>
    <input type="hidden" name="termsVersion" value={policy.termsVersion} />
    <input type="hidden" name="privacyVersion" value={policy.privacyVersion} />
    <AuthNotice state={state} />
    <div className="auth-step-actions">
      {!completing && step === 2 && <button type="button" className="auth-back" disabled={pending} aria-label="Volver a tus datos" onClick={() => {
        navigated.current = true
        setStep(1)
      }}><ArrowLeft size={16} aria-hidden="true" />Volver</button>}
      <button type="submit" disabled={pending} className="auth-button">{pending ? 'Procesando…' : completing ? 'Guardar y continuar' : step === 1 ? 'Continuar' : 'Crear mi cuenta'}<ArrowRight size={16} aria-hidden="true" /></button>
    </div>
  </form>
}
