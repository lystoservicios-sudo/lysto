import type { ReadPage, ReadState } from './read-contracts'
/** Error and empty are deliberately different. Components receive no provider details. */
export async function loadReadPage<T>(
  read: () => Promise<ReadPage<T>>
): Promise<ReadState<ReadPage<T>>> {
  try {
    const page = await read()
    // An exhausted/stale cursor can have no items while earlier rows still exist.
    return page.total === 0 ? { state: 'empty' } : { state: 'ready', data: page }
  } catch {
    return {
      state: 'error',
      message: 'No pudimos cargar los datos. Intentá nuevamente.',
      retryable: true
    }
  }
}
export function mapReadPage<T, U>(page: ReadPage<T>, map: (item: T) => U): ReadPage<U> {
  return { items: page.items.map(map), total: page.total, nextCursor: page.nextCursor }
}
