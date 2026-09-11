import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Comprobante no disponible',
  robots: { index: false, follow: false }
}

// Reopened by T22 only after validating the persisted token and public projection.
export default function PublicReceiptPage() {
  notFound()
}
