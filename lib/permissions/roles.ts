import type { UserRole } from '../domain/types.ts'
import { canRoleAccessPath } from '../auth/session-routing.ts'

export function canAccessRoute(role: UserRole | null, pathname: string): boolean {
  return canRoleAccessPath(role, pathname)
}

export function assertCanAccessRoute(role: UserRole | null, pathname: string): void {
  if (!canAccessRoute(role, pathname)) throw new Error(`Role ${role ?? 'anonymous'} cannot access ${pathname}`)
}
