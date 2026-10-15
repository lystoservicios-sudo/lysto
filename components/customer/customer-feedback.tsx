/* eslint-disable @next/next/no-html-link-for-pages -- Recovery links must work even when the app router cannot recover. */
import { ArrowLeft, CircleAlert, FileQuestion, RotateCcw } from 'lucide-react'
import styles from './customer-feedback.module.css'

export const uncertainOperationMessage = 'Si estabas guardando cambios o pagando, revisá el estado antes de repetir la operación.'
export const unavailableContentMessage = 'El enlace puede ser incorrecto o el contenido no estar disponible.'

type FeedbackProps = {
  title: string
  description: string
  kind?: 'error' | 'not-found'
  onRetry?: () => void
  sectionLink?: { href: string; label: string }
  standalone?: boolean
}

/** A provider-independent exit for failed reads and unavailable customer resources. */
export function CustomerFeedback({ title, description, kind = 'error', onRetry, sectionLink, standalone = false }: FeedbackProps) {
  const Icon = kind === 'not-found' ? FileQuestion : CircleAlert
  const content = <section className={styles.feedback} role={kind === 'error' ? 'alert' : undefined} aria-labelledby="customer-feedback-title">
    <div className={styles.marker} aria-hidden="true"><Icon size={20} /></div>
    <p className={styles.eyebrow}>{kind === 'not-found' ? '404 · No disponible' : 'Lysto · Intentá de nuevo'}</p>
    <h1 id="customer-feedback-title" className={styles.title}>{title}</h1>
    <p className={styles.description}>{description}</p>
    <div className={styles.actions}>
      {onRetry ? <button type="button" className={styles.primary} onClick={onRetry}><RotateCcw size={18} aria-hidden="true" />Reintentar</button> : null}
      <a className={onRetry ? styles.secondary : styles.primary} href="/app">Ir a Inicio</a>
    </div>
    {sectionLink ? <a className={styles.sectionLink} href={sectionLink.href}><ArrowLeft size={18} aria-hidden="true" />{sectionLink.label}</a> : null}
    {standalone ? <a className={styles.sectionLink} href="/">Ir a la página de Lysto</a> : null}
  </section>

  return standalone ? <main className={styles.standalone}>{content}</main> : content
}

export { styles as feedbackStyles }
