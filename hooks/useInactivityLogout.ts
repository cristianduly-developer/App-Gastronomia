'use client'
import { useEffect, useRef } from 'react'
import { supabaseApp } from '@/lib/supabaseApp'

const TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos

export function useInactivityLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        supabaseApp.auth.signOut()
      }, TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabaseApp.auth.getSession().then(({ data: { session } }) => {
          if (!session) supabaseApp.auth.signOut()
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach((e) => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}
