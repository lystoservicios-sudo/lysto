import { createHash } from 'node:crypto'
import { z } from 'zod'

const pointSchema = z
  .object({ createdAt: z.string().datetime({ offset: true }).max(40), id: z.string().uuid() })
  .strict()
const cursorSchema = pointSchema
  .extend({ v: z.literal(1), scope: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict()
const inputSchema = z
  .object({
    pageSize: z.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(1024).optional()
  })
  .strict()
const fingerprint = (scope: string) => createHash('sha256').update(scope).digest('hex')
export type PagePoint = z.infer<typeof pointSchema>
/** Opaque query position, not a credential. RLS authorizes every page again. */
export function encodeCursor(point: PagePoint, scope: string): string {
  return Buffer.from(
    JSON.stringify({ ...pointSchema.parse(point), v: 1, scope: fingerprint(scope) })
  ).toString('base64url')
}
export function parsePageInput(
  input: unknown,
  scope: string
): { pageSize: number; cursor: PagePoint | null } {
  const parsed = inputSchema.parse(input)
  if (!parsed.cursor) return { pageSize: parsed.pageSize, cursor: null }
  if (!/^[A-Za-z0-9_-]+$/.test(parsed.cursor)) throw Error('Invalid cursor')
  const bytes = Buffer.from(parsed.cursor, 'base64url')
  if (bytes.toString('base64url') !== parsed.cursor) throw Error('Invalid cursor')
  const cursor = cursorSchema.parse(JSON.parse(bytes.toString('utf8')))
  if (cursor.scope !== fingerprint(scope)) throw Error('Cursor belongs to another query')
  return { pageSize: parsed.pageSize, cursor: { createdAt: cursor.createdAt, id: cursor.id } }
}
