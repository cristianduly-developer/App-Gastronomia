'use client'

import { useEffect } from 'react'
import { reportarError } from '../lib/reportarError'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportarError(error, { pantalla: typeof window !== 'undefined' ? window.location.pathname : null })
  }, [error])

  return (
    <html>
      <body style={{ fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, background: '#f9fafb' }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 400 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>⚠️</p>
          <h2 style={{ color: '#111827', marginBottom: 8 }}>Ocurrió un inconveniente inesperado</h2>
          <p style={{ color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
            El problema ya fue reportado automáticamente. Si vuelve a ocurrir, comunicate con nosotros.
          </p>
          <button onClick={reset} style={{
            background: '#ea580c', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Intentar de nuevo</button>
        </div>
      </body>
    </html>
  )
}
