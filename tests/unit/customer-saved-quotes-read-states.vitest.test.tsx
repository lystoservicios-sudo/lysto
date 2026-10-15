import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SavedQuotes } from '@/components/pricing/saved-quotes'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const emptyCopy = 'No hay presupuestos disponibles para esta cuenta.'

describe('customer saved quote read states', () => {
  it('shows pending rather than an empty account until the real read resolves', async () => {
    let complete!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve })))
    render(<SavedQuotes />)
    expect(screen.getByRole('status').textContent).toContain('Cargando presupuestos')
    expect(screen.queryByText(emptyCopy)).toBeNull()
    await act(async () => { complete(new Response(JSON.stringify({ quotes: [], nextCursor: null }), { status: 200 })) })
    expect(await screen.findByText(emptyCopy)).toBeTruthy()
    expect(screen.queryByText('Cargando presupuestos…')).toBeNull()
  })

  it('offers a read-only retry after a network failure without announcing a false empty account', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('network unavailable')).mockResolvedValueOnce(new Response(JSON.stringify({ quotes: [], nextCursor: null }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    render(<SavedQuotes />)
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos consultar tus presupuestos')
    expect(screen.queryByText(emptyCopy)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar presupuestos' }))
    expect(await screen.findByText(emptyCopy)).toBeTruthy()
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [, options] of fetcher.mock.calls) expect(options?.method ?? 'GET').toBe('GET')
  })

  it('does not reveal backend errors or mistake a rejected read for an empty account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'private backend detail' }), { status: 503 })))
    render(<SavedQuotes />)
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos consultar tus presupuestos')
    expect(screen.queryByText(/private backend detail/)).toBeNull()
    expect(screen.queryByText(emptyCopy)).toBeNull()
  })
})
