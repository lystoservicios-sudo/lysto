import { test, expect } from '../_lib/test.ts'
import { assertCanAccessRoute, canAccessRoute } from '../../lib/permissions/roles.ts'

test('cliente accede a app pero no admin', () => {
  expect(canAccessRoute('customer', '/app')).toBeTruthy()
  expect(canAccessRoute('customer', '/admin')).toBeFalsy()
})

test('profesional accede a pro pero no app cliente', () => {
  expect(canAccessRoute('professional', '/pro/trabajos')).toBeTruthy()
  expect(canAccessRoute('professional', '/app/trabajos')).toBeFalsy()
})

test('admin accede a todos los paneles internos', () => {
  expect(canAccessRoute('admin', '/admin')).toBeTruthy()
  expect(canAccessRoute('admin', '/pro')).toBeTruthy()
  expect(canAccessRoute('admin', '/app')).toBeTruthy()
})

test('anonimo no accede a rutas privadas', () => {
  expect(canAccessRoute(null, '/login')).toBeTruthy()
  expect(canAccessRoute(null, '/admin')).toBeFalsy()
  expect(() => assertCanAccessRoute(null, '/admin')).toThrow()
})
