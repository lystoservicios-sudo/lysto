const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export type PlaywrightCoverage = { files: readonly string[]; projects: readonly string[] }
export function verifyPlaywrightCoverage(list: unknown, execution: unknown | undefined, requirements: PlaywrightCoverage): number {
  const listedCount = verifyPlaywrightReport(list, true)
  if (new Set(requirements.files).size !== requirements.files.length || new Set(requirements.projects).size !== requirements.projects.length || (requirements.files.length > 0 && requirements.projects.length === 0)) throw new Error('Invalid mandatory Playwright coverage')
  const identities = (report: unknown) => {
    const cases = new Set<string>()
    const combinations = new Set<string>()
    const visit = (suites: unknown[]) => {
      for (const suite of suites) {
        if (!object(suite)) throw new Error('Invalid suite identity')
        if (Array.isArray(suite.specs)) for (const spec of suite.specs) {
          if (!object(spec) || typeof spec.file !== 'string' || typeof spec.id !== 'string' || !spec.id || !Array.isArray(spec.tests)) throw new Error('Every test requires its discovered file and stable case ID')
          const file = spec.file.replaceAll('\\', '/').replace(/^.*\/tests\/e2e\//, '').replace(/^tests\/e2e\//, '')
          for (const test of spec.tests) {
            if (!object(test) || typeof test.projectName !== 'string' || !test.projectName) throw new Error('Every test requires a browser project identity')
            const identity = JSON.stringify([file, spec.id, test.projectName])
            if (cases.has(identity)) throw new Error('Duplicate Playwright test identity')
            cases.add(identity)
            combinations.add(JSON.stringify([file, test.projectName]))
          }
        }
        if (Array.isArray(suite.suites)) visit(suite.suites)
      }
    }
    if (!object(report) || !Array.isArray(report.suites)) throw new Error('Missing Playwright suites')
    visit(report.suites)
    for (const file of requirements.files) for (const project of requirements.projects) if (!combinations.has(JSON.stringify([file, project]))) throw new Error(`Missing mandatory Playwright coverage: ${file} (${project})`)
    return cases
  }
  const listed = identities(list)
  if (execution !== undefined) {
    const executedCount = verifyPlaywrightReport(execution, false)
    const executed = identities(execution)
    if (listedCount !== executedCount || listed.size !== executed.size || [...listed].some(id => !executed.has(id))) throw new Error('Playwright execution differs from the discovered test identities')
  }
  return listedCount
}

export function assertStagingTarget(env: Record<string, string | undefined>, identity: unknown): { origin: string; projectRef: string } {
  if (!object(identity) || identity.production !== false || identity.environment !== 'staging' || env.APP_ENV !== 'staging' || env.MERCADOPAGO_MODE !== 'test' || typeof identity.origin !== 'string' || typeof identity.projectRef !== 'string' || !/^[a-z]{20}$/.test(identity.projectRef) || !Array.isArray(identity.testResources) || identity.testResources.length < 3 || identity.testResources.some(item => typeof item !== 'string' || !item.trim()) || new Set(identity.testResources).size !== identity.testResources.length) throw new Error('Explicit approved staging identity and QA resources required')
  const origin = new URL(env.LYSTO_E2E_BASE_URL ?? '')
  const database = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  const cleanOrigin = (url: URL) => url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (!cleanOrigin(origin) || !cleanOrigin(database) || origin.origin !== identity.origin || database.origin !== `https://${identity.projectRef}.supabase.co`) throw new Error('Staging URL or Supabase project is not allowlisted')
  return { origin: origin.origin, projectRef: identity.projectRef }
}

export function verifyPlaywrightReport(report: unknown, listOnly: boolean): number {
  if (!object(report) || !Array.isArray(report.suites) || (Array.isArray(report.errors) && report.errors.length > 0)) throw new Error('Missing or failed Playwright report')
  const tests: Record<string, unknown>[] = []
  const visit = (suites: unknown[]) => {
    for (const suite of suites) {
      if (!object(suite)) throw new Error('Invalid suite evidence')
      if (Array.isArray(suite.specs)) for (const spec of suite.specs) {
        if (!object(spec) || !Array.isArray(spec.tests)) throw new Error('Invalid test evidence')
        for (const test of spec.tests) { if (!object(test)) throw new Error('Invalid test record'); tests.push(test) }
      }
      if (Array.isArray(suite.suites)) visit(suite.suites)
    }
  }
  visit(report.suites)
  if (tests.length === 0) throw new Error('Zero Playwright tests cannot pass')
  if (!listOnly) {
    if (!object(report.stats) || report.stats.expected !== tests.length || report.stats.unexpected !== 0 || report.stats.flaky !== 0 || report.stats.skipped !== 0) throw new Error('Playwright has failed, omitted or inconsistent cases')
    for (const test of tests) if (!Array.isArray(test.results) || test.results.length === 0 || test.results.some(result => !object(result) || result.status !== 'passed')) throw new Error('Every Playwright test must actually execute and pass')
  }
  return tests.length
}
