import { z } from 'zod'

const savedSchema = z.object({
  key: z.string().uuid(),
  fingerprint: z.string().min(1),
  state: z.literal('pending')
})
export type RecoverableCommand = z.infer<typeof savedSchema>
const storageKey = (scope: string) => `lysto:command:${scope}`

export function recoverCommand(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  scope: string,
  fingerprint: string
): RecoverableCommand {
  const stored = storage.getItem(storageKey(scope))
  if (stored) {
    try {
      const parsed = savedSchema.parse(JSON.parse(stored))
      if (parsed.fingerprint === fingerprint) return parsed
    } catch {
      /* replace invalid local data */
    }
  }
  const next = { key: crypto.randomUUID(), fingerprint, state: 'pending' as const }
  storage.setItem(storageKey(scope), JSON.stringify(next))
  return next
}

export function acknowledgeCommand(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  scope: string,
  key: string
) {
  const stored = storage.getItem(storageKey(scope))
  if (!stored) return
  try {
    if (savedSchema.parse(JSON.parse(stored)).key === key) storage.removeItem(storageKey(scope))
  } catch {
    storage.removeItem(storageKey(scope))
  }
}
