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

/** Accept only local destinations belonging to the verified account's surface. */
export function safeLocalRedirectPath(candidate: unknown, role: UserRole): string {
  const fallback = roleHome(role)
  if (typeof candidate !== 'string' || !candidate) return fallback
  const origin = 'https://lysto.invalid'
  try {
    let decoded = candidate
    for (let depth = 0; depth < 4; depth += 1) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') ||
          [...decoded].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return fallback
      const target = new URL(decoded, origin)
      if (target.origin !== origin || requiredRoleForPath(target.pathname) !== role) return fallback
      const next = decodeURIComponent(decoded)
      if (next === decoded) {
        const destination = new URL(candidate, origin)
        return destination.pathname + destination.search + destination.hash
      }
      decoded = next
    }
  } catch { return fallback }
  return fallback
}
