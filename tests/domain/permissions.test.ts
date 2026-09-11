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

test('admin accede solamente a su panel interno', () => {
  expect(canAccessRoute('admin', '/admin')).toBeTruthy()
  expect(canAccessRoute('admin', '/pro')).toBeFalsy()
  expect(canAccessRoute('admin', '/app')).toBeFalsy()
})

test('los prefijos de panel respetan los límites de segmento', () => {
  expect(canAccessRoute(null, '/application')).toBeTruthy()
  expect(canAccessRoute(null, '/professional-public')).toBeTruthy()
  expect(canAccessRoute(null, '/administrator-help')).toBeTruthy()
})

test('anonimo no accede a rutas privadas', () => {
  expect(canAccessRoute(null, '/login')).toBeTruthy()
  expect(canAccessRoute(null, '/admin')).toBeFalsy()
  expect(() => assertCanAccessRoute(null, '/admin')).toThrow()
})
