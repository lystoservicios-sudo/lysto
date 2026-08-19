export const requiredAirConditioningTools = [
  'vacuum_pump',
  'manifold_r410a_r32',
  'digital_scale',
  'multimeter',
  'clamp_meter',
  'leak_detector',
  'thermometer',
  'ladder',
  'safety_equipment'
] as const

export type ToolCode = typeof requiredAirConditioningTools[number]

export function calculateToolCompleteness(tools: Partial<Record<ToolCode, boolean>>): { score: number; missing: ToolCode[]; approved: boolean } {
  const missing = requiredAirConditioningTools.filter((tool) => !tools[tool])
  const score = Number((((requiredAirConditioningTools.length - missing.length) / requiredAirConditioningTools.length) * 10).toFixed(1))
  return { score, missing, approved: missing.length <= 2 }
}
