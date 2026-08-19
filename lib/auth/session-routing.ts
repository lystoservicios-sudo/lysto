import type { UserRole } from '../domain/types'

const ROLE_HOMES: Record<UserRole, string> = {
  customer: '/app',
  professional: '/pro/dashboard',
  admin: '/admin/dashboard'
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'customer' || value === 'professional' || value === 'admin'
}

function isPathInside(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function readTrustedRole(metadata: unknown): UserRole | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  const role = (metadata as Record<string, unknown>).app_role
  return isUserRole(role) ? role : null
}

export function requiredRoleForPath(pathname: string): UserRole | null {
  if (isPathInside(pathname, '/app')) return 'customer'
  if (isPathInside(pathname, '/pro')) return 'professional'
  if (isPathInside(pathname, '/admin')) return 'admin'
  return null
}

export function roleHome(role: UserRole): string {
  return ROLE_HOMES[role]
}

export function canRoleAccessPath(role: UserRole | null, pathname: string): boolean {
  const requiredRole = requiredRoleForPath(pathname)
  return requiredRole === null || role === requiredRole
}
