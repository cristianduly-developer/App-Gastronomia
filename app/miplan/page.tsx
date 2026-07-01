'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'

const PLANES_META: Record<string, { label: string; color: string; emoji: string }> = {
  basico:      { label: 'Básico',      color: '#6b7280', emoji: '⚡' },
  profesional: { label: 'Profesional', color: '#7c3aed', emoji: '🚀' },
  premium:     { label: 'Premium',     color: '#d97706', emoji: '💎' },
  sincargo:    { label: 'Sin cargo',   color: '#16a34a', emoji: '🎁' },
  demo:        { label: 'Demo',        color: '#7c3aed', emoji: '🎁' },
}

function fmt(n: number) { return '$' + Number(n).toLocaleString('es-AR') }

export default function MiPlanPage() {
  const router = useRouter()
  const { plan: planActual, estadoSuscripcion, diasRestantes } = useSession()
  const meta = PLANES_META[planActual ?? 'basico'] ?? PLANES_META.basico

  const [planesDB,       setPlanesDB]       = useState<any[]>([])
  const [planSel,        setPlanSel]        = useState('profesional')
  const [vistaUpgrade,   setVistaUpgrade]   = useState(false)
  const [cargando,       setCargando]       = useState(false)
  const [cancelando,     setCancelando]     = useState(false)
  const [confirmarCancel,setConfirmarCancel]= useState(false)
  const [mpPreapproval,  setMpPreapproval]  = useState<string | null>(null)
  const [fechaVenc,      setFechaVenc]      = useState<string | null>(null)
  const [error,          setError]          = useState('')

  useEffect(() => {
    fetch('/api/planes-precios').then(r => r.json()).then(data => {
      if (data.planes?.length) {
        const ordenados = ['basico', 'profesional', 'premium'].map(id => {
          const row = data.planes.find((p: any) => p.plan === id)
          if (!row) return null
          return { id, ...PLANES_META[id], precio: fmt(row.precio_mensual), beneficios: row.beneficios || [] }
        }).filter(Boolean)
        setPlanesDB(ordenados)
      }
    }).catch(() => {})

    const cargarSub = async () => {
      const { data: { session } } = await supabaseApp.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/verificar-acceso?email=${encodeURIComponent(session.user.email ?? '')}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.acceso?.mp_preapproval_id) setMpPreapproval(data.acceso.mp_preapproval_id)
      if (data.acceso?.fecha_vencimiento)  setFechaVenc(data.acceso.fecha_vencimiento)
    }
    cargarSub()
  }, [])

  const iniciarUpgrade = async () => {
    setCargando(true); setError('')
    const { data: { session } } = await supabaseApp.auth.getSession()
    if (!session) { setError('Sesión expirada. Volvé a ingresar.'); setCargando(false); return }
    try {
      const res = await fetch('/api/mp-crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: planSel }),
      })
      const data = await res.json()
      if (!res.ok || !data.init_point) { setError(data.error || 'Error al iniciar el pago.'); setCargando(false); return }
      window.location.href = data.init_point
    } catch { setError('Error de conexión. Intentá de nuevo.'); setCargando(false) }
  }

  const cancelarSuscripcion = async () => {
    setCancelando(true); setError('')
    const { data: { session } } = await supabaseApp.auth.getSession()
    if (!session) { setError('Sesión expirada.'); setCancelando(false); return }
    try {
      const res = await fetch('/api/mp-cancelar-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al cancelar.'); setCancelando(false); setConfirmarCancel(false); return }
      setMpPreapproval(null)
      setConfirmarCancel(false)
    } catch { setError('Error de conexión.') }
    setCancelando(false)
  }

  const planesUpgrade = planesDB.filter(p => p.id !== planActual)

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-300">
            ←
          </button>
          <h1 className="text-lg font-bold">Mi plan</h1>
        </div>

        {/* Plan actual */}
        <div className="rounded-2xl p-5 mb-4 border-2" style={{ borderColor: meta.color, background: meta.color + '12' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: meta.color }}>Plan actual</div>
          <div className="text-2xl font-black mb-3" style={{ color: meta.color }}>{meta.emoji} {meta.label}</div>

          {estadoSuscripcion === 'demo' && (
            <div className="text-sm text-amber-400 font-semibold mb-2">
              🎁 Demo — {diasRestantes != null ? `${diasRestantes} días restantes` : 'activa'}
            </div>
          )}
          {fechaVenc && estadoSuscripcion === 'activo' && (
            <div className="text-sm text-gray-300 mb-2">
              🔄 Próxima renovación: <strong>{new Date(fechaVenc).toLocaleDateString('es-AR')}</strong>
            </div>
          )}

          {mpPreapproval ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" /> Débito automático activo
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 rounded-full bg-gray-600" /> Sin débito automático
            </div>
          )}
        </div>

        {/* Acciones */}
        {!vistaUpgrade && (
          <div className="flex flex-col gap-3 mb-4">
            <button onClick={() => setVistaUpgrade(true)}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm bg-violet-700 active:scale-95 transition-all">
              ⬆️ Cambiar plan
            </button>
            {mpPreapproval && (
              <button onClick={() => setConfirmarCancel(true)}
                className="w-full py-3 rounded-2xl font-semibold text-red-400 text-sm border border-red-900 active:scale-95 transition-all">
                Cancelar débito automático
              </button>
            )}
          </div>
        )}

        {/* Vista upgrade */}
        {vistaUpgrade && (
          <div>
            <button onClick={() => setVistaUpgrade(false)} className="text-violet-400 text-sm font-bold mb-4 flex items-center gap-1">← Volver</button>
            <div className="text-base font-bold mb-1">Cambiar plan</div>
            <div className="text-sm text-gray-400 mb-4">Se activa de inmediato con débito automático mensual.</div>

            {planesUpgrade.map((p: any) => (
              <div key={p.id} onClick={() => setPlanSel(p.id)}
                className="rounded-2xl p-4 mb-3 cursor-pointer border-2 transition-all"
                style={{ borderColor: planSel === p.id ? p.color : '#1f2937', background: planSel === p.id ? p.color + '12' : '#111827' }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-base" style={{ color: p.color }}>{p.label}</span>
                  <span className="font-black text-white">{p.precio}<span className="text-gray-400 font-normal text-xs">/mes</span></span>
                </div>
                {p.beneficios?.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.beneficios.map((b: string, i: number) => (
                      <li key={i} className="text-xs text-gray-300 flex items-center gap-1.5">
                        <span style={{ color: p.color }}>✓</span> {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}

            <div className="bg-violet-950/50 border border-violet-800 rounded-xl p-3 mb-4 text-xs text-violet-300">
              💳 El pago se procesa por <strong>Mercado Pago</strong>. Se renueva automáticamente cada mes.
            </div>

            {error && <div className="text-red-400 text-xs bg-red-950/40 border border-red-800 rounded-xl p-3 mb-3">{error}</div>}

            <button onClick={iniciarUpgrade} disabled={cargando}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm mb-3 disabled:opacity-60"
              style={{ background: '#7c3aed' }}>
              {cargando ? 'Redirigiendo...' : `Suscribirme — Plan ${planesDB.find(p => p.id === planSel)?.label ?? planSel}`}
            </button>
          </div>
        )}

        {/* Confirmar cancelación */}
        {confirmarCancel && (
          <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-800">
              <h3 className="text-base font-bold text-white mb-2">¿Cancelar débito automático?</h3>
              <p className="text-gray-400 text-sm mb-5">
                Tu acceso continúa hasta el vencimiento. Después tendrás que reactivar manualmente.
              </p>
              {error && <div className="text-red-400 text-xs mb-3">{error}</div>}
              <div className="flex gap-3">
                <button onClick={() => setConfirmarCancel(false)} className="flex-1 py-3 rounded-xl text-gray-400 border border-gray-700 text-sm">
                  No, mantener
                </button>
                <button onClick={cancelarSuscripcion} disabled={cancelando}
                  className="flex-1 py-3 rounded-xl bg-red-700 text-white font-bold text-sm disabled:opacity-60">
                  {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
