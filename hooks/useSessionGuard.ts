'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseApp } from '@/lib/supabaseApp'
import { useSession } from '@/lib/sessionStore'
import { getPermisos, type RolSistema } from '@/lib/permisos'
import { type Plan } from '@/lib/planLimits'

export function useSessionGuard() {
  const { setSession, clearSession, setHydrated } = useSession()
  const router = useRouter()

  useEffect(() => {
    const syncSession = async () => {
      const { data: { session } } = await supabaseApp.auth.getSession()

      if (!session) {
        clearSession()
        setHydrated()
        return
      }

      const meta = session.user.app_metadata ?? {}
      let localId: string | null = meta.local_id ?? null
      const plan: Plan | null = meta.plan ?? null
      let isOwner: boolean = meta.is_owner ?? false
      let rolSistema: RolSistema = isOwner ? 'owner' : (meta.rol ?? 'cajero')

      // Si no tiene local_id en app_metadata, puede ser un colaborador que ingresó
      // con Google antes de que el owner lo agregara al sistema central.
      // Buscar en la tabla colaboradores por email.
      if (!localId && session.user.email) {
        const { data: colab } = await supabaseApp
          .from('colaboradores')
          .select('local_id, rol, activo')
          .eq('email', session.user.email.toLowerCase())
          .eq('activo', true)
          .maybeSingle()
        if (colab) {
          localId = colab.local_id
          isOwner = false
          rolSistema = colab.rol as RolSistema
        }
      }

      // Si es colaborador, verificar que su rol en DB sea el correcto (puede haber cambiado)
      if (!isOwner && localId && session.user.email) {
        const { data: colab } = await supabaseApp
          .from('colaboradores')
          .select('rol, activo')
          .eq('local_id', localId)
          .eq('email', session.user.email.toLowerCase())
          .maybeSingle()
        if (colab) {
          if (!colab.activo) {
            clearSession()
            setHydrated()
            router.push('/login')
            return
          }
          rolSistema = colab.rol as RolSistema
        }
      }

      // Si es mozo, cargar sus mesas asignadas
      let mesasAsignadas: string[] | null = null
      if (!isOwner && rolSistema === 'mozo' && localId && session.user.email) {
        const { data: colab } = await supabaseApp
          .from('colaboradores')
          .select('mesas_asignadas')
          .eq('email', session.user.email.toLowerCase())
          .eq('local_id', localId)
          .maybeSingle()
        mesasAsignadas = colab?.mesas_asignadas ?? null
      }

      // Cargar flags de config del local
      let usaMesas = false, usaDelivery = false, usaCocina = false, usaQr = false
      let nombreNegocio: string | null = null
      let onboardingCompleto = false
      if (localId) {
        const { data: cfg } = await supabaseApp
          .from('config_local')
          .select('nombre_negocio, onboarding_completo, usa_mesas, usa_delivery, usa_cocina, usa_qr')
          .eq('local_id', localId)
          .maybeSingle()
        if (cfg) {
          nombreNegocio = cfg.nombre_negocio ?? null
          onboardingCompleto = cfg.onboarding_completo ?? false
          usaMesas = cfg.usa_mesas ?? false
          usaDelivery = cfg.usa_delivery ?? false
          usaCocina = cfg.usa_cocina ?? false
          usaQr = cfg.usa_qr ?? false
        }
      }

      setSession({
        localId,
        plan,
        nombreNegocio,
        onboardingCompleto,
        rol: isOwner ? 'owner' : 'colaborador',
        rolSistema,
        permisos: getPermisos(rolSistema),
        mesasAsignadas,
        usaMesas,
        usaDelivery,
        usaCocina,
        usaQr,
        _hydrated: true,
      })
      setHydrated()
    }

    syncSession()

    // Re-verificar cada 5 minutos (plan, estado suscripción, permisos)
    const interval = setInterval(syncSession, 5 * 60 * 1000)

    const { data: { subscription } } = supabaseApp.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSession()
        const path = window.location.pathname
        if (!path.startsWith('/menu') && !path.startsWith('/delivery') && !path.startsWith('/ayuda')) {
          router.push('/login')
        }
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        syncSession()
      }
    })

    return () => {
      clearInterval(interval)
      subscription.unsubscribe()
    }
  }, [])
}
