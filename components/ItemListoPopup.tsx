'use client'
import { useEffect, useState } from 'react'
import { useItemsListos } from '@/context/ItemsListosContext'

export function ItemListoPopup() {
  const { nuevoListo, cerrar } = useItemsListos()
  const [progreso, setProgreso] = useState(100)

  useEffect(() => {
    if (!nuevoListo) return
    setProgreso(100)
    const inicio = Date.now()
    const duracion = 6000
    const interval = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - inicio) / duracion) * 100)
      setProgreso(pct)
      if (pct === 0) { clearInterval(interval); cerrar() }
    }, 50)
    return () => clearInterval(interval)
  }, [nuevoListo])

  if (!nuevoListo) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-green-900 border border-green-700 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div>
              <p className="text-sm font-bold text-green-200">¡Listo para servir!</p>
              <p className="text-base font-semibold text-white mt-0.5">
                {nuevoListo.cantidad}× {nuevoListo.nombre}
              </p>
              <p className="text-sm text-green-300 mt-0.5">Mesa {nuevoListo.mesa_nombre}</p>
            </div>
          </div>
          <button onClick={cerrar} className="text-green-400 hover:text-white transition text-lg leading-none mt-0.5">✕</button>
        </div>
      </div>
      <div className="h-1 bg-green-950">
        <div className="h-full bg-green-400 transition-all duration-100" style={{ width: `${progreso}%` }} />
      </div>
    </div>
  )
}
