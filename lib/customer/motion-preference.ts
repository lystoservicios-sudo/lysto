/** OS accessibility settings always win over an app preference. */
export function isCustomerMotionReduced() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.lystoReduceMotion === 'true' || document.querySelector('[data-client-reduce-motion="true"]') !== null
}
export function subscribeCustomerMotionPreference(changed: () => void) {
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener?.('change', changed)
  window.addEventListener('lysto:motion-change', changed)
  return () => { media?.removeEventListener?.('change', changed); window.removeEventListener('lysto:motion-change', changed) }
}
