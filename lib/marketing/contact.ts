import { z } from 'zod'

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre.').max(100),
  email: z.string().trim().toLowerCase().email('Ingresá un email válido.').max(254),
  phone: z.string().trim().max(40).refine(value => !value || /^[+()\d\s-]{8,40}$/.test(value), 'Revisá el teléfono.').default(''),
  subject: z.enum(['servicio', 'consulta', 'cuenta', 'otro']),
  message: z.string().trim().min(20, 'Contanos un poco más (al menos 20 caracteres).').max(2000, 'El mensaje puede tener hasta 2000 caracteres.'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Necesitamos tu autorización para responderte.' }) }),
  website: z.string().max(200).default('')
})
export type ContactInquiry = Omit<z.infer<typeof contactSchema>, 'website'>
export type ContactResult = { ok: true } | { ok: false; status: number; message: string; errors?: Record<string, string[] | undefined> }
export async function submitContactInquiry(input: unknown, save: (value: ContactInquiry) => Promise<{ ok: boolean; reason?: string }>): Promise<ContactResult> {
  if (input && typeof input === 'object' && 'website' in input && typeof input.website === 'string' && input.website) return { ok: true }
  const parsed = contactSchema.safeParse(input)
  if (!parsed.success) return { ok: false, status: 400, message: 'Revisá los datos del formulario.', errors: parsed.error.flatten().fieldErrors }
  const { website: _website, ...inquiry } = parsed.data
  void _website
  try {
    const result = await save(inquiry)
    if (result.ok) return { ok: true }
    if (result.reason === 'rate_limit') return { ok: false, status: 429, message: 'Ya recibimos varias consultas tuyas. Esperá unos minutos antes de enviar otra.' }
  } catch { /* The visitor should never receive internal storage or provider errors. */ }
  return { ok: false, status: 503, message: 'No pudimos guardar tu consulta. Tus datos siguen en el formulario para que puedas intentar nuevamente.' }
}
