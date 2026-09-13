import type { NextConfig } from 'next'

function supabaseBrowserOrigins() {
  try {
    const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    if (!['http:', 'https:'].includes(endpoint.protocol)) return []
    const websocketProtocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'
    return [endpoint.origin, `${websocketProtocol}//${endpoint.host}`]
  } catch {
    return []
  }
}

const nextConfig: NextConfig = {
  distDir: process.env.LYSTO_BUILD_DIR ?? '.next',
  // Keep page-generation workers bounded on developer machines and CI runners.
  experimental: { cpus: 2 },
  // The package includes a generated Prisma client and filesystem migrations.
  // Let Node load it intact instead of treating migration directories as assets.
  serverExternalPackages: ['@waltergaltieri/mercadopago-split', 'pg'],
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      [
        "script-src 'self' 'unsafe-inline'",
        ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'"] : []),
        'https://sdk.mercadopago.com'
      ].join(' '),
      [
        "connect-src 'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        ...supabaseBrowserOrigins(),
        'https://api.mercadopago.com'
      ].join(' '),
      'frame-src https://www.mercadopago.com https://*.mercadopago.com',
      ["img-src 'self' data: blob: https:", ...supabaseBrowserOrigins()].join(' '),
      "style-src 'self' 'unsafe-inline'",
      "form-action 'self' https://www.mercadopago.com https://*.mercadopago.com",
      ...(process.env.APP_ENV === 'production' ? ['upgrade-insecure-requests'] : [])
    ].join('; ')
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' }
        ]
      }
    ]
  }
}

export default nextConfig
