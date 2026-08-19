import { describe, expect, it } from 'vitest'

import {
  canRoleAccessPath,
  readTrustedRole,
  requiredRoleForPath,
  roleHome
} from '../../lib/auth/session-routing'

describe('trusted demo session routing', () => {
  it('reads only supported roles from trusted application metadata', () => {
    expect(readTrustedRole({ app_role: 'customer' })).toBe('customer')
    expect(readTrustedRole({ app_role: 'professional' })).toBe('professional')
    expect(readTrustedRole({ app_role: 'admin' })).toBe('admin')
    expect(readTrustedRole({ app_role: 'owner' })).toBeNull()
    expect(readTrustedRole(null)).toBeNull()
  })

  it('maps each protected surface to its required role', () => {
    expect(requiredRoleForPath('/app/trabajos')).toBe('customer')
    expect(requiredRoleForPath('/pro/dashboard')).toBe('professional')
    expect(requiredRoleForPath('/admin/dashboard')).toBe('admin')
  })

  it('leaves public routes without a role requirement', () => {
    expect(requiredRoleForPath('/')).toBeNull()
    expect(requiredRoleForPath('/ingresar')).toBeNull()
    expect(requiredRoleForPath('/application')).toBeNull()
  })

  it('maps each role to its own home', () => {
    expect(roleHome('customer')).toBe('/app')
    expect(roleHome('professional')).toBe('/pro/dashboard')
    expect(roleHome('admin')).toBe('/admin/dashboard')
  })

  it('keeps demo accounts inside their own protected surface', () => {
    expect(canRoleAccessPath('customer', '/app/trabajos')).toBe(true)
    expect(canRoleAccessPath('professional', '/pro/dashboard')).toBe(true)
    expect(canRoleAccessPath('admin', '/admin/dashboard')).toBe(true)
    expect(canRoleAccessPath('customer', '/admin')).toBe(false)
    expect(canRoleAccessPath('admin', '/app')).toBe(false)
    expect(canRoleAccessPath(null, '/app')).toBe(false)
    expect(canRoleAccessPath(null, '/ingresar')).toBe(true)
  })
})
