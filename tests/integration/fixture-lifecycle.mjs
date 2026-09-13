// The race settles even if a broken transport ignores AbortSignal. Every caller
// must also check the setup signal before its next mutation.
export async function boundedFixtureOperation(label, operation, { timeoutMs = 10_000, signal } = {}) {
  if (signal?.aborted) throw new Error(`${label} cancelled`)
  const controller = new AbortController()
  let timer
  let onAbort
  const cancelled = new Promise((_, reject) => {
    onAbort = () => {
      controller.abort()
      reject(new Error(`${label} cancelled`))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`${label} timed out`))
    }, timeoutMs)
  })
  try { return await Promise.race([Promise.resolve().then(() => {
    if (controller.signal.aborted) throw new Error(`${label} cancelled`)
    return operation(controller.signal)
  }), cancelled]) }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export async function runFixtureCleanup(steps, { timeoutMs = 5_000 } = {}) {
  const failures = []
  for (const step of steps) {
    try { await boundedFixtureOperation(step.label, step.run, { timeoutMs }) }
    catch { failures.push(step.label) }
  }
  return failures
}
