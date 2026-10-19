import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import ResetPage, { metadata } from '../../app/(auth)/restablecer/page'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('keeps recovery form POSTs same-origin in the document policy', async () => {
  expect(metadata.referrer).toBe('same-origin')
  render(await ResetPage({ searchParams: Promise.resolve({ token_hash: 'a'.repeat(64) }) }))
  const form = screen.getByRole('button', { name: 'Guardar contraseña' }).closest('form')
  expect(form?.getAttribute('action')).toBe('/auth/reset-password')
  expect(form?.getAttribute('method')).toBe('post')
})

it('keeps the chosen password while asking for and retrying the authenticator code', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ continuation: 'signed-grant', factors: [{ id: 'factor', name: 'Autenticador' }], message: 'Ingresá el código de tu autenticador.' }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ continuation: 'signed-grant', factors: [{ id: 'factor', name: 'Autenticador' }], message: 'Revisá tu autenticador e intentá nuevamente.' }) })
  vi.stubGlobal('fetch', fetchMock)
  render(await ResetPage({ searchParams: Promise.resolve({ token_hash: 'a'.repeat(64) }) }))
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Clave123' } })
  fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'Clave123' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar contraseña' }).closest('form')!)
  const code = await screen.findByLabelText('Código del autenticador')
  expect((screen.getByLabelText('Nueva contraseña') as HTMLInputElement).value).toBe('Clave123')
  expect(document.querySelector('input[name="token_hash"]')).toBeNull()
  fireEvent.change(code, { target: { value: '123456' } })
  fireEvent.submit(code.closest('form')!)
  await screen.findByText('Revisá tu autenticador e intentá nuevamente.')
  expect((fetchMock.mock.calls[1][1].body as FormData).get('continuation')).toBe('signed-grant')
  expect((fetchMock.mock.calls[1][1].body as FormData).get('factorId')).toBe('factor')
  expect((code as HTMLInputElement).value).toBe('')
})
