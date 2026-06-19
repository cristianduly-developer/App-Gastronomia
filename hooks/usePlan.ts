'use client'
import { useSession } from '@/lib/sessionStore'
import { getLimites } from '@/lib/planLimits'

export function usePlan() {
  const { plan } = useSession()
  return getLimites(plan)
}
