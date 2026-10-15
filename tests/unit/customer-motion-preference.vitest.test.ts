import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCustomerMotionReduced, subscribeCustomerMotionPreference } from '@/lib/customer/motion-preference'
afterEach(() => { delete document.documentElement.dataset.lystoReduceMotion; vi.unstubAllGlobals() })
describe('persisted and OS motion preferences', () => {
  it('reduces movement when the saved preference is on even if the OS is not', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    document.documentElement.dataset.lystoReduceMotion = 'true'
    expect(isCustomerMotionReduced()).toBe(true)
  })
  it('never overrides an OS accessibility preference with a saved false', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    document.documentElement.dataset.lystoReduceMotion = 'false'
    expect(isCustomerMotionReduced()).toBe(true)
  })
  it('notifies subscribers of live preference changes and releases listeners', () => {
    const changed = vi.fn(), add = vi.fn(), remove = vi.fn()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: add, removeEventListener: remove }))
    const release = subscribeCustomerMotionPreference(changed)
    window.dispatchEvent(new Event('lysto:motion-change'))
    expect(changed).toHaveBeenCalledTimes(1)
    release(); window.dispatchEvent(new Event('lysto:motion-change'))
    expect(changed).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('change', changed)
  })
})
