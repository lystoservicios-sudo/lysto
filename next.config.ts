import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: process.env.LYSTO_BUILD_DIR ?? '.next',
  // The package includes a generated Prisma client and filesystem migrations.
  // Let Node load it intact instead of treating migration directories as assets.
  serverExternalPackages: ['@waltergaltieri/mercadopago-split', 'pg'],
}

export default nextConfig
