import type { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin
  return ['', '/solucion', '/nosotros', '/contacto'].map(path => ({ url: `${origin}${path}`, changeFrequency: 'monthly' as const, priority: path === '' ? 1 : .8 }))
}
