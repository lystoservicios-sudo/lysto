import { randomInt } from 'node:crypto'

/** Generate a cryptographically random, exactly seven-digit onboarding password. */
export function generateTemporaryProfessionalPassword(): string {
  return randomInt(1_000_000, 10_000_000).toString()
}
