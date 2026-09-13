import type { MetadataRoute } from 'next'
export default function robots(): MetadataRoute.Robots {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').origin
  return { rules: { userAgent: '*', allow: '/', disallow: ['/app/', '/admin/', '/pro/', '/api/', '/auth/', '/login', '/registro', '/equipo/', '/completar-perfil', '/actualizar-contrasena', '/recuperar-contrasena'] }, sitemap: `${origin}/sitemap.xml` }
}
