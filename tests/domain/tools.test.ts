import { test, expect } from '../_lib/test.ts'
import { calculateToolCompleteness, requiredAirConditioningTools } from '../../lib/professional/tool-checklist.ts'

test('herramientas completas aprueban score 10', () => {
  const result = calculateToolCompleteness(Object.fromEntries(requiredAirConditioningTools.map((tool) => [tool, true])))
  expect(result.score).toBe(10)
  expect(result.approved).toBeTruthy()
})

test('muchas herramientas faltantes no aprueban', () => {
  const result = calculateToolCompleteness({ vacuum_pump: true, multimeter: true })
  expect(result.approved).toBeFalsy()
  expect(result.missing.length).toBeGreaterThan(2)
})
