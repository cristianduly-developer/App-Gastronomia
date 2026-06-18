'use client'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'

export function SessionGuardProvider({ children }: { children: React.ReactNode }) {
  useSessionGuard()
  useInactivityLogout()
  return <>{children}</>
}
