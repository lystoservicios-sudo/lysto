import { describe, expect, it } from 'vitest'
import { encodeCursor, parsePageInput } from '@/lib/data-access/pagination'
const point = {
  createdAt: '2026-09-11T11:12:13.123456+00:00',
  id: '10000000-0000-4000-8000-000000000001'
}
describe('read-model pagination', () => {
  it('preserves PostgreSQL microseconds and binds the cursor to the query', () => {
    const cursor = encodeCursor(point, 'customer-a:requests:draft')
    expect(parsePageInput({ cursor, pageSize: 100 }, 'customer-a:requests:draft')).toEqual({
      pageSize: 100,
      cursor: point
    })
    expect(() => parsePageInput({ cursor }, 'customer-b:requests:draft')).toThrow()
    expect(() => parsePageInput({ cursor }, 'customer-a:requests:submitted')).toThrow()
  })
  it.each([0, -1, 101, 1.5, Infinity, '25'])('rejects an invalid page size %s', (pageSize) =>
    expect(() => parsePageInput({ pageSize }, 'scope')).toThrow()
  )
  it.each([
    'not-json',
    'x'.repeat(1025),
    Buffer.from('{"v":1,"createdAt":"x","id":"x"}').toString('base64url')
  ])('rejects malformed cursors', (cursor) =>
    expect(() => parsePageInput({ cursor }, 'scope')).toThrow()
  )
  it('rejects unknown controls and supplies a bounded default', () => {
    expect(() => parsePageInput({ offset: 50 }, 'scope')).toThrow()
    expect(parsePageInput({}, 'scope')).toEqual({ pageSize: 25, cursor: null })
  })
})
