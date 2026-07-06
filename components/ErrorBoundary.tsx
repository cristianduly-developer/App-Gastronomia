'use client'
import { Component, ReactNode } from 'react'
import { reportarError } from '@/lib/reportarError'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportarError(error, { pantalla: typeof window !== 'undefined' ? window.location.pathname : '', accion: 'error_boundary', metadata: { componentStack: info?.componentStack } })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: '32px 24px', textAlign: 'center', background: '#030712' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f9fafb', marginBottom: 8 }}>Algo salió mal</div>
        <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24, maxWidth: 280 }}>
          Ocurrió un error inesperado. Podés intentar recargar la app.
        </div>
        <button onClick={() => window.location.reload()}
          style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          Recargar app
        </button>
      </div>
    )
  }
}
