type TestCase = { name: string; run: () => void | Promise<void> }
const tests: TestCase[] = []

export function test(name: string, run: TestCase['run']) { tests.push({ name, run }) }
export function expect(value: unknown) { return {
  toBe(expected: unknown) { if (value !== expected) throw new Error(`Expected ${String(value)} to be ${String(expected)}`) },
  toEqual(expected: unknown) { const a = JSON.stringify(value); const b = JSON.stringify(expected); if (a !== b) throw new Error(`Expected ${a} to equal ${b}`) },
  toBeGreaterThan(expected: number) { if (typeof value !== 'number' || value <= expected) throw new Error(`Expected ${String(value)} to be > ${expected}`) },
  toBeGreaterThanOrEqual(expected: number) { if (typeof value !== 'number' || value < expected) throw new Error(`Expected ${String(value)} to be >= ${expected}`) },
  toContain(expected: unknown) { if (!Array.isArray(value) && typeof value !== 'string') throw new Error('Value is not containable'); if (!(value as string | unknown[]).includes(expected as never)) throw new Error(`Expected ${String(value)} to contain ${String(expected)}`) },
  toIncludeText(expected: string) { if (typeof value !== 'string' || !value.includes(expected)) throw new Error(`Expected text to include ${expected}; got ${String(value)}`) },
  toBeTruthy() { if (!value) throw new Error(`Expected ${String(value)} to be truthy`) },
  toBeFalsy() { if (value) throw new Error(`Expected ${String(value)} to be falsy`) },
  toThrow() { if (typeof value !== 'function') throw new Error('Value is not a function'); let thrown = false; try { (value as () => void)() } catch { thrown = true } if (!thrown) throw new Error('Expected function to throw') }
} }

export async function run() {
  let passed = 0
  for (const t of tests) {
    try { await t.run(); passed += 1; console.log(`✓ ${t.name}`) }
    catch (error) { console.error(`✗ ${t.name}`); console.error(error); process.exitCode = 1 }
  }
  console.log(`\n${passed}/${tests.length} tests passed`)
  if (passed !== tests.length) process.exit(1)
}
