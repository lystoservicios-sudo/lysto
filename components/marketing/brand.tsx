export function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`m-brand${inverse ? ' m-brand-inverse' : ''}`}><svg viewBox="0 0 34 38" width="34" height="38" aria-hidden="true"><path d="M9 1a7 7 0 0 1 7 7v16h10a7 7 0 0 1 0 14H9a7 7 0 0 1-7-7V8a7 7 0 0 1 7-7Z" fill="currentColor"/><path d="M16 24v7a7 7 0 0 1-7 7h17a7 7 0 0 0 0-14Z" fill="white" opacity=".17"/></svg><span>lysto<span className="m-brand-dot">.</span></span></span>
}
