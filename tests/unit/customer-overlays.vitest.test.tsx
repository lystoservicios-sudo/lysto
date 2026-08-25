import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'

import { Dialog } from '@/components/ui/dialog'
import { Popover } from '@/components/ui/popover'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

function DialogHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Cancelar solicitud</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Confirmar cancelación"
        description="La solicitud no se modificará hasta confirmar."
      >
        <button type="button">Confirmar</button>
      </Dialog>
    </>
  )
}

describe('shared customer overlays', () => {
  it('controls dialog focus, Escape close and body scroll ownership', async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole('button', { name: 'Cancelar solicitud' })

    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Confirmar cancelación' })
    const close = screen.getByRole('button', { name: 'Cerrar diálogo' })
    const confirm = screen.getByRole('button', { name: 'Confirmar' })
    expect(document.body.style.overflow).toBe('hidden')
    await waitFor(() => expect(document.activeElement).toBe(close))

    confirm.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Confirmar cancelación' })).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
  })

  it('opens a popover and restores focus after Escape', () => {
    render(
      <Popover trigger="Elegir fecha" label="Opciones de fecha">
        <button type="button">Hoy</button>
      </Popover>
    )

    const trigger = screen.getByRole('button', { name: 'Elegir fecha' })
    fireEvent.click(trigger)
    const popover = screen.getByRole('dialog', { name: 'Opciones de fecha' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(popover, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Opciones de fecha' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes a popover after an outside pointer interaction', () => {
    render(
      <Popover trigger="Filtrar" label="Opciones de filtro">
        <button type="button">Activos</button>
      </Popover>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }))
    expect(screen.getByRole('dialog', { name: 'Opciones de filtro' })).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'Opciones de filtro' })).toBeNull()
  })
})
