import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MoreError } from '@/components/customer/more/more-states'
import CustomerPaymentsError from '@/app/(customer)/app/pagos/error'

afterEach(cleanup)

it.each([MoreError, CustomerPaymentsError])('does not assert an uncertain write or payment never happened', (Boundary) => {
  const reset = vi.fn()
  render(<Boundary reset={reset} error={new Error('private-detail')} />)
  expect(screen.queryByText(/No se (modificó ningún pago|confirmó ninguna operación)/)).toBeNull()
  expect(screen.getByText(/antes de repetir/i)).toBeTruthy()
  expect(screen.queryByText('private-detail')).toBeNull()
  expect(reset).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /intentar/i }))
  expect(reset).toHaveBeenCalledTimes(1)
})
