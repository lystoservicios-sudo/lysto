import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import ResetPage, { metadata } from '../../app/(auth)/restablecer/page'

afterEach(cleanup)

it('keeps recovery form POSTs same-origin in the document policy', async () => {
  expect(metadata.referrer).toBe('same-origin')
  render(await ResetPage({ searchParams: Promise.resolve({ token_hash: 'a'.repeat(64) }) }))
  const form = screen.getByRole('button', { name: 'Guardar contraseña' }).closest('form')
  expect(form?.getAttribute('action')).toBe('/auth/reset-password')
  expect(form?.getAttribute('method')).toBe('post')
})
