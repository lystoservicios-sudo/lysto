import type { UserRole } from '../domain/types.ts'

export function canAccessRoute(role: UserRole | null, pathname: string): boolean {
  if (pathname.startsWith('/admin')) return role === 'admin'
  if (pathname.startsWith('/pro')) return role === 'professional' || role === 'admin'
  if (pathname.startsWith('/app')) return role === 'customer' || role === 'admin'
  return true
}

export function assertCanAccessRoute(role: UserRole | null, pathname: string): void {
  if (!canAccessRoute(role, pathname)) throw new Error(`Role ${role ?? 'anonymous'} cannot access ${pathname}`)
}
