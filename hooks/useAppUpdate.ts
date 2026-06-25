'use client'
import { useEffect, useState } from 'react'

export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const checkWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) setUpdateReady(true)
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      checkWaiting(reg)
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        if (!newSW) return
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateReady(true)
          }
        })
      })
    })

    // Chequear updates cada 60 segundos
    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const aplicarUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    })
    setTimeout(() => window.location.reload(), 800)
  }

  return { updateReady, aplicarUpdate }
}
