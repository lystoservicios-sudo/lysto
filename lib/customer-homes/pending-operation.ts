'use client'

import { z } from 'zod'
import { addHomeEquipmentSchema, createHomeMutationSchema } from './contracts'

const pendingOperationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create-home'), input: createHomeMutationSchema }).strict(),
  z.object({ kind: z.literal('add-equipment'), input: addHomeEquipmentSchema }).strict()
])
export type PendingHomeOperation = z.infer<typeof pendingOperationSchema>
export const pendingStorageMessage =
  'Tu navegador no permite guardar el registro pendiente en el almacenamiento de esta pestaña. Habilitalo antes de guardar; todavía no enviamos la operación.'
export const invalidPendingMessage =
  'No pudimos recuperar el guardado pendiente. No crees otro hogar ni otro aire hasta resolverlo con ayuda: podría existir un registro todavía sin confirmar.'
const storageKey = (customerId: string) => `lysto:hogar:pending:${customerId}`

export function readPendingHomeOperation(customerId: string): {
  operation: PendingHomeOperation | null
  error: string
} {
  if (!z.string().uuid().safeParse(customerId).success)
    return { operation: null, error: invalidPendingMessage }
  try {
    const raw = window.sessionStorage.getItem(storageKey(customerId))
    if (!raw) return { operation: null, error: '' }
    const parsed = pendingOperationSchema.safeParse(JSON.parse(raw))
    return parsed.success
      ? { operation: parsed.data, error: '' }
      : { operation: null, error: invalidPendingMessage }
  } catch {
    return { operation: null, error: invalidPendingMessage }
  }
}

/** Persist before POST. A write must not start if its identity cannot survive refresh. */
export function storePendingHomeOperation(customerId: string, operation: PendingHomeOperation) {
  if (!z.string().uuid().safeParse(customerId).success) throw new Error(invalidPendingMessage)
  const validated = pendingOperationSchema.parse(operation)
  try {
    const key = storageKey(customerId)
    const serialized = JSON.stringify(validated)
    window.sessionStorage.setItem(key, serialized)
    if (window.sessionStorage.getItem(key) !== serialized) throw new Error('Storage unavailable')
  } catch {
    throw new Error(pendingStorageMessage)
  }
}

export function clearPendingHomeOperation(customerId: string) {
  try {
    window.sessionStorage.removeItem(storageKey(customerId))
  } catch {
    // Retaining a resolved command is safe: its next explicit replay is idempotent.
  }
}
