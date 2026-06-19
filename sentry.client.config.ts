import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,   // 10% de requests para performance tracing
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
  enabled: process.env.NODE_ENV === 'production',
})
