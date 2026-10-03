import Link from 'next/link'
import type { ReactNode } from 'react'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Postulación profesional — Lysto',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
}
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-5">
          <Link href="/" className="text-2xl font-black tracking-tight text-blue-700">Lysto</Link>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
            Alta de profesional
          </span>
        </div>
        {children}
      </div>
    </main>
  )
}
