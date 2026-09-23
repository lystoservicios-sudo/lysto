import { describe, expect, it } from 'vitest'
import { customerDestination, missingCustomerFields, safeCustomerNext, validateRegistration, validateProfileCompletion } from '../../lib/auth/customer-access'

const profile = { first_name: 'Ana', last_name: 'Pérez', phone: '+54 9 11 1234 5678' }
const address = { street: 'Corrientes', number: '1234', city: 'Buenos Aires', province: 'Buenos Aires', property_type: 'apartment' }

describe('customer access and progressive onboarding', () => {
  it.each(['https://evil.test', '//evil.test', '/admin', '/application', '/app/../admin', '/app/%2e%2e/admin', '/app/\\evil.test', '/app?next=https://evil.test', '/app/%252e%252e/admin'])('rejects unsafe destinations: %s', (next) => {
    expect(safeCustomerNext(next)).toBe('/app')
  })
  it('preserves an intended service request', () => {
    expect(safeCustomerNext('/app/solicitar/aire-acondicionado')).toBe('/app/solicitar/aire-acondicionado')
  })
  it('asks only for missing profile and address fields', () => {
    expect(missingCustomerFields({ ...profile, phone: '' }, { ...address, number: '' })).toEqual(['phone', 'number'])
    expect(missingCustomerFields(profile, address)).toEqual([])
  })
  it('requires confirmation and completeness before opening the app', () => {
    expect(customerDestination({ verified: false, profile, address })).toBe('/login?notice=confirm-email')
    expect(customerDestination({ verified: true, profile, address: null }, '/app/solicitar/aire-acondicionado')).toBe('/completar-perfil?next=%2Fapp%2Fsolicitar%2Faire-acondicionado')
    expect(customerDestination({ verified: true, profile, address }, '/app/solicitar/aire-acondicionado')).toBe('/app/solicitar/aire-acondicionado')
  })
  it('rejects weak signup credentials and mismatched passwords', () => {
    expect(validateRegistration({ email: 'ana@example.com', password: 'short', confirmPassword: 'short', firstName: 'Ana', lastName: 'Pérez' }).success).toBe(false)
    expect(validateRegistration({ email: 'ana@example.com', password: 'clave-123', confirmPassword: 'diferente', firstName: 'Ana', lastName: 'Pérez' }).success).toBe(false)
    expect(validateRegistration({ email: ' ANA@example.com ', password: 'clave-123', confirmPassword: 'clave-123', firstName: 'Ana', lastName: 'Pérez' }).success).toBe(true)
  })
  it.each([6, 12])('accepts a customer password with %i characters', length => {
    const password = 'a'.repeat(length)
    expect(validateRegistration({ email: 'ana@example.com', password, confirmPassword: password, firstName: 'Ana', lastName: 'Pérez' }).success).toBe(true)
  })
  it.each([5, 13])('rejects a customer password with %i characters', length => {
    const password = 'a'.repeat(length)
    expect(validateRegistration({ email: 'ana@example.com', password, confirmPassword: password, firstName: 'Ana', lastName: 'Pérez' }).success).toBe(false)
  })
  it('retains known fields and validates genuinely missing values on the server', () => {
    const data = new FormData()
    data.set('phone', '+54 9 11 8765 4321')
    data.set('first_name', 'Modified')
    expect(validateProfileCompletion({ ...profile, phone: '' }, address, data)).toMatchObject({ success: true, data: { first_name: 'Ana', phone: '+54 9 11 8765 4321' } })
    expect(validateProfileCompletion(profile, null, new FormData()).success).toBe(false)
  })
})
