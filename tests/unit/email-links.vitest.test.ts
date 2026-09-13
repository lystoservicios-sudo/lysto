import { describe, expect, it } from 'vitest'
import { emailJobLinks } from '@/lib/notifications/email-links'

const id = 'a1000000-0000-4000-8000-000000000001'

describe('email job links', () => {
  it('builds only authenticated Lysto destinations', () => {
    expect(emailJobLinks('https://app.lysto.test', id)).toEqual({
      detail: `https://app.lysto.test/app/trabajos/${id}`,
      directions: `https://app.lysto.test/app/trabajos/${id}#agenda`,
      reschedule: `https://app.lysto.test/app/trabajos/${id}#reprogramacion`,
      contact: `https://app.lysto.test/app/trabajos/${id}#contacto`,
      review: `https://app.lysto.test/app/trabajos/${id}/review`
    })
  })

  it.each([
    ['https://user:secret@app.lysto.test', id],
    ['https://app.lysto.test/other', id],
    ['https://app.lysto.test?next=foreign', id],
    ['javascript:alert(1)', id],
    ['https://app.lysto.test', 'not-a-job']
  ])('rejects unsafe input', (origin, jobId) => {
    expect(() => emailJobLinks(origin, jobId)).toThrow()
  })
})
