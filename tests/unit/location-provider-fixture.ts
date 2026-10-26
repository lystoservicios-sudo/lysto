import { fireEvent, screen, waitFor, within } from '@testing-library/react'

// Only the external location boundary is faked. Parent/form and persistence
// controllers remain real, and domain request spies stay independently asserted.
export function withLocationProvider(domainFetch: typeof fetch): typeof fetch {
  return async (input, options) => {
    const path = String(input)
    if (!path.startsWith('/api/location/')) return domainFetch(input, options)
    const address = { street: 'Corrientes', number: '456', city: 'Buenos Aires', province: 'Buenos Aires', provinceId: '06', cityId: 'city', streetId: 'street', formattedAddress: 'Corrientes 456, Buenos Aires', latitude: -34.6, longitude: -58.4, precision: 'rooftop', source: 'georef_google' }
    const result = path.includes('/suggestions')
      ? { suggestions: [{ kind: 'address', id: 'address', label: address.formattedAddress, street: address.street, number: address.number, city: address.city, province: address.province }] }
      : { address, proof: 'unit-location-proof' }
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
  }
}

export async function selectUnitAddress() {
  fireEvent.change(screen.getByRole('combobox', { name: 'Provincia' }), { target: { value: '06' } })
  fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), { target: { value: 'Corrientes 456' } })
  const menu = await screen.findByRole('listbox', { name: 'Dirección opciones' })
  fireEvent.click(await within(menu).findByRole('option', { name: 'Corrientes 456, Buenos Aires' }))
  await waitFor(() => {
    if ((screen.getByRole('combobox', { name: 'Dirección' }) as HTMLInputElement).value !== 'Corrientes 456, Buenos Aires, Buenos Aires') throw new Error('Resolution pending')
  })
}
