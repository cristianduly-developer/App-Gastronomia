import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import withPWA from 'next-pwa'

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true, // fuerza instalación inmediata del SW corregido
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  navigateFallbackDenylist: [/^\/ayuda/, /^\/menu\//, /^\/delivery\//],
  runtimeCaching: [
    {
      // Páginas públicas: siempre red, nunca cache — para que el SW no interfiera
      urlPattern: /\/(menu|delivery)\//,
      handler: 'NetworkOnly',
    },
  ],
})

const nextConfig: NextConfig = {}

export default withSentryConfig(pwaConfig(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
})
