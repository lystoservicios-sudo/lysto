import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RegistrationPayments, useRegistrationAccount } from '@/components/pro/registration-payments'

const fetcher = vi.fn()
const assign = vi.fn()
const linked = { configured: true, linked: true, mode: 'live', accountId: '123456' } as const
const unlinked = { configured: true, linked: false, mode: 'live', accountId: null } as const
function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }) }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function Connected({ id = 'professional-1' }: { id?: string }) { const state = useRegistrationAccount(id); return <RegistrationPayments state={state} /> }

beforeEach(() => {
  fetcher.mockReset(); assign.mockReset()
  vi.stubGlobal('fetch', fetcher)
  const original = window
  vi.stubGlobal('window', new Proxy(original, { get(target, key) {
    if (key === 'location') return { ...original.location, assign }
    return Reflect.get(target, key)
  } }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('loads the actual account before offering a connection', async () => {
  const pending = deferred<Response>(); fetcher.mockReturnValue(pending.promise)
  render(<Connected />)
  expect(screen.getByText('Consultando tu conexión…')).toBeTruthy()
  expect(screen.getByRole('button', { name: /vincular Mercado Pago/i }).hasAttribute('disabled')).toBe(true)
  await act(async () => pending.resolve(response(unlinked)))
  expect(screen.getByText('Todavía sin vincular')).toBeTruthy()
  expect(screen.getByRole('button', { name: /vincular Mercado Pago/i }).hasAttribute('disabled')).toBe(false)
  expect(fetcher.mock.calls[0][0]).toBe('/api/mercadopago/account')
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
})

it('shows a verified connection without claiming technician approval', async () => {
  fetcher.mockResolvedValue(response(linked)); render(<Connected />)
  await waitFor(() => expect(screen.getByText('Cuenta vinculada')).toBeTruthy())
  expect(screen.getByText(/no reemplaza la revisión de tu postulación/i)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /vincular Mercado Pago/i })).toBeNull()
  expect(screen.queryByText(/ya estás habilitado/i)).toBeNull()
})

it('does not offer authorization when account configuration is unavailable', async () => {
  fetcher.mockResolvedValue(response({ configured: false, linked: null })); render(<Connected />)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('La vinculación no está disponible'))
  expect(screen.getByRole('button', { name: /vincular Mercado Pago/i }).hasAttribute('disabled')).toBe(true)
})

it('explicitly identifies a test connection instead of presenting it as live readiness', async () => {
  fetcher.mockResolvedValue(response({ ...linked, mode: 'test' })); const { container } = render(<Connected />)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Conexión de prueba'))
  expect(screen.queryByText('Cuenta vinculada')).toBeNull()
  expect(screen.queryByText(/Completaste la conexión de cobros/)).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Conexión de prueba')
  expect(container.querySelector('.lucide-circle-check')).toBeNull()
  expect(screen.queryByRole('button', { name: /Vincular Mercado Pago/ })).toBeNull()
  expect(screen.queryByText(/ya estás habilitado/i)).toBeNull()
})

it('names the payment provider without fabricating its logo', async () => {
  fetcher.mockResolvedValue(response(unlinked))
  const { container } = render(<Connected />)
  await waitFor(() => expect(screen.getByText('Mercado Pago', { exact: true })).toBeTruthy())
  expect(container.querySelector('.lucide-handshake')).toBeNull()
})

it('rejects an ambiguous account response and lets the applicant retry', async () => {
  fetcher.mockResolvedValueOnce(response({ configured: true, linked: 'yes' })).mockResolvedValueOnce(response(unlinked))
  render(<Connected />)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('Cuenta vinculada')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }))
  await waitFor(() => expect(screen.getByText('Todavía sin vincular')).toBeTruthy())
})

it('clears a verified account while refreshing and after access is denied', async () => {
  fetcher.mockResolvedValueOnce(response(linked)).mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))
  const { result } = renderHook(() => useRegistrationAccount('professional-1'))
  await waitFor(() => expect(result.current.account?.linked).toBe(true))
  await act(async () => { expect(await result.current.refresh()).toBeNull() })
  expect(result.current.account).toBeNull()
  expect(result.current.error).toContain('sesión')
})

it('ignores the prior professional response after identity changes', async () => {
  const old = deferred<Response>(); fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(unlinked))
  const { result, rerender } = renderHook(({ id }) => useRegistrationAccount(id), { initialProps: { id: 'old-professional' } })
  rerender({ id: 'new-professional' })
  await waitFor(() => expect(result.current.account?.linked).toBe(false))
  await act(async () => old.resolve(response(linked)))
  expect(result.current.account?.linked).toBe(false)
})

