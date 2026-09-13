import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight, MapPin, MessageCircle, Snowflake, UserRound, ClipboardCheck } from 'lucide-react'
import { PublicShell } from '@/components/layout/page-shell'
import { ContactForm } from '@/components/marketing/contact-form'
import { RequestLink } from '@/components/marketing/shared'
import '@/components/marketing/contact-content.css'

export const metadata: Metadata = {
  title: 'Hablemos | Lysto',
  description: 'Consultá por servicios, cobertura, tu cuenta o una visita realizada. El equipo de Lysto te acompaña en el cuidado de tu hogar.',
}

const contactTopics = [
  { icon: Snowflake, title: 'Elegir un servicio', text: 'Te orientamos si no sabés si tu aire necesita mantenimiento, reparación o una instalación.' },
  { icon: MapPin, title: 'Consultar por tu zona', text: 'Empezamos en Buenos Aires. La disponibilidad se confirma según tu domicilio y el servicio que necesitás.' },
  { icon: UserRound, title: 'Recibir ayuda con tu cuenta', text: 'Explicanos en qué paso necesitás ayuda para que podamos orientarte.' },
  { icon: ClipboardCheck, title: 'Hablar de una visita', text: 'Si ya recibiste un servicio, también estamos para escuchar cómo salió y qué necesitás revisar.' },
]

const contactQuestions = [
  ['¿Para pedir un servicio tengo que escribir primero?', 'Podés empezar directamente desde “Pedir un servicio”. Te guiamos para completar la información de tu equipo y tu domicilio. Si tenés dudas antes de avanzar, usá este formulario.'],
  ['¿Puedo consultar aunque todavía no tenga una cuenta?', 'Sí. Para escribirnos solo necesitás completar este formulario. Cuando quieras pedir un servicio, podés iniciar sesión o registrarte para hacer la solicitud y seguirla desde tu cuenta.'],
  ['¿Qué información les sirve para orientarme?', 'Una descripción de lo que necesitás y tu barrio o localidad. Si se trata de un aire acondicionado, contanos qué observás y desde cuándo. Si tu consulta es sobre una visita, sumá la referencia de la solicitud si la tenés.'],
  ['¿Enviar una consulta confirma una visita?', 'El formulario es para conversar con nuestro equipo. La visita se coordina a través de una solicitud de servicio, con la disponibilidad y la propuesta claras antes de confirmar.'],
  ['¿Cómo siguen en contacto conmigo?', 'Te respondemos al email que dejás en el formulario. Si tu consulta es sobre un servicio realizado, contanos qué pasó para que podamos revisar el caso y acompañarte.'],
] as const

export default function ContactPage() {
  return (
    <PublicShell>
      <main>
        <section className="m-container m-page-hero m-contact-hero">
          <span className="m-small-label">Hay alguien del otro lado</span>
          <h1>Hola. <span>Hablemos.</span></h1>
          <p>Una duda antes de empezar. Una mano después de la visita. El cuidado de tu casa también empieza por escucharte.</p>
          <a href="#escribinos" className="m-text-link">Escribir una consulta <ArrowDown size={18} aria-hidden="true" /></a>
        </section>

        <div className="m-container m-contact-layout m-contact-content-layout">
          <section id="escribinos" className="m-contact-composer" aria-labelledby="contact-form-title" tabIndex={-1}>
            <div className="m-contact-form-intro">
              <h2 id="contact-form-title">Te leemos.</h2>
              <p>Contanos qué necesitás resolver. Tu mensaje llega al equipo de Lysto y te respondemos por email.</p>
            </div>
            <ContactForm />
            <div className="m-contact-writing-guide">
              <h3>Un poco de contexto ayuda mucho.</h3>
              <p>Si consultás por un equipo, incluí qué pasa, desde cuándo y en qué barrio estás. Si es por una visita, sumá la referencia de tu solicitud si la tenés.</p>
            </div>
          </section>

          <aside aria-label="Cómo podemos ayudarte">
            <div className="m-contact-aside m-contact-service-invite">
              <MessageCircle aria-hidden="true" />
              <h2>¿Tu aire necesita<br />una mano?</h2>
              <p>Empezá con una solicitud de reparación, mantenimiento o instalación. Nuestro equipo de especialistas aprobados se ocupa de acompañarte.</p>
              <RequestLink />
              <Link href="/solucion" className="m-text-link">Conocer los servicios <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </div>
            <div className="m-contact-topics">
              <h2>Estamos para ayudarte con…</h2>
              <ul>
                {contactTopics.map(({ icon: Icon, title, text }) => (
                  <li key={title}>
                    <Icon size={22} aria-hidden="true" />
                    <div><h3>{title}</h3><p>{text}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <section className="m-contact-followthrough" aria-labelledby="contact-next-title">
          <div className="m-container">
            <div className="m-contact-next-intro">
              <h2 id="contact-next-title">Una conversación.<br /><span>Un próximo paso claro.</span></h2>
              <p>No necesitás conocer el nombre de la falla ni tener todo decidido. Contanos lo que pasa; nosotros te ayudamos a ordenar lo que sigue.</p>
            </div>
            <ol className="m-contact-next-steps">
              <li><span aria-hidden="true">01</span><h3>Te escuchamos.</h3><p>Leemos tu consulta para entender qué necesitás, en qué zona estás y si ya hay un servicio en curso.</p></li>
              <li><span aria-hidden="true">02</span><h3>Lo vemos con vos.</h3><p>Si hace falta más información, te la pedimos. Nuestro equipo te orienta sobre el servicio o la ayuda que corresponde.</p></li>
              <li><span aria-hidden="true">03</span><h3>Sabés cómo seguir.</h3><p>Te explicamos el siguiente paso. Si necesitás una visita, avanzás con una solicitud y una propuesta que podés revisar antes de confirmar.</p></li>
            </ol>
          </div>
        </section>

        <section className="m-container m-faq m-contact-faq" aria-labelledby="contact-faq-title">
          <div>
            <h2 id="contact-faq-title">Antes de escribir,<br />quizás te sirva.</h2>
            <p>Las respuestas a algunas dudas que pueden aparecer al contactar a Lysto.</p>
            <Link href="/nosotros" className="m-text-link">Conocé a Lysto <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="m-faq-list">
            {contactQuestions.map(([question, answer]) => (
              <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
            ))}
          </div>
        </section>
      </main>
    </PublicShell>
  )
}
