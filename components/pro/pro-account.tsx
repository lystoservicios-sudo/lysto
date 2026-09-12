'use client'

import { useState } from 'react'
import { BookOpen, Check, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ProPage, ProPanel } from './pro-ui'

const guides = [
  ['Prepará tu visita', 'Revisá horario, dirección, acceso y antecedentes antes de salir.'],
  ['Documentá el equipo', 'Registrá el estado inicial sin incluir datos personales en las fotos.'],
  ['Confirmá el diagnóstico', 'Explicá alcance y adicionales antes de comenzar tareas nuevas.'],
  ['Cerrá el trabajo', 'Completá el informe, la evidencia y las recomendaciones de mantenimiento.']
] as const

export function ProfessionalTraining() {
  const [read, setRead] = useState<string[]>([])
  return (
    <ProPage
      title="Guías de operación"
      description="Material de referencia para usar Lysto durante una visita."
    >
      <ProPanel title={`${read.length} de ${guides.length} guías revisadas`}>
        <div className="space-y-3">
          {guides.map(([title, content]) => (
            <details key={title} className="pro-accordion">
              <summary>
                <BookOpen size={18} />
                <span className="flex-1">{title}</span>
                {read.includes(title) ? <Check size={18} /> : <ChevronDown size={18} />}
              </summary>
              <div>
                <p className="pro-muted">{content}</p>
                <Button
                  className="mt-3"
                  variant="secondary"
                  onClick={() =>
                    setRead((current) =>
                      current.includes(title)
                        ? current.filter((item) => item !== title)
                        : [...current, title]
                    )
                  }
                >
                  {read.includes(title) ? 'Marcar pendiente' : 'Marcar revisada'}
                </Button>
              </div>
            </details>
          ))}
        </div>
        <p className="pro-muted mt-5">
          Estas guías explican la operación en Lysto. No sustituyen habilitaciones ni formación
          técnica.
        </p>
      </ProPanel>
    </ProPage>
  )
}

export function ProfessionalProfile() {
  return (
    <ProPage title="Mi perfil" description="La página productiva carga el perfil autenticado.">
      <ProPanel title="Perfil">
        <p className="pro-muted">Abrí esta vista desde una sesión profesional aprobada.</p>
      </ProPanel>
    </ProPage>
  )
}

export function ProfessionalOnboarding() {
  return (
    <ProPage
      title="Registro profesional"
      description="El alta productiva se inicia con una invitación válida."
    >
      <ProPanel title="Invitación requerida">
        <p className="pro-muted">
          Usá el enlace personal enviado por Lysto para completar y presentar tu expediente.
        </p>
      </ProPanel>
    </ProPage>
  )
}
