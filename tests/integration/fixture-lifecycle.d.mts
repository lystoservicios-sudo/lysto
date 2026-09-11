export function boundedFixtureOperation<T>(label: string, operation: (signal: AbortSignal) => PromiseLike<T> | T, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<T>
export function runFixtureCleanup(steps: Array<{ label: string; run: (signal: AbortSignal) => PromiseLike<unknown> | unknown }>, options?: { timeoutMs?: number }): Promise<string[]>
