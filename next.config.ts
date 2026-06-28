import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import withPWA from 'next-pwa'

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: false, // control manual del update via banner
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
  navigateFallbackDenylist: [/^\/ayuda/], // página estática, no interceptar con el SW
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
