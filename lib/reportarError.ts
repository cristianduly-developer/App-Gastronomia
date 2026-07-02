const SAAS_URL = 'https://saas.solucionesmdp.com.ar'
const APP_ID   = 'app-gastronomia'

export function reportarError(error: unknown, contexto: Record<string, unknown> = {}) {
  try {
    const err = error instanceof Error ? error : new Error(String(error))
    const APP_KEY = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_ERROR_KEY || '')
      : ''
    fetch(`${SAAS_URL}/api/reportar-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-id': APP_ID, 'x-app-key': APP_KEY },
      body: JSON.stringify({
        mensaje:    err.message,
        stack:      err.stack   || null,
        pantalla:   (contexto.pantalla as string)   || (typeof window !== 'undefined' ? window.location.pathname : null),
        accion:     (contexto.accion as string)     || null,
        user_email: (contexto.user_email as string) || null,
        org_id:     (contexto.org_id as string)     || null,
        navegador:  typeof navigator !== 'undefined' ? navigator.userAgent : null,
        dispositivo: typeof navigator !== 'undefined' && /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        metadata:   (contexto.metadata as Record<string, unknown>) || null,
      }),
    }).catch(() => {})
  } catch {}
}
