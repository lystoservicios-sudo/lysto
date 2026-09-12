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
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <Link href="/" className="text-xl font-bold text-blue-700">
        Lysto
      </Link>
      {children}
    </main>
  )
}
