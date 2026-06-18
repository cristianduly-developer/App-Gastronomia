'use client'
import { useSession } from '@/lib/sessionStore'
import { getPermisos } from '@/lib/permisos'

export function usePermisos() {
  const { permisos, rolSistema } = useSession()
  return permisos ?? getPermisos(rolSistema ?? 'owner')
}
