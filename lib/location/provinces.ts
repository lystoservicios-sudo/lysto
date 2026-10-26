export type ArgentineProvince = {
  readonly id: string
  readonly name: string
  readonly label: string
  readonly aliases?: readonly string[]
}

// GeoRef /provincias official jurisdiction IDs. CABA is a separate jurisdiction;
// address validation is independent from the service's pricing coverage.
export const ARGENTINE_PROVINCES: readonly ArgentineProvince[] = [
  { id: '02', name: 'CABA', label: 'Ciudad Autónoma de Buenos Aires (CABA)', aliases: ['Ciudad Autónoma de Buenos Aires', 'Ciudad de Buenos Aires', 'Capital Federal'] },
  { id: '06', name: 'Buenos Aires', label: 'Buenos Aires' },
  { id: '10', name: 'Catamarca', label: 'Catamarca' },
  { id: '14', name: 'Córdoba', label: 'Córdoba' },
  { id: '18', name: 'Corrientes', label: 'Corrientes' },
  { id: '22', name: 'Chaco', label: 'Chaco' },
  { id: '26', name: 'Chubut', label: 'Chubut' },
  { id: '30', name: 'Entre Ríos', label: 'Entre Ríos' },
  { id: '34', name: 'Formosa', label: 'Formosa' },
  { id: '38', name: 'Jujuy', label: 'Jujuy' },
  { id: '42', name: 'La Pampa', label: 'La Pampa' },
  { id: '46', name: 'La Rioja', label: 'La Rioja' },
  { id: '50', name: 'Mendoza', label: 'Mendoza' },
  { id: '54', name: 'Misiones', label: 'Misiones' },
  { id: '58', name: 'Neuquén', label: 'Neuquén' },
  { id: '62', name: 'Río Negro', label: 'Río Negro' },
  { id: '66', name: 'Salta', label: 'Salta' },
  { id: '70', name: 'San Juan', label: 'San Juan' },
  { id: '74', name: 'San Luis', label: 'San Luis' },
  { id: '78', name: 'Santa Cruz', label: 'Santa Cruz' },
  { id: '82', name: 'Santa Fe', label: 'Santa Fe' },
  { id: '86', name: 'Santiago del Estero', label: 'Santiago del Estero' },
  { id: '90', name: 'Tucumán', label: 'Tucumán' },
  { id: '94', name: 'Tierra del Fuego, Antártida e Islas del Atlántico Sur', label: 'Tierra del Fuego, Antártida e Islas del Atlántico Sur', aliases: ['Tierra del Fuego'] }
]

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function findArgentineProvince(value?: string | null): ArgentineProvince | undefined {
  if (!value?.trim()) return undefined
  const query = normalize(value).replace(/^(provincia|province) de /, '')
  return ARGENTINE_PROVINCES.find(province => [province.id, province.name, province.label, ...(province.aliases ?? [])]
    .some(name => normalize(name) === query))
}