it('does not query an inactive identity', () => {
  const { result } = renderHook(() => useRegistrationAccount(''))
  expect(result.current.account).toBeNull(); expect(result.current.loading).toBe(false)
  expect(fetcher).not.toHaveBeenCalled()
})

it('aborts a pending account read when unmounted', async () => {
  const pending = deferred<Response>(); fetcher.mockReturnValueOnce(pending.promise)
  const { unmount } = renderHook(() => useRegistrationAccount('professional-1'))
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal
  unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => pending.resolve(response(linked)))
})

it('ignores an older refresh result once a newer account read completes', async () => {
  const pending = deferred<Response>()
  fetcher.mockResolvedValueOnce(response(unlinked)).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(unlinked))
  const { result } = renderHook(() => useRegistrationAccount('professional-1'))
  await waitFor(() => expect(result.current.account?.linked).toBe(false))
  let old!: Promise<unknown>
  act(() => { old = result.current.refresh() })
  expect(result.current.account).toBeNull()
  await act(async () => { await result.current.refresh() })
  await act(async () => { pending.resolve(response(linked)); await old })
  expect(result.current.account?.linked).toBe(false)
})

it('starts exactly one authorization with the allowlisted onboarding return', async () => {
  const pending = deferred<Response>()
  fetcher.mockResolvedValueOnce(response(unlinked)).mockReturnValueOnce(pending.promise)
  render(<Connected />)
  const button = screen.getByRole('button', { name: /vincular Mercado Pago/i })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button); fireEvent.click(button)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[1][0]).toBe('/api/mercadopago/oauth/authorize')
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ returnTo: 'onboarding' })
  await act(async () => pending.resolve(response({ url: 'https://auth.mercadopago.com/authorization?state=nonce' })))
  expect(assign).toHaveBeenCalledWith('https://auth.mercadopago.com/authorization?state=nonce')
})

it('never navigates to a malformed authorization destination', async () => {
  fetcher.mockResolvedValueOnce(response(unlinked)).mockResolvedValueOnce(response({ url: 'https://attacker.test/authorization?state=nonce' }))
  render(<Connected />)
  const button = screen.getByRole('button', { name: /vincular Mercado Pago/i })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(assign).not.toHaveBeenCalled()
  expect(screen.queryByText('Cuenta vinculada')).toBeNull()
})

it('does not redirect an old authorization after the applicant changes', async () => {
  const pending = deferred<Response>()
  fetcher.mockResolvedValueOnce(response(unlinked)).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(unlinked))
  const { rerender } = render(<Connected id="old-professional" />)
  const button = screen.getByRole('button', { name: /vincular Mercado Pago/i })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button); rerender(<Connected id="new-professional" />)
  await act(async () => pending.resolve(response({ url: 'https://auth.mercadopago.com/authorization?state=nonce' })))
  expect(assign).not.toHaveBeenCalled()
})

it('waits for hydration before reading an OAuth cancellation from the browser', () => {
  const original = window
  vi.stubGlobal('window', new Proxy(original, { get(target, key) {
    if (key === 'location') return { ...original.location, search: '?conexion=cancelada' }
    return Reflect.get(target, key)
  } }))
  const state = { account: unlinked, loading: false, error: '', refresh: vi.fn() }
  expect(renderToString(<RegistrationPayments state={state} />)).not.toContain('Cancelaste la vinculación')
  render(<RegistrationPayments state={state} />)
  expect(screen.getByText(/Cancelaste la vinculación/)).toBeTruthy()
})

it('rechecks the real account and offers recovery after a failed OAuth return', async () => {
  const original = window
  vi.stubGlobal('window', new Proxy(original, { get(target, key) {
    if (key === 'location') return { ...original.location, search: '?conexion=fallida' }
    return Reflect.get(target, key)
  } }))
  fetcher.mockResolvedValueOnce(response(unlinked)).mockResolvedValueOnce(response(linked))
  render(<Connected />)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No pudimos confirmar la vinculación'))
  expect(screen.queryByText('Cuenta vinculada')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }))
  await waitFor(() => expect(screen.getByText('Cuenta vinculada')).toBeTruthy())
  expect(screen.queryByRole('alert')).toBeNull()
  expect(assign).not.toHaveBeenCalled()
})
