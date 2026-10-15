import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthFrame } from '../../components/auth/auth-frame'
import ResetPage from '../../app/(auth)/restablecer/page'

afterEach(cleanup)

describe('customer access visual shell', () => {
  it('uses the approved room masthead without marketing or signed-in navigation', () => {
    const { container } = render(<AuthFrame title="Ingresá a tu cuenta" description="Seguí tus servicios desde acá."><button>Ingresar</button></AuthFrame>)
    expect(container.querySelector('.auth-customer')).not.toBeNull()
    expect(container.querySelector('.auth-masthead img')?.getAttribute('src')).toContain('room-architecture.webp')
    expect(screen.getByRole('link', { name: 'Lysto, volver al inicio' }).getAttribute('href')).toBe('/')
    expect(screen.getByText('Tu hogar, conectado.')).toBeDefined()
    expect(screen.getByRole('main').getAttribute('tabindex')).toBe('-1')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ingresá a tu cuenta')
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
    expect(container.textContent).not.toMatch(/Que tu casa|Profesionales verificados|MÁS TIEMPO PARA VOS/)
  })
  it('offers a keyboard skip link to its unique main content', () => {
    render(<AuthFrame title="Creá tu cuenta" description="Empecemos por tus datos."><p>Formulario</p></AuthFrame>)
    const main = screen.getByRole('main')
    expect(screen.getByRole('link', { name: 'Saltar al formulario' }).getAttribute('href')).toBe(`#${main.id}`)
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })
  it('allows revealing a new password and reports a mismatch without sending it', async () => {
    const { container } = render(await ResetPage({ searchParams: Promise.resolve({ token_hash: 'a'.repeat(43) }) }))
    const password = screen.getByLabelText('Nueva contraseña') as HTMLInputElement
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar nueva contraseña' }))
    expect(password.type).toBe('text')
    fireEvent.change(password, { target: { value: 'segura123' } })
    fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'diferente123' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(screen.getByRole('alert').textContent).toContain('Las contraseñas no coinciden')
    expect((screen.getByRole('button', { name: 'Guardar contraseña' }) as HTMLButtonElement).disabled).toBe(false)
    expect(container.querySelector('form')?.getAttribute('action')).toBe('/auth/reset-password')
    expect(container.querySelector('input[name="token_hash"]')?.getAttribute('value')).toBe('a'.repeat(43))
  })
  it('keeps the reset action and prevents duplicate submissions while sending', async () => {
    const { container } = render(await ResetPage({ searchParams: Promise.resolve({ token_hash: 'b'.repeat(43) }) }))
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'segura123' } })
    fireEvent.change(screen.getByLabelText('Repetir contraseña'), { target: { value: 'segura123' } })
    fireEvent.submit(container.querySelector('form')!)
    expect((screen.getByRole('button', { name: 'Guardando…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
