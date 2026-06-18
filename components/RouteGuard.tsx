'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/sessionStore'
import { type Permisos } from '@/lib/permisos'

interface Props {
  permiso: keyof Permisos
  redirectTo?: string
  children: React.ReactNode
}

export function RouteGuard({ permiso, redirectTo = '/', children }: Props) {
  const { _hydrated, localId, permisos } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!_hydrated) return
    if (!localId) { router.push('/login'); return }
    if (permisos && !permisos[permiso]) router.push(redirectTo)
  }, [_hydrated, localId, permisos, permiso, redirectTo])

  if (!_hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!localId) return null
  if (permisos && !permisos[permiso]) return null

  return <>{children}</>
}
