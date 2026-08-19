import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lysto | Servicios técnicos verificados',
  description: 'Técnicos verificados para resolver problemas de aire acondicionado en tu hogar.'
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  )
}
