'use client'
import { useSessionGuard } from '@/hooks/useSessionGuard'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { usePresencePing } from '@/hooks/usePresencePing'

export function SessionGuardProvider({ children }: { children: React.ReactNode }) {
  useSessionGuard()
  useInactivityLogout()
  usePresencePing()
  return <>{children}</>
}
