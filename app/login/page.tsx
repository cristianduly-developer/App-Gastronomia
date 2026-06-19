'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getPermisos, type RolSistema } from '@/lib/permisos'
import { type Plan } from '@/lib/planLimits'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setSession } = useSession()
  const router = useRouter()

  useEffect(() => {
    let procesado = false

    const { data: { subscription } } = supabaseApp.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !procesado) {
        procesado = true
        setLoading(true)
        procesarSesion(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const procesarSesion = async (session: { user: { email?: string; id: string }; access_token: string }) => {
    const email = session.user.email ?? ''
    setError(null)

    try {
      const res = await fetch(`/api/verificar-acceso?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()

      if (!res.ok) {
        setError('No tenés acceso a esta aplicación. Contactá al administrador.')
        await supabaseApp.auth.signOut()
        setLoading(false)
        return
      }

      let localId: string
      let plan: Plan
      let rolSistema: RolSistema
      let isOwner: boolean
      let nombreNegocio: string
      let estadoSuscripcion: 'activo' | 'demo' | 'impago' | 'suspendido'
      let diasRestantes: number | null

      if (json.esColab) {
        localId = json.localId
        plan = json.plan ?? 'basico'
        rolSistema = json.rol as RolSistema
        isOwner = false
        nombreNegocio = ''
        estadoSuscripcion = 'activo'
        diasRestantes = null
      } else {
        const acceso = json.acceso
        if (!acceso.tiene_acceso) {
          setError('Sin acceso. Verificá tu suscripción.')
          await supabaseApp.auth.signOut()
          setLoading(false)
          return
        }
        localId = acceso.ret_org_id
        plan = acceso.plan as Plan
        rolSistema = 'owner'
        isOwner = true
        nombreNegocio = acceso.nombre_docente ?? ''
        estadoSuscripcion = acceso.estado
        diasRestantes = acceso.dias_restantes
      }

      // Actualizar JWT con local_id y plan
      await fetch('/api/set-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ localId, plan, userId: session.user.id, isOwner }),
      })

      // Refrescar el JWT del cliente para que RLS vea el nuevo local_id
      await supabaseApp.auth.refreshSession()

      const nombreUsuario = session.user.user_metadata?.full_name
        ?? session.user.user_metadata?.name
        ?? email.split('@')[0]

      setSession({
        localId,
        plan,
        rol: isOwner ? 'owner' : 'colaborador',
        rolSistema,
        permisos: getPermisos(rolSistema),
        nombreNegocio,
        estadoSuscripcion,
        diasRestantes,
        nombreUsuario,
      })

      // Verificar onboarding y cargar flags de módulos
      const { data: config } = await supabaseApp
        .from('config_local')
        .select('onboarding_completo, usa_mesas, usa_delivery, usa_cocina, usa_qr')
        .eq('local_id', localId)
        .maybeSingle()

      if (config) {
        setSession({
          usaMesas:   config.usa_mesas   ?? false,
          usaDelivery: config.usa_delivery ?? false,
          usaCocina:  config.usa_cocina  ?? false,
          usaQr:      config.usa_qr      ?? false,
        })
      }

      if (!config?.onboarding_completo) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('Error al verificar acceso. Intentá de nuevo.')
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabaseApp.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        skipBrowserRedirect: true,
      },
    })
    if (error || !data.url) {
      setError('Error al iniciar sesión con Google.')
      setLoading(false)
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-4xl">🍽️</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GastroApp</h1>
          <p className="text-gray-400 text-sm mt-1">Sistema de gestión gastronómica</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-1">Iniciar sesión</h2>
          <p className="text-gray-400 text-sm mb-6">Ingresá con tu cuenta de Google para continuar</p>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl p-3 text-sm mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-xl py-3 px-4 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? 'Verificando...' : 'Continuar con Google'}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Versión 1.0.0
        </p>
      </div>
    </div>
  )
}
