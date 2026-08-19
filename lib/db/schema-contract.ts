export const requiredTables = [
  'profiles', 'customer_profiles', 'professional_profiles', 'admin_profiles', 'customer_addresses',
  'service_categories', 'service_issue_types', 'service_questions', 'service_question_options', 'diagnosis_rules',
  'service_requests', 'request_answers', 'request_media', 'diagnosis_reports', 'price_options',
  'professional_invitations', 'professional_documents', 'professional_tools', 'professional_service_categories',
  'professional_service_zones', 'professional_availability', 'professional_payment_accounts',
  'jobs', 'job_status_events', 'job_media', 'job_final_reports', 'customer_equipment', 'equipment_service_records',
  'payments', 'payment_events', 'payout_records', 'reviews', 'complaints', 'warranty_claims', 'quality_events',
  'pricing_rules', 'platform_settings', 'admin_audit_logs', 'service_zones', 'professional_training_modules',
  'professional_training_completions', 'notification_events', 'notifications', 'public_receipts', 'receipts'
] as const

export const requiredRlsTables = requiredTables.filter((table) => !['service_categories', 'service_issue_types', 'service_questions', 'service_question_options', 'diagnosis_rules', 'pricing_rules', 'platform_settings'].includes(table))

export function findMissingTables(sql: string): string[] {
  return requiredTables.filter((table) => !new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i').test(sql))
}

export function findMissingRls(sql: string): string[] {
  return requiredRlsTables.filter((table) => !new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql))
}

export function findDuplicateMigrationVersions(filenames: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const name of filenames) {
    const version = name.slice(0, 14)
    if (seen.has(version)) dupes.add(version)
    seen.add(version)
  }
  return [...dupes]
}
