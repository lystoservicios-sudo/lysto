import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectedProfessionalReview } from '@/components/admin/connected-professional-review'
import type { ProfessionalReview } from '@/lib/professional/onboarding-contracts'

const professionalId = '96000000-0000-4000-8000-000000000001'
const documentId = '96000000-0000-4000-8000-000000000002'
const secondDocumentId = '96000000-0000-4000-8000-000000000003'
const fetchMock = vi.fn()

function dossier(): ProfessionalReview {
  return {
    application: {
      professionalId, version: 10, status: 'form_submitted', email: 'review@lysto.test',
      firstName: 'Profesional', lastName: 'Prueba', phone: '', dni: '', cuil: '', birthdate: '',
      yearsExperience: 0, licenseNumber: '', licenseEntity: '', hasMobility: false,
      mobilityType: '', bio: '', categoryIds: [], zoneIds: [], tools: [], availability: []
    },
    requirements: { testOnly: false, policies: [] },
    decisionReason: null, eligible: false,
    documents: [
      { id: documentId, documentType: 'identity_front', status: 'pending', version: 1,
        expiresAt: null, reviewedBy: null, reviewedAt: null, reason: null, inSubmission: true,
        createdAt: '2026-10-25T20:00:00Z' },
      { id: secondDocumentId, documentType: 'identity_back', status: 'pending', version: 1,
        expiresAt: null, reviewedBy: null, reviewedAt: null, reason: null, inSubmission: true,
        createdAt: '2026-10-25T20:00:00Z' }
    ]
  }
}

function show(initial = dossier()) {
  render(<ConnectedProfessionalReview initial={initial} catalog={{ categories: [], zones: [] }} />)
}

function documentSection(name = 'DNI frente') {
  return within(screen.getByRole('heading', { name }).closest('section')!)
}

function submitReview(decision: 'approved' | 'rejected', name = 'DNI frente') {
  const section = documentSection(name)
  // Exercise the existing select flow as well as the replacement explicit actions.
  const select = section.queryByRole('combobox')
  if (select) fireEvent.change(select, { target: { value: decision } })
  const action = section.queryByRole('button', {
    name: decision === 'approved' ? 'Aprobar documento' : 'Solicitar corrección'
  }) ?? section.getByRole('button', { name: 'Registrar revisión documental' })
  fireEvent.click(action)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('document approval from the administrative dossier', () => {
  it('saves an approval without making the operator invent a rejection reason', async () => {
    const next = dossier()
    next.application.version = 12
    next.application.status = 'under_review'
    next.documents[0].status = 'approved'
    fetchMock.mockResolvedValue(new Response(JSON.stringify(next)))
    show()

    submitReview('approved')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/professionals/documents/review')
    expect(JSON.parse(request.body)).toMatchObject({
      professionalId, documentId, expectedVersion: 10, decision: 'approved', expiresAt: null
    })
    expect(JSON.parse(request.body).reason.trim().length).toBeGreaterThanOrEqual(10)
    await waitFor(() => expect(documentSection().getByRole('status').textContent).toBe('Documento aprobado.'))
    expect(documentSection().getByText(/Aprobado/)).toBeTruthy()
  })

  it('preserves a short approval observation while satisfying the persisted audit requirement', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(dossier())))
    show()
    fireEvent.change(documentSection().getByRole('textbox'), { target: { value: '  Todo OK  ' } })

    submitReview('approved')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const reason = JSON.parse(fetchMock.mock.calls[0][1].body).reason
    expect(reason).toContain('Todo OK')
    expect(reason.trim().length).toBeGreaterThanOrEqual(10)
  })

  it('counts approval observations the same way as the database when they contain emoji', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(dossier())))
    show()
    fireEvent.change(documentSection().getByRole('textbox'), { target: { value: '😀😀😀😀😀' } })

    submitReview('approved')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const reason = JSON.parse(fetchMock.mock.calls[0][1].body).reason as string
    expect([...reason.trim()].length).toBeGreaterThanOrEqual(10)
  })

  it('explains an expired date beside the document without sending a rejected request', () => {
    show()
    fireEvent.change(documentSection().getByRole('textbox'), {
      target: { value: 'Documento verificado por administración' }
    })
    fireEvent.change(documentSection().getByLabelText(/Fecha de vencimiento/), {
      target: { value: '2000-01-01' }
    })

    submitReview('approved')

    expect(documentSection().getByRole('alert').textContent).toMatch(/vencimiento.*posterior/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['', '     ', '😀😀😀😀😀'])('requires a clear correction reason locally (%j)', (reason) => {
    show()
    fireEvent.change(documentSection().getByRole('textbox'), { target: { value: reason } })

    submitReview('rejected')

    expect(documentSection().getByRole('alert').textContent).toMatch(/motivo.*10 caracteres/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('saves a correction with its explanation as a rejection, never as an approval', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(dossier())))
    show()
    fireEvent.change(documentSection().getByRole('textbox'), {
      target: { value: '  La imagen está borrosa. Volvé a subir el frente.  ' }
    })

    submitReview('rejected')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      documentId, decision: 'rejected', reason: 'La imagen está borrosa. Volvé a subir el frente.'
    })
    await waitFor(() => expect(documentSection().getByRole('status').textContent).toBe('Corrección solicitada.'))
  })

  it('preserves the actual future expiration supplied with an approval', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(dossier())))
    show()
    fireEvent.change(documentSection().getByLabelText(/Fecha de vencimiento/), {
      target: { value: '2100-12-31' }
    })

    submitReview('approved')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).expiresAt).toBe('2100-12-31')
  })

  it('explains a policy-required expiration before trying to approve', () => {
    const initial = dossier()
    initial.requirements!.policies.push({
      categoryId: professionalId, version: 'v1', requiredDocuments: ['identity_front'],
      expiryDocuments: ['identity_front'], requiredTools: [], minExperience: 0, requiresLicense: false
    })
    show(initial)

    submitReview('approved')

    expect(documentSection().getByRole('alert').textContent).toMatch(/vencimiento.*obligatoria/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps a failed save and its explanation next to the document without erasing the draft', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'conflict' }), { status: 409 }))
    show()
    fireEvent.change(documentSection().getByRole('textbox'), {
      target: { value: 'Documento verificado por administración' }
    })

    submitReview('approved')

    await waitFor(() => expect(documentSection().getByRole('alert').textContent).toContain('Los datos cambiaron'))
    expect((documentSection().getByRole('textbox') as HTMLTextAreaElement).value)
      .toBe('Documento verificado por administración')
    expect(documentSection().queryByRole('status')).toBeNull()
  })

  it('uses the returned dossier version for the next document and preserves the other draft', async () => {
    const first = dossier()
    first.application.version = 12
    first.documents[0].status = 'approved'
    const second = structuredClone(first)
    second.application.version = 14
    second.documents[1].status = 'approved'
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(first)))
      .mockResolvedValueOnce(new Response(JSON.stringify(second)))
    show()
    fireEvent.change(documentSection('DNI dorso').getByRole('textbox'), {
      target: { value: 'Revisar el dorso en el siguiente paso' }
    })

    submitReview('approved')
    await waitFor(() => expect(documentSection().getByRole('status')).toBeTruthy())
    expect((documentSection('DNI dorso').getByRole('textbox') as HTMLTextAreaElement).value)
      .toBe('Revisar el dorso en el siguiente paso')
    submitReview('approved', 'DNI dorso')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      documentId: secondDocumentId, expectedVersion: 12, decision: 'approved'
    })
  })
})
