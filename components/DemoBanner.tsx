'use client'
import { useSession } from '@/lib/sessionStore'

export function DemoBanner() {
  const { estadoSuscripcion, diasRestantes } = useSession()

  if (estadoSuscripcion !== 'demo') return null

  return (
    <div className="w-full bg-amber-500 text-amber-950 text-center text-sm font-medium py-1.5 px-4">
      Modo demo — quedan {diasRestantes ?? 0} día{diasRestantes !== 1 ? 's' : ''}
    </div>
  )
}
