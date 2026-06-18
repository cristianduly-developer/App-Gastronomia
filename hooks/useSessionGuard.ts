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
      const localId: string | null = meta.local_id ?? null
      const plan: Plan | null = meta.plan ?? null
      const isOwner: boolean = meta.is_owner ?? true
      const rolSistema: RolSistema = isOwner ? 'owner' : (meta.rol ?? 'cajero')

      setSession({
        localId,
        plan,
        rol: isOwner ? 'owner' : 'colaborador',
        rolSistema,
        permisos: getPermisos(rolSistema),
        _hydrated: true,
      })
      setHydrated()
    }

    syncSession()

    const { data: { subscription } } = supabaseApp.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSession()
        router.push('/login')
      }
      if (event === 'SIGNED_IN') {
        syncSession()
      }
    })

    return () => subscription.unsubscribe()
  }, [])
}
